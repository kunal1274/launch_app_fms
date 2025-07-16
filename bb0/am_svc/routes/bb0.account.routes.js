// routes/account.routes.js

import express from "express";
import {
  // applyAccountTemplate,
  applyTemplate,
  archiveAccountById,
  bulkAllDeleteAccounts,
  bulkAllDeleteAccountsCascade,
  bulkArchiveAccounts,
  bulkCreateAccounts,
  bulkUpdateAccounts,
  createAccount,
  // createAccountTemplate,
  createTemplate,
  deleteAccountById,
  duplicateAccountById,
  getAccountById,
  getAllAccounts,
  replicateAccountById,
  unarchiveAccountById,
  updateAccountById,
} from "../controllers/bb0.account.controller.js";
// import {
//   getAllAccounts,
//   getAccountById,
//   createAccount,
//   bulkCreateAccounts,
//   updateAccountById,
//   bulkUpdateAccounts,
//   deleteAccountById,
//   bulkDeleteAccounts,
//   archiveAccountById,
//   unarchiveAccountById,
//   bulkAllDeleteAccounts,
//   bulkAllDeleteAccountsCascade,
//   getTrialBalance,
//   getIncomeStatement,
//   getBalanceSheet,
//   getAccountLedger,
// } from "../controllers/account.controller.js";

// const ledgerAccountRouter = express.Router();

// // 4. BULK CREATE ACCOUNTS
// ledgerAccountRouter.post("/bulk", bulkCreateAccounts);
// // 6. BULK UPDATE ACCOUNTS
// ledgerAccountRouter.patch("/bulk", bulkUpdateAccounts);
// // 8. BULK DELETE (archive) ACCOUNTS
// ledgerAccountRouter.delete("/bulk", bulkDeleteAccounts);
// ledgerAccountRouter.delete("/bulk-all", bulkAllDeleteAccounts);
// ledgerAccountRouter.delete("/bulk-all-cascade", bulkAllDeleteAccountsCascade);

// // 3. CREATE ONE ACCOUNT
// ledgerAccountRouter.post("/", createAccount);
// // 1. GET ALL ACCOUNTS
// //    Optional: ?includeArchived=true  ?hierarchy=true
// ledgerAccountRouter.get("/", getAllAccounts);

// // Financial reports
// ledgerAccountRouter.get("/trial-balance", getTrialBalance);
// ledgerAccountRouter.get("/income-statement", getIncomeStatement);
// ledgerAccountRouter.get("/balance-sheet", getBalanceSheet);
// ledgerAccountRouter.get("/account-ledger", getAccountLedger);

// // 2. GET ONE ACCOUNT BY ID
// ledgerAccountRouter.get("/:id", getAccountById);

// // 5. UPDATE ONE ACCOUNT BY ID
// ledgerAccountRouter.patch("/:id", updateAccountById);

// // 7. DELETE (archive) ONE ACCOUNT
// ledgerAccountRouter.delete("/:id", deleteAccountById);

// // 9. ARCHIVE ONE ACCOUNT (alias for delete)
// ledgerAccountRouter.patch("/:id/archive", archiveAccountById);

// // 10. UNARCHIVE ONE ACCOUNT
// ledgerAccountRouter.patch("/:id/unarchive", unarchiveAccountById);

const bb0_ledgerAccountRouter = express.Router();

bb0_ledgerAccountRouter.post("/bulk", bulkCreateAccounts);
bb0_ledgerAccountRouter.patch("/bulk", bulkUpdateAccounts);
bb0_ledgerAccountRouter.patch("/bulk-archive", bulkArchiveAccounts);
bb0_ledgerAccountRouter.delete("/bulk-leaf-delete", bulkAllDeleteAccounts);
bb0_ledgerAccountRouter.delete(
  "/bulk-cascade-delete",
  bulkAllDeleteAccountsCascade
);

// Create a new template
bb0_ledgerAccountRouter.post("/account-templates", createTemplate);

// Apply a template to create an account
bb0_ledgerAccountRouter.post("/account-templates/:id/apply", applyTemplate);
// bb0_ledgerAccountRouter.post("/account-templates", createAccountTemplate);
// bb0_ledgerAccountRouter.post("/apply-template", applyAccountTemplate);

bb0_ledgerAccountRouter.post("/", createAccount);
bb0_ledgerAccountRouter.get("/", getAllAccounts);
bb0_ledgerAccountRouter.get("/:id", getAccountById);
bb0_ledgerAccountRouter.post("/:id/duplicate", duplicateAccountById);
bb0_ledgerAccountRouter.post("/:id/replicate", replicateAccountById);
bb0_ledgerAccountRouter.put("/:id", updateAccountById);
bb0_ledgerAccountRouter.patch("/:id/archive", archiveAccountById);
bb0_ledgerAccountRouter.patch("/:id/unarchive", unarchiveAccountById);
bb0_ledgerAccountRouter.delete("/:id", deleteAccountById);

export default bb0_ledgerAccountRouter;
