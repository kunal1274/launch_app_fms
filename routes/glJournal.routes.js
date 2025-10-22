// routes/glJournal.routes.js

import express from 'express';

import * as WF from '../controllers/glWorkflow.controller.js';
import {
  createGLJournal,
  // getAccountLedger,
  // getBalanceSheet,
  // getGLJournalHistory,
  // getGLJournals,
  // getGLJournalsProjection,
  // getIncomeStatement,
  // getTrialBalance,
  // listGLJournalWorkflows,
  postGLJournal,
  postGLJournalFinancial,
} from '../controllers/glJournal.controller.js';

const glJournalRouter = express.Router();

/**
 * @route   POST /api/v1/gl-journals
 * @desc    Create a new General Ledger Journal (balanced)
 * @access  Private (attach auth middleware if available)
 */
glJournalRouter.post('/', createGLJournal);
glJournalRouter.post('/:id/post', postGLJournal);
glJournalRouter.post('/:id/post-financial', postGLJournalFinancial);
/**
 * @route   GET /api/v1/gl-journals
 * @desc    List / filter GL Journals (paginated)
 * @access  Private
 *
 * Query parameters:
 *   - startDate=YYYY-MM-DD
 *   - endDate=YYYY-MM-DD
 *   - accountCode=SALES_REVENUE
 *   - createdBy=alice
 *   - page=1
 *   - limit=20
 */
/*
glJournalRouter.get("/", getGLJournals);
glJournalRouter.get("/projection", getGLJournalsProjection);
// List every journal’s workflow definition
glJournalRouter.get("/workflows", listGLJournalWorkflows);
// Financial reports
glJournalRouter.get("/trial-balance", getTrialBalance);
glJournalRouter.get("/income-statement", getIncomeStatement);
glJournalRouter.get("/balance-sheet", getBalanceSheet);
glJournalRouter.get("/account-ledger", getAccountLedger);

glJournalRouter.post("/:id/post", postGLJournal);

// Get audit history for a single journal
glJournalRouter.get("/:id/history", getGLJournalHistory);
glJournalRouter.patch("/:id/status", changeStatus);

// ───── Workflow ───────────────────────────────────
glJournalRouter.post("/:id/submit", WF.submitForApproval);
glJournalRouter.post("/:id/step/:step/act", WF.actOnApproval);
glJournalRouter.post("/:id/step/:step/delegate", WF.delegateStep);
glJournalRouter.post("/:id/recall", WF.recallSubmission);
*/
export default glJournalRouter;
