// controllers/aisle.controller.js

import mongoose from "mongoose";
import { AisleModel } from "../models/aisle.model.js";
import { AisleCounterModel } from "../models/counter.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";

// Helper: invalidate aisle cache
const invalidateAisleCache = async (key = "/fms/api/v0/aisles") => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: "invalidateAisleCache",
    });
  } catch (err) {
    logStackError("❌ Aisle cache invalidation failed", err);
  }
};

/** Create a new Aisle */
export const createAisle = async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      location,
      zone,
      locationLatLng,
      remarks,
      active,
      groups,
      company,
      files,
      extras,
    } = req.body;
    if (!name || !location) {
      return res.status(422).json({
        status: "failure",
        message: "⚠️ 'name' and 'location' are required.",
      });
    }

    const aisle = await AisleModel.create({
      name,
      description,
      type,
      location,
      zone,
      locationLatLng,
      remarks,
      active,
      groups,
      company,
      files,
      extras,
    });

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Aisle",
      action: "CREATE",
      recordId: aisle._id,
      changes: { newData: aisle },
    });

    await invalidateAisleCache();
    winstonLogger.info(`✅ Aisle created: ${aisle._id}`);

    return res.status(201).json({
      status: "success",
      message: "✅ Aisle created successfully.",
      data: aisle,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError("❌ Aisle Validation Error", error);
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    if (error.code === 11000) {
      logStackError("❌ Aisle Duplicate Error", error);
      return res.status(409).json({
        status: "failure",
        message: "Aisle name or code already exists.",
      });
    }
    logStackError("❌ Aisle Creation Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Retrieve all Aisles */
export const getAllAisles = async (req, res) => {
  try {
    const list = await AisleModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });

    winstonLogger.info(`✅ Fetched all aisles (${list.length})`);
    return res
      .status(200)
      .json({ status: "success", count: list.length, data: list });
  } catch (error) {
    logStackError("❌ Get All Aisles Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Retrieve archived Aisles */
export const getArchivedAisles = async (req, res) => {
  try {
    const archived = await AisleModel.find({ archived: true });
    return res.status(200).json({ status: "success", data: archived });
  } catch (error) {
    logError("❌ Get Archived Aisles Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Retrieve an Aisle by ID */
export const getAisleById = async (req, res) => {
  try {
    const { aisleId } = req.params;
    const aisle = await AisleModel.findById(aisleId);
    if (!aisle) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Aisle not found." });
    }
    winstonLogger.info(`✅ Retrieved aisle: ${aisleId}`);
    return res.status(200).json({ status: "success", data: aisle });
  } catch (error) {
    logError("❌ Get Aisle By ID Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Update an Aisle by ID */
export const updateAisleById = async (req, res) => {
  try {
    const { aisleId } = req.params;
    const updateData = {
      ...req.body,
      updatedBy: req.user?.username || "Unknown",
    };
    const aisle = await AisleModel.findByIdAndUpdate(aisleId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!aisle) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Aisle not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Aisle",
      action: "UPDATE",
      recordId: aisle._id,
      changes: { newData: aisle },
    });

    await invalidateAisleCache();
    winstonLogger.info(`ℹ️ Updated aisle: ${aisleId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Aisle updated.", data: aisle });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logError("❌ Update Aisle Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Delete an Aisle by ID */
export const deleteAisleById = async (req, res) => {
  try {
    const { aisleId } = req.params;
    const aisle = await AisleModel.findByIdAndDelete(aisleId);
    if (!aisle) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Aisle not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Aisle",
      action: "DELETE",
      recordId: aisle._id,
    });

    await invalidateAisleCache();
    winstonLogger.info(`ℹ️ Deleted aisle: ${aisleId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Aisle deleted." });
  } catch (error) {
    logError("❌ Delete Aisle Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Archive an Aisle by ID */
export const archiveAisleById = async (req, res) => {
  try {
    const { aisleId } = req.params;
    const aisle = await AisleModel.findByIdAndUpdate(
      aisleId,
      { archived: true, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!aisle) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Aisle not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Aisle",
      action: "ARCHIVE",
      recordId: aisle._id,
    });

    await invalidateAisleCache();
    return res
      .status(200)
      .json({ status: "success", message: "✅ Aisle archived.", data: aisle });
  } catch (error) {
    logError("❌ Archive Aisle Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Unarchive an Aisle by ID */
export const unarchiveAisleById = async (req, res) => {
  try {
    const { aisleId } = req.params;
    const aisle = await AisleModel.findByIdAndUpdate(
      aisleId,
      { archived: false, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!aisle) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Aisle not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Aisle",
      action: "UNARCHIVE",
      recordId: aisle._id,
    });

    await invalidateAisleCache();
    return res.status(200).json({
      status: "success",
      message: "✅ Aisle unarchived.",
      data: aisle,
    });
  } catch (error) {
    logError("❌ Unarchive Aisle Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Bulk Create Aisles */
export const bulkCreateAisles = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Provide non-empty array of aisles.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    const counter = await AisleCounterModel.findOneAndUpdate(
      { _id: "aisleCode" },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq;
    const start = end - n + 1;

    docs.forEach((d, i) => {
      d.code = `RK_${String(start + i).padStart(3, "0")}`;
    });

    const created = await AisleModel.insertMany(docs, { session });
    await Promise.all(
      created.map((a) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Aisle",
          action: "BULK_CREATE",
          recordId: a._id,
          changes: { newData: a },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateAisleCache();

    return res.status(201).json({
      status: "success",
      message: `✅ ${created.length} aisles created.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk create aisles error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk creation.",
      error: error.message,
    });
  }
};

/** Bulk Update Aisles */
export const bulkUpdateAisles = async (req, res) => {
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
        throw new Error(`Invalid aisle ID: ${id}`);

      const a = await AisleModel.findByIdAndUpdate(
        id,
        { ...entry.update, updatedBy: req.user?.username || "Unknown" },
        { new: true, runValidators: true, session }
      );
      if (!a) throw new Error(`Aisle not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || "67ec2fb004d3cc3237b58772",
        module: "Aisle",
        action: "BULK_UPDATE",
        recordId: a._id,
        changes: { newData: a },
      });
      results.push(a);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateAisleCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${results.length} aisles updated.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk update aisles error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk update.",
      error: error.message,
    });
  }
};

/** Bulk Delete Aisles */
export const bulkDeleteAisles = async (req, res) => {
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
    const { deletedCount } = await AisleModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error("No aisles deleted.");

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Aisle",
          action: "BULK_DELETE",
          recordId: id,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateAisleCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${deletedCount} aisles deleted.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk delete aisles error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk delete.",
      error: error.message,
    });
  }
};
