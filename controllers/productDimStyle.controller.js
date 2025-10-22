// controllers/productDimStyle.controller.js

import mongoose from 'mongoose';
import { ProductDimStyleModel } from '../models/productDimStyle.model.js';
import { ProductDimStyleCounterModel } from '../models/counter.model.js';
import { createAuditLog } from '../audit_logging_service/utils/auditLogger.utils.js';
import redisClient from '../middleware/redisClient.js';
import logger, { logStackError } from '../utility/logger.util.js';
import { winstonLogger, logError } from '../utility/logError.utils.js';

// Helper: invalidate style configs cache
const invalidateStyleCache = async (key = '/fms/api/v0/styles') => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: 'invalidateStyleCache',
    });
  } catch (err) {
    logStackError('❌ Style cache invalidation failed', err);
  }
};

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/** Create a new Product Dimension Style */
export const createStyleConfig = async (req, res) => {
  try {
    const {
      name,
      type,
      values,
      description,
      active,
      groups,
      company,
      files,
      extras,
    } = req.body;
    if (!name || !type || !Array.isArray(values) || values.length === 0) {
      return res.status(422).json({
        status: 'failure',
        message: '⚠️ name, type and a non-empty values array are required.',
      });
    }

    const styleCfg = await ProductDimStyleModel.create({
      name,
      type,
      values,
      description,
      active,
      groups,
      company,
      files,
      extras,
    });

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'ProductDimStyle',
      action: 'CREATE',
      recordId: styleCfg._id,
      changes: { newData: styleCfg },
    });

    await invalidateStyleCache();
    winstonLogger.info(`✅ Style config created: ${styleCfg._id}`);

    return res.status(201).json({
      status: 'success',
      message: '✅ Style configuration created successfully.',
      data: styleCfg,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res
        .status(422)
        .json({ status: 'failure', message: error.message });
    }
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ status: 'failure', message: 'Duplicate code or name.' });
    }
    logStackError('❌ Style creation error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

/** ──────────────────────────────
 *  Append new values (leave existing intact)
 * ────────────────────────────── */
export const appendStyleValues = async (req, res) => {
  try {
    const { styleId } = req.params;
    const { values } = req.body;

    if (!isValidObjectId(styleId)) {
      return res
        .status(400)
        .json({ status: 'failure', message: 'Invalid style ID' });
    }
    if (!Array.isArray(values) || values.length === 0) {
      return res.status(422).json({
        status: 'failure',
        message: '⚠️ `values` must be a non-empty array of strings.',
      });
    }

    // $addToSet avoids duplicates, $each lets us add multiple
    const stl = await ProductDimStyleModel.findByIdAndUpdate(
      styleId,
      {
        $addToSet: { values: { $each: values } },
        updatedBy: req.user?.username,
      },
      { new: true, runValidators: true }
    );
    if (!stl) {
      return res.status(404).json({ status: 'failure', message: 'Not found.' });
    }

    await createAuditLog({
      user: req.user?.username,
      module: 'ProductDimStyle',
      action: 'APPEND_VALUES',
      recordId: stl._id,
      changes: { appended: values },
    });
    await invalidateStyleCache();

    return res.status(200).json({ status: 'success', data: stl });
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(422).json({ status: 'failure', message: err.message });
    }
    logError('❌ Append values error', err);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error',
      error: err.message,
    });
  }
};

