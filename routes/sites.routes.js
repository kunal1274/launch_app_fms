import express from "express";
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
} from "../controllers/sites.controller.js";
import { cacheMiddleware } from "../middleware/cacheMiddleware.js";

const siteRouter = express.Router();

siteRouter.post("/bulk-create", bulkCreateSites);
siteRouter.put("/bulk-update", bulkUpdateSites);
siteRouter.delete("/bulk-delete", bulkDeleteSites);

siteRouter.post("/", createSite);
siteRouter.get("/", cacheMiddleware, getAllSites);
siteRouter.get("/archived", getArchivedSites);
siteRouter.get("/:siteId", getSiteById);
siteRouter.put("/:siteId", updateSiteById);
siteRouter.delete("/:siteId", deleteSiteById);
siteRouter.patch("/:siteId/archive", archiveSiteById);
siteRouter.patch("/:siteId/unarchive", unarchiveSiteById);

export { siteRouter };
