import express from "express";
import { createTest } from "../controllers/test.controller.js";
import { authenticateToken, authorizeRoles } from "../middlewares/auth.middleware.js";

const testRoutes = express.Router();

testRoutes.post("/create", authenticateToken, authorizeRoles("HR"), createTest);
// authRoutes.post("/login", login);
// authRoutes.post("/verify-otp", verifyOTP);


export default testRoutes;

