// controllers/productDimVersion.controller.js

import mongoose from "mongoose";
import { ProductDimVersionModel } from "../models/productDimVersion.model.js";
import { ProductDimVersionCounterModel } from "../models/counter.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";

// Helper: invalidate version cache
const invalidateVersionCache = async (key = "/fms/api/v0/versions") => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: "invalidateVersionCache",
    });
  } catch (err) {
    logStackError("❌ Version cache invalidation failed", err);
  }
};

/** Create a new Product Dimension Version */
export const createVersionConfig = async (req, res) => {
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

    const ver = await ProductDimVersionModel.create({
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
      module: "ProductDimVersion",
      action: "CREATE",
      recordId: ver._id,
      changes: { newData: ver },
    });

    await invalidateVersionCache();
    winstonLogger.info(`✅ Version config created: ${ver._id}`);

    return res.status(201).json({
      status: "success",
      message: "✅ Version configuration created successfully.",
      data: ver,
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
    logStackError("❌ Version creation error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Get all Version Configurations */
export const getAllVersionConfigs = async (req, res) => {
  try {
    const list = await ProductDimVersionModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });

    winstonLogger.info(`✅ Fetched all version configs (${list.length})`);
    return res.status(200).json({
      status: "success",
      count: list.length,
      data: list,
    });
  } catch (error) {
    logStackError("❌ Get all version configs error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Get archived Version Configurations */
export const getArchivedVersionConfigs = async (req, res) => {
  try {
    const archived = await ProductDimVersionModel.find({ archived: true });
    return res.status(200).json({
      status: "success",
      data: archived,
    });
  } catch (error) {
    logError("❌ Get archived version configs error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Get one Version Config by ID */
export const getVersionConfigById = async (req, res) => {
  try {
    const { versionId } = req.params;
    const cfg = await ProductDimVersionModel.findById(versionId);
    if (!cfg) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Not found." });
    }
    return res.status(200).json({ status: "success", data: cfg });
  } catch (error) {
    logError("❌ Get version config by ID error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Update a Version Config by ID */
export const updateVersionConfigById = async (req, res) => {
  try {
    const { versionId } = req.params;
    const updateData = {
      ...req.body,
      updatedBy: req.user?.username || "Unknown",
    };
    const cfg = await ProductDimVersionModel.findByIdAndUpdate(
      versionId,
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
      module: "ProductDimVersion",
      action: "UPDATE",
      recordId: cfg._id,
      changes: { newData: cfg },
    });

    await invalidateVersionCache();
    return res.status(200).json({ status: "success", data: cfg });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logError("❌ Update version config error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Delete a Version Config by ID */
export const deleteVersionConfigById = async (req, res) => {
  try {
    const { versionId } = req.params;
    const cfg = await ProductDimVersionModel.findByIdAndDelete(versionId);
    if (!cfg) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "ProductDimVersion",
      action: "DELETE",
      recordId: cfg._id,
    });

    await invalidateVersionCache();
    return res.status(200).json({ status: "success", message: "✅ Deleted." });
  } catch (error) {
    logError("❌ Delete version config error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Archive / Unarchive */
export const archiveVersionConfigById = async (req, res) => {
  try {
    const { versionId } = req.params;
    const cfg = await ProductDimVersionModel.findByIdAndUpdate(
      versionId,
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
      module: "ProductDimVersion",
      action: "ARCHIVE",
      recordId: cfg._id,
    });

    await invalidateVersionCache();
    return res.status(200).json({ status: "success", data: cfg });
  } catch (error) {
    logError("❌ Archive version config error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

export const unarchiveVersionConfigById = async (req, res) => {
  try {
    const { versionId } = req.params;
    const cfg = await ProductDimVersionModel.findByIdAndUpdate(
      versionId,
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
      module: "ProductDimVersion",
      action: "UNARCHIVE",
      recordId: cfg._id,
    });

    await invalidateVersionCache();
    return res.status(200).json({ status: "success", data: cfg });
  } catch (error) {
    logError("❌ Unarchive version config error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Bulk Create / Update / Delete */
export const bulkCreateVersionConfigs = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Provide a non-empty array of version configs.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    const counter = await ProductDimVersionCounterModel.findOneAndUpdate(
      { _id: "configCode" },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq,
      start = end - n + 1;

    docs.forEach((d, i) => {
      d.code = `VER_${(start + i).toString().padStart(3, "0")}`;
    });

    const created = await ProductDimVersionModel.insertMany(docs, { session });
    await Promise.all(
      created.map((cfg) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "ProductDimVersion",
          action: "BULK_CREATE",
          recordId: cfg._id,
          changes: { newData: cfg },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateVersionCache();

    return res.status(201).json({
      status: "success",
      message: `✅ ${created.length} version configs created.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk create version configs error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk creation.",
      error: error.message,
    });
  }
};

export const bulkUpdateVersionConfigs = async (req, res) => {
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
      const cfg = await ProductDimVersionModel.findByIdAndUpdate(
        id,
        { ...entry.update, updatedBy: req.user?.username || "Unknown" },
        { new: true, runValidators: true, session }
      );
      if (!cfg) throw new Error(`Not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || "67ec2fb004d3cc3237b58772",
        module: "ProductDimVersion",
        action: "BULK_UPDATE",
        recordId: cfg._id,
        changes: { newData: cfg },
      });
      results.push(cfg);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateVersionCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${results.length} updated successfully.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk update version configs error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk update.",
      error: error.message,
    });
  }
};

export const bulkDeleteVersionConfigs = async (req, res) => {
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
    const { deletedCount } = await ProductDimVersionModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error("No configs deleted.");

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "ProductDimVersion",
          action: "BULK_DELETE",
          recordId: id,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateVersionCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${deletedCount} configs deleted.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk delete version configs error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk delete.",
      error: error.message,
    });
  }
};
