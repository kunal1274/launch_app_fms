/**
 * Standardized Controller Template
 * Provides a base template for creating consistent controllers
 */

import { asyncHandler } from './errorHandler.js';
import { ApiResponse } from './apiResponse.js';
import { Validator } from './validator.js';
import { logError } from './errorHandler.js';

export class BaseController {
  constructor(Model, Service, validator) {
    this.Model = Model;
    this.Service = Service;
    this.validator = validator;
  }

  /**
   * Create a new resource
   */
  create = asyncHandler(async (req, res) => {
    // 1. Validation
    const validationResult = this.validator ? this.validator.validateCreate(req.body) : { isValid: true };
    if (!validationResult.isValid) {
      return res.status(400).json(
        ApiResponse.validationError('Validation failed', validationResult.errors)
      );
    }

    // 2. Business Logic
    const resource = await this.Service.create(req.body);

    // 3. Response
    res.status(201).json(
      ApiResponse.created('Resource created successfully', resource)
    );
  });

  /**
   * Get all resources with pagination
   */
  getAll = asyncHandler(async (req, res) => {
    // 1. Validate pagination parameters
    const paginationResult = Validator.validatePagination(req.query);
    if (!paginationResult.isValid) {
      return res.status(400).json(
        ApiResponse.validationError('Invalid pagination parameters', paginationResult.errors)
      );
    }

    // 2. Get resources
    const { page, limit } = paginationResult.sanitized;
    const { data, total } = await this.Service.getAll(req.query, page, limit);

    // 3. Response
    const pagination = { page, limit, total };
    res.json(
      ApiResponse.paginated('Resources retrieved successfully', data, pagination)
    );
  });

  /**
   * Get resource by ID
   */
  getById = asyncHandler(async (req, res) => {
    // 1. Validate ID
    const idValidation = Validator.validateObjectId(req.params.id, 'id');
    if (!idValidation.isValid) {
      return res.status(400).json(
        ApiResponse.validationError('Invalid ID format', idValidation.errors)
      );
    }

    // 2. Get resource
    const resource = await this.Service.getById(req.params.id);

    // 3. Response
    res.json(
      ApiResponse.success('Resource retrieved successfully', resource)
    );
  });

  /**
   * Update resource by ID
   */
  update = asyncHandler(async (req, res) => {
    // 1. Validate ID
    const idValidation = Validator.validateObjectId(req.params.id, 'id');
    if (!idValidation.isValid) {
      return res.status(400).json(
        ApiResponse.validationError('Invalid ID format', idValidation.errors)
      );
    }

    // 2. Validate update data
    const validationResult = this.validator ? this.validator.validateUpdate(req.body) : { isValid: true };
    if (!validationResult.isValid) {
      return res.status(400).json(
        ApiResponse.validationError('Validation failed', validationResult.errors)
      );
    }

    // 3. Update resource
    const resource = await this.Service.update(req.params.id, req.body);

    // 4. Response
    res.json(
      ApiResponse.success('Resource updated successfully', resource)
    );
  });

  /**
   * Partial update resource by ID
   */
  patch = asyncHandler(async (req, res) => {
    // 1. Validate ID
    const idValidation = Validator.validateObjectId(req.params.id, 'id');
    if (!idValidation.isValid) {
      return res.status(400).json(
        ApiResponse.validationError('Invalid ID format', idValidation.errors)
      );
    }

    // 2. Validate patch data
    const validationResult = this.validator ? this.validator.validatePatch(req.body) : { isValid: true };
    if (!validationResult.isValid) {
      return res.status(400).json(
        ApiResponse.validationError('Validation failed', validationResult.errors)
      );
    }

    // 3. Patch resource
    const resource = await this.Service.patch(req.params.id, req.body);

    // 4. Response
    res.json(
      ApiResponse.success('Resource updated successfully', resource)
    );
  });

  /**
   * Delete resource by ID
   */
  delete = asyncHandler(async (req, res) => {
    // 1. Validate ID
    const idValidation = Validator.validateObjectId(req.params.id, 'id');
    if (!idValidation.isValid) {
      return res.status(400).json(
        ApiResponse.validationError('Invalid ID format', idValidation.errors)
      );
    }

    // 2. Delete resource
    await this.Service.delete(req.params.id);

    // 3. Response
    res.json(
      ApiResponse.success('Resource deleted successfully')
    );
  });

