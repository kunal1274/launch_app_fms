// routes/productDimColor.routes.js

import express from 'express';
import {
  createColorConfig,
  getAllColorConfigs,
  getArchivedColorConfigs,
  getColorConfigById,
  updateColorConfigById,
  deleteColorConfigById,
  archiveColorConfigById,
  unarchiveColorConfigById,
  bulkCreateColorConfigs,
  bulkUpdateColorConfigs,
  bulkDeleteColorConfigs,
  appendColorValues,
} from '../controllers/productDimColor.controller.js';

const colorRouter = express.Router();

// Bulk operations first
colorRouter.post('/bulk', bulkCreateColorConfigs);
colorRouter.put('/bulk', bulkUpdateColorConfigs);
colorRouter.delete('/bulk', bulkDeleteColorConfigs);

// Collection endpoints
colorRouter.get('/', getAllColorConfigs);
colorRouter.get('/archived', getArchivedColorConfigs);
colorRouter.post('/', createColorConfig);

// Single-item & archive toggles
colorRouter.get('/:colorId', getColorConfigById);
colorRouter.put('/:colorId', updateColorConfigById);
colorRouter.patch('/:colorId/values', appendColorValues); // ← new
colorRouter.delete('/:colorId', deleteColorConfigById);
colorRouter.patch('/:colorId/archive', archiveColorConfigById);
colorRouter.patch('/:colorId/unarchive', unarchiveColorConfigById);

export default colorRouter;
