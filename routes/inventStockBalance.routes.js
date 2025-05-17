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
} from "../controllers/stockBalance.controller.js";

const stockBalanceRouter = Router();

stockBalanceRouter.post("/bulk-create", bulkCreateStockBalances);
stockBalanceRouter.patch("/bulk-update", bulkUpdateStockBalances);
stockBalanceRouter.delete("/bulk-delete", bulkDeleteStockBalances);

stockBalanceRouter.post("/", createStockBalance);
stockBalanceRouter.get("/", getAllStockBalances);

stockBalanceRouter.get("/:id", getStockBalanceById);
stockBalanceRouter.patch("/:id", updateStockBalanceById);
stockBalanceRouter.delete("/:id", deleteStockBalanceById);

export default stockBalanceRouter;
