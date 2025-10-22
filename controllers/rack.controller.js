// controllers/rack.controller.js

import mongoose from 'mongoose';
import { RackModel } from '../models/rack.model.js';
import {
  BinCounterModel,
  RackCounterModel,
  ShelfCounterModel,
} from '../models/counter.model.js';
import { createAuditLog } from '../audit_logging_service/utils/auditLogger.utils.js';
import redisClient from '../middleware/redisClient.js';
import logger, { logStackError } from '../utility/logger.util.js';
import { winstonLogger, logError } from '../utility/logError.utils.js';
import { AisleModel } from '../models/aisle.model.js';
import { ShelfModel } from '../models/shelf.model.js';
import { BinModel } from '../models/bin.model.js';

/** Helper: clear Redis cache for racks */
const invalidateRackCache = async (key = '/fms/api/v0/racks') => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: 'invalidateRackCache',
    });
  } catch (err) {
    logStackError('❌ Rack cache invalidation failed', err);
  }
};

/** Create one Rack (pre-save hook sets `code`) */
export const createRack = async (req, res) => {
  try {
    const {
      name,
      type,
      aisle,
      description,
      rackLatLng,
      remarks,
      company,
      groups,
      files,
      extras,
      active,
    } = req.body;

    // require name, type, and location
    if (!name || !type || !aisle) {
      logger.warn('Rack Creation - Missing fields - name , type and aisle ', {
        context: 'createRack',
        body: req.body,
      });
      return res.status(422).json({
        status: 'failure',
        message: '⚠️ name, type, and aisle are required.',
      });
    }

    const ai = await AisleModel.findById(aisle);
    if (!ai) {
      return res.status(404).json({
        status: 'failure',
        message: `⚠️ Aisle ${aisle} not found.`,
      });
    }

    const rack = await RackModel.create({
      name,
      type,
      aisle,
      description,
      rackLatLng,
      remarks,
      company,
      groups,
      files,
      extras,
      active,
      createdBy: req.user?.username || 'SystemRackCreation',
    });

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Rack',
      action: 'CREATE',
      recordId: rack._id,
      changes: { newData: rack },
    });

    await invalidateRackCache();

    winstonLogger.info(`✅ Rack created: ${rack._id}`);
    return res.status(201).json({
      status: 'success',
      message: '✅ Rack created successfully.',
      data: rack,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError('❌ Rack Validation Error', error);
      return res
        .status(422)
        .json({ status: 'failure', message: error.message });
    }
    if (error.code === 11000) {
      logStackError('❌ Rack Duplicate Error', error);
      return res.status(409).json({
        status: 'failure',
        message: 'A rack with that code or name already exists.',
      });
    }
    logStackError('❌ Rack Creation Error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/** Get all Racks */
export const getAllRacks = async (req, res) => {
  try {
    const list = await RackModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });

    winstonLogger.info(`✅ Fetched all racks (${list.length})`);
    return res.status(200).json({
      status: 'success',
      message: '✅ Racks retrieved successfully.',
      count: list.length,
      data: list,
    });
  } catch (error) {
    logStackError('❌ Get All Racks Error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/** Get archived Racks */
export const getArchivedRacks = async (req, res) => {
  try {
    const archived = await RackModel.find({ archived: true });
    winstonLogger.info(`ℹ️ Retrieved ${archived.length} archived racks.`);
    return res.status(200).json({
      status: 'success',
      message: '✅ Archived racks retrieved.',
      data: archived,
    });
  } catch (error) {
    logError('❌ Get Archived Racks', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/** Get one Rack by ID */
export const getRackById = async (req, res) => {
  try {
    const { rackId } = req.params;
    const rack = await RackModel.findById(rackId);
    if (!rack) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Rack not found.' });
    }
    winstonLogger.info(`✅ Retrieved rack: ${rackId}`);
    return res
      .status(200)
      .json({ status: 'success', message: '✅ Rack retrieved.', data: rack });
  } catch (error) {
    logError('❌ Get Rack By ID', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/** Update one Rack by ID */
export const updateRackById = async (req, res) => {
  try {
    const { rackId } = req.params;
    const updateData = {
      ...req.body,
      // aisle,
      updatedBy: req.user?.username || 'Unknown',
    };

    const ai = await AisleModel.findById(req.body.aisle);
    if (!ai) {
      return res.status(404).json({
        status: 'failure',
        message: `⚠️ Aisle ${req.body.aisle} not found.`,
      });
    }

    const rack = await RackModel.findByIdAndUpdate(rackId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!rack) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Rack not found.' });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Rack',
      action: 'UPDATE',
      recordId: rack._id,
      changes: { newData: rack },
    });

    await invalidateRackCache();

    winstonLogger.info(`ℹ️ Updated rack: ${rackId}`);
    return res
      .status(200)
      .json({ status: 'success', message: '✅ Rack updated.', data: rack });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res
        .status(422)
        .json({ status: 'failure', message: error.message });
    }
    logError('❌ Update Rack', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/** Delete one Rack by ID */
export const deleteRackById = async (req, res) => {
  try {
    const { rackId } = req.params;
    const rack = await RackModel.findByIdAndDelete(rackId);
    if (!rack) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Rack not found.' });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Rack',
      action: 'DELETE',
      recordId: rack._id,
      changes: null,
    });

    await invalidateRackCache();

    winstonLogger.info(`ℹ️ Deleted rack: ${rackId}`);
    return res
      .status(200)
      .json({ status: 'success', message: '✅ Rack deleted.' });
  } catch (error) {
    logError('❌ Delete Rack', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/** Archive / Unarchive */
export const archiveRackById = async (req, res) => {
  try {
    const { rackId } = req.params;
    const rack = await RackModel.findByIdAndUpdate(
      rackId,
      { archived: true, updatedBy: req.user?.username || 'Unknown' },
      { new: true }
    );
    if (!rack) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Rack not found.' });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Rack',
      action: 'ARCHIVE',
      recordId: rack._id,
      changes: { newData: rack },
    });

    await invalidateRackCache();

    return res
      .status(200)
      .json({ status: 'success', message: '✅ Rack archived.', data: rack });
  } catch (error) {
    logError('❌ Archive Rack', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const unarchiveRackById = async (req, res) => {
  try {
    const { rackId } = req.params;
    const rack = await RackModel.findByIdAndUpdate(
      rackId,
      { archived: false, updatedBy: req.user?.username || 'Unknown' },
      { new: true }
    );
    if (!rack) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Rack not found.' });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Rack',
      action: 'UNARCHIVE',
      recordId: rack._id,
      changes: { newData: rack },
    });

    await invalidateRackCache();

    return res
      .status(200)
      .json({ status: 'success', message: '✅ Rack unarchived.', data: rack });
  } catch (error) {
    logError('❌ Unarchive Rack', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/** Bulk Create Racks */
export const bulkCreateRacks = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: 'failure',
      message: '⚠️ Request body must be a non-empty array of rack objects.',
    });
  }

  // 1) In-batch validation: each rack needs a name + aisle, no in-batch dupes
  const combos = docs.map((d, idx) => {
    if (!d.name || !d.aisle) {
      throw new Error(
        `Each rack must have both a name and an aisle (error at index ${idx})`
      );
    }
    return { name: d.name.trim(), aisle: d.aisle, idx };
  });

  // detect in-batch duplicates
  const seen = new Set();
  const dupes = combos.filter(({ name, aisle }) => {
    const key = `${aisle}:${name}`;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
  if (dupes.length) {
    return res.status(400).json({
      status: 'failure',
      message:
        'Duplicate rack name+aisle in request: ' +
        [...new Set(dupes.map((d) => `${d.name}@${d.aisle}`))].join(', '),
    });
  }

  // 2) Validate all parent aisles exist
  const aisleIds = [...new Set(combos.map((c) => c.aisle))];
  if (aisleIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    return res
      .status(400)
      .json({ status: 'failure', message: 'One or more invalid aisle IDs.' });
  }
  const countA = await AisleModel.countDocuments({ _id: { $in: aisleIds } });
  if (countA !== aisleIds.length) {
    return res
      .status(404)
      .json({ status: 'failure', message: 'Some parent aisles not found.' });
  }

  // 3) DB‐wide uniqueness: no existing rack with same name+aisle
  const conflictQ = combos.map(({ name, aisle }) => ({ name, aisle }));
  const conflicts = await RackModel.find({ $or: conflictQ })
    .select('name aisle')
    .lean();
  if (conflicts.length) {
    return res.status(409).json({
      status: 'failure',
      message:
        'These rack name+aisle already exist: ' +
        conflicts.map((c) => `${c.name}@${c.aisle}`).join(', '),
    });
  }

  // 4) Everything valid → reserve codes & insert

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    logger.info('💾 Bulk create: reserving rack codes', {
      context: 'bulkCreateRacks',
      count: n,
    });

    const counter = await RackCounterModel.findOneAndUpdate(
      { _id: 'rackCode' },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq;
    const start = end - n + 1;

    docs.forEach((d, i) => {
      const seq = (start + i).toString().padStart(3, '0');
      d.code = `RK_${seq}`;
      d.createdBy = req.user?.username || 'SystemRackCreation';
    });

    const created = await RackModel.insertMany(docs, { session });

    await Promise.all(
      created.map((rk) =>
        createAuditLog({
          user: req.user?.username || '67ec2fb004d3cc3237b58772',
          module: 'Rack',
          action: 'BULK_CREATE',
          recordId: rk._id,
          changes: { newData: rk },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateRackCache();

    return res.status(201).json({
      status: 'success',
      message: `✅ ${created.length} racks created successfully.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError('❌ Bulk create racks error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Error during bulk rack creation.',
      error: error.message,
    });
  }
};

/** Bulk Update Racks */
export const bulkUpdateRacks = async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      status: 'failure',
      message:
        '⚠️ Request body must be a non-empty array of {id or _id, update}.',
    });
  }

  // 1) Gather any name/aisle changes for in-batch & DB uniqueness checks
  const toCheck = [];
  for (const { id, _id, update } of updates) {
    const docId = id || _id;
    if (!mongoose.Types.ObjectId.isValid(docId)) {
      return res
        .status(400)
        .json({ status: 'failure', message: `Invalid rack ID: ${docId}` });
    }
    if (update.name || update.aisle) {
      toCheck.push({ id: docId, name: update.name, aisle: update.aisle });
    }
  }

  // 2) Load originals
  const ids = toCheck.map((c) => c.id);
  const originals = await RackModel.find({ _id: { $in: ids } })
    .select('name aisle')
    .lean();
  const origMap = new Map(originals.map((o) => [o._id.toString(), o]));

  // 3) Build new combos and detect in-batch dupes
  const seen2 = new Set();
  const dupes2 = [];
  const combos2 = toCheck.map(({ id, name, aisle }) => {
    const orig = origMap.get(id);
    if (!orig) throw new Error(`Rack not found: ${id}`);
    const newName = name != null ? name.trim() : orig.name;
    const newAisle = aisle != null ? aisle : orig.aisle;
    const key = `${newAisle}:${newName}`;
    if (seen2.has(key)) dupes2.push({ name: newName, aisle: newAisle });
    seen2.add(key);
    return { id, name: newName, aisle: newAisle };
  });
  if (dupes2.length) {
    return res.status(400).json({
      status: 'failure',
      message:
        'Duplicate rack name+aisle in request: ' +
        [...new Set(dupes2.map((d) => `${d.name}@${d.aisle}`))].join(', '),
    });
  }

  // 4) Validate any new parent aisles
  const newAisleIds = [...new Set(combos2.map((c) => c.aisle))];
  if (newAisleIds.length) {
    if (newAisleIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res
        .status(400)
        .json({ status: 'failure', message: 'Invalid aisle IDs in update.' });
    }
    const cnt2 = await AisleModel.countDocuments({ _id: { $in: newAisleIds } });
    if (cnt2 !== newAisleIds.length) {
      return res.status(404).json({
        status: 'failure',
        message: 'Some target aisles do not exist.',
      });
    }
  }

  // 5) DB‐wide uniqueness
  const conflictQs2 = combos2.map(({ id, name, aisle }) => ({
    _id: { $ne: id },
    name,
    aisle,
  }));
  const conflicts2 = await RackModel.find({ $or: conflictQs2 })
    .select('name aisle')
    .lean();
  if (conflicts2.length) {
    return res.status(409).json({
      status: 'failure',
      message:
        'These rack name+aisle pairs already exist: ' +
        conflicts2.map((c) => `${c.name}@${c.aisle}`).join(', '),
    });
  }

  // 6) Apply updates in a transaction

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    logger.info('🔄 Bulk update racks', {
      context: 'bulkUpdateRacks',
      count: updates.length,
    });

    const results = [];
    for (const entry of updates) {
      const id = entry.id ?? entry._id;
      if (!mongoose.Types.ObjectId.isValid(id))
        throw new Error(`Invalid rack ID: ${id}`);

      const rk = await RackModel.findByIdAndUpdate(
        id,
        { ...entry.update, updatedBy: req.user?.username || 'Unknown' },
        { new: true, runValidators: true, session }
      );
      if (!rk) throw new Error(`Rack not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || '67ec2fb004d3cc3237b58772',
        module: 'Rack',
        action: 'BULK_UPDATE',
        recordId: rk._id,
        changes: { newData: rk },
      });

      results.push(rk);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateRackCache();

    return res.status(200).json({
      status: 'success',
      message: `✅ ${results.length} racks updated successfully.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError('❌ Bulk update racks error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Error during bulk rack update.',
      error: error.message,
    });
  }
};

/** Bulk Delete Racks */
export const bulkDeleteRacks = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      status: 'failure',
      message: '⚠️ Request body must include a non-empty array of ids.',
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    logger.info('🗑️ Bulk delete racks', {
      context: 'bulkDeleteRacks',
      count: ids.length,
    });

    const { deletedCount } = await RackModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error('No racks deleted.');

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || '67ec2fb004d3cc3237b58772',
          module: 'Rack',
          action: 'BULK_DELETE',
          recordId: id,
          changes: null,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateRackCache();

    return res.status(200).json({
      status: 'success',
      message: `✅ ${deletedCount} racks deleted successfully.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError('❌ Bulk delete racks error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Error during bulk rack deletion.',
      error: error.message,
    });
  }
};

/**
 * 1) Bulk‐delete only “leaf” Racks (skip any that have child Shelves)
 */
export const bulkAllDeleteRacks = async (req, res) => {
  try {
    // 1. Find all rack IDs that have at least one Shelf
    const racksWithChildren = await ShelfModel.distinct('rack');

    // 2. Leaf‐racks are those NOT in that list
    const leafRacks = await RackModel.find({
      _id: { $nin: racksWithChildren },
    })
      .select('_id code name')
      .lean();

    if (leafRacks.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No leaf racks to delete; every rack has child shelves.',
        skippedDueToShelves: racksWithChildren,
      });
    }

    // 3. Delete those leaf racks
    const deleteIds = leafRacks.map((r) => r._id);
    const deleted = await RackModel.deleteMany({
      _id: { $in: deleteIds },
    });

    // 4. Recompute highest sequence from remaining codes
    const remaining = await RackModel.find({}, 'code').lean();
    let maxSeq = 0;
    remaining.forEach(({ code }) => {
      const m = code.match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxSeq) maxSeq = n;
      }
    });

    // 5. Reset the rackCode counter to maxSeq
    const resetCounter = await RackCounterModel.findByIdAndUpdate(
      { _id: 'rackCode' },
      { seq: maxSeq },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      status: 'success',
      message: `Deleted ${deleted.deletedCount} leaf rack(s).`,
      deletedRacks: leafRacks,
      skippedDueToShelves: racksWithChildren,
      counter: resetCounter,
    });
  } catch (err) {
    console.error('❌ bulkAllDeleteRacks error:', err);
    return res.status(500).json({
      status: 'failure',
      message: 'Error in bulkAllDeleteRacks',
      error: err.message,
    });
  }
};

/**
 * 2) Bulk‐delete EVERYTHING: Racks → Shelves → Bins
 */
export const bulkAllDeleteRacksCascade = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. Gather all Rack IDs
    const allRacks = await RackModel.find({}, '_id').session(session).lean();
    const rackIds = allRacks.map((r) => r._id);

    if (rackIds.length === 0) {
      await session.commitTransaction();
      session.endSession();
      return res
        .status(200)
        .json({ status: 'success', message: 'No racks to delete.' });
    }

    // 2. Delete child Shelves
    const shelfDocs = await ShelfModel.find({ rack: { $in: rackIds } }, '_id')
      .session(session)
      .lean();
    const shelfIds = shelfDocs.map((s) => s._id);
    await ShelfModel.deleteMany({ rack: { $in: rackIds } }).session(session);

    // 3. Delete child Bins
    await BinModel.deleteMany({ shelf: { $in: shelfIds } }).session(session);

    // 4. Finally delete all Racks
    const deletedRacks = await RackModel.deleteMany({
      _id: { $in: rackIds },
    }).session(session);

    // 5. Reset all relevant counters back to 0
    const [resetRackCtr, resetShelfCtr, resetBinCtr] = await Promise.all([
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
      message: `Cascade-deleted ${deletedRacks.deletedCount} rack(s) + all descendants.`,
      counter: {
        rack: resetRackCtr,
        shelf: resetShelfCtr,
        bin: resetBinCtr,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ bulkAllDeleteRacksCascade error:', err);
    return res.status(500).json({
      status: 'failure',
      message: 'Error in bulkAllDeleteRacksCascade',
      error: err.message,
    });
  }
};
