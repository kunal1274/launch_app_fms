# ERP Backend - Extensibility Guidelines

**Version:** 1.0.0  
**Last Updated:** $(date)  
**Status:** Active  

## Overview

This document provides guidelines for extending the ERP backend system with new modules while maintaining consistency, quality, and maintainability. These guidelines ensure that new modules follow established patterns and integrate seamlessly with existing functionality.

## Table of Contents
1. [Module Structure](#module-structure)
2. [Naming Conventions](#naming-conventions)
3. [Code Patterns](#code-patterns)
4. [Integration Guidelines](#integration-guidelines)
5. [Testing Requirements](#testing-requirements)
6. [Documentation Standards](#documentation-standards)
7. [Deployment Considerations](#deployment-considerations)

## Module Structure

### Standard Module Layout
```
/modules/{module-name}/
├── controllers/
│   └── {entity}.controller.js
├── models/
│   └── {entity}.model.js
├── routes/
│   └── {entity}.routes.js
├── services/
│   └── {entity}.service.js
├── validators/
│   └── {entity}.validator.js
├── middleware/
│   └── {module-name}.middleware.js
├── tests/
│   ├── {entity}.test.js
│   └── integration/
│       └── {module-name}.test.js
├── docs/
│   └── {module-name}.md
└── config/
    └── {module-name}.config.js
```

### Module Naming Convention
- **Module Name:** `{purpose}_{management}` (e.g., `hr_management`, `asset_management`)
- **Entity Names:** `{entity}` (e.g., `employee`, `asset`, `project`)
- **File Names:** `{entity}.{type}.js` (e.g., `employee.controller.js`)

## Naming Conventions

### Module Names
```javascript
// Good examples
hr_management
asset_management
project_management
crm_management

// Bad examples
HRManagement
assetManagement
project_mgmt
```

### Entity Names
```javascript
// Good examples
employee
asset
project
customer
vendor

// Bad examples
Employee
Asset
Project
Customer
Vendor
```

### File Names
```javascript
// Good examples
employee.controller.js
asset.service.js
project.validator.js

// Bad examples
EmployeeController.js
assetService.js
projectValidator.js
```

## Code Patterns

### Model Pattern
```javascript
// models/{entity}.model.js
import mongoose, { Schema, model } from 'mongoose';
import { EntityCounterModel } from './counter.model.js';

const entitySchema = new Schema({
  // Required fields first
  code: {
    type: String,
    required: true,
    unique: true
  },
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
  
  // Status fields
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive', 'pending'],
      message: 'Status must be active, inactive, or pending'
    },
    default: 'active'
  },
  
  // References
  company: {
    type: Schema.Types.ObjectId,
    ref: 'Companies',
    required: true
  },
  
  // Audit fields
  createdBy: {
    type: String,
    required: true,
    default: 'System'
  },
  updatedBy: {
    type: String,
    default: null
  },
  active: {
    type: Boolean,
    default: true
  },
  archived: {
    type: Boolean,
    default: false
  },
  
  // Extensibility
  extras: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Pre-save hook for code generation
entitySchema.pre('save', async function(next) {
  if (!this.isNew) return next();
  
  try {
    const counter = await EntityCounterModel.findByIdAndUpdate(
      { _id: `${this.constructor.modelName.toLowerCase()}Code` },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    
    const seqNumber = counter.seq.toString().padStart(6, '0');
    this.code = `${this.constructor.modelName.toUpperCase()}_${seqNumber}`;
    
    next();
  } catch (error) {
    next(error);
  }
});

export const EntityModel = mongoose.models.Entities || model('Entities', entitySchema);
```

### Service Pattern
```javascript
// services/{entity}.service.js
import { BaseService } from '../../utility/serviceTemplate.js';
import { EntityModel } from '../models/entity.model.js';
import { ValidationError, NotFoundError } from '../../utility/errorHandler.js';

export class EntityService extends BaseService {
  constructor() {
    super(EntityModel);
  }

  async validateCreate(data) {
    const errors = [];
    
    // Custom validation logic
    if (data.requiredField && data.requiredField.length < 2) {
      errors.push({
        field: 'requiredField',
        message: 'Required field must be at least 2 characters',
        value: data.requiredField
      });
    }
    
    if (errors.length > 0) {
      throw new ValidationError('Validation failed', errors);
    }
  }

  async validateUpdate(data) {
    // Custom update validation
    await this.validateCreate(data);
  }

  async validatePatch(data) {
    // Custom patch validation
    // Only validate fields that are being updated
  }

  // Custom business methods
  async getByStatus(status) {
    return await this.Model.find({ status, active: true });
  }

  async getByCompany(companyId) {
    return await this.Model.find({ company: companyId, active: true });
  }
}
```

### Controller Pattern
```javascript
// controllers/{entity}.controller.js
import { asyncHandler } from '../../utility/errorHandler.js';
import { ApiResponse } from '../../utility/apiResponse.js';
import { EntityService } from '../services/entity.service.js';
import { EntityValidator } from '../validators/entity.validator.js';

const entityService = new EntityService();

export const createEntity = asyncHandler(async (req, res) => {
  const validation = EntityValidator.validateCreate(req.body);
  if (!validation.isValid) {
    return res.status(400).json(
      ApiResponse.validationError('Validation failed', validation.errors)
    );
  }

  const entity = await entityService.create(req.body);
  res.status(201).json(
    ApiResponse.created('Entity created successfully', entity)
  );
});

export const getAllEntities = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, ...filters } = req.query;
  const { data, total } = await entityService.getAll(filters, page, limit);
  
  res.json(
    ApiResponse.paginated('Entities retrieved successfully', data, {
      page: parseInt(page),
      limit: parseInt(limit),
      total
    })
  );
});

export const getEntityById = asyncHandler(async (req, res) => {
  const entity = await entityService.getById(req.params.id);
  res.json(
    ApiResponse.success('Entity retrieved successfully', entity)
  );
});

export const updateEntity = asyncHandler(async (req, res) => {
  const validation = EntityValidator.validateUpdate(req.body);
  if (!validation.isValid) {
    return res.status(400).json(
      ApiResponse.validationError('Validation failed', validation.errors)
    );
  }

  const entity = await entityService.update(req.params.id, req.body);
  res.json(
    ApiResponse.success('Entity updated successfully', entity)
  );
});

export const deleteEntity = asyncHandler(async (req, res) => {
  await entityService.delete(req.params.id);
  res.json(
    ApiResponse.success('Entity deleted successfully')
  );
});

// Custom endpoints
export const getEntitiesByStatus = asyncHandler(async (req, res) => {
  const { status } = req.params;
  const entities = await entityService.getByStatus(status);
  res.json(
    ApiResponse.success('Entities retrieved successfully', entities)
  );
});
```

### Validator Pattern
```javascript
// validators/{entity}.validator.js
import { Validator } from '../../utility/validator.js';
import { commonSchemas } from '../../utility/validator.js';

export class EntityValidator {
  static validateCreate(data) {
    const rules = {
      name: { ...commonSchemas.name, required: true },
      description: { ...commonSchemas.description, required: false },
      status: { ...commonSchemas.status, required: true },
      company: { ...commonSchemas.objectId, required: true },
      customField: {
        type: 'string',
        required: false,
        minLength: 2,
        maxLength: 50
      }
    };

    return Validator.validateBusinessRules(data, rules);
  }

  static validateUpdate(data) {
    // Same as create for full updates
    return this.validateCreate(data);
  }

  static validatePatch(data) {
    // Only validate fields that are being updated
    const rules = {};
    
    if (data.name !== undefined) {
      rules.name = { ...commonSchemas.name, required: true };
    }
    
    if (data.status !== undefined) {
      rules.status = { ...commonSchemas.status, required: true };
    }
    
    if (data.customField !== undefined) {
      rules.customField = {
        type: 'string',
        required: false,
        minLength: 2,
        maxLength: 50
      };
    }

    return Validator.validateBusinessRules(data, rules);
  }
}
```

### Routes Pattern
```javascript
// routes/{entity}.routes.js
import express from 'express';
import {
  createEntity,
  getAllEntities,
  getEntityById,
  updateEntity,
  deleteEntity,
  getEntitiesByStatus
} from '../controllers/entity.controller.js';

const router = express.Router();

// Standard CRUD routes
router.post('/', createEntity);
router.get('/', getAllEntities);
router.get('/:id', getEntityById);
router.put('/:id', updateEntity);
router.delete('/:id', deleteEntity);

// Custom routes
router.get('/status/:status', getEntitiesByStatus);

export { router as entityRouter };
```

## Integration Guidelines

### Database Integration
```javascript
// Always use transactions for multi-model operations
import mongoose from 'mongoose';

const session = await mongoose.startSession();
session.startTransaction();

try {
  // Perform multiple operations
  const entity1 = await Entity1Model.create([data1], { session });
  const entity2 = await Entity2Model.create([data2], { session });
  
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

### Service Integration
```javascript
// Import and use other services
import { CustomerService } from '../customer/customer.service.js';
import { ItemService } from '../item/item.service.js';

export class OrderService extends BaseService {
  async createOrder(data) {
    // Validate customer exists
    await CustomerService.getById(data.customerId);
    
    // Validate item exists
    await ItemService.getById(data.itemId);
    
    // Create order
    return await this.create(data);
  }
}
```

### Event Integration
```javascript
// Emit events for other modules to listen
import { EventEmitter } from 'events';

const eventEmitter = new EventEmitter();

export class EntityService extends BaseService {
  async create(data) {
    const entity = await super.create(data);
    
    // Emit event
    eventEmitter.emit('entity.created', {
      entityId: entity._id,
      data: entity,
      timestamp: new Date()
    });
    
    return entity;
  }
}
```

## Testing Requirements

### Unit Tests
```javascript
// tests/{entity}.test.js
import { describe, it, expect, beforeEach, afterEach } from 'jest';
import { EntityService } from '../services/entity.service.js';
import { EntityModel } from '../models/entity.model.js';

describe('EntityService', () => {
  let entityService;

  beforeEach(() => {
    entityService = new EntityService();
  });

  describe('create', () => {
    it('should create entity with valid data', async () => {
      const data = {
        name: 'Test Entity',
        description: 'Test Description',
        company: 'company_id_here'
      };

      const entity = await entityService.create(data);
      
      expect(entity).toBeDefined();
      expect(entity.name).toBe(data.name);
      expect(entity.code).toBeDefined();
    });

    it('should throw validation error with invalid data', async () => {
      const data = {
        name: '', // Invalid: empty name
        company: 'company_id_here'
      };

      await expect(entityService.create(data)).rejects.toThrow('Validation failed');
    });
  });
});
```

### Integration Tests
```javascript
// tests/integration/{module-name}.test.js
import request from 'supertest';
import app from '../../app.js';

describe('Entity API', () => {
  describe('POST /api/v1/entities', () => {
    it('should create entity', async () => {
      const data = {
        name: 'Test Entity',
        description: 'Test Description',
        company: 'company_id_here'
      };

      const response = await request(app)
        .post('/api/v1/entities')
        .send(data)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(data.name);
    });
  });
});
```

## Documentation Standards

### Module Documentation
```markdown
# {Module Name} Module

**Version:** 1.0.0  
**Last Updated:** $(date)  
**Status:** Active  

## Overview
Brief description of the module's purpose and functionality.

## Architecture
- Components and their responsibilities
- Dependencies on other modules
- Integration points

## Data Models
- Schema definitions
- Relationships
- Validation rules

## API Endpoints
- Complete endpoint documentation
- Request/response examples
- Error scenarios

## Business Logic
- Key business rules
- Workflow descriptions
- Integration points

## Testing
- Test coverage requirements
- Test data setup
- Performance considerations
```

### API Documentation
```javascript
/**
 * Create a new entity
 * @route POST /api/v1/entities
 * @param {Object} req.body - Entity data
 * @param {string} req.body.name - Entity name (required)
 * @param {string} req.body.description - Entity description (optional)
 * @param {string} req.body.company - Company ID (required)
 * @returns {Object} Created entity
 * @throws {ValidationError} When validation fails
 * @throws {ConflictError} When entity already exists
 */
export const createEntity = asyncHandler(async (req, res) => {
  // Implementation
});
```

## Deployment Considerations

### Environment Configuration
```javascript
// config/{module-name}.config.js
export const moduleConfig = {
  development: {
    enabled: true,
    logLevel: 'debug',
    cacheEnabled: false
  },
  production: {
    enabled: true,
    logLevel: 'info',
    cacheEnabled: true
  }
};
```

### Database Migrations
```javascript
// migrations/{module-name}.migration.js
export const up = async (db) => {
  await db.collection('entities').createIndex({ code: 1 }, { unique: true });
  await db.collection('entities').createIndex({ company: 1, status: 1 });
};

export const down = async (db) => {
  await db.collection('entities').dropIndex({ code: 1 });
  await db.collection('entities').dropIndex({ company: 1, status: 1 });
};
```

### Health Checks
```javascript
// health/{module-name}.health.js
export const healthCheck = async () => {
  try {
    // Check database connectivity
    await EntityModel.findOne().limit(1);
    
    // Check external dependencies
    // await externalService.ping();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: 'healthy',
        externalService: 'healthy'
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
};
```

## Best Practices

### Code Organization
1. **Single Responsibility:** Each file should have one clear purpose
2. **Dependency Injection:** Use dependency injection for testability
3. **Error Handling:** Always handle errors appropriately
4. **Logging:** Log important events and errors
5. **Validation:** Validate all inputs and outputs

### Performance
1. **Database Queries:** Optimize database queries
2. **Caching:** Implement caching where appropriate
3. **Pagination:** Always implement pagination for list endpoints
4. **Indexing:** Create proper database indexes
5. **Monitoring:** Monitor performance metrics

### Security
1. **Input Validation:** Validate all inputs
2. **Authentication:** Implement proper authentication
3. **Authorization:** Implement role-based access control
4. **Data Sanitization:** Sanitize user inputs
5. **Audit Logging:** Log all important operations

### Maintainability
1. **Documentation:** Keep documentation up-to-date
2. **Testing:** Maintain high test coverage
3. **Code Reviews:** All code should be reviewed
4. **Refactoring:** Regular refactoring to improve code quality
5. **Monitoring:** Monitor system health and performance

## Conclusion

Following these guidelines ensures that new modules integrate seamlessly with the existing ERP system while maintaining high code quality, consistency, and maintainability. Always refer to the coding standards document for detailed implementation patterns and best practices.

---

**Guidelines Version:** 1.0.0  
**Last Updated:** $(date)  
**For questions or clarifications, contact the development team.**