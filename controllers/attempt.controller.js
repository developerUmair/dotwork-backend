// controllers/attempt.controller.js
import Attempt from "../models/Attempt.model.js";
import Test from "../models/Test.model.js";
import AppError from "../utils/AppError.js";
import { evaluateWithGemini } from "../services/geminiEvaluate.service.js";

/* ---------------- helpers (kept in this file) ---------------- */

const coerceBool = (val) => {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return val;
};

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

const normalizeAnswers = (answersMap = {}, qIndex) => {
  const out = [];
  for (const [qid, raw] of Object.entries(answersMap)) {
    const meta = qIndex.get(String(qid));
    if (!meta) continue;
    out.push({
      questionId: String(qid),
      type: meta.type,
      prompt: meta.prompt,
      marks: meta.marks,
      options: meta.type === "mcq" ? meta.options : undefined,
      answer: meta.type === "trueFalse" ? coerceBool(raw) : raw,
    });
  }
  return out;
};

const fetchTest = async (payload) => {
  const select = "mcqs trueFalse descriptive candidates accessDeadline slug testName";
  if (payload?.slug) return Test.findOne({ slug: payload.slug }).select(select).lean();
  if (payload?._id) return Test.findById(payload._id).select(select).lean();
  return null;
};

const assertSubmissionAllowed = (testDoc, userEmail) => {
  if (!testDoc) throw new AppError("Test not found", 404);

  const deadline = testDoc.accessDeadline ? new Date(testDoc.accessDeadline).getTime() : null;
  if (deadline && deadline < Date.now()) throw new AppError("Access deadline has passed", 400);

  const invited = (testDoc.candidates || []).some((c) => c.email === userEmail);
  if (!invited) throw new AppError("You are not invited to this test", 403);
};

const markHasAttempted = async (testId, email) => {
  await Test.updateOne(
    { _id: testId, "candidates.email": email },
    { $set: { "candidates.$.hasAttempted": true } }
  ).lean();
};

/* ---------------- controller ---------------- */

export const submitTestAttemptFromBody = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return next(new AppError("Not authenticated", 401));
    if (user.role !== "CANDIDATE") return next(new AppError("Only candidates can submit attempts", 403));

    const { test: testPayload, answers, durationSeconds, metadata } = req.body || {};
    if (!testPayload || typeof testPayload !== "object") {
      return next(new AppError("test object is required in body", 400));
    }
    if (!answers || typeof answers !== "object" || !Object.keys(answers).length) {
      return next(new AppError("answers map is required and cannot be empty", 400));
    }

    const testDoc = await fetchTest(testPayload);
    assertSubmissionAllowed(testDoc, user.email);

    const candidateId = user.userId ?? user._id;

    const exists = await Attempt.findOne({ test: testDoc._id, candidate: candidateId })
      .select("_id")
      .lean();
    if (exists) return next(new AppError("You have already submitted this test", 400));

    const qIndex = buildQuestionIndex(testDoc);
    const normalized = normalizeAnswers(answers, qIndex);
    if (!normalized.length) return next(new AppError("No valid answers matched the test questions", 400));

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
        raw: req.body,
      },
      durationSeconds: typeof durationSeconds === "number" ? durationSeconds : undefined,
    });

    await markHasAttempted(testDoc._id, user.email);

    // Evaluate immediately
    let evaluation = null;
    try {
      evaluation = await evaluateWithGemini(attempt);
      attempt.status = "evaluated";
      attempt.evaluation = evaluation;
      await attempt.save();
    } catch (e) {
      return next(new AppError(`Evaluation failed: ${e.message}`, 502));
    }

    return res.status(201).json({
      status: 201,
      success: true,
      message: "Submission received and evaluated",
      attemptId: attempt._id,
      testId: String(testDoc._id),
      evaluation,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return next(new AppError("You have already submitted this test", 400));
    }
    next(err);
  }
};
