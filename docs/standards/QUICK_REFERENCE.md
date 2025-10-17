# ERP Backend - Quick Reference Guide

**Version:** 1.0.0  
**Last Updated:** $(date)  

## Quick Start Checklist

### ✅ Before Starting Development
- [ ] Read coding standards document
- [ ] Set up development environment
- [ ] Install required dependencies
- [ ] Configure environment variables

### ✅ Before Committing Code
- [ ] Code follows naming conventions
- [ ] Functions are small and focused
- [ ] Error handling is implemented
- [ ] Validation is added
- [ ] Tests are written
- [ ] Documentation is updated

## Common Patterns

### Controller Pattern
```javascript
import { asyncHandler } from '../utility/errorHandler.js';
import { ApiResponse } from '../utility/apiResponse.js';
import { EntityService } from '../services/entity.service.js';

export const createEntity = asyncHandler(async (req, res) => {
  const entity = await EntityService.create(req.body);
  res.status(201).json(ApiResponse.created('Entity created successfully', entity));
});
```

### Service Pattern
```javascript
import { BaseService } from '../utility/serviceTemplate.js';
import { EntityModel } from '../models/entity.model.js';

export class EntityService extends BaseService {
  constructor() {
    super(EntityModel);
  }

  async validateCreate(data) {
    // Custom validation logic
  }
}
```

### Error Handling Pattern
```javascript
import { ValidationError, NotFoundError } from '../utility/errorHandler.js';

// Throw errors
throw new ValidationError('Invalid data', errors);
throw new NotFoundError('Resource not found');

// Handle errors in middleware
app.use(errorHandler);
```

### Validation Pattern
```javascript
import { Validator } from '../utility/validator.js';

const validation = Validator.validateRequired(data, ['field1', 'field2']);
if (!validation.isValid) {
  throw new ValidationError('Validation failed', validation.errors);
}
```

## API Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* response data */ },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_123456"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "errors": [
    {
      "field": "fieldName",
      "message": "Specific error message",
      "value": "invalidValue"
    }
  ],
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_123456"
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": [ /* array of items */ ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10,
    "hasNext": true,
    "hasPrev": false
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation errors |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate resource |
| 422 | Unprocessable Entity | Business logic errors |
| 500 | Internal Server Error | Server errors |

## Naming Conventions

### Variables and Functions
```javascript
// camelCase
const salesOrderId = 'SO_001';
const customerName = 'John Doe';
const isActive = true;

// Functions
const calculateTotal = (items) => { /* ... */ };
const validateEmail = (email) => { /* ... */ };
```

### Classes and Constructors
```javascript
// PascalCase
class SalesOrderService { /* ... */ }
class ValidationError extends Error { /* ... */ }
```

### Constants
```javascript
// UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_PAGE_SIZE = 20;
```

### Database Fields
```javascript
// snake_case (MongoDB convention)
const sales_order_schema = {
  order_number: String,
  customer_id: ObjectId,
  total_amount: Number
};
```

## Common Validation Rules

### Required Fields
```javascript
const validation = Validator.validateRequired(data, ['name', 'email']);
```

### Email Validation
```javascript
const emailValidation = Validator.validateEmail(email);
```

### ObjectId Validation
```javascript
const idValidation = Validator.validateObjectId(id, 'customerId');
```

### Business Rules
```javascript
const rules = {
  name: { required: true, type: 'string', minLength: 2, maxLength: 100 },
  email: { required: true, type: 'string', custom: (value) => Validator.isValidEmail(value) },
  age: { required: true, type: 'number', min: 0, max: 120 }
};

const validation = Validator.validateBusinessRules(data, rules);
```

## Error Handling

### Common Error Types
```javascript
// Validation errors
throw new ValidationError('Invalid data', errors);

// Not found errors
throw new NotFoundError('Resource not found');

// Conflict errors
throw new ConflictError('Duplicate resource');

// Unauthorized errors
throw new UnauthorizedError('Authentication required');

// Forbidden errors
throw new ForbiddenError('Insufficient permissions');
```

### Error Handling Middleware
```javascript
// Add to app.js
app.use(errorHandler);
```

## Testing Patterns

### Unit Test Structure
```javascript
import { describe, it, expect, beforeEach, afterEach } from 'jest';
import { EntityService } from '../services/entity.service.js';

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
  });
});
```

### Test Data
```javascript
const testEntity = {
  name: 'Test Entity',
  email: 'test@example.com',
  active: true
};
```

## Database Patterns

### Model Definition
```javascript
const entitySchema = new Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: (v) => Validator.isValidEmail(v),
      message: 'Invalid email format'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});
```

### Query Patterns
```javascript
// Find with pagination
const { data, total } = await EntityService.getAll(filters, page, limit);

// Find by ID
const entity = await EntityService.getById(id);

// Search
const results = await EntityService.search(query, page, limit);
```

## File Organization

### Module Structure
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
├── tests/
│   └── {entity}.test.js
└── docs/
    └── {entity}.md
```

### Import/Export Patterns
```javascript
// Named exports
export const createEntity = asyncHandler(async (req, res) => { /* ... */ });
export const getEntity = asyncHandler(async (req, res) => { /* ... */ });

// Default export
export default { createEntity, getEntity };

// Import
import { createEntity, getEntity } from './entity.controller.js';
```

## Common Utilities

### Date Handling
```javascript
import dayjs from 'dayjs';

const now = dayjs();
const formatted = now.format('YYYY-MM-DD HH:mm:ss');
```

### String Utilities
```javascript
import { Validator } from '../utility/validator.js';

const sanitized = Validator.sanitizeString(input);
const isValid = Validator.isValidEmail(email);
```

### Response Helpers
```javascript
import { ApiResponse } from '../utility/apiResponse.js';

// Success responses
res.json(ApiResponse.success('Operation successful', data));
res.json(ApiResponse.created('Resource created', data));
res.json(ApiResponse.paginated('Data retrieved', data, pagination));

// Error responses
res.status(400).json(ApiResponse.validationError('Validation failed', errors));
res.status(404).json(ApiResponse.notFound('Resource not found'));
```

## Debugging Tips

### Common Issues
1. **Validation Errors:** Check field names and types
2. **ObjectId Errors:** Ensure valid 24-character hex string
3. **Async Errors:** Use asyncHandler wrapper
4. **Response Format:** Use ApiResponse utilities

### Debugging Tools
```javascript
// Logging
console.log('Debug info:', { data, context });

// Error logging
logError(error, req);

// Request tracking
req.requestId = generateRequestId();
```

## Performance Tips

### Database Queries
- Use projection to limit returned fields
- Add proper indexes
- Use aggregation for complex queries
- Implement pagination for large datasets

### Memory Management
- Avoid loading large datasets into memory
- Use streaming for large file operations
- Implement proper error handling
- Monitor memory usage

## Security Best Practices

### Input Validation
- Validate all input data
- Sanitize user input
- Use parameterized queries
- Implement rate limiting

### Authentication
- Use JWT tokens
- Implement proper session management
- Validate tokens on every request
- Use HTTPS in production

---

**Quick Reference Version:** 1.0.0  
**Last Updated:** $(date)  
**For detailed information, see the full coding standards document.**