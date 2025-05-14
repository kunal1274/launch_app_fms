// controllers/warehouse.controller.js

import mongoose from "mongoose";
import { WarehouseModel } from "../models/warehouse.model.js";
import { WarehouseCounterModel } from "../models/counter.model.js"; // for bulk code gen
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import { dbgRedis } from "../index.js";
import redisClient from "../middleware/redisClient.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";
import logger, {
  loggerJsonFormat,
  logStackError,
} from "../utility/logger.util.js";

/** Helper to clear warehouse cache */
const invalidateWarehouseCache = async (key = "/fms/api/v0/warehouses") => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: "invalidateWarehouseCache",
    });
  } catch (err) {
    logStackError("❌ Warehouse cache invalidation failed", err);
  }
};

/** Create one warehouse (uses pre-save hook to generate code) */
export const createWarehouse = async (req, res) => {
  try {
    const {
      name,
      type,
      site,
      description,
      remarks,
      company,
      groups,
      files,
      extras,
      active,
    } = req.body;
    if (!name || !type || !site) {
      logger.warn("Warehouse Creation - Missing fields", {
        context: "createWarehouse",
        body: req.body,
      });
      return res.status(422).json({
        status: "failure",
        message: "⚠️ name, type and site are required.",
      });
    }

    const wh = await WarehouseModel.create({
      name,
      type,
      site,
      description,
      remarks,
      company,
      groups,
      files,
      extras,
      active,
      createdBy: req.user?.username || "SystemWHCreation",
    });

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Warehouse",
      action: "CREATE",
      recordId: wh._id,
      changes: { newData: wh },
    });

    await invalidateWarehouseCache();

    logger.info("✅ Warehouse created", {
      context: "createWarehouse",
      whId: wh._id,
    });
    loggerJsonFormat.info("✅ Warehouse created", {
      context: "createWarehouse",
      whId: wh._id,
    });

    return res
      .status(201)
      .json({ status: "success", message: "✅ Warehouse created.", data: wh });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError("❌ Warehouse Validation Error", error);
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    if (error.code === 11000) {
      logStackError("❌ Warehouse Duplicate Error", error);
      return res
        .status(409)
        .json({ status: "failure", message: "⚠️ Duplicate code or name." });
    }
    logStackError("❌ Warehouse Creation Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get all warehouses */
export const getAllWarehouses = async (req, res) => {
  try {
    const list = await WarehouseModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });
    dbgRedis("warehouse cache set", redisClient);

    logger.info("✅ Fetched all warehouses", {
      context: "getAllWarehouses",
      count: list.length,
    });
    return res.status(200).json({
      status: "success",
      message: "✅ Warehouses retrieved.",
      count: list.length,
      data: list,
    });
  } catch (error) {
    logStackError("❌ Get All Warehouses Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get one warehouse by ID */
export const getWarehouseById = async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const wh = await WarehouseModel.findById(warehouseId);
    if (!wh) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Warehouse not found." });
    }
    winstonLogger.info(`✅ Retrieved warehouse ${warehouseId}`);
    return res.status(200).json({
      status: "success",
      message: "✅ Warehouse retrieved.",
      data: wh,
    });
  } catch (error) {
    logError("❌ Get Warehouse By ID", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Update one warehouse by ID */
export const updateWarehouseById = async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const updateData = {
      ...req.body,
      updatedBy: req.user?.username || "Unknown",
    };
    const wh = await WarehouseModel.findByIdAndUpdate(warehouseId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!wh) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Warehouse not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Warehouse",
      action: "UPDATE",
      recordId: wh._id,
      changes: { newData: wh },
    });

    await invalidateWarehouseCache();

    winstonLogger.info(`ℹ️ Updated warehouse ${warehouseId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Warehouse updated.", data: wh });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logError("❌ Update Warehouse", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Delete one warehouse by ID */
export const deleteWarehouseById = async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const wh = await WarehouseModel.findByIdAndDelete(warehouseId);
    if (!wh) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Warehouse not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Warehouse",
      action: "DELETE",
      recordId: wh._id,
      changes: null,
    });

    await invalidateWarehouseCache();

    winstonLogger.info(`ℹ️ Deleted warehouse ${warehouseId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Warehouse deleted." });
  } catch (error) {
    logError("❌ Delete Warehouse", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Archive / Unarchive / Get Archived */
export const archiveWarehouseById = async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const wh = await WarehouseModel.findByIdAndUpdate(
      warehouseId,
      { archived: true, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!wh) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Warehouse not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Warehouse",
      action: "ARCHIVE",
      recordId: wh._id,
      changes: { newData: wh },
    });

    await invalidateWarehouseCache();

    return res
      .status(200)
      .json({ status: "success", message: "✅ Warehouse archived.", data: wh });
  } catch (error) {
    logError("❌ Archive Warehouse", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const unarchiveWarehouseById = async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const wh = await WarehouseModel.findByIdAndUpdate(
      warehouseId,
      { archived: false, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!wh) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Warehouse not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Warehouse",
      action: "UNARCHIVE",
      recordId: wh._id,
      changes: { newData: wh },
    });

    await invalidateWarehouseCache();

    return res.status(200).json({
      status: "success",
      message: "✅ Warehouse unarchived.",
      data: wh,
    });
  } catch (error) {
    logError("❌ Unarchive Warehouse", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getArchivedWarehouses = async (req, res) => {
  try {
    const list = await WarehouseModel.find({ archived: true });
    winstonLogger.info(`ℹ️ Retrieved ${list.length} archived warehouses.`);
    return res.status(200).json({
      status: "success",
      message: "✅ Archived warehouses.",
      data: list,
    });
  } catch (error) {
    logError("❌ Get Archived Warehouses", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Bulk Create Warehouses */
export const bulkCreateWarehouses = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: "failure",
      message:
        "⚠️ Request body must be a non-empty array of warehouse objects.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    logger.info("💾 Bulk create: reserving warehouse codes", {
      context: "bulkCreateWarehouses",
      count: n,
    });

    const counter = await WarehouseCounterModel.findOneAndUpdate(
      { _id: "whCode" },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq,
      start = end - n + 1;

    docs.forEach((d, i) => {
      const num = (start + i).toString().padStart(3, "0");
      d.code = `WH_${num}`;
      d.createdBy = req.user?.username || "SystemWHCreation";
    });

    const created = await WarehouseModel.insertMany(docs, { session });

    await Promise.all(
      created.map((wh) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Warehouse",
          action: "BULK_CREATE",
          recordId: wh._id,
          changes: { newData: wh },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateWarehouseCache();

    return res.status(201).json({
      status: "success",
      message: `✅ ${created.length} warehouses created.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk create warehouses error", error);
    return res.status(500).json({ status: "failure", message: error.message });
  }
};

/** Bulk Update Warehouses */
export const bulkUpdateWarehouses = async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      status: "failure",
      message:
        "⚠️ Request body must be a non-empty array of { id or _id, update }.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    logger.info("🔄 Bulk update warehouses", {
      context: "bulkUpdateWarehouses",
      count: updates.length,
    });

    const results = [];
    for (const entry of updates) {
      const id = entry.id ?? entry._id;
      if (!mongoose.Types.ObjectId.isValid(id))
        throw new Error(`Invalid ID: ${id}`);

      const wh = await WarehouseModel.findByIdAndUpdate(
        id,
        { ...entry.update, updatedBy: req.user?.username || "Unknown" },
        { new: true, runValidators: true, session }
      );
      if (!wh) throw new Error(`Warehouse not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || "67ec2fb004d3cc3237b58772",
        module: "Warehouse",
        action: "BULK_UPDATE",
        recordId: wh._id,
        changes: { newData: wh },
      });
      results.push(wh);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateWarehouseCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${results.length} warehouses updated.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk update warehouses error", error);
    return res.status(500).json({ status: "failure", message: error.message });
  }
};

/** Bulk Delete Warehouses */
export const bulkDeleteWarehouses = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Request body must include non-empty array of ids.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    logger.info("🗑️ Bulk delete warehouses", {
      context: "bulkDeleteWarehouses",
      count: ids.length,
    });

    const { deletedCount } = await WarehouseModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error("No warehouses deleted.");

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Warehouse",
          action: "BULK_DELETE",
          recordId: id,
          changes: null,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateWarehouseCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${deletedCount} warehouses deleted.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk delete warehouses error", error);
    return res.status(500).json({ status: "failure", message: error.message });
  }
};
