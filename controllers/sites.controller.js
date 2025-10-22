// controllers/site.controller.js

import mongoose from 'mongoose';
import { SiteModel } from '../models/site.model.js';
import { createAuditLog } from '../audit_logging_service/utils/auditLogger.utils.js';
import { dbgRedis } from '../index.js';
import redisClient from '../middleware/redisClient.js';
import { winstonLogger, logError } from '../utility/logError.utils.js';
import logger, {
  loggerJsonFormat,
  logStackError,
} from '../utility/logger.util.js';
import {
  AisleCounterModel,
  BinCounterModel,
  LocationCounterModel,
  RackCounterModel,
  ShelfCounterModel,
  SiteCounterModel,
  WarehouseCounterModel,
  ZoneCounterModel,
} from '../models/counter.model.js';
import { WarehouseModel } from '../models/warehouse.model.js';
import { ZoneModel } from '../models/zone.model.js';
import { LocationModel } from '../models/location.model.js';
import { AisleModel } from '../models/aisle.model.js';
import { RackModel } from '../models/rack.model.js';
import { ShelfModel } from '../models/shelf.model.js';
import { BinModel } from '../models/bin.model.js';

/**
 * Helper to invalidate Redis cache for sites.
 */
const invalidateSiteCache = async (key = '/fms/api/v0/sites') => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: 'invalidateSiteCache',
    });
  } catch (err) {
    logStackError('❌ Cache invalidation failed', err);
  }
};

/**
 * Create a new Site.
 */
export const createSite = async (req, res) => {
  try {
    const { name, type, company, description, active, groups, files, extras } =
      req.body;

    // Basic validation
    if (!name || !type) {
      logger.warn('Site Creation - ⚠️ Missing Required Fields', {
        context: 'createSite',
        body: req.body,
      });
      return res.status(422).json({
        status: 'failure',
        message: '⚠️ Site name and type are required.',
      });
    }

    const site = await SiteModel.create({
      name,
      type,
      company,
      description,
      active,
      groups,
      files,
      extras,
    });

    // Audit log
    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Site',
      action: 'CREATE',
      recordId: site._id,
      changes: { newData: site },
    });

    await invalidateSiteCache();

    logger.info('✅ Site Created Successfully', {
      context: 'createSite',
      siteId: site._id,
    });
    loggerJsonFormat.info('✅ Site Created Successfully', {
      context: 'createSite',
      siteId: site._id,
    });

    return res.status(201).json({
      status: 'success',
      message: '✅ Site created successfully.',
      data: site,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError('❌ Site Creation - Validation Error', error);
      return res.status(422).json({
        status: 'failure',
        message: '❌ Validation error during site creation.',
        error: error.message,
      });
    }
    if (error.code === 11000) {
      logStackError('❌ Site Creation - Duplicate Error', error);
      return res.status(409).json({
        status: 'failure',
        message: 'A site with this code or name already exists.',
      });
    }
    logStackError('❌ Site Creation - Unknown Error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'An unexpected error occurred creating the site.',
      error: error.message,
    });
  }
};

/**
 * Retrieve all Sites.
 */
export const getAllSites = async (req, res) => {
  try {
    const sites = await SiteModel.find();

    // Cache in Redis
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(sites), { EX: 60 * 5 });
    dbgRedis('redis mounting complete', redisClient);

    logger.info('✅ Fetched All Sites', {
      context: 'getAllSites',
      count: sites.length,
    });
    loggerJsonFormat.info('✅ Fetched All Sites', {
      context: 'getAllSites',
      count: sites.length,
    });

    return res.status(200).json({
      status: 'success',
      message: '✅ Sites retrieved successfully.',
      count: sites.length,
      data: sites,
    });
  } catch (error) {
    logStackError('❌ Get All Sites Error', error);
    return res.status(500).json({
      status: 'failure',
      message: '❌ Internal Server Error while fetching sites.',
      error: error.message,
    });
  }
};

/**
 * Retrieve a Site by ID.
 */
