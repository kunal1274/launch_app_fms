// controllers/location.controller.js

import mongoose from "mongoose";
import { LocationModel } from "../models/location.model.js";
import {
  AisleCounterModel,
  BinCounterModel,
  LocationCounterModel,
  RackCounterModel,
  ShelfCounterModel,
} from "../models/counter.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";
import { ZoneModel } from "../models/zone.model.js";
import { WarehouseModel } from "../models/warehouse.model.js";
import { AisleModel } from "../models/aisle.model.js";
import { RackModel } from "../models/rack.model.js";
import { ShelfModel } from "../models/shelf.model.js";
import { BinModel } from "../models/bin.model.js";

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

  // 1) Build (name + parentType + parentId) combos and catch in-batch duplicates
  const combos = docs.map((d, i) => {
    const name = (d.name || "").trim();
    const hasZone = !!d.zone,
      hasWh = !!d.warehouse;
    if ((hasZone && hasWh) || (!hasZone && !hasWh)) {
      throw new Error(
        `Each location must specify exactly one parent: zone OR warehouse. Error at index ${i}.`
      );
    }
    return {
      name,
      parentType: hasZone ? "zone" : "warehouse",
      parentId: hasZone ? d.zone : d.warehouse,
      idx: i,
    };
  });

  // detect in-batch dupes
  const seen = new Set();
  const dupes = combos.filter(({ name, parentType, parentId }) => {
    const key = `${parentType}:${parentId}:${name}`;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
  if (dupes.length) {
    return res.status(400).json({
      status: "failure",
      message:
        "Duplicate name/parent in payload: " +
        [
          ...new Set(
            dupes.map((d) => `${d.name} @ ${d.parentType}:${d.parentId}`)
          ),
        ].join(", "),
    });
  }

  // 2) Validate all parent IDs exist
  const zoneIds = [
    ...new Set(
      combos.filter((c) => c.parentType === "zone").map((c) => c.parentId)
    ),
  ];
  const whIds = [
    ...new Set(
      combos.filter((c) => c.parentType === "warehouse").map((c) => c.parentId)
    ),
  ];

  if (
    zoneIds.some((id) => !mongoose.Types.ObjectId.isValid(id)) ||
    whIds.some((id) => !mongoose.Types.ObjectId.isValid(id))
  ) {
    return res.status(400).json({
      status: "failure",
      message: "One or more invalid zone or warehouse IDs.",
    });
  }
  const [foundZones, foundWhs] = await Promise.all([
    ZoneModel.countDocuments({ _id: { $in: zoneIds } }),
    WarehouseModel.countDocuments({ _id: { $in: whIds } }),
  ]);
  if (foundZones !== zoneIds.length || foundWhs !== whIds.length) {
    return res.status(404).json({
      status: "failure",
      message: "Some parent zone or warehouse IDs were not found.",
    });
  }

  // 3) DB-wide uniqueness
  const orQueries = combos.map(({ name, parentType, parentId }) => ({
    name,
    [parentType]: parentId,
  }));
  const conflicts = await LocationModel.find({ $or: orQueries })
    .select("name zone warehouse")
    .lean();
  if (conflicts.length) {
    return res.status(409).json({
      status: "failure",
      message:
        "These locations already exist: " +
        conflicts.map((c) => `${c.name} @ ${c.zone || c.warehouse}`).join(", "),
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

  // 1) Build combos of intended changes for name+parent
  const combos = [];
  for (const { id, _id, update } of updates) {
    const docId = id || _id;
    if (!mongoose.Types.ObjectId.isValid(docId)) {
      return res.status(400).json({
        status: "failure",
        message: `Invalid location ID: ${docId}`,
      });
    }
    const name = update.name?.trim();
    const hasZone = update.zone != null;
    const hasWh = update.warehouse != null;
    if (hasZone && hasWh) {
      return res.status(400).json({
        status: "failure",
        message: `Cannot reparent to both zone and warehouse for ${docId}.`,
      });
    }
    if (name || hasZone || hasWh) {
      combos.push({
        id: docId,
        name,
        parentType: hasZone ? "zone" : hasWh ? "warehouse" : null,
        parentId: hasZone ? update.zone : hasWh ? update.warehouse : null,
      });
    }
  }

  // 2) In-batch dupes
  const seen = new Set();
  const dupes = combos.filter((c) => {
    if (!c.name || !c.parentType) return false;
    const key = `${c.parentType}:${c.parentId}:${c.name}`;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
  if (dupes.length) {
    return res.status(400).json({
      status: "failure",
      message:
        "Duplicate reparent/name in request: " +
        [
          ...new Set(
            dupes.map((d) => `${d.name}@${d.parentType}:${d.parentId}`)
          ),
        ].join(", "),
    });
  }

  // 3) Validate any new parent IDs
  const zids = [
    ...new Set(
      combos.filter((c) => c.parentType === "zone").map((c) => c.parentId)
    ),
  ];
  const wids = [
    ...new Set(
      combos.filter((c) => c.parentType === "warehouse").map((c) => c.parentId)
    ),
  ];
  if (zids.length) {
    const cnt = await ZoneModel.countDocuments({ _id: { $in: zids } });
    if (cnt !== zids.length) {
      return res.status(404).json({
        status: "failure",
        message: "Some target zones do not exist.",
      });
    }
  }
  if (wids.length) {
    const cnt = await WarehouseModel.countDocuments({ _id: { $in: wids } });
    if (cnt !== wids.length) {
      return res.status(404).json({
        status: "failure",
        message: "Some target warehouses do not exist.",
      });
    }
  }

  // 4) DB-wide uniqueness (excluding self)
  const orQs = combos
    .filter((c) => c.name && c.parentType)
    .map(({ name, parentType, parentId, id }) => ({
      name,
      [parentType]: parentId,
      _id: { $ne: id },
    }));
  if (orQs.length) {
    const conflicts = await LocationModel.find({ $or: orQs })
      .select("name zone warehouse")
      .lean();
    if (conflicts.length) {
      return res.status(409).json({
        status: "failure",
        message:
          "These location/name conflicts exist: " +
          conflicts.map((c) => `${c.name}@${c.zone || c.warehouse}`).join(", "),
      });
    }
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

/**
 * 1) Bulk‐delete only “leaf” Locations (skip any with child Aisles)
 */
export const bulkAllDeleteLocations = async (req, res) => {
  try {
    // 1. Find all location IDs that have at least one Aisle
    const aislesParents = await AisleModel.distinct("location");

    // 2. Leaf locations = those NOT in aislesParents
    const leafLocs = await LocationModel.find({
      _id: { $nin: aislesParents },
    })
      .select("_id code name")
      .lean();

    if (leafLocs.length === 0) {
      return res.status(200).json({
        status: "success",
        message:
          "No leaf locations to delete; every location has child aisles.",
        skippedDueToAisles: aislesParents,
      });
    }

    // 3. Delete the leaf locations
    const deleteIds = leafLocs.map((l) => l._id);
    const deleted = await LocationModel.deleteMany({
      _id: { $in: deleteIds },
    });

    // 4. Recompute max sequence from remaining codes
    const remaining = await LocationModel.find({}, "code").lean();
    let maxSeq = 0;
    for (const { code } of remaining) {
      // assuming codes like “LN_012”
      const m = code.match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxSeq) maxSeq = n;
      }
    }

    // 5. Reset the location counter to maxSeq
    const resetCounter = await LocationCounterModel.findByIdAndUpdate(
      { _id: "locationCode" },
      { seq: maxSeq },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      status: "success",
      message: `Deleted ${deleted.deletedCount} leaf location(s).`,
      deletedLocations: leafLocs,
      skippedDueToAisles: aislesParents,
      counter: resetCounter,
    });
  } catch (err) {
    console.error("❌ bulkAllDeleteLocations error:", err);
    return res.status(500).json({
      status: "failure",
      message: "Error in bulkAllDeleteLocations",
      error: err.message,
    });
  }
};

/**
 * 2) Bulk‐delete EVERYTHING: Locations → Aisles → Racks → Shelves → Bins
 */
export const bulkAllDeleteLocationsCascade = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. Gather all Location IDs
    const allLocDocs = await LocationModel.find({}, "_id")
      .session(session)
      .lean();
    const locIds = allLocDocs.map((l) => l._id);
    if (locIds.length === 0) {
      await session.commitTransaction();
      session.endSession();
      return res
        .status(200)
        .json({ status: "success", message: "No locations to delete." });
    }

    // 2. Delete child Aisles
    const aisleDocs = await AisleModel.find(
      { location: { $in: locIds } },
      "_id"
    )
      .session(session)
      .lean();
    const aisleIds = aisleDocs.map((a) => a._id);
    await AisleModel.deleteMany({ location: { $in: locIds } }).session(session);

    // 3. Delete child Racks
    const rackDocs = await RackModel.find({ aisle: { $in: aisleIds } }, "_id")
      .session(session)
      .lean();
    const rackIds = rackDocs.map((r) => r._id);
    await RackModel.deleteMany({ aisle: { $in: aisleIds } }).session(session);

    // 4. Delete child Shelves
    const shelfDocs = await ShelfModel.find({ rack: { $in: rackIds } }, "_id")
      .session(session)
      .lean();
    const shelfIds = shelfDocs.map((s) => s._id);
    await ShelfModel.deleteMany({ rack: { $in: rackIds } }).session(session);

    // 5. Delete child Bins
    await BinModel.deleteMany({ shelf: { $in: shelfIds } }).session(session);

    // 6. Finally delete all Locations
    const deletedLocs = await LocationModel.deleteMany({
      _id: { $in: locIds },
    }).session(session);

    // 7. Reset all relevant counters back to 0
    const [
      resetLocCtr,
      resetAisleCtr,
      resetRackCtr,
      resetShelfCtr,
      resetBinCtr,
    ] = await Promise.all([
      LocationCounterModel.findByIdAndUpdate(
        { _id: "locationCode" },
        { seq: 0 },
        { new: true, upsert: true, session }
      ),
      AisleCounterModel.findByIdAndUpdate(
        { _id: "aisleCode" },
        { seq: 0 },
        { new: true, upsert: true, session }
      ),
      RackCounterModel.findByIdAndUpdate(
        { _id: "rackCode" },
        { seq: 0 },
        { new: true, upsert: true, session }
      ),
      ShelfCounterModel.findByIdAndUpdate(
        { _id: "shelfCode" },
        { seq: 0 },
        { new: true, upsert: true, session }
      ),
      BinCounterModel.findByIdAndUpdate(
        { _id: "binCode" },
        { seq: 0 },
        { new: true, upsert: true, session }
      ),
    ]);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      status: "success",
      message: `Cascade‐deleted ${deletedLocs.deletedCount} location(s) + all descendants.`,
      counter: {
        location: resetLocCtr,
        aisle: resetAisleCtr,
        rack: resetRackCtr,
        shelf: resetShelfCtr,
        bin: resetBinCtr,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ bulkAllDeleteLocationsCascade error:", err);
    return res.status(500).json({
      status: "failure",
      message: "Error in bulkAllDeleteLocationsCascade",
      error: err.message,
    });
  }
};
