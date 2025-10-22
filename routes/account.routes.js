// routes/account.routes.js

import express from 'express';
import {
  getAllAccounts,
  getAccountById,
  createAccount,
  bulkCreateAccounts,
  updateAccountById,
  bulkUpdateAccounts,
  deleteAccountById,
  bulkDeleteAccounts,
  archiveAccountById,
  unarchiveAccountById,
  bulkAllDeleteAccounts,
  bulkAllDeleteAccountsCascade,
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet,
  getAccountLedger,
} from '../controllers/account.controller.js';

const ledgerAccountRouter = express.Router();

// 4. BULK CREATE ACCOUNTS
ledgerAccountRouter.post('/bulk', bulkCreateAccounts);
// 6. BULK UPDATE ACCOUNTS
ledgerAccountRouter.patch('/bulk', bulkUpdateAccounts);
// 8. BULK DELETE (archive) ACCOUNTS
ledgerAccountRouter.delete('/bulk', bulkDeleteAccounts);
ledgerAccountRouter.delete('/bulk-all', bulkAllDeleteAccounts);
ledgerAccountRouter.delete('/bulk-all-cascade', bulkAllDeleteAccountsCascade);

// 3. CREATE ONE ACCOUNT
ledgerAccountRouter.post('/', createAccount);
// 1. GET ALL ACCOUNTS
//    Optional: ?includeArchived=true  ?hierarchy=true
ledgerAccountRouter.get('/', getAllAccounts);

// Financial reports
ledgerAccountRouter.get('/trial-balance', getTrialBalance);
ledgerAccountRouter.get('/income-statement', getIncomeStatement);
ledgerAccountRouter.get('/balance-sheet', getBalanceSheet);
ledgerAccountRouter.get('/account-ledger', getAccountLedger);

// 2. GET ONE ACCOUNT BY ID
ledgerAccountRouter.get('/:id', getAccountById);

// 5. UPDATE ONE ACCOUNT BY ID
ledgerAccountRouter.patch('/:id', updateAccountById);

// 7. DELETE (archive) ONE ACCOUNT
ledgerAccountRouter.delete('/:id', deleteAccountById);

// 9. ARCHIVE ONE ACCOUNT (alias for delete)
ledgerAccountRouter.patch('/:id/archive', archiveAccountById);

// 10. UNARCHIVE ONE ACCOUNT
ledgerAccountRouter.patch('/:id/unarchive', unarchiveAccountById);

export default ledgerAccountRouter;