export const getSiteById = async (req, res) => {
  try {
    const { siteId } = req.params;
    const site = await SiteModel.findById(siteId);
    if (!site) {
      return res.status(404).json({
        status: 'failure',
        message: '⚠️ Site not found.',
      });
    }
    winstonLogger.info(`✅ Retrieved site: ${site._id}`);
    return res.status(200).json({
      status: 'success',
      message: '✅ Site retrieved successfully.',
      data: site,
    });
  } catch (error) {
    logError('❌ Get Site By ID', error);
    return res.status(500).json({
      status: 'failure',
      message: '❌ Internal Server Error',
      error: error.message,
    });
  }
};

/**
 * Update a Site by ID.
 */
export const updateSiteById = async (req, res) => {
  try {
    const { siteId } = req.params;
    const updateData = {
      ...req.body,
      updatedBy: req.user?.username || 'Unknown',
    };
    const site = await SiteModel.findByIdAndUpdate(siteId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!site) {
      return res.status(404).json({
        status: 'failure',
        message: '⚠️ Site not found.',
      });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Site',
      action: 'UPDATE',
      recordId: site._id,
      changes: { newData: site },
    });

    await invalidateSiteCache();

    winstonLogger.info(`ℹ️ Updated site: ${site._id}`);
    return res.status(200).json({
      status: 'success',
      message: '✅ Site updated successfully.',
      data: site,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(422).json({
        status: 'failure',
        message: '❌ Validation error during site update.',
        error: error.message,
      });
    }
    logError('❌ Update Site By ID', error);
    return res.status(500).json({
      status: 'failure',
      message: '❌ Internal Server Error',
      error: error.message,
    });
  }
};

/**
 * Delete a Site by ID.
 */
export const deleteSiteById = async (req, res) => {
  try {
    const { siteId } = req.params;
    const site = await SiteModel.findByIdAndDelete(siteId);
    if (!site) {
      return res.status(404).json({
        status: 'failure',
        message: '⚠️ Site not found.',
      });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Site',
      action: 'DELETE',
      recordId: site._id,
      changes: null,
    });

    await invalidateSiteCache();

    winstonLogger.info(`ℹ️ Deleted site: ${site._id}`);
    return res.status(200).json({
      status: 'success',
      message: '✅ Site deleted successfully.',
    });
  } catch (error) {
    logError('❌ Delete Site By ID', error);
    return res.status(500).json({
      status: 'failure',
      message: '❌ Internal Server Error',
      error: error.message,
    });
  }
};

/**
 * Archive a Site by ID.
 */
export const archiveSiteById = async (req, res) => {
  try {
    const { siteId } = req.params;
    const site = await SiteModel.findByIdAndUpdate(
      siteId,
      { archived: true, updatedBy: req.user?.username || 'Unknown' },
      { new: true }
    );
    if (!site) {
      return res.status(404).json({
        status: 'failure',
        message: '⚠️ Site not found.',
      });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Site',
      action: 'ARCHIVE',
      recordId: site._id,
      changes: { newData: site },
    });

    await invalidateSiteCache();

    winstonLogger.info(`ℹ️ Archived site: ${site._id}`);
    return res.status(200).json({
      status: 'success',
      message: '✅ Site archived successfully.',
      data: site,
    });
  } catch (error) {
    logError('❌ Archive Site', error);
    return res.status(500).json({
      status: 'failure',
      message: '❌ Internal Server Error',
      error: error.message,
    });
  }
};

/**
 * Unarchive a Site by ID.
 */
export const unarchiveSiteById = async (req, res) => {
  try {
    const { siteId } = req.params;
    const site = await SiteModel.findByIdAndUpdate(
      siteId,
      { archived: false, updatedBy: req.user?.username || 'Unknown' },
      { new: true }
    );
    if (!site) {
      return res.status(404).json({
        status: 'failure',
        message: '⚠️ Site not found.',
      });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'Site',
      action: 'UNARCHIVE',
      recordId: site._id,
      changes: { newData: site },
    });

    await invalidateSiteCache();

    winstonLogger.info(`ℹ️ Unarchived site: ${site._id}`);
    return res.status(200).json({
      status: 'success',
      message: '✅ Site unarchived successfully.',
      data: site,
    });
  } catch (error) {
    logError('❌ Unarchive Site', error);
    return res.status(500).json({
      status: 'failure',
      message: '❌ Internal Server Error',
      error: error.message,
    });
  }
};

/**
 * Retrieve archived Sites.
 */
