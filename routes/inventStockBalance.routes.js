import { Router } from "express";
import {
  createStockBalance,
  bulkCreateStockBalances,
  getAllStockBalances,
  getStockBalanceById,
  updateStockBalanceById,
  bulkUpdateStockBalances,
  deleteStockBalanceById,
  bulkDeleteStockBalances,
  getProvisionalStockBalances,
  getStockTransactions,
  getStockTransactionsForBalance,
} from "../controllers/inventStockBalance.controller.js";

const stockBalanceRouter = Router();

stockBalanceRouter.get("/provisional", getProvisionalStockBalances);
stockBalanceRouter.get("/transactions", getStockTransactions);
stockBalanceRouter.post("/bulk", bulkCreateStockBalances);
stockBalanceRouter.patch("/bulk", bulkUpdateStockBalances);
stockBalanceRouter.delete("/bulk", bulkDeleteStockBalances);

stockBalanceRouter.post("/", createStockBalance);
stockBalanceRouter.get("/", getAllStockBalances);

stockBalanceRouter.get(
  "/:balanceId/transactions",
  getStockTransactionsForBalance
);
stockBalanceRouter.get("/:id", getStockBalanceById);
stockBalanceRouter.patch("/:id", updateStockBalanceById);
stockBalanceRouter.delete("/:id", deleteStockBalanceById);

export default stockBalanceRouter;
