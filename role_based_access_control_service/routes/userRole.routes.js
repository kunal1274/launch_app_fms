// routes/userRole.routes.js
import express from 'express';
import {
  createUserRole,
  getAllUserRoles,
  getUserRoleById,
  updateUserRole,
  deleteUserRole,
  assignPermissionsToRole,
  removePermissionsFromRole,
} from '../controllers/userRole.controller.js';

const userRoleRouter = express.Router();

userRoleRouter.post('/', createUserRole);
userRoleRouter.get('/', getAllUserRoles);
userRoleRouter.get('/:id', getUserRoleById);
userRoleRouter.patch('/:id', updateUserRole);
userRoleRouter.delete('/:id', deleteUserRole);

// Additional endpoints for assignment
userRoleRouter.patch('/:roleId/permissions', assignPermissionsToRole);
userRoleRouter.patch('/:roleId/remove-permissions', removePermissionsFromRole);

export default userRoleRouter;
