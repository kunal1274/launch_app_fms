// controllers/productDimConfig.controller.js

import mongoose from "mongoose";
import { ProductDimConfigModel } from "../models/productDimConfig.model.js";
import { ProductDimConfigCounterModel } from "../models/counter.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";

// Helper: invalidate configurations cache
const invalidateConfigCache = async (key = "/fms/api/v0/configurations") => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: "invalidateConfigCache",
    });
  } catch (err) {
    logStackError("❌ Configuration cache invalidation failed", err);
  }
};

/** Create a new Product Dimension Configuration */
export const createConfig = async (req, res) => {
  try {
    const {
      name,
      type,
      values,
      description,
      active,
      groups,
      company,
      files,
      extras,
    } = req.body;
    if (!name || !type || !Array.isArray(values) || values.length === 0) {
      return res.status(422).json({
        status: "failure",
        message: "⚠️ name, type and non-empty values array are required.",
      });
    }
    const config = await ProductDimConfigModel.create({
      name,
      type,
      values,
      description,
      active,
      groups,
      company,
      files,
      extras,
    });

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "ProductDimConfig",
      action: "CREATE",
      recordId: config._id,
      changes: { newData: config },
    });

    await invalidateConfigCache();
    winstonLogger.info(`✅ Configuration created: ${config._id}`);
    return res.status(201).json({
      status: "success",
      message: "✅ Configuration created.",
      data: config,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ status: "failure", message: "Duplicate code or name." });
    }
    logStackError("❌ Configuration creation error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Get all Configurations */
export const getAllConfigs = async (req, res) => {
  try {
    const list = await ProductDimConfigModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });
    winstonLogger.info(`✅ Fetched all configurations (${list.length})`);
    return res
      .status(200)
      .json({ status: "success", count: list.length, data: list });
  } catch (error) {
    logStackError("❌ Get all configurations error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get archived Configurations */
export const getArchivedConfigs = async (req, res) => {
  try {
    const archived = await ProductDimConfigModel.find({ archived: true });
    return res.status(200).json({ status: "success", data: archived });
  } catch (error) {
    logError("❌ Get archived configurations error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get Configuration by ID */
export const getConfigById = async (req, res) => {
  try {
    const { configId } = req.params;
    const cfg = await ProductDimConfigModel.findById(configId);
    if (!cfg)
      return res.status(404).json({ status: "failure", message: "Not found." });
    return res.status(200).json({ status: "success", data: cfg });
  } catch (error) {
    logError("❌ Get configuration by ID error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Update Configuration by ID */
export const updateConfigById = async (req, res) => {
  try {
    const { configId } = req.params;
    const updateData = {
      ...req.body,
      updatedBy: req.user?.username || "Unknown",
    };
    const cfg = await ProductDimConfigModel.findByIdAndUpdate(
      configId,
      updateData,
      { new: true, runValidators: true }
    );
    if (!cfg)
      return res.status(404).json({ status: "failure", message: "Not found." });

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "ProductDimConfig",
      action: "UPDATE",
      recordId: cfg._id,
      changes: { newData: cfg },
    });
    await invalidateConfigCache();
    return res.status(200).json({ status: "success", data: cfg });
  } catch (error) {
    if (error.name === "ValidationError")
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    logError("❌ Update configuration error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Delete Configuration by ID */
export const deleteConfigById = async (req, res) => {
  try {
    const { configId } = req.params;
    const cfg = await ProductDimConfigModel.findByIdAndDelete(configId);
    if (!cfg)
      return res.status(404).json({ status: "failure", message: "Not found." });

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "ProductDimConfig",
      action: "DELETE",
      recordId: cfg._id,
    });
    await invalidateConfigCache();
    return res.status(200).json({ status: "success", message: "Deleted." });
  } catch (error) {
    logError("❌ Delete configuration error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Archive / Unarchive Configurations */
export const archiveConfigById = async (req, res) => {
  try {
    const { configId } = req.params;
    const cfg = await ProductDimConfigModel.findByIdAndUpdate(
      configId,
      { archived: true, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!cfg)
      return res.status(404).json({ status: "failure", message: "Not found." });
    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "ProductDimConfig",
      action: "ARCHIVE",
      recordId: cfg._id,
    });
    await invalidateConfigCache();
    return res.status(200).json({ status: "success", data: cfg });
  } catch (error) {
    logError("❌ Archive configuration error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};
export const unarchiveConfigById = async (req, res) => {
  try {
    const { configId } = req.params;
    const cfg = await ProductDimConfigModel.findByIdAndUpdate(
      configId,
      { archived: false, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!cfg)
      return res.status(404).json({ status: "failure", message: "Not found." });
    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "ProductDimConfig",
      action: "UNARCHIVE",
      recordId: cfg._id,
    });
    await invalidateConfigCache();
    return res.status(200).json({ status: "success", data: cfg });
  } catch (error) {
    logError("❌ Unarchive configuration error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Bulk operations (create/update/delete) */
export const bulkCreateConfigs = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0)
    return res
      .status(400)
      .json({ status: "failure", message: "Provide non-empty array." });
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    const counter = await ProductDimConfigCounterModel.findOneAndUpdate(
      { _id: "configCode" },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq,
      start = end - n + 1;
    docs.forEach((d, i) => {
      d.code = `CFG_${(start + i).toString().padStart(3, "0")}`;
    });
    const created = await ProductDimConfigModel.insertMany(docs, { session });
    await Promise.all(
      created.map((c) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "ProductDimConfig",
          action: "BULK_CREATE",
          recordId: c._id,
          changes: { newData: c },
        })
      )
    );
    session.commitTransaction();
    session.endSession();
    await invalidateConfigCache();
    res.status(201).json({
      status: "success",
      message: `Created ${created.length}`,
      data: created,
    });
  } catch (e) {
    session.abortTransaction();
    session.endSession();
    logStackError("Bulk create configs error", e);
    res
      .status(500)
      .json({ status: "failure", message: "Error", error: e.message });
  }
};
export const bulkUpdateConfigs = async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0)
    return res
      .status(400)
      .json({ status: "failure", message: "Provide non-empty array." });
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const results = [];
    for (const entry of updates) {
      const id = entry.id ?? entry._id;
      if (!mongoose.Types.ObjectId.isValid(id))
        throw new Error(`Invalid ID ${id}`);
      const cfg = await ProductDimConfigModel.findByIdAndUpdate(
        id,
        { ...entry.update, updatedBy: req.user?.username || "Unknown" },
        { new: true, runValidators: true, session }
      );
      if (!cfg) throw new Error(`Not found ${id}`);
      await createAuditLog({
        user: req.user?.username || "67ec2fb004d3cc3237b58772",
        module: "ProductDimConfig",
        action: "BULK_UPDATE",
        recordId: cfg._id,
        changes: { newData: cfg },
      });
      results.push(cfg);
    }
    session.commitTransaction();
    session.endSession();
    await invalidateConfigCache();
    res.status(200).json({
      status: "success",
      message: `Updated ${results.length}`,
      data: results,
    });
  } catch (e) {
    session.abortTransaction();
    session.endSession();
    logStackError("Bulk update configs error", e);
    res
      .status(500)
      .json({ status: "failure", message: "Error", error: e.message });
  }
};
export const bulkDeleteConfigs = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0)
    return res
      .status(400)
      .json({ status: "failure", message: "Provide non-empty ids array." });
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { deletedCount } = await ProductDimConfigModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error("No deleted");
    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "ProductDimConfig",
          action: "BULK_DELETE",
          recordId: id,
        })
      )
    );
    session.commitTransaction();
    session.endSession();
    await invalidateConfigCache();
    res
      .status(200)
      .json({ status: "success", message: `Deleted ${deletedCount}` });
  } catch (e) {
    session.abortTransaction();
    session.endSession();
    logStackError("Bulk delete configs error", e);
    res
      .status(500)
      .json({ status: "failure", message: "Error", error: e.message });
  }
};
