// controllers/trackingDimSerial.controller.js

import mongoose from "mongoose";
import { SerialModel } from "../models/trackingDimSerial.model.js";
import { SerialCounterModel } from "../models/counter.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";

// Helper: invalidate serials cache
const invalidateSerialCache = async (key = "/fms/api/v0/serials") => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: "invalidateSerialCache",
    });
  } catch (err) {
    logStackError("❌ Serial cache invalidation failed", err);
  }
};

/** Create a new Serial Group */
export const createSerial = async (req, res) => {
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
    //     message: "⚠️ 'values' must be a non-empty array of serial entries.",
    //   });
    // }

    const serialGroup = await SerialModel.create({
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
      module: "Serial",
      action: "CREATE",
      recordId: serialGroup._id,
      changes: { newData: serialGroup },
    });

    await invalidateSerialCache();
    winstonLogger.info(`✅ Serial group created: ${serialGroup._id}`);

    return res.status(201).json({
      status: "success",
      message: "✅ Serial group created successfully.",
      data: serialGroup,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError("❌ Serial Validation Error", error);
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    if (error.code === 11000) {
      logStackError("❌ Serial Duplicate Error", error);
      return res
        .status(409)
        .json({ status: "failure", message: "Duplicate serial code." });
    }
    logStackError("❌ Serial Creation Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Get all Serial Groups */
export const getAllSerials = async (req, res) => {
  try {
    const list = await SerialModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });

    winstonLogger.info(`✅ Fetched all serial groups (${list.length})`);
    return res
      .status(200)
      .json({ status: "success", count: list.length, data: list });
  } catch (error) {
    logStackError("❌ Get All Serials Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Get archived Serial Groups */
export const getArchivedSerials = async (req, res) => {
  try {
    const archived = await SerialModel.find({ archived: true });
    return res.status(200).json({ status: "success", data: archived });
  } catch (error) {
    logError("❌ Get Archived Serials Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Get a Serial Group by ID */
export const getSerialById = async (req, res) => {
  try {
    const { serialId } = req.params;
    const serialGroup = await SerialModel.findById(serialId);
    if (!serialGroup) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Serial group not found." });
    }
    winstonLogger.info(`✅ Retrieved serial group: ${serialId}`);
    return res.status(200).json({ status: "success", data: serialGroup });
  } catch (error) {
    logError("❌ Get Serial By ID Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Update a Serial Group by ID */
export const updateSerialById = async (req, res) => {
  try {
    const { serialId } = req.params;
    const updateData = { ...req.body };
    const serialGroup = await SerialModel.findByIdAndUpdate(
      serialId,
      updateData,
      { new: true, runValidators: true }
    );
    if (!serialGroup) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Serial group not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Serial",
      action: "UPDATE",
      recordId: serialGroup._id,
      changes: { newData: serialGroup },
    });

    await invalidateSerialCache();
    winstonLogger.info(`ℹ️ Updated serial group: ${serialId}`);
    return res.status(200).json({
      status: "success",
      message: "✅ Serial group updated.",
      data: serialGroup,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logError("❌ Update Serial Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Delete a Serial Group by ID */
export const deleteSerialById = async (req, res) => {
  try {
    const { serialId } = req.params;
    const serialGroup = await SerialModel.findByIdAndDelete(serialId);
    if (!serialGroup) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Serial group not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Serial",
      action: "DELETE",
      recordId: serialGroup._id,
    });

    await invalidateSerialCache();
    winstonLogger.info(`ℹ️ Deleted serial group: ${serialId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Serial group deleted." });
  } catch (error) {
    logError("❌ Delete Serial Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Archive a Serial Group */
export const archiveSerialById = async (req, res) => {
  try {
    const { serialId } = req.params;
    const serialGroup = await SerialModel.findByIdAndUpdate(
      serialId,
      { archived: true },
      { new: true }
    );
    if (!serialGroup) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Serial group not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Serial",
      action: "ARCHIVE",
      recordId: serialGroup._id,
    });

    await invalidateSerialCache();
    return res.status(200).json({
      status: "success",
      message: "✅ Serial group archived.",
      data: serialGroup,
    });
  } catch (error) {
    logError("❌ Archive Serial Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Unarchive a Serial Group */
export const unarchiveSerialById = async (req, res) => {
  try {
    const { serialId } = req.params;
    const serialGroup = await SerialModel.findByIdAndUpdate(
      serialId,
      { archived: false },
      { new: true }
    );
    if (!serialGroup) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Serial group not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Serial",
      action: "UNARCHIVE",
      recordId: serialGroup._id,
    });

    await invalidateSerialCache();
    return res.status(200).json({
      status: "success",
      message: "✅ Serial group unarchived.",
      data: serialGroup,
    });
  } catch (error) {
    logError("❌ Unarchive Serial Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Bulk Create Serial Groups */
export const bulkCreateSerials = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Provide non-empty array of serial groups.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    const counter = await SerialCounterModel.findOneAndUpdate(
      { _id: "serialCode" },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq;
    const start = end - n + 1;

    docs.forEach((d, i) => {
      d.code = `SL_${String(start + i).padStart(9, "0")}`;
    });

    const created = await SerialModel.insertMany(docs, { session });
    await Promise.all(
      created.map((s) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Serial",
          action: "BULK_CREATE",
          recordId: s._id,
          changes: { newData: s },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateSerialCache();

    return res.status(201).json({
      status: "success",
      message: `✅ ${created.length} serial groups created.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk create serials error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk creation.",
      error: error.message,
    });
  }
};

/** Bulk Update Serial Groups */
export const bulkUpdateSerials = async (req, res) => {
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
        throw new Error(`Invalid serial group ID: ${id}`);

      const s = await SerialModel.findByIdAndUpdate(
        id,
        { ...entry.update },
        { new: true, runValidators: true, session }
      );
      if (!s) throw new Error(`Serial group not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || "67ec2fb004d3cc3237b58772",
        module: "Serial",
        action: "BULK_UPDATE",
        recordId: s._id,
        changes: { newData: s },
      });
      results.push(s);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateSerialCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${results.length} serial groups updated.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk update serials error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk update.",
      error: error.message,
    });
  }
};

/** Bulk Delete Serial Groups */
export const bulkDeleteSerials = async (req, res) => {
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
    const { deletedCount } = await SerialModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error("No serial groups deleted.");

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Serial",
          action: "BULK_DELETE",
          recordId: id,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateSerialCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${deletedCount} serial groups deleted.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk delete serials error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk delete.",
      error: error.message,
    });
  }
};
