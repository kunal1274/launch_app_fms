// controllers/bin.controller.js

import mongoose from 'mongoose';
import { BinModel } from '../models/bin.model.js';
import { BinCounterModel } from '../models/counter.model.js';
import { createAuditLog } from '../audit_logging_service/utils/auditLogger.utils.js';
import redisClient from '../middleware/redisClient.js';
import logger, { logStackError } from '../utility/logger.util.js';
import { winstonLogger, logError } from '../utility/logError.utils.js';
import { ShelfModel } from '../models/shelf.model.js';

/** Helper: invalidate Bin cache */
const invalidateBinCache = async (key = '/fms/api/v0/bins') => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, { context: 'invalidateBinCache' });
  } catch (err) {
    logStackError('❌ Bin cache invalidation failed', err);
  }
};

/** Create a new Bin */
export const createBin = async (req, res) => {
  try {
    const {
      name,
      type,
      shelf,
      binLatLng,
      description,
      remarks,
      company,
      groups,
      files,
      extras,
      active,
    } = req.body;

    // require name, type, and location
    if (!name || !type || !shelf) {
      logger.warn('Bin Creation - Missing fields - bin name , type and shelf', {
        context: 'createBin',
        body: req.body,
      });
      return res.status(422).json({
        status: 'failure',
        message: '⚠️ name, type, and shelf are required.',
      });
    }

    const sh = await ShelfModel.findById(shelf);
    if (!sh) {
      return res.status(404).json({
        status: 'failure',
        message: `⚠️ Shelf ${shelf} not found.`,
      });
    }

    const bin = await BinModel.create({
      name,
      type,
      shelf,
      description,
      binLatLng,
      remarks,
      company,
      groups,
      files,
      extras,
      active,
      createdBy: req.user?.username || 'SystemBinCreation',
    });

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Bin',
      action: 'CREATE',
      recordId: bin._id,
      changes: { newData: bin },
    });

    await invalidateBinCache();

    winstonLogger.info(`✅ Bin created: ${bin._id}`);
    return res.status(201).json({
      status: 'success',
      message: '✅ Bin created successfully.',
      data: bin,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError('❌ Bin Validation Error', error);
      return res
        .status(422)
        .json({ status: 'failure', message: error.message });
    }
    if (error.code === 11000) {
      logStackError('❌ Bin Duplicate Error', error);
      return res.status(409).json({
        status: 'failure',
        message: 'A bin with that code or name already exists.',
      });
    }
    logStackError('❌ Bin Creation Error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/** Get all Bins */
export const getAllBins = async (req, res) => {
  try {
    const list = await BinModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });

    winstonLogger.info(`✅ Fetched all bins (${list.length})`);
    return res.status(200).json({
      status: 'success',
      message: '✅ Bins retrieved successfully.',
      count: list.length,
      data: list,
    });
  } catch (error) {
    logStackError('❌ Get All Bins Error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/** Get archived Bins */
export const getArchivedBins = async (req, res) => {
  try {
    const archived = await BinModel.find({ archived: true });
    winstonLogger.info(`ℹ️ Retrieved ${archived.length} archived bins.`);
    return res.status(200).json({
      status: 'success',
      message: '✅ Archived bins retrieved.',
      data: archived,
    });
  } catch (error) {
    logError('❌ Get Archived Bins', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/** Get one Bin by ID */
export const getBinById = async (req, res) => {
  try {
    const { binId } = req.params;
    const bin = await BinModel.findById(binId);
    if (!bin) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Bin not found.' });
    }
    winstonLogger.info(`✅ Retrieved bin: ${binId}`);
    return res
      .status(200)
      .json({ status: 'success', message: '✅ Bin retrieved.', data: bin });
  } catch (error) {
    logError('❌ Get Bin By ID', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/** Update one Bin by ID */
export const updateBinById = async (req, res) => {
  try {
    const { binId } = req.params;
    const updateData = {
      ...req.body,
      // shelf,
      updatedBy: req.user?.username || 'Unknown',
    };

    const sh = await ShelfModel.findById(req.body.shelf);
    if (!sh) {
      return res.status(404).json({
        status: 'failure',
        message: `⚠️ Shelf ${req.body.shelf} not found.`,
      });
    }
    const bin = await BinModel.findByIdAndUpdate(binId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!bin) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Bin not found.' });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Bin',
      action: 'UPDATE',
      recordId: bin._id,
      changes: { newData: bin },
    });

    await invalidateBinCache();

    winstonLogger.info(`ℹ️ Updated bin: ${binId}`);
    return res
      .status(200)
      .json({ status: 'success', message: '✅ Bin updated.', data: bin });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res
        .status(422)
        .json({ status: 'failure', message: error.message });
    }
    logError('❌ Update Bin', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/** Delete one Bin by ID */
export const deleteBinById = async (req, res) => {
  try {
    const { binId } = req.params;
    const bin = await BinModel.findByIdAndDelete(binId);
    if (!bin) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Bin not found.' });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Bin',
      action: 'DELETE',
      recordId: bin._id,
      changes: null,
    });

    await invalidateBinCache();

    winstonLogger.info(`ℹ️ Deleted bin: ${binId}`);
    return res
      .status(200)
      .json({ status: 'success', message: '✅ Bin deleted.' });
  } catch (error) {
    logError('❌ Delete Bin', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/** Archive / Unarchive */
export const archiveBinById = async (req, res) => {
  try {
    const { binId } = req.params;
    const bin = await BinModel.findByIdAndUpdate(
      binId,
      { archived: true, updatedBy: req.user?.username || 'Unknown' },
      { new: true }
    );
    if (!bin) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Bin not found.' });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Bin',
      action: 'ARCHIVE',
      recordId: bin._id,
      changes: { newData: bin },
    });

    await invalidateBinCache();

    return res
      .status(200)
      .json({ status: 'success', message: '✅ Bin archived.', data: bin });
  } catch (error) {
    logError('❌ Archive Bin', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const unarchiveBinById = async (req, res) => {
  try {
    const { binId } = req.params;
    const bin = await BinModel.findByIdAndUpdate(
      binId,
      { archived: false, updatedBy: req.user?.username || 'Unknown' },
      { new: true }
    );
    if (!bin) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Bin not found.' });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Bin',
      action: 'UNARCHIVE',
      recordId: bin._id,
      changes: { newData: bin },
    });

    await invalidateBinCache();

    return res
      .status(200)
      .json({ status: 'success', message: '✅ Bin unarchived.', data: bin });
  } catch (error) {
    logError('❌ Unarchive Bin', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/** Bulk Create Bins */
export const bulkCreateBins = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: 'failure',
      message: '⚠️ Request body must be a non-empty array of bin objects.',
    });
  }

  // 1) Validate required fields & collect parent IDs
  const combos = docs.map((d, idx) => {
    if (!d.name || !d.shelf) {
      throw new Error(
        `Each bin must have both a name and a shelf (error at index ${idx})`
      );
    }
    return { name: d.name.trim(), shelf: d.shelf };
  });

  // 2) In-batch duplicate check on (name + shelf)
  const seen = new Set(),
    duplicates = [];
  combos.forEach(({ name, shelf }) => {
    const key = `${shelf}:${name}`;
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
  });
  if (duplicates.length) {
    return res.status(400).json({
      status: 'failure',
      message:
        'Duplicate bin name+shelf in request: ' +
        [...new Set(duplicates)].join(', '),
    });
  }

  // 3) Parent validation: all referenced shelves must exist
  const shelfIds = [...new Set(combos.map((c) => c.shelf))];
  if (shelfIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    return res
      .status(400)
      .json({ status: 'failure', message: 'Invalid shelf IDs present.' });
  }
  const shelfCount = await ShelfModel.countDocuments({
    _id: { $in: shelfIds },
  });
  if (shelfCount !== shelfIds.length) {
    return res.status(404).json({
      status: 'failure',
      message: 'One or more parent shelves not found.',
    });
  }

  // 4) Cross‐batch uniqueness: ensure no existing name+shelf collision
  const conflictQs = combos.map(({ name, shelf }) => ({ name, shelf }));
  const conflicts = await BinModel.find({ $or: conflictQs })
    .select('name shelf')
    .lean();
  if (conflicts.length) {
    return res.status(409).json({
      status: 'failure',
      message:
        'These bin name+shelf pairs already exist: ' +
        conflicts.map((c) => `${c.name}@${c.shelf}`).join(', '),
    });
  }

  // 5) All validation passed: reserve codes & insert

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    logger.info('💾 Bulk create: reserving bin codes', {
      context: 'bulkCreateBins',
      count: n,
    });

    const counter = await BinCounterModel.findOneAndUpdate(
      { _id: 'binCode' },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq;
    const start = end - n + 1;

    docs.forEach((d, i) => {
      const seq = (start + i).toString().padStart(3, '0');
      d.code = `BIN_${seq}`;
      d.createdBy = req.user?.username || 'SystemBinCreation';
    });

    const created = await BinModel.insertMany(docs, { session });

    await Promise.all(
      created.map((bn) =>
        createAuditLog({
          user: req.user?.username || '67ec2fb004d3cc3237b58772',
          module: 'Bin',
          action: 'BULK_CREATE',
          recordId: bn._id,
          changes: { newData: bn },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateBinCache();

    return res.status(201).json({
      status: 'success',
      message: `✅ ${created.length} bins created successfully.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError('❌ Bulk create bins error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Error during bulk bin creation.',
      error: error.message,
    });
  }
};

/** Bulk Update Bins */

export const bulkUpdateBins = async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      status: 'failure',
      message:
        '⚠️ Request body must be a non-empty array of {id or _id, update}.',
    });
  }

  // 1) Prepare combo checks for any name/shelf changes
  const toCheck = [];
  for (const { id, _id, update } of updates) {
    const docId = id || _id;
    if (!mongoose.Types.ObjectId.isValid(docId)) {
      return res
        .status(400)
        .json({ status: 'failure', message: `Invalid bin ID: ${docId}` });
    }
    if (update.name || update.shelf) {
      toCheck.push({ id: docId, name: update.name, shelf: update.shelf });
    }
  }

  // 2) Load existing bins for those IDs
  const ids = toCheck.map((c) => c.id);
  const originals = await BinModel.find({ _id: { $in: ids } })
    .select('name shelf')
    .lean();
  const origMap = new Map(originals.map((o) => [o._id.toString(), o]));

  // 3) Build new combos, detect in-batch duplicates
  const seen2 = new Set(),
    dupes2 = [];
  const combos2 = toCheck.map(({ id, name, shelf }) => {
    const orig = origMap.get(id);
    if (!orig) throw new Error(`Bin not found: ${id}`);
    const newName = name != null ? name.trim() : orig.name;
    const newShelf = shelf != null ? shelf : orig.shelf;
    const key = `${newShelf}:${newName}`;
    if (seen2.has(key)) dupes2.push(key);
    seen2.add(key);
    return { id, name: newName, shelf: newShelf };
  });
  if (dupes2.length) {
    return res.status(400).json({
      status: 'failure',
      message:
        'Duplicate bin name+shelf in request: ' +
        [...new Set(dupes2)].join(', '),
    });
  }

  // 4) Validate any new parent shelves
  const newShelfIds = [...new Set(combos2.map((c) => c.shelf))];
  if (newShelfIds.length) {
    if (newShelfIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res
        .status(400)
        .json({ status: 'failure', message: 'Invalid shelf IDs in update.' });
    }
    const cnt2 = await ShelfModel.countDocuments({ _id: { $in: newShelfIds } });
    if (cnt2 !== newShelfIds.length) {
      return res.status(404).json({
        status: 'failure',
        message: 'Some parent shelves do not exist.',
      });
    }
  }

  // 5) DB-wide uniqueness: avoid conflicts with other bins
  const conflictQs2 = combos2.map(({ id, name, shelf }) => ({
    _id: { $ne: id },
    name,
    shelf,
  }));
  const conflicts2 = await BinModel.find({ $or: conflictQs2 })
    .select('name shelf')
    .lean();
  if (conflicts2.length) {
    return res.status(409).json({
      status: 'failure',
      message:
        'These bin name+shelf pairs already exist: ' +
        conflicts2.map((c) => `${c.name}@${c.shelf}`).join(', '),
    });
  }

  // 6) Perform updates transactionally

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    logger.info('🔄 Bulk update bins', {
      context: 'bulkUpdateBins',
      count: updates.length,
    });

    const results = [];
    for (const entry of updates) {
      const id = entry.id ?? entry._id;
      if (!mongoose.Types.ObjectId.isValid(id))
        throw new Error(`Invalid bin ID: ${id}`);

      const bn = await BinModel.findByIdAndUpdate(
        id,
        { ...entry.update, updatedBy: req.user?.username || 'Unknown' },
        { new: true, runValidators: true, session }
      );
      if (!bn) throw new Error(`Bin not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || '67ec2fb004d3cc3237b58772',
        module: 'Bin',
        action: 'BULK_UPDATE',
        recordId: bn._id,
        changes: { newData: bn },
      });

      results.push(bn);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateBinCache();

    return res.status(200).json({
      status: 'success',
      message: `✅ ${results.length} bins updated successfully.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError('❌ Bulk update bins error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Error during bulk bin update.',
      error: error.message,
    });
  }
};

/** Bulk Delete Bins */
export const bulkDeleteBins = async (req, res) => {
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
    logger.info('🗑️ Bulk delete bins', {
      context: 'bulkDeleteBins',
      count: ids.length,
    });

    const { deletedCount } = await BinModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error('No bins deleted.');

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || '67ec2fb004d3cc3237b58772',
          module: 'Bin',
          action: 'BULK_DELETE',
          recordId: id,
          changes: null,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateBinCache();

    return res.status(200).json({
      status: 'success',
      message: `✅ ${deletedCount} bins deleted successfully.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError('❌ Bulk delete bins error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Error during bulk bin deletion.',
      error: error.message,
    });
  }
};

/**
 * 1) Bulk‐delete only “leaf” Bins (i.e. all of them),
 *    but leave any code gaps intact by resetting the counter
 *    to the highest remaining code.
 */
export const bulkAllDeleteBins = async (req, res) => {
  try {
    // 1. Fetch all existing bins (they are all leaves)
    const existing = await BinModel.find().select('_id code').lean();
    if (existing.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No bins to delete.',
        deletedCount: 0,
      });
    }

    // 2. Delete them all
    const deleteIds = existing.map((b) => b._id);
    const deleted = await BinModel.deleteMany({ _id: { $in: deleteIds } });

    // 3. Scan remaining codes (if any) to find highest sequence
    const remaining = await BinModel.find().select('code').lean();
    let maxSeq = 0;
    for (const { code } of remaining) {
      const m = code.match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxSeq) maxSeq = n;
      }
    }

    // 4. Reset the binCode counter to maxSeq
    const resetCounter = await BinCounterModel.findByIdAndUpdate(
      { _id: 'binCode' },
      { seq: maxSeq },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      status: 'success',
      message: `Deleted ${deleted.deletedCount} bin(s).`,
      counter: resetCounter,
    });
  } catch (err) {
    console.error('❌ bulkAllDeleteBins error:', err);
    return res.status(500).json({
      status: 'failure',
      message: 'Error in bulkAllDeleteBins',
      error: err.message,
    });
  }
};

/**
 * 2) Bulk‐delete EVERYTHING: Bins only (no deeper cascade),
 *    within a transaction, resetting both binCode and shelfCode.
 */
export const bulkAllDeleteBinsCascade = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. Delete all bins
    const deleted = await BinModel.deleteMany({}).session(session);

    // 2. Optionally, if you ever wanted to cascade “up” to shelves,
    //    you could delete empty shelves here—but bins have no children,
    //    so we skip that.

    // 3. Reset both binCode and shelfCode counters to zero
    const [resetBinCtr, resetShelfCtr] = await Promise.all([
      BinCounterModel.findByIdAndUpdate(
        { _id: 'binCode' },
        { seq: 0 },
        { new: true, upsert: true, session }
      ),
      ShelfCounterModel.findByIdAndUpdate(
        { _id: 'shelfCode' },
        { seq: 0 },
        { new: true, upsert: true, session }
      ),
    ]);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      status: 'success',
      message: `Cascade‐deleted ${deleted.deletedCount} bin(s).`,
      counter: {
        bin: resetBinCtr,
        //shelf: resetShelfCtr,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ bulkAllDeleteBinsCascade error:', err);
    return res.status(500).json({
      status: 'failure',
      message: 'Error in bulkAllDeleteBinsCascade',
      error: err.message,
    });
  }
};
