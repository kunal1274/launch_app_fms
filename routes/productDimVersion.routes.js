// routes/productDimVersion.routes.js

import express from "express";
import {
  createVersionConfig,
  getAllVersionConfigs,
  getArchivedVersionConfigs,
  getVersionConfigById,
  updateVersionConfigById,
  deleteVersionConfigById,
  archiveVersionConfigById,
  unarchiveVersionConfigById,
  bulkCreateVersionConfigs,
  bulkUpdateVersionConfigs,
  bulkDeleteVersionConfigs,
  appendVersionValues,
} from "../controllers/productDimVersion.controller.js";

const versionRouter = express.Router();

// Bulk operations first
versionRouter.post("/bulk", bulkCreateVersionConfigs);
versionRouter.put("/bulk", bulkUpdateVersionConfigs);
versionRouter.delete("/bulk", bulkDeleteVersionConfigs);

// Collection endpoints
versionRouter.get("/", getAllVersionConfigs);
versionRouter.get("/archived", getArchivedVersionConfigs);
versionRouter.post("/", createVersionConfig);

// Single-item & archive toggles
versionRouter.get("/:versionId", getVersionConfigById);
versionRouter.put("/:versionId", updateVersionConfigById);
versionRouter.patch("/:versionId/values", appendVersionValues);
versionRouter.delete("/:versionId", deleteVersionConfigById);
versionRouter.patch("/:versionId/archive", archiveVersionConfigById);
versionRouter.patch("/:versionId/unarchive", unarchiveVersionConfigById);

export default versionRouter;
