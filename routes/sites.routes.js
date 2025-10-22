import express from 'express';
import {
  createSite,
  getAllSites,
  getSiteById,
  updateSiteById,
  deleteSiteById,
  archiveSiteById,
  unarchiveSiteById,
  getArchivedSites,
  bulkCreateSites,
  bulkUpdateSites,
  bulkDeleteSites,
  bulkAllDeleteSites,
  bulkAllDeleteSitesCascade,
} from '../controllers/sites.controller.js';
import { cacheMiddleware } from '../middleware/cacheMiddleware.js';

const siteRouter = express.Router();

siteRouter.post('/bulk', bulkCreateSites);
siteRouter.put('/bulk', bulkUpdateSites);
siteRouter.delete('/bulk', bulkDeleteSites);
siteRouter.delete('/bulk-all', bulkAllDeleteSites);
siteRouter.delete('/bulk-all-cascade', bulkAllDeleteSitesCascade);

siteRouter.post('/', createSite);
siteRouter.get('/', cacheMiddleware, getAllSites);
siteRouter.get('/archived', getArchivedSites);
siteRouter.get('/:siteId', getSiteById);
siteRouter.put('/:siteId', updateSiteById);
siteRouter.delete('/:siteId', deleteSiteById);
siteRouter.patch('/:siteId/archive', archiveSiteById);
siteRouter.patch('/:siteId/unarchive', unarchiveSiteById);

export { siteRouter };
