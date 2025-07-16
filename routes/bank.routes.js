// routes/bank.routes.js

import express from "express";
import {
  getAllBanks,
  getBankById,
  createBank,
  bulkCreateBanks,
  updateBankById,
  bulkUpdateBanks,
  deleteBankById,
  bulkDeleteBanks,
  archiveBankById,
  unarchiveBankById,
  getBankAccountBalance,
} from "../controllers/bank.controller.js";

const router = express.Router();

// 1. GET ALL BANKS
//    Optional query: ?includeArchived=true  ?hierarchy=true
router.get("/", getAllBanks);

// 2. GET ONE BANK BY ID
router.get("/:id", getBankById);

// 3. CREATE ONE BANK
router.post("/", createBank);

// 4. BULK CREATE BANKS
router.post("/bulk", bulkCreateBanks);

// 5. UPDATE ONE BANK BY ID
router.patch("/:id", updateBankById);

// 6. BULK UPDATE BANKS
router.patch("/bulk", bulkUpdateBanks);

// 7. “DELETE” (archive) ONE BANK
router.delete("/:id", deleteBankById);

// 8. BULK DELETE (archive) BANKS
router.delete("/bulk", bulkDeleteBanks);

// 9. ARCHIVE ONE BANK (alias)
router.patch("/:id/archive", archiveBankById);

// 10. UNARCHIVE ONE BANK
router.patch("/:id/unarchive", unarchiveBankById);

router.get("/balance/:id", getBankAccountBalance);

export default router;
