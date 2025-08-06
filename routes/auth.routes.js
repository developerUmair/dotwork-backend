import express from "express";
import {
  login,
  logout,
  signup,
  verifyOTP,
} from "../controllers/auth.controller.js";

const authRoutes = express.Router();

authRoutes.post("/signup", signup);
authRoutes.post("/login", login);
authRoutes.post("/verify-otp", verifyOTP);
authRoutes.post("/logout", logout);

export default authRoutes;
