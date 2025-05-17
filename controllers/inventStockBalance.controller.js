import mongoose from "mongoose";

import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { StockBalanceModel } from "../models/inventStockBalance.model.js";

async function invalidateStockBalanceCache() {
  try {
    await redisClient.del("/fms/api/v0/stock-balances");
    logger.info("Cache invalidated: /fms/api/v0/stock-balances", {
      context: "invalidateStockBalanceCache",
    });
  } catch (err) {
    logStackError("❌ StockBalance cache invalidation failed", err);
  }
}

/**
 * Create a single stock-balance.
 */
export const createStockBalance = async (req, res) => {
  try {
    const data = req.body;
    if (!data.item || !data.site || !data.warehouse) {
      return res.status(422).json({
        status: "failure",
        message: "item, site and warehouse are required.",
      });
    }

    const sb = await StockBalanceModel.create(data);

    await createAuditLog({
      user: req.user?.username || "System",
      module: "StockBalance",
      action: "CREATE",
      recordId: sb._id,
      changes: { newData: sb },
    });
    await invalidateStockBalanceCache();

    return res.status(201).json({
      status: "success",
      message: "✅ StockBalance created successfully.",
      data: sb,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError("❌ StockBalance Validation Error", error);
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logStackError("❌ StockBalance Creation Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * Bulk create stock-balances.
 * Expects body = [{...}, {...}, ...]
 */
export const bulkCreateStockBalances = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: "failure",
      message:
        "Request body must be a non-empty array of stockBalance objects.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const created = await StockBalanceModel.insertMany(docs, { session });

    await Promise.all(
      created.map((sb) =>
        createAuditLog({
          user: req.user?.username || "System",
          module: "StockBalance",
          action: "BULK_CREATE",
          recordId: sb._id,
          changes: { newData: sb },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateStockBalanceCache();

    return res.status(201).json({
      status: "success",
      message: `✅ ${created.length} stock balances created successfully.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk create stockBalance error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk stockBalance creation.",
      error: error.message,
    });
  }
};

/**
 * Retrieve all stock-balances.
 */
export const getAllStockBalances = async (req, res) => {
  try {
    const list = await StockBalanceModel.find();
    await redisClient.set(req.originalUrl, JSON.stringify(list), { EX: 300 });
    return res
      .status(200)
      .json({ status: "success", count: list.length, data: list });
  } catch (error) {
    logStackError("❌ Get All StockBalances Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * Retrieve a stock-balance by ID.
 */
export const getStockBalanceById = async (req, res) => {
  try {
    const { id } = req.params;
    const sb = await StockBalanceModel.findById(id);
    if (!sb) {
      return res
        .status(404)
        .json({ status: "failure", message: "StockBalance not found." });
    }
    return res.status(200).json({ status: "success", data: sb });
  } catch (error) {
    logStackError("❌ Get StockBalance By ID Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * Update a stock-balance by ID.
 */
export const updateStockBalanceById = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const sb = await StockBalanceModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!sb) {
      return res
        .status(404)
        .json({ status: "failure", message: "StockBalance not found." });
    }

    await createAuditLog({
      user: req.user?.username || "System",
      module: "StockBalance",
      action: "UPDATE",
      recordId: sb._id,
      changes: { newData: sb },
    });
    await invalidateStockBalanceCache();

    return res.status(200).json({
      status: "success",
      message: "✅ StockBalance updated successfully.",
      data: sb,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logStackError("❌ Update StockBalance Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * Bulk update stock-balances.
 * Expects body = [{ _id: "...", update: {...} }, ...]
 */
export const bulkUpdateStockBalances = async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "Request body must be a non-empty array of { _id, update }.  ",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const results = [];
    for (const { _id, update } of updates) {
      const sb = await StockBalanceModel.findByIdAndUpdate(_id, update, {
        new: true,
        runValidators: true,
        session,
      });
      if (!sb) throw new Error(`StockBalance not found: ${_id}`);

      await createAuditLog({
        user: req.user?.username || "System",
        module: "StockBalance",
        action: "BULK_UPDATE",
        recordId: sb._id,
        changes: { newData: sb },
      });
      results.push(sb);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateStockBalanceCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${results.length} stock balances updated successfully.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk update stockBalance error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk stockBalance update.",
      error: error.message,
    });
  }
};

/**
 * Delete a stock-balance by ID.
 */
export const deleteStockBalanceById = async (req, res) => {
  try {
    const { id } = req.params;
    const sb = await StockBalanceModel.findByIdAndDelete(id);
    if (!sb) {
      return res
        .status(404)
        .json({ status: "failure", message: "StockBalance not found." });
    }

    await createAuditLog({
      user: req.user?.username || "System",
      module: "StockBalance",
      action: "DELETE",
      recordId: sb._id,
    });
    await invalidateStockBalanceCache();

    return res
      .status(200)
      .json({ status: "success", message: "✅ StockBalance deleted." });
  } catch (error) {
    logStackError("❌ Delete StockBalance Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * Bulk delete stock-balances.
 * Expects body = ["id1", "id2", ...]
 */
export const bulkDeleteStockBalances = async (req, res) => {
  const ids = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "Request body must be a non-empty array of IDs.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    for (const id of ids) {
      const sb = await StockBalanceModel.findByIdAndDelete(id, { session });
      if (!sb) throw new Error(`StockBalance not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || "System",
        module: "StockBalance",
        action: "BULK_DELETE",
        recordId: sb._id,
      });
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateStockBalanceCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${ids.length} stock balances deleted successfully.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk delete stockBalance error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk stockBalance delete.",
      error: error.message,
    });
  }
};
