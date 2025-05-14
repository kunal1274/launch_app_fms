// routes/productDimStyle.routes.js

import express from "express";
import {
  createStyleConfig,
  getAllStyleConfigs,
  getArchivedStyleConfigs,
  getStyleConfigById,
  updateStyleConfigById,
  deleteStyleConfigById,
  archiveStyleConfigById,
  unarchiveStyleConfigById,
  bulkCreateStyleConfigs,
  bulkUpdateStyleConfigs,
  bulkDeleteStyleConfigs,
} from "../controllers/productDimStyle.controller.js";

const styleRouter = express.Router();

// Bulk operations first
styleRouter.post("/bulk", bulkCreateStyleConfigs);
styleRouter.put("/bulk", bulkUpdateStyleConfigs);
styleRouter.delete("/bulk", bulkDeleteStyleConfigs);

// Collection endpoints
styleRouter.get("/", getAllStyleConfigs);
styleRouter.get("/archived", getArchivedStyleConfigs);
styleRouter.post("/", createStyleConfig);

// Single-item & archive toggles
styleRouter.get("/:styleId", getStyleConfigById);
styleRouter.put("/:styleId", updateStyleConfigById);
styleRouter.delete("/:styleId", deleteStyleConfigById);
styleRouter.patch("/:styleId/archive", archiveStyleConfigById);
styleRouter.patch("/:styleId/unarchive", unarchiveStyleConfigById);

export default styleRouter;
