// controllers/productDimColor.controller.js

import mongoose from "mongoose";
import { ProductDimColorModel } from "../models/productDimColor.model.js";
import { ProductDimColorCounterModel } from "../models/counter.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";

// Helper: clear color configs cache
const invalidateColorCache = async (key = "/fms/api/v0/colors") => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: "invalidateColorCache",
    });
  } catch (err) {
    logStackError("❌ Color cache invalidation failed", err);
  }
};

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/** Create a new Product Dimension Color */
export const createColorConfig = async (req, res) => {
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

    const colorCfg = await ProductDimColorModel.create({
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
      module: "ProductDimColor",
      action: "CREATE",
      recordId: colorCfg._id,
      changes: { newData: colorCfg },
    });

    await invalidateColorCache();
    winstonLogger.info(`✅ Color config created: ${colorCfg._id}`);

    return res.status(201).json({
      status: "success",
      message: "✅ Color configuration created successfully.",
      data: colorCfg,
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
    logStackError("❌ Color creation error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** ──────────────────────────────
 *  Append new values (leave existing intact)
 * ────────────────────────────── */
export const appendColorValues = async (req, res) => {
  try {
    const { colorId } = req.params;
    const { values } = req.body;

    if (!isValidObjectId(colorId)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid color ID" });
    }
    if (!Array.isArray(values) || values.length === 0) {
      return res.status(422).json({
        status: "failure",
        message: "⚠️ `values` must be a non-empty array of strings.",
      });
    }

    // $addToSet avoids duplicates, $each lets us add multiple
    const clr = await ProductDimColorModel.findByIdAndUpdate(
      colorId,
      {
        $addToSet: { values: { $each: values } },
        updatedBy: req.user?.username,
      },
      { new: true, runValidators: true }
    );
    if (!clr) {
      return res.status(404).json({ status: "failure", message: "Not found." });
    }

    await createAuditLog({
      user: req.user?.username,
      module: "ProductDimColor",
      action: "APPEND_VALUES",
      recordId: clr._id,
      changes: { appended: values },
    });
    await invalidateColorCache();

    return res.status(200).json({ status: "success", data: clr });
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(422).json({ status: "failure", message: err.message });
    }
    logError("❌ Append values error", err);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: err.message,
    });
  }
};

/** Get all Color Configurations */
export const getAllColorConfigs = async (req, res) => {
  try {
    const list = await ProductDimColorModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });

    winstonLogger.info(`✅ Fetched all color configs (${list.length})`);
    return res.status(200).json({
      status: "success",
      count: list.length,
      data: list,
    });
  } catch (error) {
    logStackError("❌ Get all color configs error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Get archived Color Configurations */
export const getArchivedColorConfigs = async (req, res) => {
  try {
    const archived = await ProductDimColorModel.find({ archived: true });
    return res.status(200).json({
      status: "success",
      data: archived,
    });
  } catch (error) {
    logError("❌ Get archived color configs error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Get one Color Configuration by ID */
export const getColorConfigById = async (req, res) => {
  try {
    const { colorId } = req.params;
    const cfg = await ProductDimColorModel.findById(colorId);
    if (!cfg) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Not found." });
    }
    return res.status(200).json({ status: "success", data: cfg });
  } catch (error) {
    logError("❌ Get color config by ID error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Update a Color Configuration by ID */
export const updateColorConfigById = async (req, res) => {
  try {
    const { colorId } = req.params;
    const updateData = {
      ...req.body,
      updatedBy: req.user?.username || "Unknown",
    };
    const cfg = await ProductDimColorModel.findByIdAndUpdate(
      colorId,
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
      module: "ProductDimColor",
      action: "UPDATE",
      recordId: cfg._id,
      changes: { newData: cfg },
    });

    await invalidateColorCache();
    return res.status(200).json({ status: "success", data: cfg });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logError("❌ Update color config error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Delete a Color Configuration by ID */
export const deleteColorConfigById = async (req, res) => {
  try {
    const { colorId } = req.params;
    const cfg = await ProductDimColorModel.findByIdAndDelete(colorId);
    if (!cfg) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "ProductDimColor",
      action: "DELETE",
      recordId: cfg._id,
    });

    await invalidateColorCache();
    return res.status(200).json({ status: "success", message: "✅ Deleted." });
  } catch (error) {
    logError("❌ Delete color config error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Archive / Unarchive */
export const archiveColorConfigById = async (req, res) => {
  try {
    const { colorId } = req.params;
    const cfg = await ProductDimColorModel.findByIdAndUpdate(
      colorId,
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
      module: "ProductDimColor",
      action: "ARCHIVE",
      recordId: cfg._id,
    });

    await invalidateColorCache();
    return res.status(200).json({ status: "success", data: cfg });
  } catch (error) {
    logError("❌ Archive color config error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

export const unarchiveColorConfigById = async (req, res) => {
  try {
    const { colorId } = req.params;
    const cfg = await ProductDimColorModel.findByIdAndUpdate(
      colorId,
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
      module: "ProductDimColor",
      action: "UNARCHIVE",
      recordId: cfg._id,
    });

    await invalidateColorCache();
    return res.status(200).json({ status: "success", data: cfg });
  } catch (error) {
    logError("❌ Unarchive color config error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/** Bulk Create / Update / Delete */
export const bulkCreateColorConfigs = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Provide a non-empty array of color configs.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    const counter = await ProductDimColorCounterModel.findOneAndUpdate(
      { _id: "colorCode" },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq,
      start = end - n + 1;

    docs.forEach((d, i) => {
      d.code = `COL_${(start + i).toString().padStart(3, "0")}`;
    });

    const created = await ProductDimColorModel.insertMany(docs, { session });
    await Promise.all(
      created.map((cfg) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "ProductDimColor",
          action: "BULK_CREATE",
          recordId: cfg._id,
          changes: { newData: cfg },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateColorCache();

    return res.status(201).json({
      status: "success",
      message: `✅ ${created.length} color configs created.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk create color configs error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk creation.",
      error: error.message,
    });
  }
};

export const bulkUpdateColorConfigs = async (req, res) => {
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
      const cfg = await ProductDimColorModel.findByIdAndUpdate(
        id,
        { ...entry.update, updatedBy: req.user?.username || "Unknown" },
        { new: true, runValidators: true, session }
      );
      if (!cfg) throw new Error(`Not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || "67ec2fb004d3cc3237b58772",
        module: "ProductDimColor",
        action: "BULK_UPDATE",
        recordId: cfg._id,
        changes: { newData: cfg },
      });
      results.push(cfg);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateColorCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${results.length} updated successfully.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk update color configs error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk update.",
      error: error.message,
    });
  }
};

export const bulkDeleteColorConfigs = async (req, res) => {
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
    const { deletedCount } = await ProductDimColorModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error("No configs deleted.");

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "ProductDimColor",
          action: "BULK_DELETE",
          recordId: id,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateColorCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${deletedCount} configs deleted.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk delete color configs error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk delete.",
      error: error.message,
    });
  }
};
