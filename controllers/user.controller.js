import mongoose from "mongoose";
import { userRoles } from "../constants/index.js";
import errorHandler from "../middlewares/errorHandler.js";
import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";

export const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return next(new errorHandler("All fields are required", 400));
    }

    if (!userRoles.includes(role)) {
      return next(
        new errorHandler(
          "Invalid role, Only HR and Student can be created",
          400
        )
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new errorHandler("User with this email already exists", 400));
    }
    // create new user
    const newUser = new User({
      name,
      email,
      password,
      role,
      active: true,
      createdBy: req.user.userId,
    });
    await newUser.save();
    res.status(201).json({
      success: true,
      message: `${role} created successfully`,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        active: newUser.active,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPendingUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;
    const query = {
      active: false,
      role: "CANDIDATE",
      name: { $regex: search, $options: "i" },
    };

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select("name email createdAt")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: users,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const approveUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid User ID format.",
      });
    }

    const user = await User.findById(userId);
    if (!user) return next(new errorHandler("User not found", 404));
    if (user.active)
      return next(new errorHandler("User is already active", 400));
    if (!user.emailVerified) {
      return next(new AppError("User email is not verified", 400));
    }
    user.active = true;
    user.role = role || user.role;
    user.createdBy = req.user.userId;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User account activated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const rejectUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return next(new errorHandler("User not found", 404));
    if (user.active)
      return next(new errorHandler("Cannot reject an active user", 400));

    await user.deleteOne();
    res.status(200).json({
      success: true,
      message: "User request rejected and deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
