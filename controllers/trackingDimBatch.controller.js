// controllers/batch.controller.js

import mongoose from "mongoose";
import { BatchModel } from "../models/trackingDimBatch.model.js";
import { BatchCounterModel } from "../models/counter.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";

// Helper: invalidate Cache
const invalidateBatchCache = async (key = "/fms/api/v0/batches") => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: "invalidateBatchCache",
    });
  } catch (err) {
    logStackError("❌ Batch cache invalidation failed", err);
  }
};

/**
 * Create a new Batch
 * Expects req.body = { values: [...], description, type, active, groups, company, files, extras }
 */
export const createBatch = async (req, res) => {
  try {
    const {
      values,
      description,
      type,
      active,
      groups,
      company,
      files,
      extras,
    } = req.body;
    // if (!Array.isArray(values) || values.length === 0) {
    //   return res.status(400).json({
    //     status: "failure",
    //     message: "⚠️ 'values' must be a non-empty array of batch entries.",
    //   });
    // }

    const batch = await BatchModel.create({
      values,
      description,
      type,
      active,
      groups,
      company,
      files,
      extras,
    });

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Batch",
      action: "CREATE",
      recordId: batch._id,
      changes: { newData: batch },
    });

    await invalidateBatchCache();
    winstonLogger.info(`✅ Batch created: ${batch._id}`);

    return res.status(201).json({
      status: "success",
      message: "✅ Batch created successfully.",
      data: batch,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError("❌ Batch Validation Error", error);
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    if (error.code === 11000) {
      logStackError("❌ Batch Duplicate Error", error);
      return res
        .status(409)
        .json({ status: "failure", message: "Duplicate batch code." });
    }
    logStackError("❌ Batch Creation Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * Retrieve all Batches.
 */
export const getAllBatches = async (req, res) => {
  try {
    const list = await BatchModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });

    winstonLogger.info(`✅ Fetched all batches (${list.length})`);
    return res
      .status(200)
      .json({ status: "success", count: list.length, data: list });
  } catch (error) {
    logStackError("❌ Get All Batches Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Get archived Batch Groups */
export const getArchivedBatches = async (req, res) => {
  try {
    const archived = await BatchModel.find({ archived: true });
    return res.status(200).json({ status: "success", data: archived });
  } catch (error) {
    logError("❌ Get Archived Batches Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * Retrieve a Batch by ID.
 */
export const getBatchById = async (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = await BatchModel.findById(batchId);
    if (!batch) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Batch not found." });
    }
    winstonLogger.info(`✅ Retrieved batch: ${batchId}`);
    return res.status(200).json({ status: "success", data: batch });
  } catch (error) {
    logError("❌ Get Batch By ID Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * Update a Batch by ID.
 */
export const updateBatchById = async (req, res) => {
  try {
    const { batchId } = req.params;
    const updateData = { ...req.body };
    const batch = await BatchModel.findByIdAndUpdate(batchId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!batch) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Batch not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Batch",
      action: "UPDATE",
      recordId: batch._id,
      changes: { newData: batch },
    });

    await invalidateBatchCache();
    winstonLogger.info(`ℹ️ Updated batch: ${batchId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Batch updated.", data: batch });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logError("❌ Update Batch Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * Delete a Batch by ID.
 */
export const deleteBatchById = async (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = await BatchModel.findByIdAndDelete(batchId);
    if (!batch) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Batch not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Batch",
      action: "DELETE",
      recordId: batch._id,
    });

    await invalidateBatchCache();
    winstonLogger.info(`ℹ️ Deleted batch: ${batchId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Batch deleted." });
  } catch (error) {
    logError("❌ Delete Batch Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Archive a Batch Group */
export const archiveBatchById = async (req, res) => {
  try {
    const { batchId } = req.params;
    const batchGroup = await BatchModel.findByIdAndUpdate(
      batchId,
      { archived: true },
      { new: true }
    );
    if (!batchGroup) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Batch group not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Batch",
      action: "ARCHIVE",
      recordId: batchGroup._id,
    });

    await invalidateBatchCache();
    return res.status(200).json({
      status: "success",
      message: "✅ Batch group archived.",
      data: batchGroup,
    });
  } catch (error) {
    logError("❌ Archive Batch Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Unarchive a Batch Group */
export const unarchiveBatchById = async (req, res) => {
  try {
    const { batchId } = req.params;
    const batchGroup = await BatchModel.findByIdAndUpdate(
      batchId,
      { archived: false },
      { new: true }
    );
    if (!batchGroup) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Batch group not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Batch",
      action: "UNARCHIVE",
      recordId: batchGroup._id,
    });

    await invalidateBatchCache();
    return res.status(200).json({
      status: "success",
      message: "✅ Batch group unarchived.",
      data: batchGroup,
    });
  } catch (error) {
    logError("❌ Unarchive Batch Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * Bulk Create Batches.
 * Expects req.body = [{ values, description, ... }, ...]
 */
export const bulkCreateBatches = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Provide non-empty array of batches.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    const counter = await BatchCounterModel.findOneAndUpdate(
      { _id: "batchCode" },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq;
    const start = end - n + 1;

    docs.forEach((d, i) => {
      d.code = `BC_${String(start + i).padStart(9, "0")}`;
    });

    const created = await BatchModel.insertMany(docs, { session });
    await Promise.all(
      created.map((b) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Batch",
          action: "BULK_CREATE",
          recordId: b._id,
          changes: { newData: b },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateBatchCache();

    return res.status(201).json({
      status: "success",
      message: `✅ ${created.length} batches created.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk create batches error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk creation.",
      error: error.message,
    });
  }
};

/**
 * Bulk Update Batches.
 * Expects req.body = [{ id or _id, update: { ... } }, ...]
 */
export const bulkUpdateBatches = async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Provide non-empty array of updates.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const results = [];
    for (const entry of updates) {
      const id = entry.id ?? entry._id;
      if (!mongoose.Types.ObjectId.isValid(id))
        throw new Error(`Invalid batch ID: ${id}`);

      const b = await BatchModel.findByIdAndUpdate(
        id,
        { ...entry.update },
        { new: true, runValidators: true, session }
      );
      if (!b) throw new Error(`Batch not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || "67ec2fb004d3cc3237b58772",
        module: "Batch",
        action: "BULK_UPDATE",
        recordId: b._id,
        changes: { newData: b },
      });
      results.push(b);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateBatchCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${results.length} batches updated.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk update batches error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk update.",
      error: error.message,
    });
  }
};

/**
 * Bulk Delete Batches.
 * Expects req.body = { ids: [...] }
 */
export const bulkDeleteBatches = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Provide non-empty array of ids.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { deletedCount } = await BatchModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error("No batches deleted.");

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Batch",
          action: "BULK_DELETE",
          recordId: id,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateBatchCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${deletedCount} batches deleted.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk delete batches error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk delete.",
      error: error.message,
    });
  }
};
