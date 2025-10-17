// routes/cashJournal.routes.js

import express from "express";
import {
  postARReceipt,
  postAPPayment,
  postBankTransfer,
} from "../controllers/cashJournal.controller.js";

const router = express.Router();

// 1. AR Receipt: POST /api/v1/cash‐journals/ar‐receipt
router.post("/ar‐receipt", postARReceipt);

// 2. AP Payment: POST /api/v1/cash‐journals/ap‐payment
router.post("/ap‐payment", postAPPayment);

// 3. Bank Transfer: POST /api/v1/cash‐journals/bank‐transfer
router.post("/bank‐transfer", postBankTransfer);

export default router;
