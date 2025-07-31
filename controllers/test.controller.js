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
      createdBy,
      mcqs,
      trueFalse,
      descriptive,
      candidateEmails,
      accessDeadline,
      enableProctoring,
      screenShotFrequency,
      fullScreenForce,
    } = req.body;

    const slug = Math.random().toString(36).substr(2, 9);
    const testLink = `http://localhost:3000/test/${slug}`;

    if (
      !testName ||
      !category ||
      !duration ||
      !description ||
      !Array.isArray(mcqs) ||
      !Array.isArray(trueFalse) ||
      !Array.isArray(descriptive) ||
      !Array.isArray(candidateEmails) ||
      !candidateEmails.length ||
      !accessDeadline ||
      enableProctoring === undefined ||
      screenShotFrequency === undefined ||
      fullScreenForce === undefined
    ) {
      return next(new AppError("Required fields are missing", 400));
    }

    const newTest = await Test.create({
      testName,
      category,
      duration,
      description,
      mcqs,
      trueFalse,
      descriptive,
      candidateEmails,
      accessDeadline,
      enableProctoring,
      screenShotFrequency,
      fullScreenForce,
      testLink,
      slug,
      createdBy: req.user.userId,
    });

    for (const email of candidateEmails) {
      await sendEmail(
        email,
        "You have been invited to a Test",
        "./templates/invite-email.html", // Path relative to root or __dirname
        {
          name: "Candidate",
          testName: testName,
          accessDeadline: new Date(accessDeadline).toLocaleDateString(),
          testLink: testLink,
        }
      );
    }

    res.status(201).json({
      success: true,
      message: "Test created and invitation emails sent successfully.",
      testId: newTest._id,
    });
  } catch (error) {
    next(error);
  }
};
