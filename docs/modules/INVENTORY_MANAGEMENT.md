# Inventory Management Module

**Version:** 1.1.0  
**Last Updated:** $(date)  
**Status:** Implemented - Needs Standardization  

## Overview

The Inventory Management module provides comprehensive inventory tracking with multi-dimensional support. It handles items, storage dimensions, product dimensions, tracking dimensions, and inventory journals.

## Architecture

### Components
- **Models:** Multiple dimension models (site, warehouse, zone, etc.)
- **Controllers:** Individual controllers for each dimension
- **Routes:** Separate routes for each dimension
- **Services:** Business logic services (to be standardized)
- **Validators:** Input validation (to be created)

### Dependencies
- **Item Model:** For product information
- **General Ledger:** For financial transaction recording
- **Purchase/Sales Modules:** For inventory updates

## Data Models

### Storage Dimensions

#### Site Model
```javascript
{
  code: String,              // Auto-generated site code
  name: String,              // Site name
  description: String,       // Site description
  address: String,           // Site address
  active: Boolean,           // Active status
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

#### Warehouse Model
```javascript
{
  code: String,              // Auto-generated warehouse code
  name: String,              // Warehouse name
  site: ObjectId,            // Reference to Sites
  address: String,           // Warehouse address
  active: Boolean,           // Active status
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

#### Zone Model
```javascript
{
  code: String,              // Auto-generated zone code
  name: String,              // Zone name
  warehouse: ObjectId,       // Reference to Warehouses
  description: String,       // Zone description
  active: Boolean,           // Active status
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

#### Location Model
```javascript
{
  code: String,              // Auto-generated location code
  name: String,              // Location name
  zone: ObjectId,            // Reference to Zones
  description: String,       // Location description
  active: Boolean,           // Active status
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

#### Aisle Model
```javascript
{
  code: String,              // Auto-generated aisle code
  name: String,              // Aisle name
  location: ObjectId,        // Reference to Locations
  description: String,       // Aisle description
  active: Boolean,           // Active status
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

#### Rack Model
```javascript
{
  code: String,              // Auto-generated rack code
  name: String,              // Rack name
  aisle: ObjectId,           // Reference to Aisles
  description: String,       // Rack description
  active: Boolean,           // Active status
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

#### Shelf Model
```javascript
{
  code: String,              // Auto-generated shelf code
  name: String,              // Shelf name
  rack: ObjectId,            // Reference to Racks
  description: String,       // Shelf description
  active: Boolean,           // Active status
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

#### Bin Model
```javascript
{
  code: String,              // Auto-generated bin code
  name: String,              // Bin name
  shelf: ObjectId,           // Reference to Shelves
  description: String,       // Bin description
  active: Boolean,           // Active status
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

### Product Dimensions

#### Configuration Model
```javascript
{
  code: String,              // Auto-generated config code
  name: String,              // Configuration name
  description: String,       // Configuration description
  active: Boolean,           // Active status
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

#### Color Model
```javascript
{
  code: String,              // Auto-generated color code
  name: String,              // Color name
  hexCode: String,           // Hex color code
  description: String,       // Color description
  active: Boolean,           // Active status
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

#### Size Model
```javascript
{
  code: String,              // Auto-generated size code
  name: String,              // Size name
  description: String,       // Size description
  active: Boolean,           // Active status
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

#### Style Model
```javascript
{
  code: String,              // Auto-generated style code
  name: String,              // Style name
  description: String,       // Style description
  active: Boolean,           // Active status
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

#### Version Model
```javascript
{
  code: String,              // Auto-generated version code
  name: String,              // Version name
  description: String,       // Version description
  active: Boolean,           // Active status
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

### Tracking Dimensions

#### Batch Model
```javascript
{
  code: String,              // Auto-generated batch code
  name: String,              // Batch name
  description: String,       // Batch description
  expiryDate: Date,          // Batch expiry date
  active: Boolean,           // Active status
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

#### Serial Model
```javascript
{
  code: String,              // Auto-generated serial code
  name: String,              // Serial number
  description: String,       // Serial description
  active: Boolean,           // Active status
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

### Inventory Transactions

#### Inventory Journal Model
```javascript
{
  journalNum: String,        // Auto-generated journal number
  journalType: String,       // "Receipt" | "Issue" | "Transfer" | "Adjustment"
  date: Date,                // Journal date
  reference: String,         // Reference document
  lines: [JournalLine],      // Journal lines
  status: String,            // "Draft" | "Posted" | "Cancelled"
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

#### Journal Line Schema
```javascript
{
  lineNum: String,           // Line number
  item: ObjectId,            // Reference to Items
  dims: {
    site: ObjectId,          // Storage dimensions
    warehouse: ObjectId,
    zone: ObjectId,
    location: ObjectId,
    aisle: ObjectId,
    rack: ObjectId,
    shelf: ObjectId,
    bin: ObjectId,
    config: ObjectId,        // Product dimensions
    color: ObjectId,
    size: ObjectId,
    style: ObjectId,
    version: ObjectId,
    batch: ObjectId,         // Tracking dimensions
    serial: ObjectId
  },
  quantity: Number,          // Quantity
  unitCost: Number,          // Unit cost
  totalCost: Number,         // Total cost
  description: String        // Line description
}
```

#### Stock Balance Model
```javascript
{
  item: ObjectId,            // Reference to Items
  dims: {
    site: ObjectId,          // All dimension references
    warehouse: ObjectId,
    zone: ObjectId,
    location: ObjectId,
    aisle: ObjectId,
    rack: ObjectId,
    shelf: ObjectId,
    bin: ObjectId,
    config: ObjectId,
    color: ObjectId,
    size: ObjectId,
    style: ObjectId,
    version: ObjectId,
    batch: ObjectId,
    serial: ObjectId
  },
  quantity: Number,          // Current quantity
  unitCost: Number,          // Average unit cost
  totalCost: Number,         // Total cost
  lastUpdated: Date,         // Last update timestamp
  company: ObjectId,         // Company reference
  timestamps: true           // createdAt, updatedAt
}
```

## API Endpoints

### Storage Dimensions
```http
# Sites
GET    /api/v0/sites
POST   /api/v0/sites
GET    /api/v0/sites/:id
PUT    /api/v0/sites/:id
DELETE /api/v0/sites/:id

# Warehouses
GET    /api/v0/warehouses
POST   /api/v0/warehouses
GET    /api/v0/warehouses/:id
PUT    /api/v0/warehouses/:id
DELETE /api/v0/warehouses/:id

# Zones
GET    /api/v0/zones
POST   /api/v0/zones
GET    /api/v0/zones/:id
PUT    /api/v0/zones/:id
DELETE /api/v0/zones/:id

# Locations
GET    /api/v0/locations
POST   /api/v0/locations
GET    /api/v0/locations/:id
PUT    /api/v0/locations/:id
DELETE /api/v0/locations/:id

# Aisles
GET    /api/v0/aisles
POST   /api/v0/aisles
GET    /api/v0/aisles/:id
PUT    /api/v0/aisles/:id
DELETE /api/v0/aisles/:id

# Racks
GET    /api/v0/racks
POST   /api/v0/racks
GET    /api/v0/racks/:id
PUT    /api/v0/racks/:id
DELETE /api/v0/racks/:id

# Shelves
GET    /api/v0/shelves
POST   /api/v0/shelves
GET    /api/v0/shelves/:id
PUT    /api/v0/shelves/:id
DELETE /api/v0/shelves/:id

# Bins
GET    /api/v0/bins
POST   /api/v0/bins
GET    /api/v0/bins/:id
PUT    /api/v0/bins/:id
DELETE /api/v0/bins/:id
```

### Product Dimensions
```http
# Configurations
GET    /api/v0/configurations
POST   /api/v0/configurations
GET    /api/v0/configurations/:id
PUT    /api/v0/configurations/:id
DELETE /api/v0/configurations/:id

# Colors
GET    /api/v0/colors
POST   /api/v0/colors
GET    /api/v0/colors/:id
PUT    /api/v0/colors/:id
DELETE /api/v0/colors/:id

# Sizes
GET    /api/v0/sizes
POST   /api/v0/sizes
GET    /api/v0/sizes/:id
PUT    /api/v0/sizes/:id
DELETE /api/v0/sizes/:id

# Styles
GET    /api/v0/styles
POST   /api/v0/styles
GET    /api/v0/styles/:id
PUT    /api/v0/styles/:id
DELETE /api/v0/styles/:id

# Versions
GET    /api/v0/versions
POST   /api/v0/versions
GET    /api/v0/versions/:id
PUT    /api/v0/versions/:id
DELETE /api/v0/versions/:id
```

### Tracking Dimensions
```http
# Batches
GET    /api/v0/batches
POST   /api/v0/batches
GET    /api/v0/batches/:id
PUT    /api/v0/batches/:id
DELETE /api/v0/batches/:id

# Serials
GET    /api/v0/serials
POST   /api/v0/serials
GET    /api/v0/serials/:id
PUT    /api/v0/serials/:id
DELETE /api/v0/serials/:id
```

### Inventory Operations
```http
# Inventory Journals
GET    /api/v0/invent-journals
POST   /api/v0/invent-journals
GET    /api/v0/invent-journals/:id
PUT    /api/v0/invent-journals/:id
DELETE /api/v0/invent-journals/:id

# Stock Balances
GET    /api/v0/stock-balances
GET    /api/v0/stock-balances/:id
POST   /api/v0/stock-balances/search
```

## Business Logic

### Dimension Hierarchy
1. **Site** → **Warehouse** → **Zone** → **Location** → **Aisle** → **Rack** → **Shelf** → **Bin**
2. **Configuration** → **Color** → **Size** → **Style** → **Version**
3. **Batch** and **Serial** are independent tracking dimensions

### Inventory Transactions
1. **Receipt:** Increase inventory (purchase, return)
2. **Issue:** Decrease inventory (sale, consumption)
3. **Transfer:** Move inventory between locations
4. **Adjustment:** Correct inventory discrepancies

### Stock Balance Updates
1. **Real-time Updates:** Update stock balances on transaction posting
2. **Cost Calculation:** Maintain average unit cost
3. **Quantity Tracking:** Track quantities by all dimensions
4. **Validation:** Ensure sufficient stock before issuing

## Integration Points

### Purchase Management
- **Receipt Processing:** Update inventory on purchase receipt
- **Return Processing:** Handle purchase returns

### Sales Management
- **Order Processing:** Reserve stock on order confirmation
- **Shipment Processing:** Update inventory on shipment
- **Return Processing:** Handle sales returns

### General Ledger
- **Cost Recording:** Record inventory costs
- **Valuation:** Maintain inventory valuation
- **Adjustments:** Record inventory adjustments

## Error Handling

### Common Errors
- **ValidationError:** Invalid dimension data
- **NotFoundError:** Dimension not found
- **InsufficientStockError:** Not enough stock available
- **InvalidTransactionError:** Invalid journal transaction
- **DuplicateError:** Duplicate dimension code

## Performance Considerations

### Database Optimization
- **Indexes:** Create indexes on frequently queried fields
- **Aggregation:** Use aggregation for stock balance queries
- **Pagination:** Implement pagination for large datasets
- **Caching:** Cache dimension data for quick access

### Query Optimization
- **Projection:** Use projection to limit returned fields
- **Filtering:** Implement efficient filtering
- **Sorting:** Optimize sorting operations
- **Joins:** Minimize database joins

## Security

### Access Control
- **Authentication:** JWT token validation
- **Authorization:** Role-based access control
- **Data Isolation:** Company-based data separation

### Data Validation
- **Input Sanitization:** Prevent XSS and injection attacks
- **Schema Validation:** Validate all input data
- **Business Rules:** Enforce inventory business rules

## Monitoring and Logging

### Logging
- **Transaction Logging:** Log all inventory transactions
- **Stock Updates:** Log stock balance changes
- **Error Logging:** Log all errors with context

### Metrics
- **Transaction Volume:** Track transactions per day
- **Stock Levels:** Monitor stock levels
- **Error Rates:** Track error frequencies
- **Performance:** Monitor response times

## Future Enhancements

### Planned Features
- **Barcode Integration:** Barcode scanning support
- **RFID Support:** RFID tag integration
- **Automated Reordering:** Automatic reorder points
- **Advanced Reporting:** Comprehensive inventory reports

### Integration Opportunities
- **WMS Systems:** Warehouse management system integration
- **ERP Systems:** External ERP system integration
- **Mobile Apps:** Mobile inventory management
- **IoT Devices:** IoT sensor integration

## Troubleshooting

### Common Issues
1. **Stock Discrepancies:** Check transaction history
2. **Dimension Validation:** Verify dimension hierarchy
3. **Cost Calculation:** Check cost calculation logic
4. **Performance Issues:** Optimize database queries

### Debug Steps
1. Check application logs
2. Verify database constraints
3. Test with sample data
4. Check external service connectivity

---

**Module Maintainer:** Development Team  
**Last Review:** $(date)  
**Next Review:** TBD