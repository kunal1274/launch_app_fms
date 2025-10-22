/**
 * Base Route Template for FMS Application
 * This file provides standardized route patterns that all routes should follow
 */

import { Router } from 'express';
import { asyncHandler } from '../utility/error.util.js';
import { validateRequest } from '../controllers/base.controller.js';
import { commonValidationSchemas } from '../controllers/base.controller.js';

/**
 * Base Route Class
 */
export class BaseRoutes {
  constructor(controller, routeName) {
    this.router = Router();
    this.controller = controller;
    this.routeName = routeName;
    this.setupRoutes();
  }

  /**
   * Setup standard CRUD routes
   */
  setupRoutes() {
    // Standard CRUD routes
    this.router.post('/', 
      validateRequest(commonValidationSchemas.create),
      this.controller.create
    );

    this.router.get('/',
      this.controller.getAll
    );

    this.router.get('/stats',
      this.controller.getStats
    );

    this.router.get('/deleted',
      this.controller.getDeleted
    );

    this.router.get('/inactive',
      this.controller.getInactive
    );

    this.router.get('/:id',
      validateRequest(commonValidationSchemas.id),
      this.controller.getById
    );

    this.router.put('/:id',
      validateRequest(commonValidationSchemas.update),
      this.controller.update
    );

    this.router.delete('/:id',
      validateRequest(commonValidationSchemas.id),
      this.controller.delete
    );

    this.router.patch('/:id/restore',
      validateRequest(commonValidationSchemas.id),
      this.controller.restore
    );

    this.router.patch('/:id/activate',
      validateRequest(commonValidationSchemas.id),
      this.controller.activate
    );

    this.router.patch('/:id/deactivate',
      validateRequest(commonValidationSchemas.id),
      this.controller.deactivate
    );

    // Bulk operations
    this.router.post('/bulk',
      validateRequest(commonValidationSchemas.bulkCreate),
      this.controller.bulkCreate
    );

    this.router.put('/bulk',
      validateRequest(commonValidationSchemas.bulkUpdate),
      this.controller.bulkUpdate
    );

    this.router.delete('/bulk',
      validateRequest(commonValidationSchemas.bulkDelete),
      this.controller.bulkDelete
    );
  }

  /**
   * Get the router instance
   */
  getRouter() {
    return this.router;
  }

  /**
   * Add custom route
   */
  addRoute(method, path, ...middleware) {
    this.router[method](path, ...middleware);
    return this;
  }

  /**
   * Add custom middleware to all routes
   */
  use(middleware) {
    this.router.use(middleware);
    return this;
  }
}

/**
 * Helper function to create standardized routes
 */
export const createRoutes = (controller, routeName) => {
  return new BaseRoutes(controller, routeName);
};

/**
 * Standard route patterns
 */
export const routePatterns = {
  // Basic CRUD
  CREATE: 'POST /',
  READ_ALL: 'GET /',
  READ_ONE: 'GET /:id',
  UPDATE: 'PUT /:id',
  DELETE: 'DELETE /:id',
  
  // Extended operations
  STATS: 'GET /stats',
  DELETED: 'GET /deleted',
  INACTIVE: 'GET /inactive',
  RESTORE: 'PATCH /:id/restore',
  ACTIVATE: 'PATCH /:id/activate',
  DEACTIVATE: 'PATCH /:id/deactivate',
  
  // Bulk operations
  BULK_CREATE: 'POST /bulk',
  BULK_UPDATE: 'PUT /bulk',
  BULK_DELETE: 'DELETE /bulk',
};

/**
 * Standard middleware patterns
 */
