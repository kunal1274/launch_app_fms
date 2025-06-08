// controllers/location.controller.js

import mongoose from "mongoose";
import { LocationModel } from "../models/location.model.js";
import { LocationCounterModel } from "../models/counter.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";
import { ZoneModel } from "../models/zone.model.js";
import { WarehouseModel } from "../models/warehouse.model.js";

/** Helper to clear Locations cache */
const invalidateLocationCache = async (key = "/fms/api/v0/locations") => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: "invalidateLocationCache",
    });
  } catch (err) {
    logStackError("❌ Location cache invalidation failed", err);
  }
};

/** Create a new Location */
export const createLocation = async (req, res) => {
  try {
    const {
      name,
      type,
      warehouse,
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

    // require name, type, and at least warehouse or zone
    if (!name || !type || (!warehouse && !zone)) {
      logger.warn("Location Creation - Missing required fields", {
        context: "createLocation",
        body: req.body,
      });
      return res.status(422).json({
        status: "failure",
        message:
          "⚠️ name and type are required, and at least one of warehouse or zone.",
      });
    }
    if (warehouse) {
      const wh = await WarehouseModel.findById(warehouse);
      if (!wh) {
        return res.status(404).json({
          status: "failure",
          message: `⚠️ Warehouse ${warehouse} not found.`,
        });
      }
    }
    if (zone) {
      const zn = await ZoneModel.findById(zone);
      if (!zn) {
        return res.status(404).json({
          status: "failure",
          message: `⚠️ Zone ${zone} not found.`,
        });
      }
    }

    const loc = await LocationModel.create({
      name,
      type,
      warehouse,
      zone,
      description,
      locationLatLng,
      remarks,
      company,
      groups,
      files,
      extras,
      active,
      createdBy: req.user?.username || "SystemLocationCreation",
    });

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Location",
      action: "CREATE",
      recordId: loc._id,
      changes: { newData: loc },
    });

    await invalidateLocationCache();

    winstonLogger.info(`✅ Location created: ${loc._id}`);
    return res.status(201).json({
      status: "success",
      message: "✅ Location created successfully.",
      data: loc,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError("❌ Location Validation Error", error);
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    if (error.code === 11000) {
      logStackError("❌ Location Duplicate Error", error);
      return res.status(409).json({
        status: "failure",
        message: "A location with that code or name already exists.",
      });
    }
    logStackError("❌ Location Creation Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get all Locations */
export const getAllLocations = async (req, res) => {
  try {
    const list = await LocationModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });

    winstonLogger.info(`✅ Fetched all locations (${list.length})`);
    return res.status(200).json({
      status: "success",
      message: "✅ Locations retrieved successfully.",
      count: list.length,
      data: list,
    });
  } catch (error) {
    logStackError("❌ Get All Locations Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get archived Locations */
export const getArchivedLocations = async (req, res) => {
  try {
    const archived = await LocationModel.find({ archived: true });
    winstonLogger.info(`ℹ️ Retrieved ${archived.length} archived locations.`);
    return res.status(200).json({
      status: "success",
      message: "✅ Archived locations retrieved.",
      data: archived,
    });
  } catch (error) {
    logError("❌ Get Archived Locations", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get single Location by ID */
export const getLocationById = async (req, res) => {
  try {
    const { locationId } = req.params;
    const loc = await LocationModel.findById(locationId);
    if (!loc) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Location not found." });
    }
    winstonLogger.info(`✅ Retrieved location: ${locationId}`);
    return res.status(200).json({
      status: "success",
      message: "✅ Location retrieved.",
      data: loc,
    });
  } catch (error) {
    logError("❌ Get Location By ID", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Update a Location by ID */
export const updateLocationById = async (req, res) => {
  try {
    const { locationId } = req.params;
    const updateData = {
      ...req.body,
      // warehouse,
      // zone,
      updatedBy: req.user?.username || "Unknown",
    };

    if (warehouse) {
      const wh = await WarehouseModel.findById(req.body.warehouse);
      if (!wh) {
        return res.status(404).json({
          status: "failure",
          message: `⚠️ Warehouse ${req.body.warehouse} not found.`,
        });
      }
    }
    if (zone) {
      const zn = await ZoneModel.findById(req.body.zone);
      if (!zn) {
        return res.status(404).json({
          status: "failure",
          message: `⚠️ Zone ${req.body.zone} not found.`,
        });
      }
    }
    const loc = await LocationModel.findByIdAndUpdate(locationId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!loc) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Location not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Location",
      action: "UPDATE",
      recordId: loc._id,
      changes: { newData: loc },
    });

    await invalidateLocationCache();

    winstonLogger.info(`ℹ️ Updated location: ${locationId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Location updated.", data: loc });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logError("❌ Update Location", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Delete a Location by ID */
export const deleteLocationById = async (req, res) => {
  try {
    const { locationId } = req.params;
    const loc = await LocationModel.findByIdAndDelete(locationId);
    if (!loc) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Location not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Location",
      action: "DELETE",
      recordId: loc._id,
      changes: null,
    });

    await invalidateLocationCache();

    winstonLogger.info(`ℹ️ Deleted location: ${locationId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Location deleted." });
  } catch (error) {
    logError("❌ Delete Location", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Archive a Location by ID */
export const archiveLocationById = async (req, res) => {
  try {
    const { locationId } = req.params;
    const loc = await LocationModel.findByIdAndUpdate(
      locationId,
      { archived: true, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!loc) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Location not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Location",
      action: "ARCHIVE",
      recordId: loc._id,
      changes: { newData: loc },
    });

    await invalidateLocationCache();

    return res
      .status(200)
      .json({ status: "success", message: "✅ Location archived.", data: loc });
  } catch (error) {
    logError("❌ Archive Location", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Unarchive a Location by ID */
export const unarchiveLocationById = async (req, res) => {
  try {
    const { locationId } = req.params;
    const loc = await LocationModel.findByIdAndUpdate(
      locationId,
      { archived: false, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!loc) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Location not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Location",
      action: "UNARCHIVE",
      recordId: loc._id,
      changes: { newData: loc },
    });

    await invalidateLocationCache();

    return res.status(200).json({
      status: "success",
      message: "✅ Location unarchived.",
      data: loc,
    });
  } catch (error) {
    logError("❌ Unarchive Location", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Bulk Create Locations */
export const bulkCreateLocations = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Request body must be a non-empty array of location objects.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    logger.info("💾 Bulk create: reserving location codes", {
      context: "bulkCreateLocations",
      count: n,
    });

    const counter = await LocationCounterModel.findOneAndUpdate(
      { _id: "locationCode" },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq;
    const start = end - n + 1;

    docs.forEach((d, i) => {
      const seq = (start + i).toString().padStart(3, "0");
      d.code = `LN_${seq}`;
      d.createdBy = req.user?.username || "SystemLocationCreation";
    });

    const created = await LocationModel.insertMany(docs, { session });

    await Promise.all(
      created.map((loc) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Location",
          action: "BULK_CREATE",
          recordId: loc._id,
          changes: { newData: loc },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateLocationCache();

    return res.status(201).json({
      status: "success",
      message: `✅ ${created.length} locations created successfully.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk create locations error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk location creation.",
      error: error.message,
    });
  }
};

/** Bulk Update Locations */
export const bulkUpdateLocations = async (req, res) => {
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
    logger.info("🔄 Bulk update locations", {
      context: "bulkUpdateLocations",
      count: updates.length,
    });

    const results = [];
    for (const entry of updates) {
      const id = entry.id ?? entry._id;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid location ID: ${id}`);
      }
      const loc = await LocationModel.findByIdAndUpdate(
        id,
        { ...entry.update, updatedBy: req.user?.username || "Unknown" },
        { new: true, runValidators: true, session }
      );
      if (!loc) throw new Error(`Location not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || "67ec2fb004d3cc3237b58772",
        module: "Location",
        action: "BULK_UPDATE",
        recordId: loc._id,
        changes: { newData: loc },
      });
      results.push(loc);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateLocationCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${results.length} locations updated successfully.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk update locations error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk location update.",
      error: error.message,
    });
  }
};

/** Bulk Delete Locations */
export const bulkDeleteLocations = async (req, res) => {
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
    logger.info("🗑️ Bulk delete locations", {
      context: "bulkDeleteLocations",
      count: ids.length,
    });

    const { deletedCount } = await LocationModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error("No locations deleted.");

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Location",
          action: "BULK_DELETE",
          recordId: id,
          changes: null,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateLocationCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${deletedCount} locations deleted successfully.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk delete locations error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk location deletion.",
      error: error.message,
    });
  }
};
