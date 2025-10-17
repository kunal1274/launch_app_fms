# ERP Backend - Coding Standards

**Version:** 1.0.0  
**Last Updated:** $(date)  
**Status:** Active  

## Table of Contents
1. [General Principles](#general-principles)
2. [File and Folder Naming](#file-and-folder-naming)
3. [Code Structure](#code-structure)
4. [Naming Conventions](#naming-conventions)
5. [Error Handling](#error-handling)
6. [API Design](#api-design)
7. [Database Design](#database-design)
8. [Testing Standards](#testing-standards)
9. [Documentation Standards](#documentation-standards)

## General Principles

### 1. Consistency
- Follow established patterns throughout the codebase
- Use consistent naming conventions
- Maintain uniform code structure

### 2. Readability
- Write self-documenting code
- Use meaningful variable and function names
- Add comments for complex business logic

### 3. Maintainability
- Keep functions small and focused
- Avoid deep nesting (max 3 levels)
- Use dependency injection where appropriate

### 4. Extensibility
- Design for future enhancements
- Use configuration over hardcoding
- Implement proper abstraction layers

## File and Folder Naming

### Folders
```
/modules/{module-name}/
├── controllers/
├── models/
├── routes/
├── services/
├── middleware/
├── validators/
├── tests/
└── docs/
```

### Files
- **Controllers:** `{entity}.controller.js` (e.g., `salesorder.controller.js`)
- **Models:** `{entity}.model.js` (e.g., `salesorder.model.js`)
- **Routes:** `{entity}.routes.js` (e.g., `salesorder.routes.js`)
- **Services:** `{entity}.service.js` (e.g., `salesorder.service.js`)
- **Tests:** `{entity}.test.js` (e.g., `salesorder.test.js`)

## Code Structure

### Controller Structure
```javascript
import { EntityModel } from '../models/entity.model.js';
import { EntityService } from '../services/entity.service.js';
import { validateEntity } from '../validators/entity.validator.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ErrorHandler } from '../utils/errorHandler.js';

export const createEntity = async (req, res, next) => {
  try {
    // 1. Validation
    const validationResult = validateEntity(req.body);
    if (!validationResult.isValid) {
      return res.status(400).json(
        ApiResponse.error('Validation failed', validationResult.errors)
      );
    }

    // 2. Business Logic
    const entity = await EntityService.create(req.body);

    // 3. Response
    res.status(201).json(
      ApiResponse.success('Entity created successfully', entity)
    );
  } catch (error) {
    next(ErrorHandler.handle(error));
  }
};
```

### Model Structure
```javascript
import mongoose, { Schema, model } from 'mongoose';

const entitySchema = new Schema({
  // Field definitions
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
entitySchema.virtual('computedField').get(function() {
  // Virtual logic
});

// Methods
entitySchema.methods.customMethod = function() {
  // Method logic
};

// Statics
entitySchema.statics.findByStatus = function(status) {
  return this.find({ status });
};

// Pre-save hooks
entitySchema.pre('save', async function(next) {
  try {
    // Pre-save logic
    next();
  } catch (error) {
    next(error);
  }
});

export const EntityModel = mongoose.models.Entities || model('Entities', entitySchema);
```

### Service Structure
```javascript
import { EntityModel } from '../models/entity.model.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

export class EntityService {
  static async create(data) {
    try {
      const entity = new EntityModel(data);
      return await entity.save();
    } catch (error) {
      throw new ValidationError('Failed to create entity', error);
    }
  }

  static async findById(id) {
    const entity = await EntityModel.findById(id);
    if (!entity) {
      throw new NotFoundError('Entity not found');
    }
    return entity;
  }

  static async update(id, data) {
    const entity = await this.findById(id);
    Object.assign(entity, data);
    return await entity.save();
  }

  static async delete(id) {
    const entity = await this.findById(id);
    return await EntityModel.findByIdAndDelete(id);
  }
}
```

## Naming Conventions

### Variables and Functions
- **camelCase** for variables and functions
- **PascalCase** for classes and constructors
- **UPPER_SNAKE_CASE** for constants
- **snake_case** for database fields (MongoDB convention)

### Examples
```javascript
// Variables
const salesOrderId = 'SO_001';
const customerName = 'John Doe';
const isActive = true;

// Functions
const calculateTotal = (items) => { /* ... */ };
const validateEmail = (email) => { /* ... */ };

// Classes
class SalesOrderService { /* ... */ }
class ValidationError extends Error { /* ... */ }

// Constants
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_PAGE_SIZE = 20;

// Database fields
const sales_order_schema = {
  order_number: String,
  customer_id: ObjectId,
  total_amount: Number
};
```

### Database Collections
- **PascalCase** for collection names
- **Plural** form
- Examples: `SalesOrders`, `PurchaseOrders`, `Customers`

## Error Handling

### Error Classes
```javascript
// Base Error Class
export class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific Error Classes
export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}
```

### Error Handling Middleware
```javascript
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new NotFoundError(message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new ValidationError(message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = new ValidationError(message);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
```

## API Design

### Response Format
```javascript
// Success Response
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_123456"
  }
}

// Error Response
{
  "success": false,
  "error": "Error message",
  "errors": [
    // Validation errors (if applicable)
  ],
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_123456"
  }
}
```

### HTTP Status Codes
- **200** - OK (GET, PUT, PATCH)
- **201** - Created (POST)
- **204** - No Content (DELETE)
- **400** - Bad Request (validation errors)
- **401** - Unauthorized
- **403** - Forbidden
- **404** - Not Found
- **409** - Conflict (duplicate resources)
- **422** - Unprocessable Entity (business logic errors)
- **500** - Internal Server Error

### API Endpoints
```javascript
// RESTful patterns
GET    /api/v1/entities           // List all entities
GET    /api/v1/entities/:id       // Get entity by ID
POST   /api/v1/entities           // Create new entity
PUT    /api/v1/entities/:id       // Update entire entity
PATCH  /api/v1/entities/:id       // Partial update
DELETE /api/v1/entities/:id       // Delete entity

// Nested resources
GET    /api/v1/entities/:id/items // Get entity items
POST   /api/v1/entities/:id/items // Add item to entity
```

## Database Design

### Schema Guidelines
```javascript
const entitySchema = new Schema({
  // Required fields first
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  
  // Optional fields
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Enums with validation
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive', 'pending'],
      message: 'Status must be active, inactive, or pending'
    },
    default: 'active'
  },
  
  // References
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'Customers',
    required: true
  },
  
  // Computed fields
  totalAmount: {
    type: Number,
    default: 0,
    set: v => Math.round(v * 100) / 100
  },
  
  // Timestamps (automatically added)
  // createdAt, updatedAt
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});
```

### Indexing Strategy
```javascript
// Single field indexes
entitySchema.index({ status: 1 });
entitySchema.index({ createdAt: -1 });

// Compound indexes
entitySchema.index({ customer: 1, status: 1 });
entitySchema.index({ orderNumber: 1, customer: 1 });

// Text indexes for search
entitySchema.index({ 
  name: 'text', 
  description: 'text' 
});
```

## Testing Standards

### Test Structure
```javascript
import { describe, it, expect, beforeEach, afterEach } from 'jest';
import { EntityService } from '../services/entity.service.js';
import { EntityModel } from '../models/entity.model.js';

describe('EntityService', () => {
  beforeEach(async () => {
    // Setup test data
  });

  afterEach(async () => {
    // Cleanup test data
  });

  describe('create', () => {
    it('should create entity with valid data', async () => {
      // Test implementation
    });

    it('should throw error with invalid data', async () => {
      // Test implementation
    });
  });
});
```

### Test Coverage
- **Unit Tests:** 90%+ coverage for services and utilities
- **Integration Tests:** All API endpoints
- **E2E Tests:** Critical user workflows

## Documentation Standards

### Code Comments
```javascript
/**
 * Creates a new sales order with validation and business logic
 * @param {Object} orderData - The sales order data
 * @param {string} orderData.customerId - Customer ID
 * @param {Array} orderData.items - Array of order items
 * @returns {Promise<Object>} Created sales order
 * @throws {ValidationError} When order data is invalid
 * @throws {NotFoundError} When customer doesn't exist
 */
export const createSalesOrder = async (orderData) => {
  // Implementation
};
```

### API Documentation
- Use OpenAPI/Swagger for API documentation
- Include request/response examples
- Document error scenarios
- Keep documentation up-to-date

## Code Review Checklist

### Before Submitting
- [ ] Code follows naming conventions
- [ ] Functions are small and focused
- [ ] Error handling is implemented
- [ ] Tests are written and passing
- [ ] Documentation is updated
- [ ] No console.log statements in production code
- [ ] No commented-out code
- [ ] Proper error messages for users

### Review Criteria
- [ ] Code readability and maintainability
- [ ] Performance considerations
- [ ] Security implications
- [ ] Test coverage
- [ ] Documentation completeness

---

**Note:** These standards should be followed by all team members and enforced through code reviews and automated tools where possible.