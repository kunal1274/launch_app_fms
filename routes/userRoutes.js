import { Router } from "express";
const userRouter = Router();

import {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  createUser,
} from "../controllers/userController.js";

// CREATE
userRouter.post("/", createUser);

// READ ALL
userRouter.get("/", getUsers);

// READ ONE
userRouter.get("/:userId", getUserById);

// UPDATE
userRouter.put("/:userId", updateUser);

// DELETE
userRouter.delete("/:userId", deleteUser);

export default userRouter;
