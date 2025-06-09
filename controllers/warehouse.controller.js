// controllers/warehouse.controller.js

import mongoose from "mongoose";
import { WarehouseModel } from "../models/warehouse.model.js";
import {
  AisleCounterModel,
  BinCounterModel,
  LocationCounterModel,
  RackCounterModel,
  ShelfCounterModel,
  WarehouseCounterModel,
  ZoneCounterModel,
} from "../models/counter.model.js"; // for bulk code gen
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import { dbgRedis } from "../index.js";
import redisClient from "../middleware/redisClient.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";
import logger, {
  loggerJsonFormat,
  logStackError,
} from "../utility/logger.util.js";
import { ZoneModel } from "../models/zone.model.js";
import { LocationModel } from "../models/location.model.js";
import { AisleModel } from "../models/aisle.model.js";
import { RackModel } from "../models/rack.model.js";
import { ShelfModel } from "../models/shelf.model.js";
import { BinModel } from "../models/bin.model.js";
import { SiteModel } from "../models/site.model.js";

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

    const st = await SiteModel.findById(site);
    if (!st) {
      return res.status(404).json({
        status: "failure",
        message: `⚠️ Site ${site} not found.`,
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

    const st = await SiteModel.findById(req.body.site);
    if (!st) {
      return res.status(404).json({
        status: "failure",
        message: `⚠️ Site ${req.body.site} not found.`,
      });
    }

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

  // 1) Pre-validate that every `d.site` exists in Sites
  const siteIds = [...new Set(docs.map((d) => d.site))];
  const existing = await SiteModel.find({ _id: { $in: siteIds } })
    .select("_id")
    .lean();
  const existingSet = new Set(existing.map((s) => s._id.toString()));
  const missing = siteIds.filter((id) => !existingSet.has(id.toString()));
  if (missing.length) {
    return res.status(404).json({
      status: "failure",
      message: `Site(s) not found: ${missing.join(", ")}`,
    });
  }

  // 2) In‐batch duplicate‐name check
  const names = docs.map((d) => d.name);
  const dupInBatch = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupInBatch.length) {
    return res.status(400).json({
      status: "failure",
      message: `Duplicate warehouse name(s) in request: ${[
        ...new Set(dupInBatch),
      ].join(", ")}`,
    });
  }

  // 3) Conflict with existing DB names
  const conflict = await WarehouseModel.find({
    name: { $in: names },
  })
    .select("name")
    .lean();
  if (conflict.length) {
    return res.status(409).json({
      status: "failure",
      message: `Warehouse name(s) already exist: ${conflict
        .map((w) => w.name)
        .join(", ")}`,
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

  // 1) Gather all to-be-updated IDs and new names
  const ids = updates.map((u) => u.id || u._id).filter(Boolean);
  if (ids.some((i) => !mongoose.Types.ObjectId.isValid(i))) {
    return res.status(400).json({
      status: "failure",
      message: "One or more invalid warehouse IDs provided.",
    });
  }

  // 2) If any update.name present, collect them
  const nameUpdates = updates.map((u) => u.update?.name).filter(Boolean);
  // in‐batch duplicate‐name check
  const dupNames = nameUpdates.filter((n, i) => nameUpdates.indexOf(n) !== i);
  if (dupNames.length) {
    return res.status(400).json({
      status: "failure",
      message: `Duplicate names in request: ${[...new Set(dupNames)].join(
        ", "
      )}`,
    });
  }

  // 3) Check conflicts in DB (excluding these same IDs)
  if (nameUpdates.length) {
    const conflicts = await WarehouseModel.find({
      name: { $in: nameUpdates },
      _id: { $nin: ids },
    })
      .select("name")
      .lean();
    if (conflicts.length) {
      return res.status(409).json({
        status: "failure",
        message: `Warehouse name(s) already in use: ${conflicts
          .map((w) => w.name)
          .join(", ")}`,
      });
    }
  }

  // 4) Site‐existence check for any update.site
  const siteUpdates = updates.map((u) => u.update?.site).filter(Boolean);
  if (siteUpdates.length) {
    const uniqSites = [...new Set(siteUpdates)];
    const existing = await SiteModel.find({ _id: { $in: uniqSites } })
      .select("_id")
      .lean();
    const existSet = new Set(existing.map((s) => s._id.toString()));
    const missing = uniqSites.filter((id) => !existSet.has(id.toString()));
    if (missing.length) {
      return res.status(404).json({
        status: "failure",
        message: `Site(s) not found: ${missing.join(", ")}`,
      });
    }
  }

  // // 1) Pre-validate any `site` references
  // const toCheckSite = updates.map((u) => u.update?.site).filter(Boolean);
  // if (toCheckSite.length) {
  //   const uniqueSites = [...new Set(toCheckSite)];
  //   const existing = await SiteModel.find({ _id: { $in: uniqueSites } })
  //     .select("_id")
  //     .lean();
  //   const existingSet = new Set(existing.map((s) => s._id.toString()));
  //   const missing = uniqueSites.filter((id) => !existingSet.has(id.toString()));
  //   if (missing.length) {
  //     return res.status(404).json({
  //       status: "failure",
  //       message: `Site(s) not found: ${missing.join(", ")}`,
  //     });
  //   }
  // }

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

// ——— 1) Bulk‐delete only “leaf” Warehouses — skip any with Zones or direct Locations ———
export const bulkAllDeleteWarehouses = async (req, res) => {
  try {
    // Gather warehouse-ids that have at least one Zone or at least one direct Location
    const zoneParents = await ZoneModel.distinct("warehouse");
    const locParents = await LocationModel.distinct("warehouse");
    const hasChildren = new Set([...zoneParents, ...locParents]);

    // Find truly‐leaf warehouses (no zones AND no direct locations)
    const leafWarehouses = await WarehouseModel.find({
      _id: { $nin: Array.from(hasChildren) },
    })
      .select("_id code name")
      .lean();

    if (leafWarehouses.length === 0) {
      return res.status(200).json({
        status: "success",
        message:
          "No leaf warehouses to delete; every warehouse has either Zones or direct Locations.",
        skippedDueToZones: zoneParents,
        skippedDueToLocations: locParents,
      });
    }

    // Delete those leaf warehouses
    const deleteIds = leafWarehouses.map((w) => w._id);
    const deleted = await WarehouseModel.deleteMany({
      _id: { $in: deleteIds },
    });

    // 3) Recompute the highest used sequence from whatever codes remain
    const remaining = await WarehouseModel.find({}, "code").lean();
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
    const resetCounter = await WarehouseCounterModel.findByIdAndUpdate(
      { _id: "whCode" },
      { seq: maxSeq },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      status: "success",
      message: `Deleted ${deleted.deletedCount} leaf warehouse(s).`,
      deletedWarehouses: leafWarehouses,
      skippedDueToZones: zoneParents,
      skippedDueToLocations: locParents,
      counter: resetCounter,
    });
  } catch (err) {
    console.error("❌ bulkAllDeleteWarehouses error:", err);
    return res.status(500).json({
      status: "failure",
      message: "Error in bulkAllDeleteWarehouses",
      error: err.message,
    });
  }
};

// ——— 2) Bulk‐delete EVERYTHING: Warehouses → Zones → Locations → Aisles → Racks → Shelves → Bins ———
export const bulkAllDeleteWarehousesCascade = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1) All warehouse IDs
    const allWhDocs = await WarehouseModel.find({}, "_id")
      .session(session)
      .lean();
    const whIds = allWhDocs.map((w) => w._id);
    if (whIds.length === 0) {
      await session.commitTransaction();
      session.endSession();
      return res
        .status(200)
        .json({ status: "success", message: "No warehouses to delete." });
    }

    // 2) Find & delete Zones under those warehouses
    const zoneDocs = await ZoneModel.find({ warehouse: { $in: whIds } }, "_id")
      .session(session)
      .lean();
    const zoneIds = zoneDocs.map((z) => z._id);
    await ZoneModel.deleteMany({ warehouse: { $in: whIds } }).session(session);

    // 3) Find & delete Locations in TWO ways:
    //    a) Zones → Locations
    const locFromZones = await LocationModel.find(
      { zone: { $in: zoneIds } },
      "_id"
    )
      .session(session)
      .lean();
    //    b) Direct under warehouse
    const locDirect = await LocationModel.find(
      { warehouse: { $in: whIds } },
      "_id"
    )
      .session(session)
      .lean();
    const locIds = Array.from(
      new Set([
        ...locFromZones.map((l) => l._id),
        ...locDirect.map((l) => l._id),
      ])
    );
    await LocationModel.deleteMany({
      $or: [{ zone: { $in: zoneIds } }, { warehouse: { $in: whIds } }],
    }).session(session);

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
    const deletedWh = await WarehouseModel.deleteMany({
      _id: { $in: whIds },
    }).session(session);

    // // 6) Reset all counters
    // const resetWhCtr = await WarehouseCounterModel.findByIdAndUpdate(
    //   { _id: "whCode" },
    //   { seq: 0 },
    //   { new: true, upsert: true, session }
    // );

    // 3. Reset all relevant counters
    const resetWhCtr = await WarehouseCounterModel.findByIdAndUpdate(
      { _id: "whCode" },
      { seq: 0 },
      { new: true, upsert: true, session }
    );

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
      message: `Cascade‐deleted ${deletedWh.deletedCount} warehouse(s) + all children.`,
      counter: {
        warehouse: resetWhCtr,
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
    console.error("❌ bulkAllDeleteWarehousesCascade error:", err);
    return res.status(500).json({
      status: "failure",
      message: "Error in bulkAllDeleteWarehousesCascade",
      error: err.message,
    });
  }
};
