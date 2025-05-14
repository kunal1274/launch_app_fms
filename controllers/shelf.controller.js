// controllers/shelf.controller.js

import mongoose from "mongoose";
import { ShelfModel } from "../models/shelf.model.js";
import { ShelfCounterModel } from "../models/counter.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";

/** Helper: invalidate Shelf cache */
const invalidateShelfCache = async (key = "/fms/api/v0/shelves") => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: "invalidateShelfCache",
    });
  } catch (err) {
    logStackError("❌ Shelf cache invalidation failed", err);
  }
};

/** Create one Shelf */
export const createShelf = async (req, res) => {
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
      logger.warn("Shelf Creation - Missing fields", {
        context: "createShelf",
        body: req.body,
      });
      return res.status(422).json({
        status: "failure",
        message: "⚠️ name, type, and location are required.",
      });
    }

    const shelf = await ShelfModel.create({
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
      createdBy: req.user?.username || "SystemShelfCreation",
    });

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Shelf",
      action: "CREATE",
      recordId: shelf._id,
      changes: { newData: shelf },
    });

    await invalidateShelfCache();

    winstonLogger.info(`✅ Shelf created: ${shelf._id}`);
    return res.status(201).json({
      status: "success",
      message: "✅ Shelf created successfully.",
      data: shelf,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError("❌ Shelf Validation Error", error);
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    if (error.code === 11000) {
      logStackError("❌ Shelf Duplicate Error", error);
      return res.status(409).json({
        status: "failure",
        message: "A shelf with that code or name already exists.",
      });
    }
    logStackError("❌ Shelf Creation Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get all Shelves */
export const getAllShelves = async (req, res) => {
  try {
    const list = await ShelfModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });

    winstonLogger.info(`✅ Fetched all shelves (${list.length})`);
    return res.status(200).json({
      status: "success",
      message: "✅ Shelves retrieved successfully.",
      count: list.length,
      data: list,
    });
  } catch (error) {
    logStackError("❌ Get All Shelves Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get archived Shelves */
export const getArchivedShelves = async (req, res) => {
  try {
    const archived = await ShelfModel.find({ archived: true });
    winstonLogger.info(`ℹ️ Retrieved ${archived.length} archived shelves.`);
    return res.status(200).json({
      status: "success",
      message: "✅ Archived shelves retrieved.",
      data: archived,
    });
  } catch (error) {
    logError("❌ Get Archived Shelves", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get one Shelf by ID */
export const getShelfById = async (req, res) => {
  try {
    const { shelfId } = req.params;
    const shelf = await ShelfModel.findById(shelfId);
    if (!shelf) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Shelf not found." });
    }
    winstonLogger.info(`✅ Retrieved shelf: ${shelfId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Shelf retrieved.", data: shelf });
  } catch (error) {
    logError("❌ Get Shelf By ID", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Update one Shelf by ID */
export const updateShelfById = async (req, res) => {
  try {
    const { shelfId } = req.params;
    const updateData = {
      ...req.body,
      updatedBy: req.user?.username || "Unknown",
    };
    const shelf = await ShelfModel.findByIdAndUpdate(shelfId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!shelf) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Shelf not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Shelf",
      action: "UPDATE",
      recordId: shelf._id,
      changes: { newData: shelf },
    });

    await invalidateShelfCache();

    winstonLogger.info(`ℹ️ Updated shelf: ${shelfId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Shelf updated.", data: shelf });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logError("❌ Update Shelf", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Delete one Shelf by ID */
export const deleteShelfById = async (req, res) => {
  try {
    const { shelfId } = req.params;
    const shelf = await ShelfModel.findByIdAndDelete(shelfId);
    if (!shelf) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Shelf not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Shelf",
      action: "DELETE",
      recordId: shelf._id,
      changes: null,
    });

    await invalidateShelfCache();

    winstonLogger.info(`ℹ️ Deleted shelf: ${shelfId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Shelf deleted." });
  } catch (error) {
    logError("❌ Delete Shelf", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Archive / Unarchive */
export const archiveShelfById = async (req, res) => {
  try {
    const { shelfId } = req.params;
    const shelf = await ShelfModel.findByIdAndUpdate(
      shelfId,
      { archived: true, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!shelf) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Shelf not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Shelf",
      action: "ARCHIVE",
      recordId: shelf._id,
      changes: { newData: shelf },
    });

    await invalidateShelfCache();

    return res
      .status(200)
      .json({ status: "success", message: "✅ Shelf archived.", data: shelf });
  } catch (error) {
    logError("❌ Archive Shelf", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const unarchiveShelfById = async (req, res) => {
  try {
    const { shelfId } = req.params;
    const shelf = await ShelfModel.findByIdAndUpdate(
      shelfId,
      { archived: false, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!shelf) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Shelf not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Shelf",
      action: "UNARCHIVE",
      recordId: shelf._id,
      changes: { newData: shelf },
    });

    await invalidateShelfCache();

    return res.status(200).json({
      status: "success",
      message: "✅ Shelf unarchived.",
      data: shelf,
    });
  } catch (error) {
    logError("❌ Unarchive Shelf", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Bulk Create Shelves */
export const bulkCreateShelves = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Request body must be a non-empty array of shelf objects.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    logger.info("💾 Bulk create: reserving shelf codes", {
      context: "bulkCreateShelves",
      count: n,
    });

    const counter = await ShelfCounterModel.findOneAndUpdate(
      { _id: "shelfCode" },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq;
    const start = end - n + 1;

    docs.forEach((d, i) => {
      const seq = (start + i).toString().padStart(3, "0");
      d.code = `SH_${seq}`;
      d.createdBy = req.user?.username || "SystemShelfCreation";
    });

    const created = await ShelfModel.insertMany(docs, { session });

    await Promise.all(
      created.map((sh) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Shelf",
          action: "BULK_CREATE",
          recordId: sh._id,
          changes: { newData: sh },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateShelfCache();

    return res.status(201).json({
      status: "success",
      message: `✅ ${created.length} shelves created successfully.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk create shelves error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk shelf creation.",
      error: error.message,
    });
  }
};

/** Bulk Update Shelves */
export const bulkUpdateShelves = async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      status: "failure",
      message:
        "⚠️ Request body must be a non-empty array of { id or _id, update }. ",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    logger.info("🔄 Bulk update shelves", {
      context: "bulkUpdateShelves",
      count: updates.length,
    });

    const results = [];
    for (const entry of updates) {
      const id = entry.id ?? entry._id;
      if (!mongoose.Types.ObjectId.isValid(id))
        throw new Error(`Invalid shelf ID: ${id}`);

      const sh = await ShelfModel.findByIdAndUpdate(
        id,
        { ...entry.update, updatedBy: req.user?.username || "Unknown" },
        { new: true, runValidators: true, session }
      );
      if (!sh) throw new Error(`Shelf not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || "67ec2fb004d3cc3237b58772",
        module: "Shelf",
        action: "BULK_UPDATE",
        recordId: sh._id,
        changes: { newData: sh },
      });

      results.push(sh);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateShelfCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${results.length} shelves updated successfully.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk update shelves error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk shelf update.",
      error: error.message,
    });
  }
};

/** Bulk Delete Shelves */
export const bulkDeleteShelves = async (req, res) => {
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
    logger.info("🗑️ Bulk delete shelves", {
      context: "bulkDeleteShelves",
      count: ids.length,
    });

    const { deletedCount } = await ShelfModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error("No shelves deleted.");

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Shelf",
          action: "BULK_DELETE",
          recordId: id,
          changes: null,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateShelfCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${deletedCount} shelves deleted successfully.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk delete shelves error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk shelf deletion.",
      error: error.message,
    });
  }
};