  /**
   * Archive resource by ID
   */
  archive = asyncHandler(async (req, res) => {
    // 1. Validate ID
    const idValidation = Validator.validateObjectId(req.params.id, 'id');
    if (!idValidation.isValid) {
      return res.status(400).json(
        ApiResponse.validationError('Invalid ID format', idValidation.errors)
      );
    }

    // 2. Archive resource
    const resource = await this.Service.archive(req.params.id);

    // 3. Response
    res.json(
      ApiResponse.success('Resource archived successfully', resource)
    );
  });

  /**
   * Unarchive resource by ID
   */
  unarchive = asyncHandler(async (req, res) => {
    // 1. Validate ID
    const idValidation = Validator.validateObjectId(req.params.id, 'id');
    if (!idValidation.isValid) {
      return res.status(400).json(
        ApiResponse.validationError('Invalid ID format', idValidation.errors)
      );
    }

    // 2. Unarchive resource
    const resource = await this.Service.unarchive(req.params.id);

    // 3. Response
    res.json(
      ApiResponse.success('Resource unarchived successfully', resource)
    );
  });

  /**
   * Get archived resources
   */
  getArchived = asyncHandler(async (req, res) => {
    // 1. Validate pagination parameters
    const paginationResult = Validator.validatePagination(req.query);
    if (!paginationResult.isValid) {
      return res.status(400).json(
        ApiResponse.validationError('Invalid pagination parameters', paginationResult.errors)
      );
    }

    // 2. Get archived resources
    const { page, limit } = paginationResult.sanitized;
    const { data, total } = await this.Service.getArchived(req.query, page, limit);

    // 3. Response
    const pagination = { page, limit, total };
    res.json(
      ApiResponse.paginated('Archived resources retrieved successfully', data, pagination)
    );
  });

  /**
   * Bulk delete resources
   */
  bulkDelete = asyncHandler(async (req, res) => {
    // 1. Validate IDs
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json(
        ApiResponse.validationError('IDs array is required and must not be empty')
      );
    }

    // 2. Validate each ID
    const invalidIds = ids.filter(id => !Validator.isValidObjectId(id));
    if (invalidIds.length > 0) {
      return res.status(400).json(
        ApiResponse.validationError('Invalid ID format', invalidIds.map(id => ({
          field: 'ids',
          message: `Invalid ID format: ${id}`,
          value: id
        })))
      );
    }

    // 3. Bulk delete
    const result = await this.Service.bulkDelete(ids);

    // 4. Response
    res.json(
      ApiResponse.success(`Successfully deleted ${result.deletedCount} resources`)
    );
  });

  /**
   * Search resources
   */
  search = asyncHandler(async (req, res) => {
    // 1. Validate search parameters
    const { query, page = 1, limit = 10 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json(
        ApiResponse.validationError('Search query must be at least 2 characters long')
      );
    }

    // 2. Search resources
    const { data, total } = await this.Service.search(query, parseInt(page), parseInt(limit));

    // 3. Response
    const pagination = { page: parseInt(page), limit: parseInt(limit), total };
    res.json(
      ApiResponse.paginated('Search results retrieved successfully', data, pagination)
    );
  });

  /**
   * Get resource statistics
   */
  getStats = asyncHandler(async (req, res) => {
    // 1. Get statistics
    const stats = await this.Service.getStats(req.query);

    // 2. Response
    res.json(
      ApiResponse.success('Statistics retrieved successfully', stats)
    );
  });
}

/**
 * Create a standardized controller
 * @param {Object} Model - Mongoose model
 * @param {Object} Service - Service class
 * @param {Object} validator - Validator instance
 * @returns {Object} Controller object
 */
export const createController = (Model, Service, validator = null) => {
  const baseController = new BaseController(Model, Service, validator);
  
  return {
    create: baseController.create,
    getAll: baseController.getAll,
    getById: baseController.getById,
    update: baseController.update,
    patch: baseController.patch,
    delete: baseController.delete,
    archive: baseController.archive,
    unarchive: baseController.unarchive,
    getArchived: baseController.getArchived,
    bulkDelete: baseController.bulkDelete,
    search: baseController.search,
    getStats: baseController.getStats
  };
};

export default BaseController;