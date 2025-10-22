/**
 * Base Controller Template for FMS Application
 * This file provides a standardized controller structure that all controllers should follow
 */

import { asyncHandler } from '../utility/error.util.js';
import {
  successResponse,
  errorResponse,
  createdResponse,
  updatedResponse,
  deletedResponse,
  notFoundResponse,
  paginatedResponse,
  HTTP_STATUS,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from '../utility/response.util.js';
import { validate } from '../utility/validation.util.js';

/**
 * Base Controller Class
 */
export class BaseController {
  constructor(model, modelName) {
    this.model = model;
    this.modelName = modelName;
  }

  /**
   * Get all records with pagination and filtering
   */
  getAll = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      sort = '-createdAt',
      search,
      ...filters
    } = req.query;

    // Build query
    let query = { isDeleted: false };

    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Add filters
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        query[key] = filters[key];
      }
    });

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      this.model.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email'),
      this.model.countDocuments(query),
    ]);

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
    };

    return paginatedResponse(res, data, pagination, SUCCESS_MESSAGES.RETRIEVED);
  });

  /**
   * Get a single record by ID
   */
  getById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const data = await this.model.findOne({ _id: id, isDeleted: false })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!data) {
      return notFoundResponse(res, `${this.modelName} not found`);
    }

    return successResponse(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.RETRIEVED, data);
  });

  /**
   * Create a new record
   */
  create = asyncHandler(async (req, res) => {
    const data = req.body;

    // Add audit fields
    data.createdBy = req.user?.id;
    data.updatedBy = req.user?.id;

    const newRecord = await this.model.create(data);

    // Populate the created record
    await newRecord.populate('createdBy', 'name email');

    return createdResponse(res, `${this.modelName} created successfully`, newRecord);
  });

  /**
   * Update a record by ID
   */
  update = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    // Add audit fields
    updateData.updatedBy = req.user?.id;

    const updatedRecord = await this.model.findOneAndUpdate(
      { _id: id, isDeleted: false },
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!updatedRecord) {
      return notFoundResponse(res, `${this.modelName} not found`);
    }

    return updatedResponse(res, `${this.modelName} updated successfully`, updatedRecord);
  });

  /**
   * Soft delete a record by ID
   */
  delete = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const deletedRecord = await this.model.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        isDeleted: true,
        isActive: false,
        deletedBy: req.user?.id,
        deletedAt: new Date(),
      },
      { new: true }
    );

    if (!deletedRecord) {
      return notFoundResponse(res, `${this.modelName} not found`);
    }

    return deletedResponse(res, `${this.modelName} deleted successfully`);
  });

  /**
   * Hard delete a record by ID (use with caution)
   */
  hardDelete = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const deletedRecord = await this.model.findByIdAndDelete(id);

    if (!deletedRecord) {
      return notFoundResponse(res, `${this.modelName} not found`);
    }

    return deletedResponse(res, `${this.modelName} permanently deleted`);
  });

  /**
   * Restore a soft-deleted record
   */
  restore = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const restoredRecord = await this.model.findOneAndUpdate(
      { _id: id, isDeleted: true },
      {
        isDeleted: false,
        isActive: true,
        updatedBy: req.user?.id,
        deletedBy: null,
        deletedAt: null,
      },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!restoredRecord) {
      return notFoundResponse(res, `${this.modelName} not found or not deleted`);
    }

    return updatedResponse(res, `${this.modelName} restored successfully`, restoredRecord);
  });

  /**
   * Activate a record
   */
  activate = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const activatedRecord = await this.model.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        isActive: true,
        updatedBy: req.user?.id,
      },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!activatedRecord) {
      return notFoundResponse(res, `${this.modelName} not found`);
    }

    return updatedResponse(res, `${this.modelName} activated successfully`, activatedRecord);
  });

  /**
   * Deactivate a record
   */
  deactivate = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const deactivatedRecord = await this.model.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        isActive: false,
        updatedBy: req.user?.id,
      },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!deactivatedRecord) {
      return notFoundResponse(res, `${this.modelName} not found`);
    }

    return updatedResponse(res, `${this.modelName} deactivated successfully`, deactivatedRecord);
  });

  /**
   * Get deleted records
   */
  getDeleted = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      sort = '-deletedAt',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      this.model.find({ isDeleted: true })
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email')
        .populate('deletedBy', 'name email'),
      this.model.countDocuments({ isDeleted: true }),
    ]);

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
    };

    return paginatedResponse(res, data, pagination, 'Deleted records retrieved successfully');
  });

  /**
   * Get inactive records
   */
  getInactive = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      sort = '-updatedAt',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      this.model.find({ isActive: false, isDeleted: false })
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email'),
      this.model.countDocuments({ isActive: false, isDeleted: false }),
    ]);

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
    };

    return paginatedResponse(res, data, pagination, 'Inactive records retrieved successfully');
  });

  /**
   * Bulk operations
   */
  bulkCreate = asyncHandler(async (req, res) => {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Data array is required');
    }

    // Add audit fields to all records
    const recordsWithAudit = data.map(record => ({
      ...record,
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
    }));

    const createdRecords = await this.model.insertMany(recordsWithAudit);

    return createdResponse(res, `${createdRecords.length} ${this.modelName} records created successfully`, createdRecords);
  });

  bulkUpdate = asyncHandler(async (req, res) => {
    const { ids, updateData } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'IDs array is required');
    }

    // Add audit fields
    updateData.updatedBy = req.user?.id;

    const result = await this.model.updateMany(
      { _id: { $in: ids }, isDeleted: false },
      updateData
    );

    return updatedResponse(res, `${result.modifiedCount} ${this.modelName} records updated successfully`);
  });

  bulkDelete = asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'IDs array is required');
    }

    const result = await this.model.updateMany(
      { _id: { $in: ids }, isDeleted: false },
      {
        isDeleted: true,
        isActive: false,
        deletedBy: req.user?.id,
        deletedAt: new Date(),
      }
    );

    return deletedResponse(res, `${result.modifiedCount} ${this.modelName} records deleted successfully`);
  });

  /**
   * Get statistics
   */
  getStats = asyncHandler(async (req, res) => {
    const stats = await this.model.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$isActive', true] }, { $eq: ['$isDeleted', false] }] }, 1, 0]
            }
          },
          inactive: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$isActive', false] }, { $eq: ['$isDeleted', false] }] }, 1, 0]
            }
          },
          deleted: {
            $sum: {
              $cond: [{ $eq: ['$isDeleted', true] }, 1, 0]
            }
          },
        }
      }
    ]);

    const result = stats[0] || { total: 0, active: 0, inactive: 0, deleted: 0 };

    return successResponse(res, HTTP_STATUS.OK, 'Statistics retrieved successfully', result);
  });
}

