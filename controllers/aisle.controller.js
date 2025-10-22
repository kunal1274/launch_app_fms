// controllers/aisle.controller.js

import mongoose from 'mongoose';
import { AisleModel } from '../models/aisle.model.js';
import {
  AisleCounterModel,
  BinCounterModel,
  RackCounterModel,
  ShelfCounterModel,
} from '../models/counter.model.js';
import { createAuditLog } from '../audit_logging_service/utils/auditLogger.utils.js';
import redisClient from '../middleware/redisClient.js';
import logger, { logStackError } from '../utility/logger.util.js';
import { winstonLogger, logError } from '../utility/logError.utils.js';
import { LocationModel } from '../models/location.model.js';
import { RackModel } from '../models/rack.model.js';
import { ShelfModel } from '../models/shelf.model.js';
import { BinModel } from '../models/bin.model.js';

// Helper: invalidate aisle cache
const invalidateAisleCache = async (key = '/fms/api/v0/aisles') => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: 'invalidateAisleCache',
    });
  } catch (err) {
    logStackError('❌ Aisle cache invalidation failed', err);
  }
};

/** Create a new Aisle */
export const createAisle = async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      location,
      aisleLatLng,
      remarks,
      active,
      groups,
      company,
      files,
      extras,
    } = req.body;
    if (!name || !location) {
      return res.status(422).json({
        status: 'failure',
        message: '⚠️ \'name\' and \'location\' are required.',
      });
    }

    const lc = await LocationModel.findById(location);
    if (!lc) {
      return res.status(404).json({
        status: 'failure',
        message: `⚠️ Location ${location} not found.`,
      });
    }
    const aisle = await AisleModel.create({
      name,
      description,
      type,
      location,
      aisleLatLng,
      remarks,
      active,
      groups,
      company,
      files,
      extras,
    });

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Aisle',
      action: 'CREATE',
      recordId: aisle._id,
      changes: { newData: aisle },
    });

    await invalidateAisleCache();
    winstonLogger.info(`✅ Aisle created: ${aisle._id}`);

    return res.status(201).json({
      status: 'success',
      message: '✅ Aisle created successfully.',
      data: aisle,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError('❌ Aisle Validation Error', error);
      return res
        .status(422)
        .json({ status: 'failure', message: error.message });
    }
    if (error.code === 11000) {
      logStackError('❌ Aisle Duplicate Error', error);
      return res.status(409).json({
        status: 'failure',
        message: 'Aisle name or code already exists.',
      });
    }
    logStackError('❌ Aisle Creation Error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

/** Retrieve all Aisles */
export const getAllAisles = async (req, res) => {
  try {
    const list = await AisleModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });

    winstonLogger.info(`✅ Fetched all aisles (${list.length})`);
    return res
      .status(200)
      .json({ status: 'success', count: list.length, data: list });
  } catch (error) {
    logStackError('❌ Get All Aisles Error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

/** Retrieve archived Aisles */
export const getArchivedAisles = async (req, res) => {
  try {
    const archived = await AisleModel.find({ archived: true });
    return res.status(200).json({ status: 'success', data: archived });
  } catch (error) {
    logError('❌ Get Archived Aisles Error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

/** Retrieve an Aisle by ID */
export const getAisleById = async (req, res) => {
  try {
    const { aisleId } = req.params;
    const aisle = await AisleModel.findById(aisleId);
    if (!aisle) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Aisle not found.' });
    }
    winstonLogger.info(`✅ Retrieved aisle: ${aisleId}`);
    return res.status(200).json({ status: 'success', data: aisle });
  } catch (error) {
    logError('❌ Get Aisle By ID Error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

/** Update an Aisle by ID */
export const updateAisleById = async (req, res) => {
  try {
    const { aisleId } = req.params;
    const updateData = {
      ...req.body,
      // location,
      updatedBy: req.user?.username || 'Unknown',
    };

    const lc = await LocationModel.findById(req.body.location);
    if (!lc) {
      return res.status(404).json({
        status: 'failure',
        message: `⚠️ Location ${req.body.location} not found.`,
      });
    }

    const aisle = await AisleModel.findByIdAndUpdate(aisleId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!aisle) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Aisle not found.' });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Aisle',
      action: 'UPDATE',
      recordId: aisle._id,
      changes: { newData: aisle },
    });

    await invalidateAisleCache();
    winstonLogger.info(`ℹ️ Updated aisle: ${aisleId}`);
    return res
      .status(200)
      .json({ status: 'success', message: '✅ Aisle updated.', data: aisle });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res
        .status(422)
        .json({ status: 'failure', message: error.message });
    }
    logError('❌ Update Aisle Error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

/** Delete an Aisle by ID */
export const deleteAisleById = async (req, res) => {
  try {
    const { aisleId } = req.params;
    const aisle = await AisleModel.findByIdAndDelete(aisleId);
    if (!aisle) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Aisle not found.' });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Aisle',
      action: 'DELETE',
      recordId: aisle._id,
    });

    await invalidateAisleCache();
    winstonLogger.info(`ℹ️ Deleted aisle: ${aisleId}`);
    return res
      .status(200)
      .json({ status: 'success', message: '✅ Aisle deleted.' });
  } catch (error) {
    logError('❌ Delete Aisle Error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

/** Archive an Aisle by ID */
export const archiveAisleById = async (req, res) => {
  try {
    const { aisleId } = req.params;
    const aisle = await AisleModel.findByIdAndUpdate(
      aisleId,
      { archived: true, updatedBy: req.user?.username || 'Unknown' },
      { new: true }
    );
    if (!aisle) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Aisle not found.' });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Aisle',
      action: 'ARCHIVE',
      recordId: aisle._id,
    });

    await invalidateAisleCache();
    return res
      .status(200)
      .json({ status: 'success', message: '✅ Aisle archived.', data: aisle });
  } catch (error) {
    logError('❌ Archive Aisle Error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

/** Unarchive an Aisle by ID */
export const unarchiveAisleById = async (req, res) => {
  try {
    const { aisleId } = req.params;
    const aisle = await AisleModel.findByIdAndUpdate(
      aisleId,
      { archived: false, updatedBy: req.user?.username || 'Unknown' },
      { new: true }
    );
    if (!aisle) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Aisle not found.' });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Aisle',
      action: 'UNARCHIVE',
      recordId: aisle._id,
    });

    await invalidateAisleCache();
    return res.status(200).json({
      status: 'success',
      message: '✅ Aisle unarchived.',
      data: aisle,
    });
  } catch (error) {
    logError('❌ Unarchive Aisle Error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

/** Bulk Create Aisles */
export const bulkCreateAisles = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: 'failure',
      message: '⚠️ Provide non-empty array of aisles.',
    });
  }

  // 1) In-batch validation: each must have name + location, and no dupes
  const combos = docs.map((d, idx) => {
    if (!d.name || !d.location) {
      throw new Error(
        `Each aisle needs both a name and a location. Error at index ${idx}.`
      );
    }
    return {
      name: d.name.trim(),
      location: d.location,
      idx,
    };
  });

  // detect in-batch dupes
  const seen = new Set();
  const dupes = combos.filter(({ name, location }) => {
    const key = `${location}:${name}`;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
  if (dupes.length) {
    return res.status(400).json({
      status: 'failure',
      message:
        'Duplicate aisle name+location in request: ' +
        [...new Set(dupes.map((d) => `${d.name}@${d.location}`))].join(', '),
    });
  }

  // 2) Validate all parent locations exist
  const locIds = [...new Set(combos.map((c) => c.location))];
  if (locIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    return res.status(400).json({
      status: 'failure',
      message: 'One or more invalid location IDs.',
    });
  }
  const locCount = await LocationModel.countDocuments({ _id: { $in: locIds } });
  if (locCount !== locIds.length) {
    return res.status(404).json({
      status: 'failure',
      message: 'Some parent locations do not exist.',
    });
  }

  // 3) DB-wide uniqueness: no existing aisle with same name+location
  const conflictQuery = combos.map(({ name, location }) => ({
    name,
    location,
  }));
  const conflicts = await AisleModel.find({ $or: conflictQuery })
    .select('name location')
    .lean();
  if (conflicts.length) {
    return res.status(409).json({
      status: 'failure',
      message:
        'These aisles already exist: ' +
        conflicts.map((c) => `${c.name}@${c.location}`).join(', '),
    });
  }

  // 4) Everything’s valid → reserve codes & insert

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    const counter = await AisleCounterModel.findOneAndUpdate(
      { _id: 'aisleCode' },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq;
    const start = end - n + 1;

    docs.forEach((d, i) => {
      d.code = `RK_${String(start + i).padStart(3, '0')}`;
    });

    const created = await AisleModel.insertMany(docs, { session });
    await Promise.all(
      created.map((a) =>
        createAuditLog({
          user: req.user?.username || '67ec2fb004d3cc3237b58772',
          module: 'Aisle',
          action: 'BULK_CREATE',
          recordId: a._id,
          changes: { newData: a },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateAisleCache();

    return res.status(201).json({
      status: 'success',
      message: `✅ ${created.length} aisles created.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError('❌ Bulk create aisles error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Error during bulk creation.',
      error: error.message,
    });
  }
};

/** Bulk Update Aisles */
export const bulkUpdateAisles = async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      status: 'failure',
      message: '⚠️ Provide non-empty array of updates.',
    });
  }

  // 1) Gather combos for any name/location changes
  const toCheck = [];
  for (const { id, _id, update } of updates) {
    const docId = id || _id;
    if (!mongoose.Types.ObjectId.isValid(docId)) {
      return res.status(400).json({
        status: 'failure',
        message: `Invalid aisle ID: ${docId}`,
      });
    }
    if (update.name || update.location) {
      toCheck.push({ id: docId, name: update.name, location: update.location });
    }
  }

  // 2) Fetch originals
  const ids = toCheck.map((c) => c.id);
  const originals = await AisleModel.find({ _id: { $in: ids } })
    .select('name location')
    .lean();
  const origMap = new Map(originals.map((o) => [o._id.toString(), o]));

  // 3) Build new combos and detect in-batch duplicates
  const seen = new Set();
  const dupes = [];
  const combos = toCheck.map(({ id, name, location }) => {
    const orig = origMap.get(id);
    if (!orig) throw new Error(`Aisle not found: ${id}`);
    const newName = name != null ? name.trim() : orig.name;
    const newLoc = location != null ? location : orig.location;
    const key = `${newLoc}:${newName}`;
    if (seen.has(key)) dupes.push({ name: newName, location: newLoc });
    seen.add(key);
    return { id, name: newName, location: newLoc };
  });
  if (dupes.length) {
    return res.status(400).json({
      status: 'failure',
      message:
        'Duplicate name+location in request: ' +
        [...new Set(dupes.map((d) => `${d.name}@${d.location}`))].join(', '),
    });
  }

  // 4) Validate any new parent locations
  const newLocIds = [...new Set(combos.map((c) => c.location))];
  if (newLocIds.length) {
    if (newLocIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({
        status: 'failure',
        message: 'One or more invalid location IDs in updates.',
      });
    }
    const cnt = await LocationModel.countDocuments({ _id: { $in: newLocIds } });
    if (cnt !== newLocIds.length) {
      return res.status(404).json({
        status: 'failure',
        message: 'Some target locations do not exist.',
      });
    }
  }

  // 5) DB-wide uniqueness
  const conflictQs = combos.map(({ id, name, location }) => ({
    _id: { $ne: id },
    name,
    location,
  }));
  const conflicts = await AisleModel.find({ $or: conflictQs })
    .select('name location')
    .lean();
  if (conflicts.length) {
    return res.status(409).json({
      status: 'failure',
      message:
        'These aisle name+location pairs already exist: ' +
        conflicts.map((c) => `${c.name}@${c.location}`).join(', '),
    });
  }

  // 6) All clear → apply updates

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const results = [];
    for (const entry of updates) {
      const id = entry.id ?? entry._id;
      if (!mongoose.Types.ObjectId.isValid(id))
        throw new Error(`Invalid aisle ID: ${id}`);

      const a = await AisleModel.findByIdAndUpdate(
        id,
        { ...entry.update, updatedBy: req.user?.username || 'Unknown' },
        { new: true, runValidators: true, session }
      );
      if (!a) throw new Error(`Aisle not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || '67ec2fb004d3cc3237b58772',
        module: 'Aisle',
        action: 'BULK_UPDATE',
        recordId: a._id,
        changes: { newData: a },
      });
      results.push(a);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateAisleCache();

    return res.status(200).json({
      status: 'success',
      message: `✅ ${results.length} aisles updated.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError('❌ Bulk update aisles error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Error during bulk update.',
      error: error.message,
    });
  }
};

/** Bulk Delete Aisles */
export const bulkDeleteAisles = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      status: 'failure',
      message: '⚠️ Provide non-empty array of ids.',
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { deletedCount } = await AisleModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error('No aisles deleted.');

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || '67ec2fb004d3cc3237b58772',
          module: 'Aisle',
          action: 'BULK_DELETE',
          recordId: id,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateAisleCache();

    return res.status(200).json({
      status: 'success',
      message: `✅ ${deletedCount} aisles deleted.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError('❌ Bulk delete aisles error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Error during bulk delete.',
      error: error.message,
    });
  }
};

/**
 * 1) Bulk‐delete only “leaf” Aisles (skip any that have child Racks)
 */
export const bulkAllDeleteAisles = async (req, res) => {
  try {
    // 1. Find all aisle IDs that have at least one Rack
    const aislesWithChildren = await RackModel.distinct('aisle');

    // 2. Leaf‐aisles are those NOT in that list
    const leafAisles = await AisleModel.find({
      _id: { $nin: aislesWithChildren },
    })
      .select('_id code name')
      .lean();

    if (leafAisles.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No leaf aisles to delete; every aisle has child racks.',
        skippedDueToRacks: aislesWithChildren,
      });
    }

    // 3. Delete those leaf aisles
    const deleteIds = leafAisles.map((a) => a._id);
    const deleted = await AisleModel.deleteMany({
      _id: { $in: deleteIds },
    });

    // 4. Recompute highest sequence from remaining codes
    const remaining = await AisleModel.find({}, 'code').lean();
    let maxSeq = 0;
    remaining.forEach(({ code }) => {
      const m = code.match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxSeq) maxSeq = n;
      }
    });

    // 5. Reset the aisleCode counter to maxSeq
    const resetCounter = await AisleCounterModel.findByIdAndUpdate(
      { _id: 'aisleCode' },
      { seq: maxSeq },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      status: 'success',
      message: `Deleted ${deleted.deletedCount} leaf aisle(s).`,
      deletedAisles: leafAisles,
      skippedDueToRacks: aislesWithChildren,
      counter: resetCounter,
    });
  } catch (err) {
    console.error('❌ bulkAllDeleteAisles error:', err);
    return res.status(500).json({
      status: 'failure',
      message: 'Error in bulkAllDeleteAisles',
      error: err.message,
    });
  }
};

/**
 * 2) Bulk‐delete EVERYTHING: Aisles → Racks → Shelves → Bins
 */
export const bulkAllDeleteAislesCascade = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. Gather all Aisle IDs
    const allAisles = await AisleModel.find({}, '_id').session(session).lean();
    const aisleIds = allAisles.map((a) => a._id);

    if (aisleIds.length === 0) {
      await session.commitTransaction();
      session.endSession();
      return res
        .status(200)
        .json({ status: 'success', message: 'No aisles to delete.' });
    }

    // 2. Delete child Racks
    const rackDocs = await RackModel.find({ aisle: { $in: aisleIds } }, '_id')
      .session(session)
      .lean();
    const rackIds = rackDocs.map((r) => r._id);
    await RackModel.deleteMany({ aisle: { $in: aisleIds } }).session(session);

    // 3. Delete child Shelves
    const shelfDocs = await ShelfModel.find({ rack: { $in: rackIds } }, '_id')
      .session(session)
      .lean();
    const shelfIds = shelfDocs.map((s) => s._id);
    await ShelfModel.deleteMany({ rack: { $in: rackIds } }).session(session);

    // 4. Delete child Bins
    await BinModel.deleteMany({ shelf: { $in: shelfIds } }).session(session);

    // 5. Finally delete all Aisles
    const deletedAisles = await AisleModel.deleteMany({
      _id: { $in: aisleIds },
    }).session(session);

    // 6. Reset all relevant counters back to 0
    const [resetAisleCtr, resetRackCtr, resetShelfCtr, resetBinCtr] =
      await Promise.all([
        AisleCounterModel.findByIdAndUpdate(
          { _id: 'aisleCode' },
          { seq: 0 },
          { new: true, upsert: true, session }
        ),
        RackCounterModel.findByIdAndUpdate(
          { _id: 'rackCode' },
          { seq: 0 },
          { new: true, upsert: true, session }
        ),
        ShelfCounterModel.findByIdAndUpdate(
          { _id: 'shelfCode' },
          { seq: 0 },
          { new: true, upsert: true, session }
        ),
        BinCounterModel.findByIdAndUpdate(
          { _id: 'binCode' },
          { seq: 0 },
          { new: true, upsert: true, session }
        ),
      ]);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      status: 'success',
      message: `Cascade-deleted ${deletedAisles.deletedCount} aisle(s) + all descendants.`,
      counter: {
        aisle: resetAisleCtr,
        rack: resetRackCtr,
        shelf: resetShelfCtr,
        bin: resetBinCtr,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ bulkAllDeleteAislesCascade error:', err);
    return res.status(500).json({
      status: 'failure',
      message: 'Error in bulkAllDeleteAislesCascade',
      error: err.message,
    });
  }
};
