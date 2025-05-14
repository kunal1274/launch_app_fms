// routes/bin.routes.js

import express from "express";
import {
  createBin,
  getAllBins,
  getArchivedBins,
  getBinById,
  updateBinById,
  deleteBinById,
  archiveBinById,
  unarchiveBinById,
  bulkCreateBins,
  bulkUpdateBins,
  bulkDeleteBins,
} from "../controllers/bin.controller.js";

const binRouter = express.Router();

// Bulk ops first
binRouter.post("/bulk", bulkCreateBins);
binRouter.put("/bulk", bulkUpdateBins);
binRouter.delete("/bulk", bulkDeleteBins);

// Collection endpoints
binRouter.get("/", getAllBins);
binRouter.get("/archived", getArchivedBins);
binRouter.post("/", createBin);

// Single & archive toggles
binRouter.get("/:binId", getBinById);
binRouter.put("/:binId", updateBinById);
binRouter.delete("/:binId", deleteBinById);
binRouter.patch("/:binId/archive", archiveBinById);
binRouter.patch("/:binId/unarchive", unarchiveBinById);

export default binRouter;
