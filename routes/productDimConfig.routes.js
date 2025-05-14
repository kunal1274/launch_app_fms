// routes/productDimConfig.routes.js
import express from "express";
import {
  createConfig,
  getAllConfigs,
  getArchivedConfigs,
  getConfigById,
  updateConfigById,
  deleteConfigById,
  archiveConfigById,
  unarchiveConfigById,
  bulkCreateConfigs,
  bulkUpdateConfigs,
  bulkDeleteConfigs,
} from "../controllers/productDimConfig.controller.js";
const configRouter = express.Router();
// bulk first
configRouter.post("/bulk", bulkCreateConfigs);
configRouter.put("/bulk", bulkUpdateConfigs);
configRouter.delete("/bulk", bulkDeleteConfigs);
// collection
configRouter.get("/", getAllConfigs);
configRouter.get("/archived", getArchivedConfigs);
configRouter.post("/", createConfig);
// single & toggles
configRouter.get("/:configId", getConfigById);
configRouter.put("/:configId", updateConfigById);
configRouter.delete("/:configId", deleteConfigById);
configRouter.patch("/:configId/archive", archiveConfigById);
configRouter.patch("/:configId/unarchive", unarchiveConfigById);
export default configRouter;
