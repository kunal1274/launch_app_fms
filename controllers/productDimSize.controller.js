// controllers/productDimSize.controller.js

import mongoose from "mongoose";
import { ProductDimSizeModel } from "../models/productDimSize.model.js";
import { ProductDimSizeCounterModel } from "../models/counter.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";

// Helper: invalidate size configs cache
const invalidateSizeCache = async (key = "/fms/api/v0/sizes") => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: "invalidateSizeCache",
    });
  } catch (err) {
    logStackError("❌ Size cache invalidation failed", err);
  }
};

/** Create a new Product Dimension Size */
export const createSizeConfig = async (req, res) => {
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
        message: "⚠️ name, type and a non-empty values array are required.",
      });
    }

    const sizeCfg = await ProductDimSizeModel.create({
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
      module: "ProductDimSize",
      action: "CREATE",
      recordId: sizeCfg._id,
      changes: { newData: sizeCfg },
    });

    await invalidateSizeCache();
    winstonLogger.info(`✅ Size config created: ${sizeCfg._id}`);

    return res.status(201).json({
      status: "success",
      message: "✅ Size configuration created successfully.",
      data: sizeCfg,
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
    logStackError("❌ Size creation error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Get all Size Configurations */
export const getAllSizeConfigs = async (req, res) => {
  try {
    const list = await ProductDimSizeModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });

    winstonLogger.info(`✅ Fetched all size configs (${list.length})`);
    return res.status(200).json({
      status: "success",
      count: list.length,
      data: list,
    });
  } catch (error) {
    logStackError("❌ Get all size configs error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Get archived Size Configurations */
export const getArchivedSizeConfigs = async (req, res) => {
  try {
    const archived = await ProductDimSizeModel.find({ archived: true });
    return res.status(200).json({
      status: "success",
      data: archived,
    });
  } catch (error) {
    logError("❌ Get archived size configs error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Get one Size Config by ID */
export const getSizeConfigById = async (req, res) => {
  try {
    const { sizeId } = req.params;
    const cfg = await ProductDimSizeModel.findById(sizeId);
    if (!cfg) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Not found." });
    }
    return res.status(200).json({ status: "success", data: cfg });
  } catch (error) {
    logError("❌ Get size config by ID error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Update a Size Config by ID */
export const updateSizeConfigById = async (req, res) => {
  try {
    const { sizeId } = req.params;
    const updateData = {
      ...req.body,
      updatedBy: req.user?.username || "Unknown",
    };
    const cfg = await ProductDimSizeModel.findByIdAndUpdate(
      sizeId,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );
    if (!cfg) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "ProductDimSize",
      action: "UPDATE",
      recordId: cfg._1d,
      changes: { newData: cfg },
    });

    await invalidateSizeCache();
    return res.status(200).json({ status: "success", data: cfg });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logError("❌ Update size config error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Delete a Size Config by ID */
export const deleteSizeConfigById = async (req, res) => {
  try {
    const { sizeId } = req.params;
    const cfg = await ProductDimSizeModel.findByIdAndDelete(sizeId);
    if (!cfg) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "ProductDimSize",
      action: "DELETE",
      recordId: cfg._id,
    });

    await invalidateSizeCache();
    return res.status(200).json({ status: "success", message: "✅ Deleted." });
  } catch (error) {
    logError("❌ Delete size config error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Archive / Unarchive */
export const archiveSizeConfigById = async (req, res) => {
  try {
    const { sizeId } = req.params;
    const cfg = await ProductDimSizeModel.findByIdAndUpdate(
      sizeId,
      { archived: true, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!cfg) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "ProductDimSize",
      action: "ARCHIVE",
      recordId: cfg._id,
    });

    await invalidateSizeCache();
    return res.status(200).json({ status: "success", data: cfg });
  } catch (error) {
    logError("❌ Archive size config error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

export const unarchiveSizeConfigById = async (req, res) => {
  try {
    const { sizeId } = req.params;
    const cfg = await ProductDimSizeModel.findByIdAndUpdate(
      sizeId,
      { archived: false, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!cfg) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "ProductDimSize",
      action: "UNARCHIVE",
      recordId: cfg._id,
    });

    await invalidateSizeCache();
    return res.status(200).json({ status: "success", data: cfg });
  } catch (error) {
    logError("❌ Unarchive size config error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Bulk Create / Update / Delete */
export const bulkCreateSizeConfigs = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Provide a non-empty array of size configs.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    const counter = await ProductDimSizeCounterModel.findOneAndUpdate(
      { _id: "sizeCode" },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq,
      start = end - n + 1;

    docs.forEach((d, i) => {
      d.code = `SIZ_${(start + i).toString().padStart(3, "0")}`;
    });

    const created = await ProductDimSizeModel.insertMany(docs, { session });
    await Promise.all(
      created.map((cfg) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "ProductDimSize",
          action: "BULK_CREATE",
          recordId: cfg._id,
          changes: { newData: cfg },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateSizeCache();

    return res.status(201).json({
      status: "success",
      message: `✅ ${created.length} size configs created.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk create size configs error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk creation.",
      error: error.message,
    });
  }
};

export const bulkUpdateSizeConfigs = async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Provide a non-empty array of { id or _id, update }.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const results = [];
    for (const entry of updates) {
      const id = entry.id ?? entry._id;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid ID: ${id}`);
      }
      const cfg = await ProductDimSizeModel.findByIdAndUpdate(
        id,
        { ...entry.update, updatedBy: req.user?.username || "Unknown" },
        { new: true, runValidators: true, session }
      );
      if (!cfg) throw new Error(`Not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || "67ec2fb004d3cc3237b58772",
        module: "ProductDimSize",
        action: "BULK_UPDATE",
        recordId: cfg._id,
        changes: { newData: cfg },
      });
      results.push(cfg);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateSizeCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${results.length} updated successfully.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk update size configs error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk update.",
      error: error.message,
    });
  }
};

export const bulkDeleteSizeConfigs = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Provide a non-empty array of ids.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { deletedCount } = await ProductDimSizeModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error("No configs deleted.");

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "ProductDimSize",
          action: "BULK_DELETE",
          recordId: id,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateSizeCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${deletedCount} configs deleted.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk delete size configs error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk delete.",
      error: error.message,
    });
  }
};
