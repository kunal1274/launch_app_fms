import { Router } from 'express';
import { BaseRoutes } from './base.routes.js';
import userController from '../controllers/user.controller.js';

// Create standardized user routes
const userRoutes = new BaseRoutes(userController, 'User');

// Get the router instance
const userRouter = userRoutes.getRouter();

export default userRouter;
