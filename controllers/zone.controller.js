// controllers/zone.controller.js

import mongoose from "mongoose";
import { ZoneModel } from "../models/zone.model.js";
import {
  AisleCounterModel,
  BinCounterModel,
  LocationCounterModel,
  RackCounterModel,
  ShelfCounterModel,
  ZoneCounterModel,
} from "../models/counter.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";
import { WarehouseModel } from "../models/warehouse.model.js";
import { LocationModel } from "../models/location.model.js";
import { BinModel } from "../models/bin.model.js";
import { ShelfModel } from "../models/shelf.model.js";
import { RackModel } from "../models/rack.model.js";
import { AisleModel } from "../models/aisle.model.js";

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
      return res.status(404).json({
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
      // warehouse,
      updatedBy: req.user?.username || "Unknown",
    };

    const wh = await WarehouseModel.findById(req.body.warehouse);
    if (!wh) {
      return res.status(404).json({
        status: "failure",
        message: `⚠️ Warehouse ${req.body.warehouse} not found.`,
      });
    }

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

// ——— 1) Bulk‐delete only “leaf” Warehouses — skip any with Zones or direct Locations ———
export const bulkAllDeleteZones = async (req, res) => {
  try {
    // Gather warehouse-ids that have at least one Zone or at least one direct Location
    //const zoneParents = await ZoneModel.distinct("warehouse");
    const locParents = await LocationModel.distinct("warehouse");
    const hasChildren = new Set([...locParents]);

    // Find truly‐leaf warehouses (no zones AND no direct locations)
    const leafZones = await ZoneModel.find({
      _id: { $nin: Array.from(hasChildren) },
    })
      .select("_id code name")
      .lean();

    if (leafZones.length === 0) {
      return res.status(200).json({
        status: "success",
        message: "No leaf zones to delete; every zone has direct Locations.",
        //skippedDueToZones: zoneParents,
        skippedDueToLocations: locParents,
      });
    }

    // Delete those leaf warehouses
    const deleteIds = leafZones.map((z) => z._id);
    const deleted = await ZoneModel.deleteMany({
      _id: { $in: deleteIds },
    });

    // 3) Recompute the highest used sequence from whatever codes remain
    const remaining = await ZoneModel.find({}, "code").lean();
    let maxSeq = 0;
    for (const { code } of remaining) {
      // assuming your codes look like “WH_00123” or similar
      const m = code.match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxSeq) maxSeq = n;
      }
    }

    // Reset the warehouse counter
    const resetCounter = await ZoneCounterModel.findByIdAndUpdate(
      { _id: "zoneCode" },
      { seq: maxSeq },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      status: "success",
      message: `Deleted ${deleted.deletedCount} leaf zone(s).`,
      deletedZones: leafZones,
      //skippedDueToZones: zoneParents,
      skippedDueToLocations: locParents,
      counter: resetCounter,
    });
  } catch (err) {
    console.error("❌ bulkAllDeleteZones error:", err);
    return res.status(500).json({
      status: "failure",
      message: "Error in bulkAllDeleteZones",
      error: err.message,
    });
  }
};

