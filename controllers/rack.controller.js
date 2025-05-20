// controllers/rack.controller.js

import mongoose from "mongoose";
import { RackModel } from "../models/rack.model.js";
import { RackCounterModel } from "../models/counter.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";

/** Helper: clear Redis cache for racks */
const invalidateRackCache = async (key = "/fms/api/v0/racks") => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: "invalidateRackCache",
    });
  } catch (err) {
    logStackError("❌ Rack cache invalidation failed", err);
  }
};

/** Create one Rack (pre-save hook sets `code`) */
export const createRack = async (req, res) => {
  try {
    const {
      name,
      type,
      aisle,
      description,
      rackLatLng,
      remarks,
      company,
      groups,
      files,
      extras,
      active,
    } = req.body;

    // require name, type, and location
    if (!name || !type || !aisle) {
      logger.warn("Rack Creation - Missing fields - name , type and aisle ", {
        context: "createRack",
        body: req.body,
      });
      return res.status(422).json({
        status: "failure",
        message: "⚠️ name, type, and aisle are required.",
      });
    }

    const rack = await RackModel.create({
      name,
      type,
      aisle,
      description,
      rackLatLng,
      remarks,
      company,
      groups,
      files,
      extras,
      active,
      createdBy: req.user?.username || "SystemRackCreation",
    });

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Rack",
      action: "CREATE",
      recordId: rack._id,
      changes: { newData: rack },
    });

    await invalidateRackCache();

    winstonLogger.info(`✅ Rack created: ${rack._id}`);
    return res.status(201).json({
      status: "success",
      message: "✅ Rack created successfully.",
      data: rack,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError("❌ Rack Validation Error", error);
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    if (error.code === 11000) {
      logStackError("❌ Rack Duplicate Error", error);
      return res.status(409).json({
        status: "failure",
        message: "A rack with that code or name already exists.",
      });
    }
    logStackError("❌ Rack Creation Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get all Racks */
export const getAllRacks = async (req, res) => {
  try {
    const list = await RackModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });

    winstonLogger.info(`✅ Fetched all racks (${list.length})`);
    return res.status(200).json({
      status: "success",
      message: "✅ Racks retrieved successfully.",
      count: list.length,
      data: list,
    });
  } catch (error) {
    logStackError("❌ Get All Racks Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get archived Racks */
export const getArchivedRacks = async (req, res) => {
  try {
    const archived = await RackModel.find({ archived: true });
    winstonLogger.info(`ℹ️ Retrieved ${archived.length} archived racks.`);
    return res.status(200).json({
      status: "success",
      message: "✅ Archived racks retrieved.",
      data: archived,
    });
  } catch (error) {
    logError("❌ Get Archived Racks", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get one Rack by ID */
export const getRackById = async (req, res) => {
  try {
    const { rackId } = req.params;
    const rack = await RackModel.findById(rackId);
    if (!rack) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Rack not found." });
    }
    winstonLogger.info(`✅ Retrieved rack: ${rackId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Rack retrieved.", data: rack });
  } catch (error) {
    logError("❌ Get Rack By ID", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Update one Rack by ID */
export const updateRackById = async (req, res) => {
  try {
    const { rackId } = req.params;
    const updateData = {
      ...req.body,
      updatedBy: req.user?.username || "Unknown",
    };
    const rack = await RackModel.findByIdAndUpdate(rackId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!rack) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Rack not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Rack",
      action: "UPDATE",
      recordId: rack._id,
      changes: { newData: rack },
    });

    await invalidateRackCache();

    winstonLogger.info(`ℹ️ Updated rack: ${rackId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Rack updated.", data: rack });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logError("❌ Update Rack", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Delete one Rack by ID */
export const deleteRackById = async (req, res) => {
  try {
    const { rackId } = req.params;
    const rack = await RackModel.findByIdAndDelete(rackId);
    if (!rack) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Rack not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Rack",
      action: "DELETE",
      recordId: rack._id,
      changes: null,
    });

    await invalidateRackCache();

    winstonLogger.info(`ℹ️ Deleted rack: ${rackId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Rack deleted." });
  } catch (error) {
    logError("❌ Delete Rack", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Archive / Unarchive */
export const archiveRackById = async (req, res) => {
  try {
    const { rackId } = req.params;
    const rack = await RackModel.findByIdAndUpdate(
      rackId,
      { archived: true, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!rack) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Rack not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Rack",
      action: "ARCHIVE",
      recordId: rack._id,
      changes: { newData: rack },
    });

    await invalidateRackCache();

    return res
      .status(200)
      .json({ status: "success", message: "✅ Rack archived.", data: rack });
  } catch (error) {
    logError("❌ Archive Rack", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const unarchiveRackById = async (req, res) => {
  try {
    const { rackId } = req.params;
    const rack = await RackModel.findByIdAndUpdate(
      rackId,
      { archived: false, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!rack) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Rack not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Rack",
      action: "UNARCHIVE",
      recordId: rack._id,
      changes: { newData: rack },
    });

    await invalidateRackCache();

    return res
      .status(200)
      .json({ status: "success", message: "✅ Rack unarchived.", data: rack });
  } catch (error) {
    logError("❌ Unarchive Rack", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Bulk Create Racks */
export const bulkCreateRacks = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Request body must be a non-empty array of rack objects.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    logger.info("💾 Bulk create: reserving rack codes", {
      context: "bulkCreateRacks",
      count: n,
    });

    const counter = await RackCounterModel.findOneAndUpdate(
      { _id: "rackCode" },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq;
    const start = end - n + 1;

    docs.forEach((d, i) => {
      const seq = (start + i).toString().padStart(3, "0");
      d.code = `RK_${seq}`;
      d.createdBy = req.user?.username || "SystemRackCreation";
    });

    const created = await RackModel.insertMany(docs, { session });

    await Promise.all(
      created.map((rk) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Rack",
          action: "BULK_CREATE",
          recordId: rk._id,
          changes: { newData: rk },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateRackCache();

    return res.status(201).json({
      status: "success",
      message: `✅ ${created.length} racks created successfully.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk create racks error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk rack creation.",
      error: error.message,
    });
  }
};

/** Bulk Update Racks */
export const bulkUpdateRacks = async (req, res) => {
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
    logger.info("🔄 Bulk update racks", {
      context: "bulkUpdateRacks",
      count: updates.length,
    });

    const results = [];
    for (const entry of updates) {
      const id = entry.id ?? entry._id;
      if (!mongoose.Types.ObjectId.isValid(id))
        throw new Error(`Invalid rack ID: ${id}`);

      const rk = await RackModel.findByIdAndUpdate(
        id,
        { ...entry.update, updatedBy: req.user?.username || "Unknown" },
        { new: true, runValidators: true, session }
      );
      if (!rk) throw new Error(`Rack not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || "67ec2fb004d3cc3237b58772",
        module: "Rack",
        action: "BULK_UPDATE",
        recordId: rk._id,
        changes: { newData: rk },
      });

      results.push(rk);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateRackCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${results.length} racks updated successfully.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk update racks error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk rack update.",
      error: error.message,
    });
  }
};

/** Bulk Delete Racks */
export const bulkDeleteRacks = async (req, res) => {
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
    logger.info("🗑️ Bulk delete racks", {
      context: "bulkDeleteRacks",
      count: ids.length,
    });

    const { deletedCount } = await RackModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error("No racks deleted.");

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Rack",
          action: "BULK_DELETE",
          recordId: id,
          changes: null,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateRackCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${deletedCount} racks deleted successfully.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk delete racks error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk rack deletion.",
      error: error.message,
    });
  }
};
