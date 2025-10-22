// routes/inventoryJournal.routes.js

import express from 'express';
import {
  cancelJournal,
  confirmJournal,
  createJournal,
  deleteJournalById,
  getAllJournals,
  getJournalById,
  postJournal,
  reverseJournal,
  updateJournalById,
} from '../controllers/inventJournal.controller.js';

const inventJournalRouter = express.Router();

inventJournalRouter.post('/', createJournal);
inventJournalRouter.get('/', getAllJournals);

// single but no specific action
inventJournalRouter.get('/:journalId', getJournalById);
inventJournalRouter.put('/:journalId', updateJournalById);
inventJournalRouter.delete('/:journalId', deleteJournalById);
// single and more specific action
inventJournalRouter.patch('/:journalId/cancel', cancelJournal);
inventJournalRouter.patch('/:journalId/confirm', confirmJournal);
inventJournalRouter.patch('/:journalId/post', postJournal);
inventJournalRouter.patch('/:journalId/reverse', reverseJournal);

export default inventJournalRouter;
