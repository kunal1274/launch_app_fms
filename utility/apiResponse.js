/**
 * Standardized API Response Utility
 * Provides consistent response format across all API endpoints
 */

export class ApiResponse {
  /**
   * Create a success response
   * @param {string} message - Success message
   * @param {*} data - Response data
   * @param {Object} meta - Additional metadata
   * @returns {Object} Formatted success response
   */
  static success(message, data = null, meta = {}) {
    const response = {
      success: true,
      message,
      ...(data !== null && { data }),
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };

    return response;
  }

  /**
   * Create an error response
   * @param {string} message - Error message
   * @param {Array} errors - Validation errors (optional)
   * @param {Object} meta - Additional metadata
   * @returns {Object} Formatted error response
   */
  static error(message, errors = null, meta = {}) {
    const response = {
      success: false,
      error: message,
      ...(errors && { errors }),
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };

    return response;
  }

  /**
   * Create a paginated response
   * @param {string} message - Success message
   * @param {Array} data - Response data
   * @param {Object} pagination - Pagination metadata
   * @param {Object} meta - Additional metadata
   * @returns {Object} Formatted paginated response
   */
  static paginated(message, data, pagination, meta = {}) {
    return {
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || 0,
        pages: Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
        hasNext: pagination.hasNext || false,
        hasPrev: pagination.hasPrev || false
      },
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }

  /**
   * Create a created response (201)
   * @param {string} message - Success message
   * @param {*} data - Created resource data
   * @param {Object} meta - Additional metadata
   * @returns {Object} Formatted created response
   */
  static created(message, data, meta = {}) {
    return this.success(message, data, {
      ...meta,
      statusCode: 201
    });
  }

  /**
   * Create a no content response (204)
   * @param {string} message - Success message
   * @param {Object} meta - Additional metadata
   * @returns {Object} Formatted no content response
   */
  static noContent(message = 'Operation completed successfully', meta = {}) {
    return {
      success: true,
      message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 204,
        ...meta
      }
    };
  }

  /**
   * Create a validation error response
   * @param {string} message - Error message
   * @param {Array} errors - Validation errors
   * @param {Object} meta - Additional metadata
   * @returns {Object} Formatted validation error response
   */
  static validationError(message, errors, meta = {}) {
    return this.error(message, errors, {
      ...meta,
      statusCode: 400
    });
  }

  /**
   * Create a not found response
   * @param {string} message - Error message
   * @param {Object} meta - Additional metadata
   * @returns {Object} Formatted not found response
   */
  static notFound(message = 'Resource not found', meta = {}) {
    return this.error(message, null, {
      ...meta,
      statusCode: 404
    });
  }

  /**
   * Create an unauthorized response
   * @param {string} message - Error message
   * @param {Object} meta - Additional metadata
   * @returns {Object} Formatted unauthorized response
   */
  static unauthorized(message = 'Unauthorized access', meta = {}) {
    return this.error(message, null, {
      ...meta,
      statusCode: 401
    });
  }

  /**
   * Create a forbidden response
   * @param {string} message - Error message
   * @param {Object} meta - Additional metadata
   * @returns {Object} Formatted forbidden response
   */
  static forbidden(message = 'Forbidden access', meta = {}) {
    return this.error(message, null, {
      ...meta,
      statusCode: 403
    });
  }

  /**
   * Create a conflict response
   * @param {string} message - Error message
   * @param {Object} meta - Additional metadata
   * @returns {Object} Formatted conflict response
   */
  static conflict(message = 'Resource conflict', meta = {}) {
    return this.error(message, null, {
      ...meta,
      statusCode: 409
    });
  }

  /**
   * Create an unprocessable entity response
   * @param {string} message - Error message
   * @param {Object} meta - Additional metadata
   * @returns {Object} Formatted unprocessable entity response
   */
  static unprocessableEntity(message = 'Unprocessable entity', meta = {}) {
    return this.error(message, null, {
      ...meta,
      statusCode: 422
    });
  }

  /**
   * Create an internal server error response
   * @param {string} message - Error message
   * @param {Object} meta - Additional metadata
   * @returns {Object} Formatted internal server error response
   */
  static internalServerError(message = 'Internal server error', meta = {}) {
    return this.error(message, null, {
      ...meta,
      statusCode: 500
    });
  }

  /**
   * Add request ID to response metadata
   * @param {Object} response - Response object
   * @param {string} requestId - Request ID
   * @returns {Object} Response with request ID
   */
  static addRequestId(response, requestId) {
    if (response.meta) {
      response.meta.requestId = requestId;
    }
    return response;
  }

  /**
   * Add pagination info to response
   * @param {Object} response - Response object
   * @param {Object} pagination - Pagination data
   * @returns {Object} Response with pagination
   */
  static addPagination(response, pagination) {
    response.pagination = {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      total: pagination.total || 0,
      pages: Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
      hasNext: pagination.hasNext || false,
      hasPrev: pagination.hasPrev || false
    };
    return response;
  }

  /**
   * Create a response with custom status code
   * @param {boolean} success - Success status
   * @param {string} message - Response message
   * @param {*} data - Response data
   * @param {number} statusCode - HTTP status code
   * @param {Object} meta - Additional metadata
   * @returns {Object} Formatted response
   */
  static custom(success, message, data = null, statusCode = 200, meta = {}) {
    const response = {
      success,
      [success ? 'message' : 'error']: message,
      ...(data !== null && { data }),
      meta: {
        timestamp: new Date().toISOString(),
        statusCode,
        ...meta
      }
    };

    return response;
  }
}

// Helper function for pagination
export const createPaginationMeta = (page, limit, total) => {
  const pages = Math.ceil(total / limit);
  return {
    page: parseInt(page),
    limit: parseInt(limit),
    total: parseInt(total),
    pages,
    hasNext: page < pages,
    hasPrev: page > 1
  };
};

// Helper function for list responses
export const createListResponse = (data, message = 'Data retrieved successfully', pagination = null) => {
  if (pagination) {
    return ApiResponse.paginated(message, data, pagination);
  }
  return ApiResponse.success(message, data);
};

// Helper function for single item responses
export const createItemResponse = (data, message = 'Data retrieved successfully') => {
  return ApiResponse.success(message, data);
};

// Helper function for creation responses
export const createCreationResponse = (data, message = 'Resource created successfully') => {
  return ApiResponse.created(message, data);
};

// Helper function for update responses
export const createUpdateResponse = (data, message = 'Resource updated successfully') => {
  return ApiResponse.success(message, data);
};

// Helper function for deletion responses
export const createDeletionResponse = (message = 'Resource deleted successfully') => {
  return ApiResponse.success(message);
};

export default ApiResponse;