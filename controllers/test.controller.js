import Test from "../models/Test.model.js";
import AppError from "../utils/AppError.js";
import { sendEmail } from "../utils/sendEmail.js";

export const createTest = async (req, res, next) => {
  try {
    const {
      testName,
      category,
      duration,
      description,
      mcqs,
      trueFalse,
      descriptive,
      accessDeadline,
      enableProctoring,
      screenShotFrequency,
      fullScreenForce,
    } = req.body;

    if (
      !testName ||
      !category ||
      !duration ||
      !description ||
      !Array.isArray(mcqs) ||
      !Array.isArray(trueFalse) ||
      !Array.isArray(descriptive) ||
      !accessDeadline ||
      enableProctoring === undefined ||
      screenShotFrequency === undefined ||
      fullScreenForce === undefined
    ) {
      return next(new AppError("Required fields are missing", 400));
    }

    const slug = Math.random().toString(36).substring(2, 11);
    const testLink = `${process.env.FRONTEND_URL}/test/${slug}`;

    const newTest = await Test.create({
      testName,
      category,
      duration,
      description,
      mcqs,
      trueFalse,
      descriptive,
      candidateEmails: [],
      accessDeadline: new Date(accessDeadline),
      enableProctoring,
      screenShotFrequency,
      fullScreenForce,
      testLink,
      slug,
      createdBy: req.user.userId,
    });

    res.status(201).json({
      status: 201,
      success: true,
      message: "Test created successfully.",
      test: newTest,
    });
  } catch (error) {
    next(error);
  }
};

export const addCandidatesToTest = async (req, res, next) => {
  try {
    const { testId } = req.params;
    const { candidateEmails, accessDeadline } = req.body;

    if (
      !candidateEmails ||
      !Array.isArray(candidateEmails) ||
      candidateEmails.length === 0
    ) {
      return next(new AppError("Candidate emails are required", 400));
    }

    const test = await Test.findById(testId);
    if (!test) {
      return next(new AppError("Test not found", 404));
    }

    const deadlineDate = new Date(accessDeadline);
    if (deadlineDate <= new Date()) {
      return next(new AppError("Access deadline must be in the future", 400));
    }
    // Prevent duplicates by email
    const existingEmails = test.candidates.map((c) => c.email);
    const newCandidates = candidateEmails
      .filter((email) => !existingEmails.includes(email))
      .map((email) => ({ email }));

    if (newCandidates.length === 0) {
      return res.status(200).json({
        status: 200,
        success: true,
        message: "No new candidates to add",
      });
    }

    test.candidates.push(...newCandidates);
    test.accessDeadline = accessDeadline;
    await test.save();

    // Send invitation emails
    for (const email of newCandidates) {
      await sendEmail(
        email.email,
        "You have been invited to a Test",
        "./templates/invite-email.html",
        {
          name: "Candidate",
          testName: test.testName,
          accessDeadline: new Date(test.accessDeadline).toLocaleDateString(),
          loginLink: `${process.env.FRONTEND_URL}/login`,
        }
      );
    }

    res.status(200).json({
      status: 200,
      success: true,
      message: "Candidates added and invitations sent.",
      candidatesAdded: newCandidates.length,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllTests = async (req, res, next) => {
  try {
    const tests = await Test.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      message: "All test fetched successfully.",
      total: tests.length,
      tests,
    });
  } catch (error) {
    next(error);
  }
};

export const getTestDetails = async (req, res, next) => {
  try {
    const { testId } = req.params;
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({
        status: 404,
        success: false,
        message: "Test not found!",
      });
    }

    res.status(200).json({
      status: 200,
      success: true,
      message: "Test details fetched successfully.",
      test,
    });
  } catch (error) {
    next(error);
  }
};

export const getAssignedTestsToCandidate = async (req, res, next) => {
  try {
    const user = req.user; // Get logged-in user details
    if (user.role !== "CANDIDATE") {
      // Ensure the user is a candidate
      return res.status(403).json({
        status: 403,
        success: false,
        message: "Access Denied. Only candidates can access this resource",
      });
    }

    const assignedTests = await Test.find({
      "candidates.email": user.email,
    })
      .select(
        "testName category description duration accessDeadline testLink slug createdAt candidates"
      )
      .sort({ createdAt: -1 });
    const testsWithStatus = assignedTests.map((test) => {
      const candidate = test.candidates.find((c) => c.email === user.email);

      const hasAttempted = candidate ? candidate.hasAttempted : false;

      const { candidates, ...testWithoutCandidates } = test.toObject();

      return {
        ...testWithoutCandidates,
        hasAttempted,
      };
    });

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Assigned tests retrieved successfully.",
      total: testsWithStatus.length,
      tests: testsWithStatus, // Return the modified tests
    });
  } catch (error) {
    next(error); 
  }
};

export const getTestBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const userId = req.user._id;

    const test = await Test.findOne({ slug })
      .populate("createdBy", "name email role")
      .populate("candidates", "name email");

    if (!test) {
      return res.status(404).json({
        success: 404,
        success: false,
        message: "Test not found",
      });
    }

    const isCandidate = test.candidates.some((c) => c.email === req.user.email);
    const isCreator = test.createdBy.toString() === req.user._id.toString();

    if (!isCreator && !isCandidate) {
      return res.status(403).json({
        status: 403,
        success: false,
        message: "You are not authorized to view this test!",
      });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Test fetched successfully by slug",
      test,
    });
  } catch (error) {
    next(error);
  }
};
