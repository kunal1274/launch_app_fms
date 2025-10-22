// routes/warehouse.routes.js

import express from 'express';
import {
  createWarehouse,
  getAllWarehouses,
  getWarehouseById,
  updateWarehouseById,
  deleteWarehouseById,
  archiveWarehouseById,
  unarchiveWarehouseById,
  getArchivedWarehouses,
  bulkCreateWarehouses,
  bulkUpdateWarehouses,
  bulkDeleteWarehouses,
  bulkAllDeleteWarehouses,
  bulkAllDeleteWarehousesCascade,
} from '../controllers/warehouse.controller.js';

import { cacheMiddleware } from '../middleware/cacheMiddleware.js';

const whRouter = express.Router();

// ─── Bulk operations first ───────────────────────
whRouter.post('/bulk', bulkCreateWarehouses);
whRouter.put('/bulk', bulkUpdateWarehouses);
whRouter.delete('/bulk', bulkDeleteWarehouses);
whRouter.delete('/bulk-all', bulkAllDeleteWarehouses);
whRouter.delete('/bulk-all-cascade', bulkAllDeleteWarehousesCascade);

// ─── Collection endpoints ────────────────────────
whRouter.get('/', cacheMiddleware, getAllWarehouses);
whRouter.get('/archived', getArchivedWarehouses);
whRouter.post('/', createWarehouse);

// ─── Single‐item endpoints ───────────────────────
whRouter.get('/:warehouseId', getWarehouseById);
whRouter.put('/:warehouseId', updateWarehouseById);
whRouter.delete('/:warehouseId', deleteWarehouseById);

// ─── Archive toggles ────────────────────────────
whRouter.patch('/:warehouseId/archive', archiveWarehouseById);
whRouter.patch('/:warehouseId/unarchive', unarchiveWarehouseById);

export default whRouter;
