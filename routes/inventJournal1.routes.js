// routes/inventoryJournal.routes.js

import express from "express";
import {
  createJournal,
  // getAllJournals,
  // getJournalById,
  // updateJournalById,
  // deleteJournalById,
  //postJournal,
  //cancelJournal,
} from "../controllers/inventJournal.controller.js";

const inventJournalRouter1 = express.Router();

// inventJournalRouter.get("/", getAllJournals);
inventJournalRouter1.post("/", createJournal);
// inventJournalRouter.get("/:journalId", getJournalById);
// inventJournalRouter.put("/:journalId", updateJournalById);
// inventJournalRouter.delete("/:journalId", deleteJournalById);
//inventJournalRouter.patch("/:journalId/post", postJournal);
//inventJournalRouter.patch("/:journalId/cancel", cancelJournal);

export default inventJournalRouter1;
