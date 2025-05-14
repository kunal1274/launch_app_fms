// routes/shelf.routes.js

import express from "express";
import {
  createShelf,
  getAllShelves,
  getArchivedShelves,
  getShelfById,
  updateShelfById,
  deleteShelfById,
  archiveShelfById,
  unarchiveShelfById,
  bulkCreateShelves,
  bulkUpdateShelves,
  bulkDeleteShelves,
} from "../controllers/shelf.controller.js";

const shelfRouter = express.Router();

// ── Bulk operations ───────────────────────
shelfRouter.post("/bulk", bulkCreateShelves);
shelfRouter.put("/bulk", bulkUpdateShelves);
shelfRouter.delete("/bulk", bulkDeleteShelves);

// ── Collection endpoints ──────────────────
shelfRouter.get("/", getAllShelves);
shelfRouter.get("/archived", getArchivedShelves);
shelfRouter.post("/", createShelf);

// ── Single & archive toggles ─────────────
shelfRouter.get("/:shelfId", getShelfById);
shelfRouter.put("/:shelfId", updateShelfById);
shelfRouter.delete("/:shelfId", deleteShelfById);
shelfRouter.patch("/:shelfId/archive", archiveShelfById);
shelfRouter.patch("/:shelfId/unarchive", unarchiveShelfById);

export default shelfRouter;
