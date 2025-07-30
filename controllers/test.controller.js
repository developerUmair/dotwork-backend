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
      proctoring,
      screenShotFrequency,
      fullScreenForce,
    } = req.body;

    if (
      !testName ||
      !category ||
      !duration ||
      !description ||
      !createdBy ||
      mcqs ||
      !trueFalse ||
      !descriptive ||
      !candidateEmails.length ||
      !accessDeadline ||
      !proctoring ||
      !screenShotFrequency ||
      !fullScreenForce
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
      createdBy: req.user.userId,
      testLink: "will think over it later",
    });

    for (const email of candidateEmails) {
      await sendEmail(
        email,
        "You've have been invited to a Test",
        `<p>Hello,</p>
            <p>You have been invited to take the test: <strong>${testName}</strong></p>
            <p>Access Deadline: ${new Date(
              accessDeadline
            ).toLocaleDateString()}</p>
            <p>Best of Luck!</p>
            `
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
