import express from "express";
import {
  login,
  logout,
  signup,
  verifyOTP,
} from "../controllers/auth.controller.js";
import { getCurrentUser } from "../controllers/user.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";

const authRoutes = express.Router();

authRoutes.post("/signup", signup);
authRoutes.post("/login", login);
authRoutes.get("/me", authenticateToken, getCurrentUser);
authRoutes.post("/verify-otp", verifyOTP);
authRoutes.post("/logout", logout);

export default authRoutes;
