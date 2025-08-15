import express from "express";
import {
  authenticateToken,
  authorizeRoles,
} from "../middlewares/auth.middleware.js";
import { getAllAttempts, getAttemptDetails } from "../controllers/attempt.controller.js";

const attemptRoutes = express.Router();

attemptRoutes.get(
  "/getAll",
  authenticateToken,
  authorizeRoles("HR", "ADMIN"),
  getAllAttempts
);

attemptRoutes.get(
  "/:attemptId",
  authenticateToken,
  authorizeRoles("HR", "ADMIN"),
  getAttemptDetails
);

export default attemptRoutes;