// ——— 2) Bulk‐delete EVERYTHING: Warehouses → Zones → Locations → Aisles → Racks → Shelves → Bins ———
export const bulkAllDeleteZonesCascade = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1) All zone IDs
    const allZnDocs = await ZoneModel.find({}, "_id").session(session).lean();
    const znIds = allZnDocs.map((z) => z._id);
    if (znIds.length === 0) {
      await session.commitTransaction();
      session.endSession();
      return res
        .status(200)
        .json({ status: "success", message: "No zones to delete." });
    }

    // 2) Find & delete Zones under those warehouses
    // const zoneDocs = await ZoneModel.find({ warehouse: { $in: whIds } }, "_id")
    //   .session(session)
    //   .lean();
    // const zoneIds = zoneDocs.map((z) => z._id);
    // await ZoneModel.deleteMany({ warehouse: { $in: whIds } }).session(session);

    // 3) Find & delete Locations in TWO ways:
    //    a) Zones → Locations
    const locFromZones = await LocationModel.find(
      { zone: { $in: znIds } },
      "_id"
    )
      .session(session)
      .lean();
    //    b) Direct under warehouse
    // const locDirect = await LocationModel.find(
    //   { warehouse: { $in: whIds } },
    //   "_id"
    // )
    //   .session(session)
    //   .lean();
    const locIds = Array.from(
      new Set([
        ...locFromZones.map((l) => l._id),
        // ...locDirect.map((l) => l._id),
      ])
    );
    await LocationModel.deleteMany({ zone: { $in: znIds } }).session(session);
    // await LocationModel.deleteMany({
    //   $or: [{ zone: { $in: zoneIds } }, { warehouse: { $in: whIds } }],
    // }).session(session);

    // 4) Cascade down: Aisles → Racks → Shelves → Bins
    const aisleDocs = await AisleModel.find(
      { location: { $in: locIds } },
      "_id"
    )
      .session(session)
      .lean();
    const aisleIds = aisleDocs.map((a) => a._id);
    await AisleModel.deleteMany({ location: { $in: locIds } }).session(session);

    const rackDocs = await RackModel.find({ aisle: { $in: aisleIds } }, "_id")
      .session(session)
      .lean();
    const rackIds = rackDocs.map((r) => r._id);
    await RackModel.deleteMany({ aisle: { $in: aisleIds } }).session(session);

    const shelfDocs = await ShelfModel.find({ rack: { $in: rackIds } }, "_id")
      .session(session)
      .lean();
    const shelfIds = shelfDocs.map((s) => s._id);
    await ShelfModel.deleteMany({ rack: { $in: rackIds } }).session(session);

    await BinModel.deleteMany({ shelf: { $in: shelfIds } }).session(session);

    // 5) Finally delete all Warehouses
    const deletedZn = await ZoneModel.deleteMany({
      _id: { $in: znIds },
    }).session(session);

    // // 6) Reset all counters
    // const resetWhCtr = await WarehouseCounterModel.findByIdAndUpdate(
    //   { _id: "whCode" },
    //   { seq: 0 },
    //   { new: true, upsert: true, session }
    // );

    // // 3. Reset all relevant counters
    // const resetWhCtr = await WarehouseCounterModel.findByIdAndUpdate(
    //   { _id: "whCode" },
    //   { seq: 0 },
    //   { new: true, upsert: true, session }
    // );

    // 3. Reset all relevant counters
    const resetZoneCtr = await ZoneCounterModel.findByIdAndUpdate(
      { _id: "zoneCode" },
      { seq: 0 },
      { new: true, upsert: true, session }
    );
    const resetLocCtr = await LocationCounterModel.findByIdAndUpdate(
      { _id: "locationCode" },
      { seq: 0 },
      { new: true, upsert: true, session }
    );

    const resetAisleCtr = await AisleCounterModel.findByIdAndUpdate(
      { _id: "aisleCode" },
      { seq: 0 },
      { new: true, upsert: true, session }
    );

    const resetRackCtr = await RackCounterModel.findByIdAndUpdate(
      { _id: "rackCode" },
      { seq: 0 },
      { new: true, upsert: true, session }
    );

    const resetShelfCtr = await ShelfCounterModel.findByIdAndUpdate(
      { _id: "shelfCode" },
      { seq: 0 },
      { new: true, upsert: true, session }
    );

    const resetBinCtr = await BinCounterModel.findByIdAndUpdate(
      { _id: "binCode" },
      { seq: 0 },
      { new: true, upsert: true, session }
    );

    // …and likewise for zoneCode, locationCode, aisleCode, rackCode, shelfCode, binCode
    // e.g.:
    // await ZoneCounterModel.findByIdAndUpdate({ _id: "zoneCode" }, { seq: 0 }, { upsert: true, session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      status: "success",
      message: `Cascade‐deleted ${deletedZn.deletedCount} zone(s) + all children.`,
      counter: {
        // warehouse: resetWhCtr,
        zone: resetZoneCtr,
        location: resetLocCtr,
        aisle: resetAisleCtr,
        rack: resetRackCtr,
        shelf: resetShelfCtr,
        bin: resetBinCtr,
        // zone: …, location: …, aisle: …, rack: …, shelf: …, bin: …
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ bulkAllDeleteZonesCascade error:", err);
    return res.status(500).json({
      status: "failure",
      message: "Error in bulkAllDeleteZonesCascade",
      error: err.message,
    });
  }
};
