// routes/productDimSize.routes.js

import express from "express";
import {
  createSizeConfig,
  getAllSizeConfigs,
  getArchivedSizeConfigs,
  getSizeConfigById,
  updateSizeConfigById,
  deleteSizeConfigById,
  archiveSizeConfigById,
  unarchiveSizeConfigById,
  bulkCreateSizeConfigs,
  bulkUpdateSizeConfigs,
  bulkDeleteSizeConfigs,
} from "../controllers/productDimSize.controller.js";

const sizeRouter = express.Router();

// Bulk operations first
sizeRouter.post("/bulk", bulkCreateSizeConfigs);
sizeRouter.put("/bulk", bulkUpdateSizeConfigs);
sizeRouter.delete("/bulk", bulkDeleteSizeConfigs);

// Collection endpoints
sizeRouter.get("/", getAllSizeConfigs);
sizeRouter.get("/archived", getArchivedSizeConfigs);
sizeRouter.post("/", createSizeConfig);

// Single-item & archive toggles
sizeRouter.get("/:sizeId", getSizeConfigById);
sizeRouter.put("/:sizeId", updateSizeConfigById);
sizeRouter.delete("/:sizeId", deleteSizeConfigById);
sizeRouter.patch("/:sizeId/archive", archiveSizeConfigById);
sizeRouter.patch("/:sizeId/unarchive", unarchiveSizeConfigById);

export default sizeRouter;
