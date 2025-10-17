/**
 * Standardized Service Template
 * Provides a base template for creating consistent services
 */

import { NotFoundError, ValidationError, ConflictError } from './errorHandler.js';

export class BaseService {
  constructor(Model) {
    this.Model = Model;
  }

  /**
   * Create a new resource
   * @param {Object} data - Resource data
   * @returns {Promise<Object>} Created resource
   */
  async create(data) {
    try {
      // Pre-creation validation
      await this.validateCreate(data);
      
      // Create resource
      const resource = new this.Model(data);
      return await resource.save();
    } catch (error) {
      throw this.handleError(error, 'create');
    }
  }

  /**
   * Get all resources with pagination and filtering
   * @param {Object} filters - Filter criteria
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Object>} Resources and pagination info
   */
  async getAll(filters = {}, page = 1, limit = 10) {
    try {
      // Build query
      const query = this.buildQuery(filters);
      
      // Calculate pagination
      const skip = (page - 1) * limit;
      
      // Execute query
      const [data, total] = await Promise.all([
        this.Model.find(query)
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 })
          .lean(),
        this.Model.countDocuments(query)
      ]);

      return {
        data,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw this.handleError(error, 'getAll');
    }
  }

  /**
   * Get resource by ID
   * @param {string} id - Resource ID
   * @returns {Promise<Object>} Resource
   */
  async getById(id) {
    try {
      const resource = await this.Model.findById(id).lean();
      
      if (!resource) {
        throw new NotFoundError(`${this.Model.modelName} not found`);
      }

      return resource;
    } catch (error) {
      throw this.handleError(error, 'getById');
    }
  }

  /**
   * Update resource by ID
   * @param {string} id - Resource ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated resource
   */
  async update(id, data) {
    try {
      // Pre-update validation
      await this.validateUpdate(data);
      
      // Update resource
      const resource = await this.Model.findByIdAndUpdate(
        id,
        data,
        { new: true, runValidators: true }
      );

      if (!resource) {
        throw new NotFoundError(`${this.Model.modelName} not found`);
      }

      return resource;
    } catch (error) {
      throw this.handleError(error, 'update');
    }
  }

  /**
   * Partial update resource by ID
   * @param {string} id - Resource ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated resource
   */
  async patch(id, data) {
    try {
      // Pre-patch validation
      await this.validatePatch(data);
      
      // Patch resource
      const resource = await this.Model.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
      );

      if (!resource) {
        throw new NotFoundError(`${this.Model.modelName} not found`);
      }

      return resource;
    } catch (error) {
      throw this.handleError(error, 'patch');
    }
  }

  /**
   * Delete resource by ID
   * @param {string} id - Resource ID
   * @returns {Promise<Object>} Deletion result
   */
  async delete(id) {
    try {
      const resource = await this.Model.findByIdAndDelete(id);

      if (!resource) {
        throw new NotFoundError(`${this.Model.modelName} not found`);
      }

      return { deletedCount: 1 };
    } catch (error) {
      throw this.handleError(error, 'delete');
    }
  }

  /**
   * Archive resource by ID
   * @param {string} id - Resource ID
   * @returns {Promise<Object>} Archived resource
   */
  async archive(id) {
    try {
      const resource = await this.Model.findByIdAndUpdate(
        id,
        { archived: true },
        { new: true }
      );

      if (!resource) {
        throw new NotFoundError(`${this.Model.modelName} not found`);
      }

      return resource;
    } catch (error) {
      throw this.handleError(error, 'archive');
    }
  }

  /**
   * Unarchive resource by ID
   * @param {string} id - Resource ID
   * @returns {Promise<Object>} Unarchived resource
   */
  async unarchive(id) {
    try {
      const resource = await this.Model.findByIdAndUpdate(
        id,
        { archived: false },
        { new: true }
      );

      if (!resource) {
        throw new NotFoundError(`${this.Model.modelName} not found`);
      }

      return resource;
    } catch (error) {
      throw this.handleError(error, 'unarchive');
    }
  }

  /**
   * Get archived resources
   * @param {Object} filters - Filter criteria
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Object>} Archived resources and pagination info
   */
  async getArchived(filters = {}, page = 1, limit = 10) {
    try {
      // Build query with archived filter
      const query = { ...this.buildQuery(filters), archived: true };
      
      // Calculate pagination
      const skip = (page - 1) * limit;
      
      // Execute query
      const [data, total] = await Promise.all([
        this.Model.find(query)
          .skip(skip)
          .limit(limit)
          .sort({ updatedAt: -1 })
          .lean(),
        this.Model.countDocuments(query)
      ]);

      return {
        data,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw this.handleError(error, 'getArchived');
    }
  }

  /**
   * Bulk delete resources
   * @param {Array<string>} ids - Array of resource IDs
   * @returns {Promise<Object>} Deletion result
   */
  async bulkDelete(ids) {
    try {
      const result = await this.Model.deleteMany({ _id: { $in: ids } });
      return result;
    } catch (error) {
      throw this.handleError(error, 'bulkDelete');
    }
  }

  /**
   * Search resources
   * @param {string} query - Search query
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Object>} Search results and pagination info
   */
  async search(query, page = 1, limit = 10) {
    try {
      // Build search query
      const searchQuery = this.buildSearchQuery(query);
      
      // Calculate pagination
      const skip = (page - 1) * limit;
      
      // Execute search
      const [data, total] = await Promise.all([
        this.Model.find(searchQuery)
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 })
          .lean(),
        this.Model.countDocuments(searchQuery)
      ]);

      return {
        data,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw this.handleError(error, 'search');
    }
  }

  /**
   * Get resource statistics
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Statistics
   */
  async getStats(filters = {}) {
    try {
      const query = this.buildQuery(filters);
      
      const [
        total,
        active,
        archived,
        recent
      ] = await Promise.all([
        this.Model.countDocuments(query),
        this.Model.countDocuments({ ...query, active: true }),
        this.Model.countDocuments({ ...query, archived: true }),
        this.Model.countDocuments({
          ...query,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        })
      ]);

      return {
        total,
        active,
        archived,
        recent,
        inactive: total - active
      };
    } catch (error) {
      throw this.handleError(error, 'getStats');
    }
  }

  /**
   * Build query from filters
   * @param {Object} filters - Filter criteria
   * @returns {Object} MongoDB query
   */
  buildQuery(filters) {
    const query = {};

    // Add filters based on model fields
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        if (key === 'search') {
          // Handle search functionality
          query.$or = this.buildSearchConditions(filters[key]);
        } else if (key === 'dateRange') {
          // Handle date range
          if (filters[key].startDate) {
            query.createdAt = { ...query.createdAt, $gte: new Date(filters[key].startDate) };
          }
          if (filters[key].endDate) {
            query.createdAt = { ...query.createdAt, $lte: new Date(filters[key].endDate) };
          }
        } else {
          // Direct field matching
          query[key] = filters[key];
        }
      }
    });

    return query;
  }

  /**
   * Build search query
   * @param {string} searchTerm - Search term
   * @returns {Object} MongoDB search query
   */
  buildSearchQuery(searchTerm) {
    const searchFields = this.getSearchFields();
    
    if (searchFields.length === 0) {
      return {};
    }

    const searchConditions = searchFields.map(field => ({
      [field]: { $regex: searchTerm, $options: 'i' }
    }));

    return { $or: searchConditions };
  }

  /**
   * Build search conditions for filters
   * @param {string} searchTerm - Search term
   * @returns {Array} Search conditions
   */
  buildSearchConditions(searchTerm) {
    const searchFields = this.getSearchFields();
    
    return searchFields.map(field => ({
      [field]: { $regex: searchTerm, $options: 'i' }
    }));
  }

  /**
   * Get searchable fields for the model
   * Override this method in child classes
   * @returns {Array<string>} Searchable field names
   */
  getSearchFields() {
    return ['name', 'description'];
  }

  /**
   * Validate data for creation
   * Override this method in child classes
   * @param {Object} data - Data to validate
   * @throws {ValidationError} If validation fails
   */
  async validateCreate(data) {
    // Override in child classes
  }

  /**
   * Validate data for update
   * Override this method in child classes
   * @param {Object} data - Data to validate
   * @throws {ValidationError} If validation fails
   */
  async validateUpdate(data) {
    // Override in child classes
  }

  /**
   * Validate data for patch
   * Override this method in child classes
   * @param {Object} data - Data to validate
   * @throws {ValidationError} If validation fails
   */
  async validatePatch(data) {
    // Override in child classes
  }

  /**
   * Handle errors consistently
   * @param {Error} error - Error to handle
   * @param {string} operation - Operation that failed
   * @returns {Error} Processed error
   */
  handleError(error, operation) {
    // Log error
    console.error(`Error in ${this.Model.modelName}Service.${operation}:`, error);

    // Handle specific error types
    if (error.name === 'ValidationError') {
      return new ValidationError('Validation failed', Object.values(error.errors).map(e => ({
        field: e.path,
        message: e.message,
        value: e.value
      })));
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return new ConflictError(`Duplicate ${field} value`);
    }

    if (error.name === 'CastError') {
      return new NotFoundError('Invalid ID format');
    }

    // Return original error if it's already an AppError
    if (error.isOperational) {
      return error;
    }

    // Return generic error for unexpected errors
    return new Error(`An error occurred during ${operation}`);
  }
}

/**
 * Create a standardized service
 * @param {Object} Model - Mongoose model
 * @returns {Object} Service instance
 */
export const createService = (Model) => {
  return new BaseService(Model);
};

export default BaseService;