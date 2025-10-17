// controllers/shelf.controller.js

import mongoose from "mongoose";
import { ShelfModel } from "../models/shelf.model.js";
import { BinCounterModel, ShelfCounterModel } from "../models/counter.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";
import { RackModel } from "../models/rack.model.js";
import { BinModel } from "../models/bin.model.js";

/** Helper: invalidate Shelf cache */
const invalidateShelfCache = async (key = "/fms/api/v0/shelves") => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: "invalidateShelfCache",
    });
  } catch (err) {
    logStackError("❌ Shelf cache invalidation failed", err);
  }
};

/** Create one Shelf */
export const createShelf = async (req, res) => {
  try {
    const {
      name,
      type,
      rack,
      description,
      shelfLatLng,
      remarks,
      company,
      groups,
      files,
      extras,
      active,
    } = req.body;

    // require name, type, and location
    if (!name || !type || !rack) {
      logger.warn("Shelf Creation - Missing fields - name , type and rack ", {
        context: "createShelf",
        body: req.body,
      });
      return res.status(422).json({
        status: "failure",
        message: "⚠️ name, type, and rack are required.",
      });
    }

    const rk = await RackModel.findById(rack);
    if (!rk) {
      return res.status(404).json({
        status: "failure",
        message: `⚠️ Rack ${rack} not found.`,
      });
    }

    const shelf = await ShelfModel.create({
      name,
      type,
      rack,
      description,
      shelfLatLng,
      remarks,
      company,
      groups,
      files,
      extras,
      active,
      createdBy: req.user?.username || "SystemShelfCreation",
    });

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Shelf",
      action: "CREATE",
      recordId: shelf._id,
      changes: { newData: shelf },
    });

    await invalidateShelfCache();

    winstonLogger.info(`✅ Shelf created: ${shelf._id}`);
    return res.status(201).json({
      status: "success",
      message: "✅ Shelf created successfully.",
      data: shelf,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError("❌ Shelf Validation Error", error);
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    if (error.code === 11000) {
      logStackError("❌ Shelf Duplicate Error", error);
      return res.status(409).json({
        status: "failure",
        message: "A shelf with that code or name already exists.",
      });
    }
    logStackError("❌ Shelf Creation Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get all Shelves */
export const getAllShelves = async (req, res) => {
  try {
    const list = await ShelfModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });

    winstonLogger.info(`✅ Fetched all shelves (${list.length})`);
    return res.status(200).json({
      status: "success",
      message: "✅ Shelves retrieved successfully.",
      count: list.length,
      data: list,
    });
  } catch (error) {
    logStackError("❌ Get All Shelves Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get archived Shelves */
export const getArchivedShelves = async (req, res) => {
  try {
    const archived = await ShelfModel.find({ archived: true });
    winstonLogger.info(`ℹ️ Retrieved ${archived.length} archived shelves.`);
    return res.status(200).json({
      status: "success",
      message: "✅ Archived shelves retrieved.",
      data: archived,
    });
  } catch (error) {
    logError("❌ Get Archived Shelves", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Get one Shelf by ID */
export const getShelfById = async (req, res) => {
  try {
    const { shelfId } = req.params;
    const shelf = await ShelfModel.findById(shelfId);
    if (!shelf) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Shelf not found." });
    }
    winstonLogger.info(`✅ Retrieved shelf: ${shelfId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Shelf retrieved.", data: shelf });
  } catch (error) {
    logError("❌ Get Shelf By ID", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Update one Shelf by ID */
export const updateShelfById = async (req, res) => {
  try {
    const { shelfId } = req.params;
    const updateData = {
      ...req.body,
      // rack,
      updatedBy: req.user?.username || "Unknown",
    };
    const rk = await RackModel.findById(req.body.rack);
    if (!rk) {
      return res.status(404).json({
        status: "failure",
        message: `⚠️ Rack ${req.body.rack} not found.`,
      });
    }

    const shelf = await ShelfModel.findByIdAndUpdate(shelfId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!shelf) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Shelf not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Shelf",
      action: "UPDATE",
      recordId: shelf._id,
      changes: { newData: shelf },
    });

    await invalidateShelfCache();

    winstonLogger.info(`ℹ️ Updated shelf: ${shelfId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Shelf updated.", data: shelf });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logError("❌ Update Shelf", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Delete one Shelf by ID */
export const deleteShelfById = async (req, res) => {
  try {
    const { shelfId } = req.params;
    const shelf = await ShelfModel.findByIdAndDelete(shelfId);
    if (!shelf) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Shelf not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Shelf",
      action: "DELETE",
      recordId: shelf._id,
      changes: null,
    });

    await invalidateShelfCache();

    winstonLogger.info(`ℹ️ Deleted shelf: ${shelfId}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ Shelf deleted." });
  } catch (error) {
    logError("❌ Delete Shelf", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Archive / Unarchive */
export const archiveShelfById = async (req, res) => {
  try {
    const { shelfId } = req.params;
    const shelf = await ShelfModel.findByIdAndUpdate(
      shelfId,
      { archived: true, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!shelf) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Shelf not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Shelf",
      action: "ARCHIVE",
      recordId: shelf._id,
      changes: { newData: shelf },
    });

    await invalidateShelfCache();

    return res
      .status(200)
      .json({ status: "success", message: "✅ Shelf archived.", data: shelf });
  } catch (error) {
    logError("❌ Archive Shelf", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const unarchiveShelfById = async (req, res) => {
  try {
    const { shelfId } = req.params;
    const shelf = await ShelfModel.findByIdAndUpdate(
      shelfId,
      { archived: false, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!shelf) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ Shelf not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Shelf",
      action: "UNARCHIVE",
      recordId: shelf._id,
      changes: { newData: shelf },
    });

    await invalidateShelfCache();

    return res.status(200).json({
      status: "success",
      message: "✅ Shelf unarchived.",
      data: shelf,
    });
  } catch (error) {
    logError("❌ Unarchive Shelf", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error",
      error: error.message,
    });
  }
};

/** Bulk Create Shelves */
export const bulkCreateShelves = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Request body must be a non-empty array of shelf objects.",
    });
  }

  // 1) In-batch validation: each shelf needs a name + rack, and no duplicates
  const combos = docs.map((d, idx) => {
    if (!d.name || !d.rack) {
      throw new Error(
        `Each shelf must have both a name and a rack (error at index ${idx})`
      );
    }
    return { name: d.name.trim(), rack: d.rack };
  });

  const seen = new Set();
  const dupes = combos.filter(({ name, rack }) => {
    const key = `${rack}:${name}`;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
  if (dupes.length) {
    return res.status(400).json({
      status: "failure",
      message:
        "Duplicate shelf name+rack in request: " +
        [...new Set(dupes.map((d) => `${d.name}@${d.rack}`))].join(", "),
    });
  }

  // 2) Validate parent racks exist
  const rackIds = [...new Set(combos.map((c) => c.rack))];
  if (rackIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    return res
      .status(400)
      .json({ status: "failure", message: "One or more invalid rack IDs." });
  }
  const rackCount = await RackModel.countDocuments({ _id: { $in: rackIds } });
  if (rackCount !== rackIds.length) {
    return res
      .status(404)
      .json({ status: "failure", message: "Some parent racks not found." });
  }

  // 3) DB-wide uniqueness: prevent existing name+rack collisions
  const conflictQ = combos.map(({ name, rack }) => ({ name, rack }));
  const conflicts = await ShelfModel.find({ $or: conflictQ })
    .select("name rack")
    .lean();
  if (conflicts.length) {
    return res.status(409).json({
      status: "failure",
      message:
        "These shelf name+rack pairs already exist: " +
        conflicts.map((c) => `${c.name}@${c.rack}`).join(", "),
    });
  }

  // 4) All validations passed → reserve codes & insert

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    logger.info("💾 Bulk create: reserving shelf codes", {
      context: "bulkCreateShelves",
      count: n,
    });

    const counter = await ShelfCounterModel.findOneAndUpdate(
      { _id: "shelfCode" },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq;
    const start = end - n + 1;

    docs.forEach((d, i) => {
      const seq = (start + i).toString().padStart(3, "0");
      d.code = `SH_${seq}`;
      d.createdBy = req.user?.username || "SystemShelfCreation";
    });

    const created = await ShelfModel.insertMany(docs, { session });

    await Promise.all(
      created.map((sh) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Shelf",
          action: "BULK_CREATE",
          recordId: sh._id,
          changes: { newData: sh },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateShelfCache();

    return res.status(201).json({
      status: "success",
      message: `✅ ${created.length} shelves created successfully.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk create shelves error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk shelf creation.",
      error: error.message,
    });
  }
};

/** Bulk Update Shelves */
export const bulkUpdateShelves = async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      status: "failure",
      message:
        "⚠️ Request body must be a non-empty array of { id or _id, update }. ",
    });
  }

  // 1) Collect any name/rack changes for validation
  const toCheck = [];
  for (const { id, _id, update } of updates) {
    const docId = id || _id;
    if (!mongoose.Types.ObjectId.isValid(docId)) {
      return res
        .status(400)
        .json({ status: "failure", message: `Invalid shelf ID: ${docId}` });
    }
    if (update.name || update.rack) {
      toCheck.push({ id: docId, name: update.name, rack: update.rack });
    }
  }

  // 2) Load existing shelves
  const ids = toCheck.map((c) => c.id);
  const originals = await ShelfModel.find({ _id: { $in: ids } })
    .select("name rack")
    .lean();
  const origMap = new Map(originals.map((o) => [o._id.toString(), o]));

  // 3) Build new combos & detect in‐batch dupes
  const seen2 = new Set();
  const dupes2 = [];
  const combos2 = toCheck.map(({ id, name, rack }) => {
    const orig = origMap.get(id);
    if (!orig) throw new Error(`Shelf not found: ${id}`);
    const newName = name != null ? name.trim() : orig.name;
    const newRack = rack != null ? rack : orig.rack;
    const key = `${newRack}:${newName}`;
    if (seen2.has(key)) dupes2.push({ name: newName, rack: newRack });
    seen2.add(key);
    return { id, name: newName, rack: newRack };
  });
  if (dupes2.length) {
    return res.status(400).json({
      status: "failure",
      message:
        "Duplicate shelf name+rack in request: " +
        [...new Set(dupes2.map((d) => `${d.name}@${d.rack}`))].join(", "),
    });
  }

  // 4) Validate any new racks
  const newRackIds = [...new Set(combos2.map((c) => c.rack))];
  if (newRackIds.length) {
    if (newRackIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid rack IDs in update." });
    }
    const cnt2 = await RackModel.countDocuments({ _id: { $in: newRackIds } });
    if (cnt2 !== newRackIds.length) {
      return res.status(404).json({
        status: "failure",
        message: "Some target racks do not exist.",
      });
    }
  }

  // 5) DB‐wide uniqueness: avoid conflicts with other shelves
  const conflictQs2 = combos2.map(({ id, name, rack }) => ({
    _id: { $ne: id },
    name,
    rack,
  }));
  const conflicts2 = await ShelfModel.find({ $or: conflictQs2 })
    .select("name rack")
    .lean();
  if (conflicts2.length) {
    return res.status(409).json({
      status: "failure",
      message:
        "These shelf name+rack pairs already exist: " +
        conflicts2.map((c) => `${c.name}@${c.rack}`).join(", "),
    });
  }

  // 6) Apply updates inside a transaction

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    logger.info("🔄 Bulk update shelves", {
      context: "bulkUpdateShelves",
      count: updates.length,
    });

    const results = [];
    for (const entry of updates) {
      const id = entry.id ?? entry._id;
      if (!mongoose.Types.ObjectId.isValid(id))
        throw new Error(`Invalid shelf ID: ${id}`);

      const sh = await ShelfModel.findByIdAndUpdate(
        id,
        { ...entry.update, updatedBy: req.user?.username || "Unknown" },
        { new: true, runValidators: true, session }
      );
      if (!sh) throw new Error(`Shelf not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || "67ec2fb004d3cc3237b58772",
        module: "Shelf",
        action: "BULK_UPDATE",
        recordId: sh._id,
        changes: { newData: sh },
      });

      results.push(sh);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateShelfCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${results.length} shelves updated successfully.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk update shelves error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk shelf update.",
      error: error.message,
    });
  }
};

/** Bulk Delete Shelves */
export const bulkDeleteShelves = async (req, res) => {
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
    logger.info("🗑️ Bulk delete shelves", {
      context: "bulkDeleteShelves",
      count: ids.length,
    });

    const { deletedCount } = await ShelfModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error("No shelves deleted.");

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Shelf",
          action: "BULK_DELETE",
          recordId: id,
          changes: null,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateShelfCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${deletedCount} shelves deleted successfully.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk delete shelves error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk shelf deletion.",
      error: error.message,
    });
  }
};

/**
 * 1) Bulk‐delete only “leaf” Shelves (skip any that have child Bins)
 */
export const bulkAllDeleteShelves = async (req, res) => {
  try {
    // 1. Find all shelf IDs that have at least one Bin
    const shelvesWithChildren = await BinModel.distinct("shelf");

    // 2. Leaf‐shelves are those NOT in that list
    const leafShelves = await ShelfModel.find({
      _id: { $nin: shelvesWithChildren },
    })
      .select("_id code name")
      .lean();

    if (leafShelves.length === 0) {
      return res.status(200).json({
        status: "success",
        message: "No leaf shelves to delete; every shelf has child bins.",
        skippedDueToBins: shelvesWithChildren,
      });
    }

    // 3. Delete those leaf shelves
    const deleteIds = leafShelves.map((s) => s._id);
    const deleted = await ShelfModel.deleteMany({
      _id: { $in: deleteIds },
    });

    // 4. Recompute highest sequence from remaining codes
    const remaining = await ShelfModel.find({}, "code").lean();
    let maxSeq = 0;
    remaining.forEach(({ code }) => {
      const m = code.match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxSeq) maxSeq = n;
      }
    });

    // 5. Reset the shelfCode counter to maxSeq
    const resetCounter = await ShelfCounterModel.findByIdAndUpdate(
      { _id: "shelfCode" },
      { seq: maxSeq },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      status: "success",
      message: `Deleted ${deleted.deletedCount} leaf shelf(s).`,
      deletedShelves: leafShelves,
      skippedDueToBins: shelvesWithChildren,
      counter: resetCounter,
    });
  } catch (err) {
    console.error("❌ bulkAllDeleteShelves error:", err);
    return res.status(500).json({
      status: "failure",
      message: "Error in bulkAllDeleteShelves",
      error: err.message,
    });
  }
};

/**
 * 2) Bulk‐delete EVERYTHING: Shelves → Bins
 */
export const bulkAllDeleteShelvesCascade = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. Gather all Shelf IDs
    const allShelves = await ShelfModel.find({}, "_id").session(session).lean();
    const shelfIds = allShelves.map((s) => s._id);

    if (shelfIds.length === 0) {
      await session.commitTransaction();
      session.endSession();
      return res
        .status(200)
        .json({ status: "success", message: "No shelves to delete." });
    }

    // 2. Delete child Bins
    await BinModel.deleteMany({ shelf: { $in: shelfIds } }).session(session);

    // 3. Finally delete all Shelves
    const deletedShelves = await ShelfModel.deleteMany({
      _id: { $in: shelfIds },
    }).session(session);

    // 4. Reset both shelfCode & binCode counters back to 0
    const [resetShelfCtr, resetBinCtr] = await Promise.all([
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
      message: `Cascade‐deleted ${deletedShelves.deletedCount} shelf(s) + all bins.`,
      counter: {
        shelf: resetShelfCtr,
        bin: resetBinCtr,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ bulkAllDeleteShelvesCascade error:", err);
    return res.status(500).json({
      status: "failure",
      message: "Error in bulkAllDeleteShelvesCascade",
      error: err.message,
    });
  }
};
