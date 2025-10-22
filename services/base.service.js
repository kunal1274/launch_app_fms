/**
 * Base Service Template for FMS Application
 * This file provides standardized service patterns that all services should follow
 */

import { asyncHandler } from '../utility/error.util.js';
import { handleDatabaseError } from '../utility/error.util.js';
import logger from '../utility/logger.util.js';

/**
 * Base Service Class
 */
export class BaseService {
  constructor(model, serviceName) {
    this.model = model;
    this.serviceName = serviceName;
  }

  /**
   * Create a new record
   */
  create = asyncHandler(async (data, options = {}) => {
    try {
      const record = await this.model.create(data);
      
      if (options.populate) {
        await record.populate(options.populate);
      }

      logger.info(`${this.serviceName} created`, {
        id: record._id,
        data: this.sanitizeData(data),
      });

      return record;
    } catch (error) {
      handleDatabaseError(error);
    }
  });

  /**
   * Find records with query
   */
  find = asyncHandler(async (query = {}, options = {}) => {
    try {
      const {
        select,
        populate,
        sort = '-createdAt',
        limit,
        skip,
      } = options;

      let queryBuilder = this.model.find(query);

      if (select) queryBuilder = queryBuilder.select(select);
      if (populate) queryBuilder = queryBuilder.populate(populate);
      if (sort) queryBuilder = queryBuilder.sort(sort);
      if (skip) queryBuilder = queryBuilder.skip(skip);
      if (limit) queryBuilder = queryBuilder.limit(limit);

      const records = await queryBuilder.exec();
      return records;
    } catch (error) {
      handleDatabaseError(error);
    }
  });

  /**
   * Find one record
   */
  findOne = asyncHandler(async (query = {}, options = {}) => {
    try {
      const { select, populate } = options;

      let queryBuilder = this.model.findOne(query);

      if (select) queryBuilder = queryBuilder.select(select);
      if (populate) queryBuilder = queryBuilder.populate(populate);

      const record = await queryBuilder.exec();
      return record;
    } catch (error) {
      handleDatabaseError(error);
    }
  });

  /**
   * Find by ID
   */
  findById = asyncHandler(async (id, options = {}) => {
    try {
      const { select, populate } = options;

      let queryBuilder = this.model.findById(id);

      if (select) queryBuilder = queryBuilder.select(select);
      if (populate) queryBuilder = queryBuilder.populate(populate);

      const record = await queryBuilder.exec();
      return record;
    } catch (error) {
      handleDatabaseError(error);
    }
  });

  /**
   * Update a record
   */
  update = asyncHandler(async (query, updateData, options = {}) => {
    try {
      const { new: returnNew = true, runValidators = true } = options;

      const record = await this.model.findOneAndUpdate(
        query,
        updateData,
        { new: returnNew, runValidators }
      );

      if (record) {
        logger.info(`${this.serviceName} updated`, {
          id: record._id,
          updateData: this.sanitizeData(updateData),
        });
      }

      return record;
    } catch (error) {
      handleDatabaseError(error);
    }
  });

  /**
   * Update by ID
   */
  updateById = asyncHandler(async (id, updateData, options = {}) => {
    try {
      const { new: returnNew = true, runValidators = true } = options;

      const record = await this.model.findByIdAndUpdate(
        id,
        updateData,
        { new: returnNew, runValidators }
      );

      if (record) {
        logger.info(`${this.serviceName} updated by ID`, {
          id: record._id,
          updateData: this.sanitizeData(updateData),
        });
      }

      return record;
    } catch (error) {
      handleDatabaseError(error);
    }
  });

  /**
   * Delete a record (soft delete)
   */
  delete = asyncHandler(async (query, options = {}) => {
    try {
      const { hardDelete = false } = options;

      let record;
      if (hardDelete) {
        record = await this.model.findOneAndDelete(query);
      } else {
        record = await this.model.findOneAndUpdate(
          query,
          {
            isDeleted: true,
            isActive: false,
            deletedAt: new Date(),
          },
          { new: true }
        );
      }

      if (record) {
        logger.info(`${this.serviceName} deleted`, {
          id: record._id,
          hardDelete,
        });
      }

      return record;
    } catch (error) {
      handleDatabaseError(error);
    }
  });