export const getArchivedSites = async (req, res) => {
  try {
    const sites = await SiteModel.find({ archived: true });
    winstonLogger.info(`ℹ️ Retrieved ${sites.length} archived sites.`);
    return res.status(200).json({
      status: 'success',
      message: '✅ Archived sites retrieved successfully.',
      data: sites,
    });
  } catch (error) {
    logError('❌ Get Archived Sites', error);
    return res.status(500).json({
      status: 'failure',
      message: '❌ Internal Server Error',
      error: error.message,
    });
  }
};

/**
 * Bulk Create Sites.
 * Expects req.body = [{ name, type, ... }, ...]
 */
export const bulkCreateSites = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: 'failure',
      message: '⚠️ Request body must be a non-empty array of site objects.',
    });
  }

  // 1) In‐batch duplicate‐name check
  const names = docs.map((d) => d.name && d.name.trim());
  const dupNames = names.filter((n, i) => n && names.indexOf(n) !== i);
  if (dupNames.length) {
    return res.status(400).json({
      status: 'failure',
      message: `Duplicate site name(s) in request: ${[
        ...new Set(dupNames),
      ].join(', ')}`,
    });
  }

  // 2) Conflict with existing DB names
  const conflict = await SiteModel.find({ name: { $in: names } })
    .select('name')
    .lean();
  if (conflict.length) {
    return res.status(409).json({
      status: 'failure',
      message: `Site name(s) already exist: ${conflict
        .map((s) => s.name)
        .join(', ')}`,
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    logger.info('💾 Bulk create: inserting sites', {
      context: 'bulkCreateSites',
      count: n,
    });

    // 1) Reserve a block of sequence numbers
    const counter = await SiteCounterModel.findOneAndUpdate(
      { _id: 'siteCode' },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );

    const endSeq = counter.seq;
    const startSeq = endSeq - n + 1;

    // 2) Assign a unique code to each doc
    docs.forEach((doc, idx) => {
      const seqNumber = (startSeq + idx).toString().padStart(3, '0');
      doc.code = `SITE_${seqNumber}`; // ADDED
    });

    const created = await SiteModel.insertMany(docs, { session });

    await Promise.all(
      created.map((site) =>
        createAuditLog({
          user: req.user?.username || '67ec2fb004d3cc3237b58772',
          module: 'Site',
          action: 'BULK_CREATE',
          recordId: site._id,
          changes: { newData: site },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();

    await invalidateSiteCache();

    logger.info('✅ Bulk create successful', {
      context: 'bulkCreateSites',
      createdCount: created.length,
    });
    return res.status(201).json({
      status: 'success',
      message: `✅ ${created.length} sites created successfully.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError('❌ Bulk create error', error);
    return res.status(500).json({
      status: 'failure',
      message: '❌ Error during bulk site creation.',
      error: error.message,
    });
  }
};

/**
 * Bulk Update Sites.
 * Expects req.body = [{ id: "...", update: { ... } }, ...]
 */
export const bulkUpdateSites = async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      status: 'failure',
      message: '⚠️ Request body must be a non-empty array of {id, update}.',
    });
  }

  // 1) Collect IDs and new names
  const ids = updates.map((u) => u.id || u._id).filter(Boolean);
  if (ids.some((i) => !mongoose.Types.ObjectId.isValid(i))) {
    return res.status(400).json({
      status: 'failure',
      message: 'One or more invalid site IDs provided.',
    });
  }

  const nameUpdates = updates
    .map((u) => u.update?.name && u.update.name.trim())
    .filter(Boolean);

  // 2) In‐batch duplicate‐name check
  const dupNames = nameUpdates.filter((n, i) => nameUpdates.indexOf(n) !== i);
  if (dupNames.length) {
    return res.status(400).json({
      status: 'failure',
      message: `Duplicate site name(s) in request: ${[
        ...new Set(dupNames),
      ].join(', ')}`,
    });
  }

  // 3) DB conflict check (exclude these same IDs)
  if (nameUpdates.length) {
    const conflicts = await SiteModel.find({
      name: { $in: nameUpdates },
      _id: { $nin: ids },
    })
      .select('name')
      .lean();
    if (conflicts.length) {
      return res.status(409).json({
        status: 'failure',
        message: `Site name(s) already in use: ${conflicts
          .map((s) => s.name)
          .join(', ')}`,
      });
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    logger.info('🔄 Bulk update: processing sites', {
      context: 'bulkUpdateSites',
      count: updates.length,
    });

    const results = [];
    for (const { _id, update } of updates) {
      const updated = await SiteModel.findByIdAndUpdate(
        _id,
        { ...update, updatedBy: req.user?.username || 'Unknown' },
        { new: true, runValidators: true, session }
      );
      if (!updated) throw new Error(`Site not found: ${_id}`);

      await createAuditLog({
        user: req.user?.username || '67ec2fb004d3cc3237b58772',
        module: 'Site',
        action: 'BULK_UPDATE',
        recordId: updated._id,
        changes: { newData: updated },
      });
      results.push(updated);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateSiteCache();

    logger.info('✅ Bulk update successful', {
      context: 'bulkUpdateSites',
      updatedCount: results.length,
    });
    return res.status(200).json({
      status: 'success',
      message: `✅ ${results.length} sites updated successfully.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError('❌ Bulk update error', error);
    return res.status(500).json({
      status: 'failure',
      message: '❌ Error during bulk site update.',
      error: error.message,
    });
  }
};

/**
 * Bulk Delete Sites.
 * Expects req.body = { ids: ["...", "..."] }
 */
export const bulkDeleteSites = async (req, res) => {
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
    logger.info('🗑️ Bulk delete: removing sites', {
      context: 'bulkDeleteSites',
      count: ids.length,
    });

    const { deletedCount } = await SiteModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error('No sites deleted.');

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || '67ec2fb004d3cc3237b58772',
          module: 'Site',
          action: 'BULK_DELETE',
          recordId: id,
          changes: null,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateSiteCache();

    logger.info('✅ Bulk delete successful', {
      context: 'bulkDeleteSites',
      deletedCount,
    });
    return res.status(200).json({
      status: 'success',
      message: `✅ ${deletedCount} sites deleted successfully.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError('❌ Bulk delete error', error);
    return res.status(500).json({
      status: 'failure',
      message: '❌ Error during bulk site deletion.',
      error: error.message,
    });
  }
};

// controllers/site.controller.js

// ———— 1) Bulk delete only “leaf” Sites (skip those with children) ————
export const bulkAllDeleteSites = async (req, res) => {
  try {
    // 1. Find all Site IDs that have at least one Warehouse
    const sitesWithChildren = await WarehouseModel.distinct('site');
    // 2. Find leaf‐sites (no warehouses)
    const toDelete = await SiteModel.find({
      _id: { $nin: sitesWithChildren },
    }).select('_id code name');

    if (toDelete.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No leaf sites to delete. All sites have child warehouses.',
      });
    }

    const deleteIds = toDelete.map((s) => s._id);
    const deleted = await SiteModel.deleteMany({ _id: { $in: deleteIds } });

    // 3) Recompute the highest used sequence from whatever codes remain
    const remaining = await SiteModel.find({}, 'code').lean();
    let maxSeq = 0;
    for (const { code } of remaining) {
      // assuming your codes look like “WH_00123” or similar
      const m = code.match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxSeq) maxSeq = n;
      }
    }

    // 3. Reset the Site counter
    const resetCounter = await SiteCounterModel.findByIdAndUpdate(
      { _id: 'siteCode' },
      { seq: maxSeq },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      status: 'success',
      message: `Deleted ${deleted.deletedCount} leaf site(s).`,
      skipped: sitesWithChildren, // array of site IDs with children
      deletedSites: toDelete, // array of deleted site docs
      counter: resetCounter,
    });
  } catch (error) {
    console.error('❌ bulkAllDeleteSites error:', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Error in bulkAllDeleteSites',
      error: error.message,
    });
  }
};

// ———— 2) Bulk delete ALL Sites + cascade to ALL children ————
export const bulkAllDeleteSitesCascade = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. Gather all Site IDs
    const allSites = await SiteModel.find({}, '_id').lean();
    const siteIds = allSites.map((s) => s._id);

    if (siteIds.length === 0) {
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({
        status: 'success',
        message: 'No sites found to delete.',
      });
    }

    // 2. Delete cascading down the chain
    // 2a. Warehouses
    const whs = await WarehouseModel.find(
      { site: { $in: siteIds } },
      '_id'
    ).session(session);
    const whIds = whs.map((w) => w._id);
    await WarehouseModel.deleteMany({ site: { $in: siteIds } }).session(
      session
    );

    // 2b. Zones
    const zs = await ZoneModel.find(
      { warehouse: { $in: whIds } },
      '_id'
    ).session(session);
    const zIds = zs.map((z) => z._id);
    await ZoneModel.deleteMany({ warehouse: { $in: whIds } }).session(session);

    // 2c. Locations
    const locs = await LocationModel.find(
      { zone: { $in: zIds } },
      '_id'
    ).session(session);
    const locIds = locs.map((l) => l._id);
    await LocationModel.deleteMany({ zone: { $in: zIds } }).session(session);

    // 2d. Aisles
    const as = await AisleModel.find(
      { location: { $in: locIds } },
      '_id'
    ).session(session);
    const aIds = as.map((a) => a._id);
    await AisleModel.deleteMany({ location: { $in: locIds } }).session(session);

    // 2e. Racks
    const rs = await RackModel.find({ aisle: { $in: aIds } }, '_id').session(
      session
    );
    const rIds = rs.map((r) => r._id);
    await RackModel.deleteMany({ aisle: { $in: aIds } }).session(session);

    // 2f. Shelves
    const shs = await ShelfModel.find({ rack: { $in: rIds } }, '_id').session(
      session
    );
    const shIds = shs.map((s) => s._id);
    await ShelfModel.deleteMany({ rack: { $in: rIds } }).session(session);

    // 2g. Bins
    await BinModel.deleteMany({ shelf: { $in: shIds } }).session(session);

    // 2h. Finally, delete all Sites
    const deletedSites = await SiteModel.deleteMany({
      _id: { $in: siteIds },
    }).session(session);

    // 3. Reset all relevant counters
    const resetSiteCtr = await SiteCounterModel.findByIdAndUpdate(
      { _id: 'siteCode' },
      { seq: 0 },
      { new: true, upsert: true, session }
    );

    // 3. Reset all relevant counters
    const resetWhCtr = await WarehouseCounterModel.findByIdAndUpdate(
      { _id: 'whCode' },
      { seq: 0 },
      { new: true, upsert: true, session }
    );

    // 3. Reset all relevant counters
    const resetZoneCtr = await ZoneCounterModel.findByIdAndUpdate(
      { _id: 'zoneCode' },
      { seq: 0 },
      { new: true, upsert: true, session }
    );
    const resetLocCtr = await LocationCounterModel.findByIdAndUpdate(
      { _id: 'locationCode' },
      { seq: 0 },
      { new: true, upsert: true, session }
    );

    const resetAisleCtr = await AisleCounterModel.findByIdAndUpdate(
      { _id: 'aisleCode' },
      { seq: 0 },
      { new: true, upsert: true, session }
    );

    const resetRackCtr = await RackCounterModel.findByIdAndUpdate(
      { _id: 'rackCode' },
      { seq: 0 },
      { new: true, upsert: true, session }
    );

    const resetShelfCtr = await ShelfCounterModel.findByIdAndUpdate(
      { _id: 'shelfCode' },
      { seq: 0 },
      { new: true, upsert: true, session }
    );

    const resetBinCtr = await BinCounterModel.findByIdAndUpdate(
      { _id: 'binCode' },
      { seq: 0 },
      { new: true, upsert: true, session }
    );

    // ... repeat for warehouseCode, zoneCode, locationCode, aisleCode, rackCode, shelfCode, binCode
    // e.g.:
    // await WarehouseCounterModel.findByIdAndUpdate({ _id: "warehouseCode" }, { seq: 0 }, { new: true, upsert: true, session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      status: 'success',
      message: `Cascade‐deleted ${deletedSites.deletedCount} site(s) + all children.`,
      counter: {
        site: resetSiteCtr,
        warehouse: resetWhCtr,
        zone: resetZoneCtr,
        location: resetLocCtr,
        aisle: resetAisleCtr,
        rack: resetRackCtr,
        shelf: resetShelfCtr,
        bin: resetBinCtr,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ bulkAllDeleteSitesCascade error:', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Error in bulkAllDeleteSitesCascade',
      error: error.message,
    });
  }
};
