// routes/zone.routes.js

import express from 'express';
import {
  createZone,
  getAllZones,
  getZoneById,
  updateZoneById,
  deleteZoneById,
  archiveZoneById,
  unarchiveZoneById,
  getArchivedZones,
  bulkCreateZones,
  bulkUpdateZones,
  bulkDeleteZones,
  bulkAllDeleteZones,
  bulkAllDeleteZonesCascade,
} from '../controllers/zone.controller.js';

const zoneRouter = express.Router();

// ── Bulk operations (must come before param routes) ──
zoneRouter.post('/bulk', bulkCreateZones);
zoneRouter.put('/bulk', bulkUpdateZones);
zoneRouter.delete('/bulk', bulkDeleteZones);
zoneRouter.delete('/bulk-all', bulkAllDeleteZones);
zoneRouter.delete('/bulk-all-cascade', bulkAllDeleteZonesCascade);

// ── Collection endpoints ──
zoneRouter.get('/', getAllZones);
zoneRouter.get('/archived', getArchivedZones);
zoneRouter.post('/', createZone);

// ── Single‐item & archive toggles ──
zoneRouter.get('/:zoneId', getZoneById);
zoneRouter.put('/:zoneId', updateZoneById);
zoneRouter.delete('/:zoneId', deleteZoneById);
zoneRouter.patch('/:zoneId/archive', archiveZoneById);
zoneRouter.patch('/:zoneId/unarchive', unarchiveZoneById);

export default zoneRouter;
