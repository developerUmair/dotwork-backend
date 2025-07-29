import express from "express";
import { login, signup, verifyOTP } from "../controllers/auth.controller.js";


const authRoutes = express.Router();

authRoutes.post("/signup", signup);
authRoutes.post("/login", login);
authRoutes.post("/verify-otp", verifyOTP);


export default authRoutes;
