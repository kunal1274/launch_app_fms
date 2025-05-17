// routes/inventoryJournal.routes.js

import express from "express";
import {
  cancelJournal,
  createJournal,
  deleteJournalById,
  getAllJournals,
  getJournalById,
  postJournal,
  updateJournalById,
} from "../controllers/inventJournal.controller.js";

const inventJournalRouter = express.Router();

inventJournalRouter.post("/", createJournal);
inventJournalRouter.get("/", getAllJournals);

// single
inventJournalRouter.patch("/:journalId/post", postJournal);
inventJournalRouter.patch("/:journalId/cancel", cancelJournal);
inventJournalRouter.get("/:journalId", getJournalById);
inventJournalRouter.put("/:journalId", updateJournalById);
inventJournalRouter.delete("/:journalId", deleteJournalById);

export default inventJournalRouter;