  /**
   * Delete by ID
   */
  deleteById = asyncHandler(async (id, options = {}) => {
    try {
      const { hardDelete = false } = options;

      let record;
      if (hardDelete) {
        record = await this.model.findByIdAndDelete(id);
      } else {
        record = await this.model.findByIdAndUpdate(
          id,
          {
            isDeleted: true,
            isActive: false,
            deletedAt: new Date(),
          },
          { new: true }
        );
      }

      if (record) {
        logger.info(`${this.serviceName} deleted by ID`, {
          id: record._id,
          hardDelete,
        });
      }

      return record;
    } catch (error) {
      handleDatabaseError(error);
    }
  });

  /**
   * Count records
   */
  count = asyncHandler(async (query = {}) => {
    try {
      const count = await this.model.countDocuments(query);
      return count;
    } catch (error) {
      handleDatabaseError(error);
    }
  });

  /**
   * Check if record exists
   */
  exists = asyncHandler(async (query) => {
    try {
      const count = await this.model.countDocuments(query);
      return count > 0;
    } catch (error) {
      handleDatabaseError(error);
    }
  });

  /**
   * Bulk operations
   */
  bulkCreate = asyncHandler(async (dataArray, options = {}) => {
    try {
      const records = await this.model.insertMany(dataArray, options);
      
      logger.info(`${this.serviceName} bulk created`, {
        count: records.length,
      });

      return records;
    } catch (error) {
      handleDatabaseError(error);
    }
  });

  bulkUpdate = asyncHandler(async (query, updateData, options = {}) => {
    try {
      const result = await this.model.updateMany(query, updateData, options);
      
      logger.info(`${this.serviceName} bulk updated`, {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      });

      return result;
    } catch (error) {
      handleDatabaseError(error);
    }
  });

  bulkDelete = asyncHandler(async (query, options = {}) => {
    try {
      const { hardDelete = false } = options;

      let result;
      if (hardDelete) {
        result = await this.model.deleteMany(query);
      } else {
        result = await this.model.updateMany(
          query,
          {
            isDeleted: true,
            isActive: false,
            deletedAt: new Date(),
          }
        );
      }

      logger.info(`${this.serviceName} bulk deleted`, {
        deletedCount: result.deletedCount || result.modifiedCount,
        hardDelete,
      });

      return result;
    } catch (error) {
      handleDatabaseError(error);
    }
  });

  /**
   * Pagination
   */
  paginate = asyncHandler(async (query = {}, options = {}) => {
    try {
      const {
        page = 1,
        limit = 10,
        sort = '-createdAt',
        select,
        populate,
      } = options;

      const skip = (page - 1) * limit;

      const [records, total] = await Promise.all([
        this.find(query, { select, populate, sort, limit, skip }),
        this.count(query),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: records,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  });

  /**
   * Search functionality
   */
  search = asyncHandler(async (searchTerm, searchFields = [], options = {}) => {
    try {
      if (!searchTerm || searchFields.length === 0) {
        return this.paginate({}, options);
      }

      const searchQuery = {
        $or: searchFields.map(field => ({
          [field]: { $regex: searchTerm, $options: 'i' }
        }))
      };

      return this.paginate(searchQuery, options);
    } catch (error) {
      handleDatabaseError(error);
    }
  });

  /**
   * Sanitize data for logging (remove sensitive fields)
   */
  sanitizeData = (data) => {
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    const sanitized = { ...data };

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  };

  /**
   * Get statistics
   */
  getStats = asyncHandler(async (query = {}) => {
    try {
      const stats = await this.model.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$isActive', true] }, { $eq: ['$isDeleted', false] }] },
                  1,
                  0
                ]
              }
            },
            inactive: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$isActive', false] }, { $eq: ['$isDeleted', false] }] },
                  1,
                  0
                ]
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

      return stats[0] || { total: 0, active: 0, inactive: 0, deleted: 0 };
    } catch (error) {
      handleDatabaseError(error);
    }
  });
}

/**
 * Helper function to create a standardized service
 */
export const createService = (model, serviceName) => {
  return new BaseService(model, serviceName);
};

export default BaseService;
