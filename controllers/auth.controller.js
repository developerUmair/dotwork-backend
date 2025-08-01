import errorHandler from "../middlewares/errorHandler.js";
import User from "../models/User.model.js";
import { loginUser } from "../services/auth.service.js";
import AppError from "../utils/AppError.js";
import { sendEmail } from "../utils/sendEmail.js";

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    const result = await loginUser(email, password);

    res.status(200).json({
      status: 200,
      success: true,
      message: "Login successful. Welcome back!",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
};

export const signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return next(new errorHandler("All fields are required", 400));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError("Email already in use", 400));
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 10 * 60 * 10000; // 10 minutes

    const newUser = await User.create({
      name,
      email,
      password,
      role: "CANDIDATE",
      otp,
      otpExpiry,
    });

    await sendEmail(email, "Verify Your Email", "templates/otpTemplate.html", {
      name: newUser.name,
      otp: newUser.otp,
    });
    res.status(201).json({
      status: 201,
      success: true,
      message: "Success! Please verify the OTP sent.",
    });
  } catch (error) {
    next(error);
  }
};

export const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user) return next(new AppError("Invalid Email", 400));

    if (user.emailVerified) {
      return res
        .status(400)
        .json({ succes: false, message: "Email already verified." });
    }
    if (user.otp !== otp || user.otpExpiry < Date.now()) {
      return next(new AppError("Invalid or expired OTP", 400));
    }
    user.emailVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();
    res.status(200).json({
      status: 200,
      succes: true,
      message: "Verified! Admin will approve shortly.",
    });
  } catch (error) {
    next(error);
  }
};