/** Get all Style Configurations */
export const getAllStyleConfigs = async (req, res) => {
  try {
    const list = await ProductDimStyleModel.find();
    const cacheKey = req.originalUrl;
    await redisClient.set(cacheKey, JSON.stringify(list), { EX: 300 });

    winstonLogger.info(`✅ Fetched all style configs (${list.length})`);
    return res.status(200).json({
      status: 'success',
      count: list.length,
      data: list,
    });
  } catch (error) {
    logStackError('❌ Get all style configs error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

/** Get archived Style Configurations */
export const getArchivedStyleConfigs = async (req, res) => {
  try {
    const archived = await ProductDimStyleModel.find({ archived: true });
    return res.status(200).json({
      status: 'success',
      data: archived,
    });
  } catch (error) {
    logError('❌ Get archived style configs error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

/** Get one Style Config by ID */
export const getStyleConfigById = async (req, res) => {
  try {
    const { styleId } = req.params;
    const cfg = await ProductDimStyleModel.findById(styleId);
    if (!cfg) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Not found.' });
    }
    return res.status(200).json({ status: 'success', data: cfg });
  } catch (error) {
    logError('❌ Get style config by ID error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

/** Update a Style Config by ID */
export const updateStyleConfigById = async (req, res) => {
  try {
    const { styleId } = req.params;
    const updateData = {
      ...req.body,
      updatedBy: req.user?.username || 'Unknown',
    };
    const cfg = await ProductDimStyleModel.findByIdAndUpdate(
      styleId,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );
    if (!cfg) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Not found.' });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'ProductDimStyle',
      action: 'UPDATE',
      recordId: cfg._id,
      changes: { newData: cfg },
    });

    await invalidateStyleCache();
    return res.status(200).json({ status: 'success', data: cfg });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res
        .status(422)
        .json({ status: 'failure', message: error.message });
    }
    logError('❌ Update style config error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

/** Delete a Style Config by ID */
export const deleteStyleConfigById = async (req, res) => {
  try {
    const { styleId } = req.params;
    const cfg = await ProductDimStyleModel.findByIdAndDelete(styleId);
    if (!cfg) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Not found.' });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'ProductDimStyle',
      action: 'DELETE',
      recordId: cfg._id,
    });

    await invalidateStyleCache();
    return res.status(200).json({ status: 'success', message: '✅ Deleted.' });
  } catch (error) {
    logError('❌ Delete style config error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

/** Archive / Unarchive */
export const archiveStyleConfigById = async (req, res) => {
  try {
    const { styleId } = req.params;
    const cfg = await ProductDimStyleModel.findByIdAndUpdate(
      styleId,
      { archived: true, updatedBy: req.user?.username || 'Unknown' },
      { new: true }
    );
    if (!cfg) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Not found.' });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'ProductDimStyle',
      action: 'ARCHIVE',
      recordId: cfg._id,
    });

    await invalidateStyleCache();
    return res.status(200).json({ status: 'success', data: cfg });
  } catch (error) {
    logError('❌ Archive style config error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

export const unarchiveStyleConfigById = async (req, res) => {
  try {
    const { styleId } = req.params;
    const cfg = await ProductDimStyleModel.findByIdAndUpdate(
      styleId,
      { archived: false, updatedBy: req.user?.username || 'Unknown' },
      { new: true }
    );
    if (!cfg) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ Not found.' });
    }

    await createAuditLog({
      user: req.user?.username || '67ec2fb004d3cc3237b58772',
      module: 'ProductDimStyle',
      action: 'UNARCHIVE',
      recordId: cfg._id,
    });

    await invalidateStyleCache();
    return res.status(200).json({ status: 'success', data: cfg });
  } catch (error) {
    logError('❌ Unarchive style config error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

/** Bulk Create / Update / Delete */
export const bulkCreateStyleConfigs = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: 'failure',
      message: '⚠️ Provide a non-empty array of style configs.',
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const n = docs.length;
    const counter = await ProductDimStyleCounterModel.findOneAndUpdate(
      { _id: 'styleCode' },
      { $inc: { seq: n } },
      { new: true, upsert: true, session }
    );
    const end = counter.seq,
      start = end - n + 1;

    docs.forEach((d, i) => {
      d.code = `STL_${(start + i).toString().padStart(3, '0')}`;
    });

    const created = await ProductDimStyleModel.insertMany(docs, { session });
    await Promise.all(
      created.map((cfg) =>
        createAuditLog({
          user: req.user?.username || '67ec2fb004d3cc3237b58772',
          module: 'ProductDimStyle',
          action: 'BULK_CREATE',
          recordId: cfg._id,
          changes: { newData: cfg },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateStyleCache();

    return res.status(201).json({
      status: 'success',
      message: `✅ ${created.length} style configs created.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError('❌ Bulk create style configs error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Error during bulk creation.',
      error: error.message,
    });
  }
};

export const bulkUpdateStyleConfigs = async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      status: 'failure',
      message: '⚠️ Provide a non-empty array of { id or _id, update }.',
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const results = [];
    for (const entry of updates) {
      const id = entry.id ?? entry._id;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid ID: ${id}`);
      }
      const cfg = await ProductDimStyleModel.findByIdAndUpdate(
        id,
        { ...entry.update, updatedBy: req.user?.username || 'Unknown' },
        { new: true, runValidators: true, session }
      );
      if (!cfg) throw new Error(`Not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || '67ec2fb004d3cc3237b58772',
        module: 'ProductDimStyle',
        action: 'BULK_UPDATE',
        recordId: cfg._id,
        changes: { newData: cfg },
      });
      results.push(cfg);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateStyleCache();

    return res.status(200).json({
      status: 'success',
      message: `✅ ${results.length} updated successfully.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError('❌ Bulk update style configs error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Error during bulk update.',
      error: error.message,
    });
  }
};

export const bulkDeleteStyleConfigs = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      status: 'failure',
      message: '⚠️ Provide a non-empty array of ids.',
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { deletedCount } = await ProductDimStyleModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) throw new Error('No configs deleted.');

    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || '67ec2fb004d3cc3237b58772',
          module: 'ProductDimStyle',
          action: 'BULK_DELETE',
          recordId: id,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateStyleCache();

    return res.status(200).json({
      status: 'success',
      message: `✅ ${deletedCount} configs deleted.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError('❌ Bulk delete style configs error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Error during bulk delete.',
      error: error.message,
    });
  }
};
