import Attempt from "../models/Attempt.model.js";
import Test from "../models/Test.model.js";
import AppError from "../utils/AppError.js";

/* ------------------------------ helpers ------------------------------ */

/** Coerce 'true'/'false' strings to booleans for TF questions */
const coerceBool = (val) => {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return val;
};

/** Build a question index: questionId -> { type, prompt, marks, options? } */
const buildQuestionIndex = (testDoc) => {
  const ix = new Map();
  for (const q of testDoc.mcqs || []) {
    ix.set(String(q._id), { type: "mcq", prompt: q.question, marks: q.marks, options: q.options });
  }
  for (const q of testDoc.trueFalse || []) {
    ix.set(String(q._id), { type: "trueFalse", prompt: q.question, marks: q.marks });
  }
  for (const q of testDoc.descriptive || []) {
    ix.set(String(q._id), { type: "descriptive", prompt: q.question, marks: q.marks });
  }
  return ix;
};

/** Normalize answers map -> flat array using the question index */
const normalizeAnswers = (answersMap = {}, qIndex) => {
  const out = [];
  for (const [qid, raw] of Object.entries(answersMap)) {
    const meta = qIndex.get(String(qid));
    if (!meta) continue; // ignore unknown ids
    out.push({
      questionId: String(qid),
      type: meta.type,
      prompt: meta.prompt,
      marks: meta.marks,
      options: meta.type === "mcq" ? meta.options : undefined, // only MCQ
      answer: meta.type === "trueFalse" ? coerceBool(raw) : raw,
    });
  }
  return out;
};

/** Fetch authoritative Test by slug or _id with only required fields */
const fetchTest = async (payload) => {
  const select = "mcqs trueFalse descriptive candidates accessDeadline slug testName";
  if (payload?.slug) return Test.findOne({ slug: payload.slug }).select(select).lean();
  if (payload?._id) return Test.findById(payload._id).select(select).lean();
  return null;
};

/** Ensure candidate is invited and deadline not passed */
const assertSubmissionAllowed = (testDoc, userEmail) => {
  if (!testDoc) throw new AppError("Test not found", 404);

  const now = Date.now();
  const deadline = testDoc.accessDeadline ? new Date(testDoc.accessDeadline).getTime() : null;
  if (deadline && deadline < now) throw new AppError("Access deadline has passed", 400);

  const invited = (testDoc.candidates || []).some((c) => c.email === userEmail);
  if (!invited) throw new AppError("You are not invited to this test", 403);
};

/** Mark hasAttempted via positional update */
const markHasAttempted = async (testId, email) => {
  await Test.updateOne(
    { _id: testId, "candidates.email": email },
    { $set: { "candidates.$.hasAttempted": true } }
  ).lean();
};

/** Build a minimal Gemini-ready payload (for later evaluate endpoint) */
export const buildEvaluationPayload = (attempt) => ({
  testId: attempt.submission?.testId,
  slug: attempt.submission?.slug,
  testName: attempt.submission?.testName,
  candidateEmail: attempt.candidateEmail,
  durationSeconds: attempt.durationSeconds ?? null,
  questions: (attempt.submission?.answers || []).map((a) => ({
    id: a.questionId,
    type: a.type,
    prompt: a.prompt,
    options: a.type === "mcq" ? a.options : undefined,
    marks: a.marks ?? null,
  })),
  answers: (attempt.submission?.answers || []).reduce((acc, a) => {
    acc[a.questionId] = a.answer;
    return acc;
  }, {}),
});

/* ------------------------------ controllers ------------------------------ */

/**
 * POST /api/tests/submit
 * Body: { test: <full test object>, answers: { [questionId]: value }, durationSeconds?, metadata? }
 */
export const submitTestAttemptFromBody = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return next(new AppError("Not authenticated", 401));
    if (user.role !== "CANDIDATE") {
      return next(new AppError("Only candidates can submit attempts", 403));
    }

    const { test: testPayload, answers, durationSeconds, metadata } = req.body || {};
    if (!testPayload || typeof testPayload !== "object") {
      return next(new AppError("test object is required in body", 400));
    }
    if (!answers || typeof answers !== "object" || !Object.keys(answers).length) {
      return next(new AppError("answers map is required and cannot be empty", 400));
    }

    // Authoritative test look-up + checks
    const testDoc = await fetchTest(testPayload);
    assertSubmissionAllowed(testDoc, user.email);

    const candidateId = user.userId ?? user._id;

    // Prevent duplicate submission
    const exists = await Attempt.findOne({ test: testDoc._id, candidate: candidateId })
      .select("_id")
      .lean();
    if (exists) return next(new AppError("You have already submitted this test", 400));

    // Normalize answers (now includes prompt + marks; no options for non-MCQ)
    const qIndex = buildQuestionIndex(testDoc);
    const normalized = normalizeAnswers(answers, qIndex);
    if (!normalized.length) {
      return next(new AppError("No valid answers matched the test questions", 400));
    }

    // Create attempt
    const attempt = await Attempt.create({
      test: testDoc._id,
      candidate: candidateId,
      candidateEmail: user.email,
      submission: {
        testId: String(testDoc._id),
        slug: testDoc.slug,
        testName: testDoc.testName,
        metadata: metadata || {},
        answers: normalized,
        raw: req.body, // keep original payload for audit
      },
      durationSeconds:
        typeof durationSeconds === "number" ? durationSeconds : undefined,
    });

    // Mark candidate as hasAttempted
    await markHasAttempted(testDoc._id, user.email);

    return res.status(201).json({
      status: 201,
      success: true,
      message: "Submission received",
      attemptId: attempt._id,
      testId: String(testDoc._id),
    });
  } catch (err) {
    if (err?.code === 11000) {
      return next(new AppError("You have already submitted this test", 400));
    }
    next(err);
  }
};

/**
 * POST /api/tests/attempt/my
 * Body: { slug?: string, testId?: string }
 */
export const getMyAttemptForTestBody = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return next(new AppError("Not authenticated", 401));

    const { slug, testId } = req.body || {};
    const query = slug ? { slug } : testId ? { _id: testId } : null;
    if (!query) return next(new AppError("Provide slug or testId", 400));

    const testRef = await Test.findOne(query).select("_id").lean();
    if (!testRef) return next(new AppError("Test not found", 404));

    const candidateId = user.userId ?? user._id;
    const attempt = await Attempt.findOne({ test: testRef._id, candidate: candidateId }).lean();

    if (!attempt) {
      return res.status(404).json({ success: false, message: "No attempt found" });
    }
    return res.json({ success: true, attempt });
  } catch (err) {
    next(err);
  }
};
