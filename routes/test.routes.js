import express from "express";
import {
  addCandidatesToTest,
  createTest,
  getAllTests,
  getTestDetails,
} from "../controllers/test.controller.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middlewares/auth.middleware.js";

const testRoutes = express.Router();

testRoutes.post("/create", authenticateToken, authorizeRoles("HR"), createTest);
testRoutes.patch(
  "/add-candidates/:testId",
  authenticateToken,
  authorizeRoles("HR"),
  addCandidatesToTest
);
testRoutes.get("/getAll", authenticateToken, authorizeRoles("HR"), getAllTests);
testRoutes.get("/:testId", authenticateToken, authorizeRoles("HR"), getTestDetails);
// authRoutes.post("/login", login);
// authRoutes.post("/verify-otp", verifyOTP);

export default testRoutes;
