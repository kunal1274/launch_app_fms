// routes/bank.routes.js

import express from "express";
import {
  // getAllBanks,
  // getBankById,
  createBank,
  // bulkCreateBanks,
  // updateBankById,
  // bulkUpdateBanks,
  // deleteBankById,
  // bulkDeleteBanks,
  // archiveBankById,
  // unarchiveBankById,
  // getBankAccountBalance,
} from "../controllers/bank.controller.js";

const bankRouter = express.Router();

// 1. GET ALL BANKS
//    Optional query: ?includeArchived=true  ?hierarchy=true
// bankRouter.get("/", getAllBanks);

// // 2. GET ONE BANK BY ID
// bankRouter.get("/:id", getBankById);

// 3. CREATE ONE BANK
bankRouter.post("/", createBank);

// 4. BULK CREATE BANKS
// bankRouter.post("/bulk", bulkCreateBanks);

// // 5. UPDATE ONE BANK BY ID
// bankRouter.patch("/:id", updateBankById);

// // 6. BULK UPDATE BANKS
// bankRouter.patch("/bulk", bulkUpdateBanks);

// // 7. “DELETE” (archive) ONE BANK
// bankRouter.delete("/:id", deleteBankById);

// // 8. BULK DELETE (archive) BANKS
// bankRouter.delete("/bulk", bulkDeleteBanks);

// // 9. ARCHIVE ONE BANK (alias)
// bankRouter.patch("/:id/archive", archiveBankById);

// // 10. UNARCHIVE ONE BANK
// bankRouter.patch("/:id/unarchive", unarchiveBankById);

// bankRouter.get("/balance/:id", getBankAccountBalance);

export default bankRouter;