/**
 * Helper function to create a standardized controller
 */
export const createController = (model, modelName) => {
  return new BaseController(model, modelName);
};

/**
 * Common validation schemas for controllers
 */
export const commonValidationSchemas = {
  // Basic CRUD validation
  create: {
    // Override in specific controllers
  },
  update: {
    // Override in specific controllers
  },
  
  // Pagination validation
  pagination: {
    page: { type: 'number', min: 1, default: 1 },
    limit: { type: 'number', min: 1, max: 100, default: 10 },
    sort: { type: 'string', default: '-createdAt' },
    search: { type: 'string', required: false },
  },
  
  // ID validation
  id: {
    id: { type: 'string', required: true, pattern: /^[0-9a-fA-F]{24}$/ },
  },
  
  // Bulk operations validation
  bulkCreate: {
    data: { type: 'array', required: true, minLength: 1 },
  },
  bulkUpdate: {
    ids: { type: 'array', required: true, minLength: 1 },
    updateData: { type: 'object', required: true },
  },
  bulkDelete: {
    ids: { type: 'array', required: true, minLength: 1 },
  },
};

/**
 * Middleware for validation
 */
export const validateRequest = (schema) => {
  return asyncHandler(async (req, res, next) => {
    try {
      validate(req.body, schema);
      next();
    } catch (error) {
      return errorResponse(res, HTTP_STATUS.BAD_REQUEST, error.message, error.errors);
    }
  });
};

export default BaseController;
