// controllers/bin.controller.js

import mongoose from "mongoose";
import { BinModel } from "../models/bin.model.js";
import { BinCounterModel } from "../models/counter.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";

/** Helper: invalidate Bin cache */
const invalidateBinCache = async (key = "/fms/api/v0/bins") => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, { context: "invalidateBinCache" });
  } catch (err) {
    logStackError("❌ Bin cache invalidation failed", err);
  }
};

/** Create a new Bin */
export const createBin = async (req, res) => {
  try {
    const {
      name,
      type,
      location,
      zone,
      description,
      locationLatLng,
      remarks,
      company,
      groups,
      files,
      extras,
      active,
    } = req.body;

    // require name, type, and location
    if (!name || !type || !location) {
      logger.warn("Bin Creation - Missing fields", {
        context: "createBin",
        body: req.body,
      });
      return res.status(422).json({
        status: "failure",
        message: "⚠️ name, type, and location are required.",
      });
    }

    const bin = await BinModel.create({
      name,
      type,
      location,
      zone,
      description,
      locationLatLng,
      remarks,
      company,
      groups,
      files,
      extras,
      active,
      createdBy: req.user?.username || "SystemBinCreation",
    });

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Bin",
      action: "CREATE",
      recordId: bin._id,
      changes: { newData: bin },
    });

    await invalidateBinCache();

    winstonLogger.info(`✅ Bin created: ${bin._id}`);
    return res.status(201).json({
      status: "success",
      message: "✅ Bin created successfully.",
      data: bin,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError("❌ Bin Validation Error", error);
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    if (error.code === 11000) {
      logStackError("❌ Bin Duplicate Error", error);
      return res.status(409).json({
        status: "failure",
        message: "A bin with that code or name already exists.",
      });
    }
    logStackError("❌ Bin Creation Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get all Bins */
export const getAllBins = async (req, res) => {
  try {
    const list = await BinModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });

    winstonLogger.info(`✅ Fetched all bins (${list.length})`);
    return res.status(200).json({
      status: "success",
      message: "✅ Bins retrieved successfully.",
      count: list.length,
      data: list,
    });
  } catch (error) {
    logStackError("❌ Get All Bins Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get archived Bins */
export const getArchivedBins = async (req, res) => {
  try {
    const archived = await BinModel.find({ archived: true });
    winstonLogger.info(`ℹ️ Retrieved ${archived.length} archived bins.`);
    return res.status(200).json({
      status: "success",
      message: "✅ Archived bins retrieved.",
      data: archived,
    });
  } catch (error) {
    logError("❌ Get Archived Bins", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get one Bin by ID */
export const getBinById = async (req, res) => {
  try {
    const { binId } = req.params;
    const bin = await BinModel.findById(binId);
    if (!bin) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Bin not found." });
    }
    winstonLogger.info(`✅ Retrieved bin: ${binId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Bin retrieved.", data: bin });
  } catch (error) {
    logError("❌ Get Bin By ID", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Update one Bin by ID */
export const updateBinById = async (req, res) => {
  try {
    const { binId } = req.params;
    const updateData = {
      ...req.body,
      updatedBy: req.user?.username || "Unknown",
    };
    const bin = await BinModel.findByIdAndUpdate(binId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!bin) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Bin not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Bin",
      action: "UPDATE",
      recordId: bin._id,
      changes: { newData: bin },
    });

    await invalidateBinCache();

    winstonLogger.info(`ℹ️ Updated bin: ${binId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Bin updated.", data: bin });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logError("❌ Update Bin", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Delete one Bin by ID */
export const deleteBinById = async (req, res) => {
  try {
    const { binId } = req.params;
    const bin = await BinModel.findByIdAndDelete(binId);
    if (!bin) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Bin not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Bin",
      action: "DELETE",
      recordId: bin._id,
      changes: null,
    });

    await invalidateBinCache();

    winstonLogger.info(`ℹ️ Deleted bin: ${binId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Bin deleted." });
  } catch (error) {
    logError("❌ Delete Bin", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Archive / Unarchive */
export const archiveBinById = async (req, res) => {
  try {
    const { binId } = req.params;
    const bin = await BinModel.findByIdAndUpdate(
      binId,
      { archived: true, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!bin) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Bin not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Bin",
      action: "ARCHIVE",
      recordId: bin._id,
      changes: { newData: bin },
    });

    await invalidateBinCache();

    return res
      .status(200)
      .json({ status: "success", message: "✅ Bin archived.", data: bin });
  } catch (error) {
    logError("❌ Archive Bin", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const unarchiveBinById = async (req, res) => {
  try {
    const { binId } = req.params;
    const bin = await BinModel.findByIdAndUpdate(
      binId,
      { archived: false, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!bin) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Bin not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Bin",
      action: "UNARCHIVE",
      recordId: bin._id,
      changes: { newData: bin },
    });

    await invalidateBinCache();

    return res
      .status(200)
      .json({ status: "success", message: "✅ Bin unarchived.", data: bin });
  } catch (error) {
    logError("❌ Unarchive Bin", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Bulk Create Bins */
export const bulkCreateBins = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Request body must be a non-empty array of bin objects.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    logger.info("💾 Bulk create: reserving bin codes", {
      context: "bulkCreateBins",
      count: n,
    });

    const counter = await BinCounterModel.findOneAndUpdate(
      { _id: "binCode" },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq;
    const start = end - n + 1;

    docs.forEach((d, i) => {
      const seq = (start + i).toString().padStart(3, "0");
      d.code = `BIN_${seq}`;
      d.createdBy = req.user?.username || "SystemBinCreation";
    });

    const created = await BinModel.insertMany(docs, { session });

    await Promise.all(
      created.map((bn) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Bin",
          action: "BULK_CREATE",
          recordId: bn._id,
          changes: { newData: bn },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateBinCache();

    return res.status(201).json({
      status: "success",
      message: `✅ ${created.length} bins created successfully.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk create bins error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk bin creation.",
      error: error.message,
    });
  }
};

/** Bulk Update Bins */

export const bulkUpdateBins = async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      status: "failure",
      message:
        "⚠️ Request body must be a non-empty array of {id or _id, update}.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    logger.info("🔄 Bulk update bins", {
      context: "bulkUpdateBins",
      count: updates.length,
    });

    const results = [];
    for (const entry of updates) {
      const id = entry.id ?? entry._id;
      if (!mongoose.Types.ObjectId.isValid(id))
        throw new Error(`Invalid bin ID: ${id}`);

      const bn = await BinModel.findByIdAndUpdate(
        id,
        { ...entry.update, updatedBy: req.user?.username || "Unknown" },
        { new: true, runValidators: true, session }
      );
      if (!bn) throw new Error(`Bin not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || "67ec2fb004d3cc3237b58772",
        module: "Bin",
        action: "BULK_UPDATE",
        recordId: bn._id,
        changes: { newData: bn },
      });

      results.push(bn);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateBinCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${results.length} bins updated successfully.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk update bins error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk bin update.",
      error: error.message,
    });
  }
};

/** Bulk Delete Bins */
export const bulkDeleteBins = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Request body must include a non-empty array of ids.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    logger.info("🗑️ Bulk delete bins", {
      context: "bulkDeleteBins",
      count: ids.length,
    });

    const { deletedCount } = await BinModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error("No bins deleted.");

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Bin",
          action: "BULK_DELETE",
          recordId: id,
          changes: null,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateBinCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${deletedCount} bins deleted successfully.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk delete bins error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk bin deletion.",
      error: error.message,
    });
  }
};
