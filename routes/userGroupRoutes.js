import { Router } from 'express';
const userGroupRouter = Router();

import {
  createUserGroup,
  getUserGroups,
  getUserGroupById,
  updateUserGroup,
  deleteUserGroup,
} from '../controllers/userGroup.controller.js';

// CREATE
userGroupRouter.post('/', createUserGroup);

// READ ALL
userGroupRouter.get('/', getUserGroups);

// READ ONE
userGroupRouter.get('/:groupId', getUserGroupById);

// UPDATE
userGroupRouter.put('/:groupId', updateUserGroup);

// DELETE
userGroupRouter.delete('/:groupId', deleteUserGroup);

export default userGroupRouter;
