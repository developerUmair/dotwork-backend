import express from "express";
import {
  addCandidatesToTest,
  createTest,
} from "../controllers/test.controller.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middlewares/auth.middleware.js";

const testRoutes = express.Router();

testRoutes.post("/create", authenticateToken, authorizeRoles("HR"), createTest);
testRoutes.patch(
  "/:testId/add-candidates",
  authenticateToken,
  authorizeRoles("HR"),
  addCandidatesToTest
);
// authRoutes.post("/login", login);
// authRoutes.post("/verify-otp", verifyOTP);

export default testRoutes;
