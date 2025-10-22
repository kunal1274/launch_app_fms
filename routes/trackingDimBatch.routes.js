// routes/batch.routes.js
import express from 'express';
import {
  createBatch,
  getAllBatches,
  getBatchById,
  updateBatchById,
  deleteBatchById,
  bulkCreateBatches,
  bulkUpdateBatches,
  bulkDeleteBatches,
  getArchivedBatches,
  archiveBatchById,
  unarchiveBatchById,
} from '../controllers/trackingDimBatch.controller.js';

const batchRouter = express.Router();

// Bulk operations first
batchRouter.post('/bulk', bulkCreateBatches);
batchRouter.put('/bulk', bulkUpdateBatches);
batchRouter.delete('/bulk', bulkDeleteBatches);

// Collection endpoints
batchRouter.get('/', getAllBatches);
batchRouter.get('/archived', getArchivedBatches);
batchRouter.post('/', createBatch);

// Single-item endpoints
batchRouter.get('/:batchId', getBatchById);
batchRouter.put('/:batchId', updateBatchById);
batchRouter.patch('/:serialId/archive', archiveBatchById);
batchRouter.patch('/:serialId/unarchive', unarchiveBatchById);
batchRouter.delete('/:batchId', deleteBatchById);

export default batchRouter;
