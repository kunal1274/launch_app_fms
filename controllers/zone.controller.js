// controllers/zone.controller.js

import mongoose from "mongoose";
import { ZoneModel } from "../models/zone.model.js";
import { ZoneCounterModel } from "../models/counter.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";
import { WarehouseModel } from "../models/warehouse.model.js";

/** Helper to invalidate the Zones cache */
const invalidateZoneCache = async (key = "/fms/api/v0/zones") => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: "invalidateZoneCache",
    });
  } catch (err) {
    logStackError("❌ Zone cache invalidation failed", err);
  }
};

/** Create a new Zone */
export const createZone = async (req, res) => {
  try {
    const {
      name,
      type,
      warehouse,
      description,
      zoneAddress,
      remarks,
      company,
      groups,
      files,
      extras,
      active,
    } = req.body;
    if (!name || !type || !warehouse) {
      logger.warn("Zone Creation - Missing fields", {
        context: "createZone",
        body: req.body,
      });
      return res.status(422).json({
        status: "failure",
        message: "⚠️ name, type and warehouse are required.",
      });
    }

    const wh = await WarehouseModel.findById(warehouse);
    if (!wh) {
      return res
        .status(404)
        .json({
          status: "failure",
          message: `⚠️ Warehouse ${warehouse} not found.`,
        });
    }

    const zone = await ZoneModel.create({
      name,
      type,
      warehouse,
      description,
      zoneAddress,
      remarks,
      company,
      groups,
      files,
      extras,
      active,
      createdBy: req.user?.username || "67ec2fb004d3cc3237b58772",
    });

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Zone",
      action: "CREATE",
      recordId: zone._id,
      changes: { newData: zone },
    });

    await invalidateZoneCache();

    winstonLogger.info(`✅ Zone created: ${zone._id}`);
    return res.status(201).json({
      status: "success",
      message: "✅ Zone created successfully.",
      data: zone,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError("❌ Zone Validation Error", error);
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    if (error.code === 11000) {
      logStackError("❌ Zone Duplicate Error", error);
      return res.status(409).json({
        status: "failure",
        message: "A zone with this code or name already exists.",
      });
    }
    logStackError("❌ Zone Creation Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get all Zones */
export const getAllZones = async (req, res) => {
  try {
    const zones = await ZoneModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(zones), { EX: 300 });

    winstonLogger.info(`✅ Fetched all zones (${zones.length})`);
    return res.status(200).json({
      status: "success",
      message: "✅ Zones retrieved successfully.",
      count: zones.length,
      data: zones,
    });
  } catch (error) {
    logStackError("❌ Get All Zones Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get a Zone by ID */
export const getZoneById = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const zone = await ZoneModel.findById(zoneId);
    if (!zone) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Zone not found." });
    }
    winstonLogger.info(`✅ Retrieved zone: ${zoneId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Zone retrieved.", data: zone });
  } catch (error) {
    logError("❌ Get Zone By ID", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Update a Zone by ID */
export const updateZoneById = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const updateData = {
      ...req.body,
      updatedBy: req.user?.username || "Unknown",
    };
    const zone = await ZoneModel.findByIdAndUpdate(zoneId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!zone) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Zone not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Zone",
      action: "UPDATE",
      recordId: zone._id,
      changes: { newData: zone },
    });

    await invalidateZoneCache();

    winstonLogger.info(`ℹ️ Updated zone: ${zoneId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Zone updated.", data: zone });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logError("❌ Update Zone", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Delete a Zone by ID */
export const deleteZoneById = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const zone = await ZoneModel.findByIdAndDelete(zoneId);
    if (!zone) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Zone not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Zone",
      action: "DELETE",
      recordId: zone._id,
      changes: null,
    });

    await invalidateZoneCache();

    winstonLogger.info(`ℹ️ Deleted zone: ${zoneId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Zone deleted." });
  } catch (error) {
    logError("❌ Delete Zone", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Archive a Zone by ID */
export const archiveZoneById = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const zone = await ZoneModel.findByIdAndUpdate(
      zoneId,
      { archived: true, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!zone) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Zone not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Zone",
      action: "ARCHIVE",
      recordId: zone._id,
      changes: { newData: zone },
    });

    await invalidateZoneCache();

    return res
      .status(200)
      .json({ status: "success", message: "✅ Zone archived.", data: zone });
  } catch (error) {
    logError("❌ Archive Zone", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Unarchive a Zone by ID */
export const unarchiveZoneById = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const zone = await ZoneModel.findByIdAndUpdate(
      zoneId,
      { archived: false, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!zone) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Zone not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Zone",
      action: "UNARCHIVE",
      recordId: zone._id,
      changes: { newData: zone },
    });

    await invalidateZoneCache();

    return res
      .status(200)
      .json({ status: "success", message: "✅ Zone unarchived.", data: zone });
  } catch (error) {
    logError("❌ Unarchive Zone", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get all archived Zones */
export const getArchivedZones = async (req, res) => {
  try {
    const zones = await ZoneModel.find({ archived: true });
    winstonLogger.info(`ℹ️ Retrieved ${zones.length} archived zones.`);
    return res.status(200).json({
      status: "success",
      message: "✅ Archived zones retrieved.",
      data: zones,
    });
  } catch (error) {
    logError("❌ Get Archived Zones", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Bulk Create Zones */
export const bulkCreateZones = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Request body must be a non-empty array of zone objects.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    logger.info("💾 Bulk create: reserving zone codes", {
      context: "bulkCreateZones",
      count: n,
    });

    const counter = await ZoneCounterModel.findOneAndUpdate(
      { _id: "zoneCode" },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq;
    const start = end - n + 1;

    docs.forEach((d, i) => {
      const seqNum = (start + i).toString().padStart(3, "0");
      d.code = `ZN_${seqNum}`;
      d.createdBy = req.user?.username || "SystemZoneCreation";
    });

    const created = await ZoneModel.insertMany(docs, { session });

    await Promise.all(
      created.map((zone) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Zone",
          action: "BULK_CREATE",
          recordId: zone._id,
          changes: { newData: zone },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateZoneCache();

    return res.status(201).json({
      status: "success",
      message: `✅ ${created.length} zones created successfully.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk create zones error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk zone creation.",
      error: error.message,
    });
  }
};

/** Bulk Update Zones */
export const bulkUpdateZones = async (req, res) => {
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
    logger.info("🔄 Bulk update zones", {
      context: "bulkUpdateZones",
      count: updates.length,
    });

    const results = [];
    for (const entry of updates) {
      const id = entry.id ?? entry._id;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid zone ID: ${id}`);
      }

      const zone = await ZoneModel.findByIdAndUpdate(
        id,
        { ...entry.update, updatedBy: req.user?.username || "Unknown" },
        { new: true, runValidators: true, session }
      );
      if (!zone) throw new Error(`Zone not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || "67ec2fb004d3cc3237b58772",
        module: "Zone",
        action: "BULK_UPDATE",
        recordId: zone._id,
        changes: { newData: zone },
      });

      results.push(zone);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateZoneCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${results.length} zones updated successfully.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk update zones error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk zone update.",
      error: error.message,
    });
  }
};

/** Bulk Delete Zones */
export const bulkDeleteZones = async (req, res) => {
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
    logger.info("🗑️ Bulk delete zones", {
      context: "bulkDeleteZones",
      count: ids.length,
    });

    const { deletedCount } = await ZoneModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error("No zones deleted.");

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Zone",
          action: "BULK_DELETE",
          recordId: id,
          changes: null,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateZoneCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${deletedCount} zones deleted successfully.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk delete zones error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk zone deletion.",
      error: error.message,
    });
  }
};
