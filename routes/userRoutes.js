import { Router } from 'express';
import { BaseRoutes } from './base.routes.js';
import {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
} from '../controllers/user.controller.js';

// Create standardized user routes
const userRoutes = new BaseRoutes({
  create: createUser,
  getAll: getUsers,
  getById: getUserById,
  update: updateUser,
  delete: deleteUser,
  getStats: getUserStats,
}, 'User');

// Get the router instance
const userRouter = userRoutes.getRouter();

export default userRouter;
