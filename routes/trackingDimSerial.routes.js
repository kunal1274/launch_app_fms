// routes/trackingDimSerial.routes.js
import express from "express";
import {
  createSerial,
  getAllSerials,
  getSerialById,
  updateSerialById,
  deleteSerialById,
  bulkCreateSerials,
  bulkUpdateSerials,
  bulkDeleteSerials,
  getArchivedSerials,
  archiveSerialById,
  unarchiveSerialById,
} from "../controllers/trackingDimSerial.controller.js";

const serialRouter = express.Router();

// Bulk operations first
serialRouter.post("/bulk", bulkCreateSerials);
serialRouter.put("/bulk", bulkUpdateSerials);
serialRouter.delete("/bulk", bulkDeleteSerials);

// Collection endpoints
serialRouter.get("/", getAllSerials);
serialRouter.get("/archived", getArchivedSerials);
serialRouter.post("/", createSerial);

// Single-item endpoints
serialRouter.get("/:serialId", getSerialById);
serialRouter.put("/:serialId", updateSerialById);
serialRouter.patch("/:serialId/archive", archiveSerialById);
serialRouter.patch("/:serialId/unarchive", unarchiveSerialById);
serialRouter.delete("/:serialId", deleteSerialById);

export default serialRouter;