export const middlewarePatterns = {
  // Authentication middleware
  AUTH: 'auth',
  AUTH_OPTIONAL: 'authOptional',
  
  // Authorization middleware
  RBAC: 'rbac',
  PERMISSION: 'permission',
  
  // Validation middleware
  VALIDATE_CREATE: 'validateCreate',
  VALIDATE_UPDATE: 'validateUpdate',
  VALIDATE_ID: 'validateId',
  
  // Rate limiting
  RATE_LIMIT: 'rateLimit',
  
  // Caching
  CACHE: 'cache',
  NO_CACHE: 'noCache',
  
  // Logging
  LOG_REQUEST: 'logRequest',
  LOG_RESPONSE: 'logResponse',
  
  // File upload
  UPLOAD: 'upload',
  UPLOAD_MULTIPLE: 'uploadMultiple',
};

/**
 * Route documentation template
 */
export const routeDocumentation = {
  CREATE: {
    method: 'POST',
    path: '/',
    description: 'Create a new resource',
    body: 'Resource data',
    response: 'Created resource',
    statusCodes: [201, 400, 401, 403, 409, 500],
  },
  READ_ALL: {
    method: 'GET',
    path: '/',
    description: 'Get all resources with pagination and filtering',
    query: 'page, limit, sort, search, filters',
    response: 'Paginated list of resources',
    statusCodes: [200, 401, 403, 500],
  },
  READ_ONE: {
    method: 'GET',
    path: '/:id',
    description: 'Get a single resource by ID',
    params: 'id (ObjectId)',
    response: 'Resource data',
    statusCodes: [200, 401, 403, 404, 500],
  },
  UPDATE: {
    method: 'PUT',
    path: '/:id',
    description: 'Update a resource by ID',
    params: 'id (ObjectId)',
    body: 'Updated resource data',
    response: 'Updated resource',
    statusCodes: [200, 400, 401, 403, 404, 409, 500],
  },
  DELETE: {
    method: 'DELETE',
    path: '/:id',
    description: 'Soft delete a resource by ID',
    params: 'id (ObjectId)',
    response: 'Success message',
    statusCodes: [200, 401, 403, 404, 500],
  },
  STATS: {
    method: 'GET',
    path: '/stats',
    description: 'Get resource statistics',
    response: 'Statistics data',
    statusCodes: [200, 401, 403, 500],
  },
  DELETED: {
    method: 'GET',
    path: '/deleted',
    description: 'Get all deleted resources',
    query: 'page, limit, sort',
    response: 'Paginated list of deleted resources',
    statusCodes: [200, 401, 403, 500],
  },
  INACTIVE: {
    method: 'GET',
    path: '/inactive',
    description: 'Get all inactive resources',
    query: 'page, limit, sort',
    response: 'Paginated list of inactive resources',
    statusCodes: [200, 401, 403, 500],
  },
  RESTORE: {
    method: 'PATCH',
    path: '/:id/restore',
    description: 'Restore a deleted resource',
    params: 'id (ObjectId)',
    response: 'Restored resource',
    statusCodes: [200, 401, 403, 404, 500],
  },
  ACTIVATE: {
    method: 'PATCH',
    path: '/:id/activate',
    description: 'Activate a resource',
    params: 'id (ObjectId)',
    response: 'Activated resource',
    statusCodes: [200, 401, 403, 404, 500],
  },
  DEACTIVATE: {
    method: 'PATCH',
    path: '/:id/deactivate',
    description: 'Deactivate a resource',
    params: 'id (ObjectId)',
    response: 'Deactivated resource',
    statusCodes: [200, 401, 403, 404, 500],
  },
  BULK_CREATE: {
    method: 'POST',
    path: '/bulk',
    description: 'Create multiple resources',
    body: 'Array of resource data',
    response: 'Array of created resources',
    statusCodes: [201, 400, 401, 403, 409, 500],
  },
  BULK_UPDATE: {
    method: 'PUT',
    path: '/bulk',
    description: 'Update multiple resources',
    body: 'IDs array and update data',
    response: 'Update result',
    statusCodes: [200, 400, 401, 403, 404, 500],
  },
  BULK_DELETE: {
    method: 'DELETE',
    path: '/bulk',
    description: 'Delete multiple resources',
    body: 'IDs array',
    response: 'Delete result',
    statusCodes: [200, 400, 401, 403, 404, 500],
  },
};

export default BaseRoutes;
