// routes/rack.routes.js

import express from "express";
import {
  createRack,
  getAllRacks,
  getArchivedRacks,
  getRackById,
  updateRackById,
  deleteRackById,
  archiveRackById,
  unarchiveRackById,
  bulkCreateRacks,
  bulkUpdateRacks,
  bulkDeleteRacks,
  bulkAllDeleteRacks,
  bulkAllDeleteRacksCascade,
} from "../controllers/rack.controller.js";

const rackRouter = express.Router();

// ── Bulk ops first ─────────────────────
rackRouter.post("/bulk", bulkCreateRacks);
rackRouter.put("/bulk", bulkUpdateRacks);
rackRouter.delete("/bulk", bulkDeleteRacks);
rackRouter.delete("/bulk-all", bulkAllDeleteRacks);
rackRouter.delete("/bulk-all-cascade", bulkAllDeleteRacksCascade);

// ── Collection endpoints ───────────────
rackRouter.get("/", getAllRacks);
rackRouter.get("/archived", getArchivedRacks);
rackRouter.post("/", createRack);

// ── Single & archive toggles ──────────
rackRouter.get("/:rackId", getRackById);
rackRouter.put("/:rackId", updateRackById);
rackRouter.delete("/:rackId", deleteRackById);
rackRouter.patch("/:rackId/archive", archiveRackById);
rackRouter.patch("/:rackId/unarchive", unarchiveRackById);

export default rackRouter;
