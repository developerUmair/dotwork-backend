import express from "express";
import {
  authenticateToken,
  authorizeRoles,
} from "../middlewares/auth.middleware.js";
import {
  approveUser,
  createUser,
  getAllUsers,
  getPendingUsers,
  rejectUser,
} from "../controllers/user.controller.js";

const userRoutes = express.Router();

userRoutes.post(
  "/create-user",
  authenticateToken,
  authorizeRoles("ADMIN", "HR"),
  createUser
);

userRoutes.get(
  "/getAll",
  authenticateToken,
  authorizeRoles("ADMIN", "HR"),
  getAllUsers
);
userRoutes.patch(
  "/approve/:userId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  approveUser
);

userRoutes.delete(
  "/reject/:userId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  rejectUser
);

export default userRoutes;
