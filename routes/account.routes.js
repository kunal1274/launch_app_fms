// routes/account.routes.js

import express from "express";
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
} from "../controllers/account.controller.js";

const router = express.Router();

// 1. GET ALL ACCOUNTS
//    Optional: ?includeArchived=true  ?hierarchy=true
router.get("/", getAllAccounts);

// 2. GET ONE ACCOUNT BY ID
router.get("/:id", getAccountById);

// 3. CREATE ONE ACCOUNT
router.post("/", createAccount);

// 4. BULK CREATE ACCOUNTS
router.post("/bulk", bulkCreateAccounts);

// 5. UPDATE ONE ACCOUNT BY ID
router.patch("/:id", updateAccountById);

// 6. BULK UPDATE ACCOUNTS
router.patch("/bulk", bulkUpdateAccounts);

// 7. DELETE (archive) ONE ACCOUNT
router.delete("/:id", deleteAccountById);

// 8. BULK DELETE (archive) ACCOUNTS
router.delete("/bulk", bulkDeleteAccounts);

// 9. ARCHIVE ONE ACCOUNT (alias for delete)
router.patch("/:id/archive", archiveAccountById);

// 10. UNARCHIVE ONE ACCOUNT
router.patch("/:id/unarchive", unarchiveAccountById);

export default router;
