// routes/userGlobal.routes.js
import express from 'express';
import {
  createUserGlobal,
  getAllUsersGlobal,
  getUserGlobalById,
  updateUserGlobal,
  deleteUserGlobal,
  assignRolesToUser,
  removeRolesFromUser,
} from '../controllers/userGlobal.controller.js';

const userGlobalRouter = express.Router();

// BASIC CRUD for optional or emergency purpose

userGlobalRouter.post('/', createUserGlobal);
userGlobalRouter.get('/', getAllUsersGlobal);
userGlobalRouter.get('/:id', getUserGlobalById);
userGlobalRouter.patch('/:id', updateUserGlobal);
userGlobalRouter.delete('/:id', deleteUserGlobal);

// Additional endpoints for assignment of user roles
userGlobalRouter.patch('/:userId/roles', assignRolesToUser);
userGlobalRouter.patch('/:userId/remove-roles', removeRolesFromUser);

export default userGlobalRouter;
