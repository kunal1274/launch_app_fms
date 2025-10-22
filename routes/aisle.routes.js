// routes/aisle.routes.js
import express from 'express';
import {
  createAisle,
  getAllAisles,
  getArchivedAisles,
  getAisleById,
  updateAisleById,
  deleteAisleById,
  archiveAisleById,
  unarchiveAisleById,
  bulkCreateAisles,
  bulkUpdateAisles,
  bulkDeleteAisles,
  bulkAllDeleteAisles,
  bulkAllDeleteAislesCascade,
} from '../controllers/aisle.controller.js';

const aisleRouter = express.Router();

// Bulk operations first
aisleRouter.post('/bulk', bulkCreateAisles);
aisleRouter.put('/bulk', bulkUpdateAisles);
aisleRouter.delete('/bulk', bulkDeleteAisles);
aisleRouter.delete('/bulk-all', bulkAllDeleteAisles);
aisleRouter.delete('/bulk-all-cascade', bulkAllDeleteAislesCascade);

// Collection endpoints
aisleRouter.get('/', getAllAisles);
aisleRouter.get('/archived', getArchivedAisles);
aisleRouter.post('/', createAisle);

// Single-item & archive toggles
aisleRouter.get('/:aisleId', getAisleById);
aisleRouter.put('/:aisleId', updateAisleById);
aisleRouter.patch('/:aisleId/archive', archiveAisleById);
aisleRouter.patch('/:aisleId/unarchive', unarchiveAisleById);
aisleRouter.delete('/:aisleId', deleteAisleById);

export default aisleRouter;
