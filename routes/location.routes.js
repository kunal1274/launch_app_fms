// routes/location.routes.js

import express from "express";
import {
  createLocation,
  getAllLocations,
  getArchivedLocations,
  getLocationById,
  updateLocationById,
  deleteLocationById,
  archiveLocationById,
  unarchiveLocationById,
  bulkCreateLocations,
  bulkUpdateLocations,
  bulkDeleteLocations,
  bulkAllDeleteLocations,
  bulkAllDeleteLocationsCascade,
} from "../controllers/location.controller.js";

const locationRouter = express.Router();

// ── Bulk operations ─────────────────────────
locationRouter.post("/bulk", bulkCreateLocations);
locationRouter.put("/bulk", bulkUpdateLocations);
locationRouter.delete("/bulk", bulkDeleteLocations);
locationRouter.delete("/bulk-all", bulkAllDeleteLocations);
locationRouter.delete("/bulk-all-cascade", bulkAllDeleteLocationsCascade);

// ── Collection endpoints ────────────────────
locationRouter.get("/", getAllLocations);
locationRouter.get("/archived", getArchivedLocations);
locationRouter.post("/", createLocation);

// ── Single‐item & archive toggles ──────────
locationRouter.get("/:locationId", getLocationById);
locationRouter.put("/:locationId", updateLocationById);
locationRouter.delete("/:locationId", deleteLocationById);
locationRouter.patch("/:locationId/archive", archiveLocationById);
locationRouter.patch("/:locationId/unarchive", unarchiveLocationById);

export default locationRouter;
