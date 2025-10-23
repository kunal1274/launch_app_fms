# FMS Data Models Documentation

## Overview

This document provides comprehensive documentation for all data models used in the Financial Management System (FMS). All models are built using Mongoose ODM for MongoDB and follow consistent patterns for validation, indexing, and schema design.

## Core Principles

### Schema Design Patterns
- **Consistent Naming**: camelCase for field names
- **Validation**: Comprehensive client and server-side validation
- **References**: Using ObjectId references for relationships
- **Timestamps**: Auto-generated createdAt and updatedAt fields
- **Soft Deletion**: isActive boolean for logical deletion
- **Auto-generation**: Auto-generated codes and identifiers

### Common Field Types
```javascript
// Standard fields used across models
{
  _id: ObjectId,                    // Auto-generated MongoDB ID
  createdAt: Date,                 // Auto-generated timestamp
  updatedAt: Date,                 // Auto-generated timestamp
  isActive: Boolean,               // Soft deletion flag (default: true)
  createdBy: ObjectId,             // Reference to user who created
  updatedBy: ObjectId,             // Reference to user who updated
}
```

## Customer Management Models

### Customer Model
**File**: `models/customer.model.js`
**Collection**: `customers`

```javascript
{
  // Auto-generated fields
  code: {
    type: String,
    required: false,
    unique: true,
    // Auto-generated format: CUST-000001
  },
  
  // Global party integration
  globalPartyId: {
    type: Schema.Types.ObjectId,
    ref: "GlobalParties",
    required: false,
    unique: true
  },
  
  // Basic information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  
  businessType: {
    type: String,
    required: true,
    enum: [
      "Individual",
      "Manufacturing", 
      "ServiceProvider",
      "Trading",
      "Distributor",
      "Retailer", 
      "Wholesaler",
      "Others"
    ],
    default: "Trading"
  },
  
  // Hierarchical structure
  parentAccount: {
    type: Schema.Types.ObjectId,
    ref: "Customers",
    default: null
  },
  
  // Contact information
  contactNum: {
    type: String,
    required: [true, "Contact number is required"],
    minlength: [10, "Phone number should be exactly 10 digits"],
    maxlength: [10, "Phone number should be exactly 10 digits"],
    validate: {
      validator: function(v) {
        return /^\d{10}$/.test(v);
      },
      message: "Contact number must be a 10-digit number"
    }
  },
  
  email: {
    type: String,
    required: false,
    validate: {
      validator: function(v) {
        return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: "Email must be a valid email format"
    },
    lowercase: true,
    trim: true
  },
  
  // Contact person details
  contactPersonName: {
    type: String,
    required: false,
    trim: true,
    maxlength: 255
  },
  
  contactPersonPhone: {
    type: String,
    required: false,
    validate: {
      validator: function(v) {
        return !v || /^\d{10}$/.test(v);
      },
      message: "Contact person phone must be a 10-digit number"
    }
  },
  
  contactPersonEmail: {
    type: String,
    required: false,
    validate: {
      validator: function(v) {
        return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: "Contact person email must be valid"
    },
    lowercase: true,
    trim: true
  },
  
  // Address information
  address: {
    street: { type: String, maxlength: 500 },
    city: { type: String, maxlength: 100 },
    state: { type: String, maxlength: 100 },
    zipCode: { type: String, maxlength: 20 },
    country: { type: String, maxlength: 100 }
  },
  
  // Financial information
  paymentTerms: {
    type: String,
    enum: ["Cash", "Net 30", "Net 60", "Net 90", "COD", "Custom"],
    default: "Net 30"
  },
  
  creditLimit: {
    type: Number,
    min: 0,
    default: 0
  },
  
  currency: {
    type: String,
    enum: ["INR", "USD", "EUR", "GBP"],
    default: "INR"
  },
  
  // Tax information
  taxId: {
    type: String,
    maxlength: 50
  },
  
  gstNumber: {
    type: String,
    maxlength: 15,
    validate: {
      validator: function(v) {
        return !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
      },
      message: "Invalid GST number format"
    }
  },
  
  // Status and metadata
  isActive: {
    type: Boolean,
    default: true
  },
  
  notes: {
    type: String,
    maxlength: 1000
  }
}
```

**Indexes:**
```javascript
// Compound indexes for efficient queries
customerSchema.index({ code: 1 });
customerSchema.index({ name: 1, isActive: 1 });
customerSchema.index({ contactNum: 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ businessType: 1, isActive: 1 });
customerSchema.index({ globalPartyId: 1 });
```

**Pre-save Middleware:**
```javascript
// Auto-generate customer code
customerSchema.pre('save', async function(next) {
  if (this.isNew && !this.code) {
    const counter = await CustomerCounterModel.findOneAndUpdate(
      { name: 'customerCode' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.code = `CUST-${String(counter.seq).padStart(6, '0')}`;
  }
  next();
});
```

### Vendor Model
**File**: `models/vendor.model.js`
**Collection**: `vendors`

```javascript
{
  // Auto-generated fields
  code: {
    type: String,
    unique: true,
    // Auto-generated format: VEND-000001
  },
  
  globalPartyId: {
    type: Schema.Types.ObjectId,
    ref: "GlobalParties",
    unique: true
  },
  
  // Basic information
  name: {
    type: String,
    required: [true, "Vendor name is required"],
    trim: true,
    maxlength: 255
  },
  
  businessType: {
    type: String,
    required: true,
    enum: [
      "Individual",
      "Manufacturing",
      "ServiceProvider", 
      "Trading",
      "Distributor",
      "Wholesaler",
      "Others"
    ],
    default: "Trading"
  },
  
  // Contact information
  contactNum: {
    type: String,
    required: [true, "Contact number is required"],
    validate: {
      validator: function(v) {
        return /^\d{10}$/.test(v);
      },
      message: "Contact number must be a 10-digit number"
    }
  },
  
  email: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: "Email must be valid"
    },
    lowercase: true,
    trim: true
  },
  
  // Address
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  
  // Financial terms
  paymentTerms: {
    type: String,
    enum: ["Cash", "Net 30", "Net 60", "Net 90", "COD"],
    default: "Net 30"
  },
  
  currency: {
    type: String,
    enum: ["INR", "USD", "EUR", "GBP"],
    default: "INR"
  },
  
  // Tax information
  taxId: String,
  gstNumber: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
      },
      message: "Invalid GST number format"
    }
  },
  
  // Banking information
  bankDetails: {
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    accountType: {
      type: String,
      enum: ["Savings", "Current", "CC", "OD"]
    }
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
}
```

## Inventory Management Models

### Item Model
**File**: `models/item.model.js`
**Collection**: `items`

```javascript
{
  // Identification
  itemNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  
  description: {
    type: String,
    required: [true, "Item description is required"],
    trim: true,
    maxlength: 500
  },
  
  // Classification
  itemType: {
    type: String,
    required: true,
    enum: [
      "Raw Material",
      "Semi-Finished",
      "Finished Goods",
      "Trading Item",
      "Service Item",
      "Kit Item"
    ]
  },
  
  category: {
    type: String,
    maxlength: 100
  },
  
  subCategory: {
    type: String,
    maxlength: 100
  },
  
  // Measurement
  baseUOM: {
    type: String,
    required: true,
    enum: ["EA", "KG", "LTR", "MTR", "PCS", "BOX", "SET"]
  },
  
  alternateUOM: {
    uom: String,
    conversionFactor: Number
  },
  
  // Costing
  costMethod: {
    type: String,
    enum: ["FIFO", "LIFO", "Average", "Standard"],
    default: "Average"
  },
  
  standardCost: {
    type: Number,
    min: 0,
    default: 0
  },
  
  unitPrice: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // Inventory tracking
  trackInventory: {
    type: Boolean,
    default: true
  },
  
  trackBatch: {
    type: Boolean,
    default: false
  },
  
  trackSerial: {
    type: Boolean,
    default: false
  },
  
  // Physical properties
  weight: Number,
  volume: Number,
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    unit: {
      type: String,
      enum: ["CM", "M", "IN", "FT"]
    }
  },
  
  // Storage requirements
  storageRequirements: {
    temperature: {
      min: Number,
      max: Number,
      unit: String
    },
    humidity: {
      min: Number,
      max: Number
    },
    specialHandling: String
  },
  
  // Safety stock
  minimumStock: {
    type: Number,
    min: 0,
    default: 0
  },
  
  maximumStock: {
    type: Number,
    min: 0,
    default: 0
  },
  
  reorderLevel: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // Suppliers
  preferredVendors: [{
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendors"
    },
    vendorItemCode: String,
    leadTime: Number,
    minOrderQty: Number
  }],
  
  isActive: {
    type: Boolean,
    default: true
  }
}
```

### Location Hierarchy Models

#### Site Model
```javascript
{
  siteCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  
  siteName: {
    type: String,
    required: true,
    trim: true
  },
  
  siteType: {
    type: String,
    enum: ["Main", "Branch", "Warehouse", "Store", "Factory"],
    default: "Main"
  },
  
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  
  contactInfo: {
    phone: String,
    email: String,
    manager: String
  },
  
  isActive: Boolean
}
```

#### Warehouse Model
```javascript
{
  warehouseCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  
  warehouseName: {
    type: String,
    required: true,
    trim: true
  },
  
  siteId: {
    type: Schema.Types.ObjectId,
    ref: "Sites",
    required: true
  },
  
  warehouseType: {
    type: String,
    enum: ["Raw Material", "Finished Goods", "General", "Cold Storage"],
    default: "General"
  },
  
  capacity: {
    totalArea: Number,
    usableArea: Number,
    unit: String
  },
  
  isActive: Boolean
}
```

## Sales Management Models

### Sales Order Model
**File**: `models/salesorder.model.js`
**Collection**: `salesorders`

```javascript
{
  // Order identification
  orderNumber: {
    type: String,
    unique: true,
    // Auto-generated: SO-YYYY-000001
  },
  
  // Customer information
  customerId: {
    type: Schema.Types.ObjectId,
    ref: "Customers",
    required: true
  },
  
  customerPO: {
    type: String,
    maxlength: 100
  },
  
  // Dates
  orderDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  requiredDate: {
    type: Date,
    required: true
  },
  
  shippedDate: Date,
  
  // Status management
  status: {
    type: String,
    enum: [
      "Draft",
      "Pending Approval",
      "Approved", 
      "In Production",
      "Ready to Ship",
      "Shipped",
      "Delivered",
      "Invoiced",
      "Cancelled",
      "On Hold"
    ],
    default: "Draft"
  },
  
  // Financial information
  currency: {
    type: String,
    enum: ["INR", "USD", "EUR", "GBP"],
    default: "INR"
  },
  
  exchangeRate: {
    type: Number,
    default: 1
  },
  
  // Order lines
  salesOrderLines: [{
    lineNumber: {
      type: Number,
      required: true
    },
    
    itemId: {
      type: Schema.Types.ObjectId,
      ref: "Items",
      required: true
    },
    
    quantity: {
      type: Number,
      required: true,
      min: 0.001
    },
    
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    
    discountPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    
    discountAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    
    lineTotal: {
      type: Number,
      required: true,
      min: 0
    },
    
    // Product dimensions
    productDimensions: {
      configId: {
        type: Schema.Types.ObjectId,
        ref: "ProductDimConfigs"
      },
      colorId: {
        type: Schema.Types.ObjectId,
        ref: "ProductDimColors"
      },
      sizeId: {
        type: Schema.Types.ObjectId,
        ref: "ProductDimSizes"
      },
      styleId: {
        type: Schema.Types.ObjectId,
        ref: "ProductDimStyles"
      },
      versionId: {
        type: Schema.Types.ObjectId,
        ref: "ProductDimVersions"
      }
    },
    
    // Tracking dimensions
    trackingDimensions: {
      batchId: {
        type: Schema.Types.ObjectId,
        ref: "TrackingDimBatches"
      },
      serialId: {
        type: Schema.Types.ObjectId,
        ref: "TrackingDimSerials"
      }
    },
    
    // Delivery information
    requestedDeliveryDate: Date,
    deliveryLocationId: {
      type: Schema.Types.ObjectId,
      ref: "Locations"
    },
    
    lineStatus: {
      type: String,
      enum: ["Open", "Confirmed", "Shipped", "Delivered", "Cancelled"],
      default: "Open"
    }
  }],
  
  // Totals
  subTotal: {
    type: Number,
    required: true,
    min: 0
  },
  
  totalDiscount: {
    type: Number,
    min: 0,
    default: 0
  },
  
  taxAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Delivery information
  deliveryAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    contactPerson: String,
    contactPhone: String
  },
  
  // Terms and conditions
  paymentTerms: {
    type: String,
    enum: ["Cash", "Net 30", "Net 60", "Net 90", "COD"],
    default: "Net 30"
  },
  
  shippingTerms: String,
  
  // Additional information
  notes: {
    type: String,
    maxlength: 1000
  },
  
  internalNotes: {
    type: String,
    maxlength: 1000
  },
  
  // Attachments
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    uploadedAt: Date,
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "UserGlobal"
    }
  }],
  
  // Workflow
  approvals: [{
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "UserGlobal"
    },
    approvedAt: Date,
    level: Number,
    comments: String
  }],
  
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "UserGlobal",
    required: true
  }
}
```

## Accounting Models

### Account (Chart of Accounts) Model
**File**: `models/account.model.js`
**Collection**: `accounts`

```javascript
{
  // Account identification
  accountCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  
  accountName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  
  // Account classification
  accountType: {
    type: String,
    required: true,
    enum: [
      "Assets",
      "Liabilities", 
      "Equity",
      "Revenue",
      "Expenses",
      "Cost of Goods Sold"
    ]
  },
  
  accountSubType: {
    type: String,
    enum: [
      // Assets
      "Current Assets", "Fixed Assets", "Other Assets",
      // Liabilities  
      "Current Liabilities", "Long-term Liabilities",
      // Equity
      "Owner's Equity", "Retained Earnings",
      // Revenue
      "Operating Revenue", "Other Revenue",
      // Expenses
      "Operating Expenses", "Administrative Expenses"
    ]
  },
  
  // Hierarchy
  parentAccountId: {
    type: Schema.Types.ObjectId,
    ref: "Accounts",
    default: null
  },
  
  level: {
    type: Number,
    min: 1,
    max: 5,
    default: 1
  },
  
  // Balance tracking
  normalBalance: {
    type: String,
    enum: ["Debit", "Credit"],
    required: true
  },
  
  currentBalance: {
    type: Number,
    default: 0
  },
  
  // Control settings
  isControlAccount: {
    type: Boolean,
    default: false
  },
  
  allowDirectPosting: {
    type: Boolean,
    default: true
  },
  
  // Integration
  bankAccountNumber: String,
  taxAccountCode: String,
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  description: {
    type: String,
    maxlength: 500
  }
}
```

### GL Journal Model
**File**: `models/glJournal.model.js`
**Collection**: `gljournals`

```javascript
{
  // Journal identification
  journalNumber: {
    type: String,
    unique: true,
    // Auto-generated: GJ-YYYY-000001
  },
  
  // Journal information
  journalDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  postingDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  journalType: {
    type: String,
    enum: ["Manual", "Sales", "Purchase", "Payment", "Receipt", "Adjustment"],
    default: "Manual"
  },
  
  // Template reference
  templateId: {
    type: Schema.Types.ObjectId,
    ref: "JournalTemplates"
  },
  
  // Description
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  reference: {
    type: String,
    maxlength: 100
  },
  
  // Journal lines
  journalLines: [{
    lineNumber: {
      type: Number,
      required: true
    },
    
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Accounts",
      required: true
    },
    
    description: {
      type: String,
      maxlength: 255
    },
    
    debitAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    
    creditAmount: {
      type: Number, 
      min: 0,
      default: 0
    },
    
    // Analytical dimensions
    costCenterId: {
      type: Schema.Types.ObjectId,
      ref: "CostCenters"
    },
    
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Projects"
    },
    
    // Source document
    sourceDocument: {
      type: String,
      maxlength: 100
    },
    
    sourceDocumentId: Schema.Types.ObjectId
  }],
  
  // Totals
  totalDebit: {
    type: Number,
    required: true,
    min: 0
  },
  
  totalCredit: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Status
  status: {
    type: String,
    enum: ["Draft", "Posted", "Reversed"],
    default: "Draft"
  },
  
  postedBy: {
    type: Schema.Types.ObjectId,
    ref: "UserGlobal"
  },
  
  postedAt: Date,
  
  // Reversal information
  reversalJournalId: {
    type: Schema.Types.ObjectId,
    ref: "GLJournals"
  },
  
  reversedJournalId: {
    type: Schema.Types.ObjectId,
    ref: "GLJournals"
  },
  
  // Approval workflow
  requiresApproval: {
    type: Boolean,
    default: false
  },
  
  approvals: [{
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "UserGlobal"
    },
    approvedAt: Date,
    level: Number
  }],
  
  // Audit fields
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "UserGlobal",
    required: true
  }
}
```

## Shared Models

### Global Party Model
**File**: `shared_service/models/globalParty.model.js`
**Collection**: `globalparties`

```javascript
{
  // Identification
  partyCode: {
    type: String,
    unique: true,
    // Auto-generated: PARTY-000001
  },
  
  partyName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Party classification
  partyType: {
    type: String,
    enum: ["Individual", "Organization"],
    required: true
  },
  
  // Role flags
  isCustomer: {
    type: Boolean,
    default: false
  },
  
  isVendor: {
    type: Boolean,
    default: false
  },
  
  isEmployee: {
    type: Boolean,
    default: false
  },
  
  isContractor: {
    type: Boolean,
    default: false
  },
  
  // Contact information
  primaryContact: {
    phone: String,
    email: String
  },
  
  // Address
  addresses: [{
    type: {
      type: String,
      enum: ["Billing", "Shipping", "Office", "Home"]
    },
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    isPrimary: Boolean
  }],
  
  // Groups
  groupIds: [{
    type: Schema.Types.ObjectId,
    ref: "GlobalGroups"
  }],
  
  isActive: {
    type: Boolean,
    default: true
  }
}
```

### Counter Model
**File**: `models/counter.model.js`
**Collection**: `counters`

```javascript
{
  name: {
    type: String,
    required: true,
    unique: true
  },
  
  seq: {
    type: Number,
    default: 0
  },
  
  prefix: String,
  suffix: String,
  
  length: {
    type: Number,
    default: 6
  },
  
  resetPeriod: {
    type: String,
    enum: ["Never", "Daily", "Monthly", "Yearly"],
    default: "Never"
  },
  
  lastReset: Date
}
```

## Model Relationships

### Entity Relationship Diagram

```
GlobalParties
├── Customers (1:1)
├── Vendors (1:1)
└── Employees (1:1)

Customers
├── SalesOrders (1:many)
└── CustomerGroups (many:many)

Items
├── SalesOrderLines (1:many)
├── PurchaseOrderLines (1:many)
├── InventoryTransactions (1:many)
└── StockBalances (1:many)

Sites
└── Warehouses (1:many)
    └── Zones (1:many)
        └── Locations (1:many)
            └── Racks (1:many)
                └── Shelves (1:many)
                    └── Bins (1:many)

Accounts (Hierarchical)
├── GLJournalLines (1:many)
└── SubAccounts (1:many)

SalesOrders
├── SalesOrderLines (1:many)
└── Approvals (1:many)
```

### Common Query Patterns

#### Customer with Orders
```javascript
const customerWithOrders = await CustomerModel.findById(customerId)
  .populate({
    path: 'salesOrders',
    select: 'orderNumber orderDate totalAmount status',
    options: { sort: { orderDate: -1 }, limit: 10 }
  });
```

#### Sales Order with Full Details
```javascript
const salesOrderDetail = await SalesOrderModel.findById(orderId)
  .populate('customerId', 'name contactNum email')
  .populate('salesOrderLines.itemId', 'itemNumber description baseUOM')
  .populate('createdBy', 'name email');
```

#### Account Hierarchy
```javascript
const accountHierarchy = await AccountModel.find({ 
  parentAccountId: parentId 
}).populate('children');
```

## Validation Patterns

### Email Validation
```javascript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

### Phone Validation (India)
```javascript
const phoneRegex = /^\d{10}$/;
```

### GST Number Validation (India)
```javascript
const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
```

### Currency Validation
```javascript
const supportedCurrencies = ["INR", "USD", "EUR", "GBP"];
```

## Performance Considerations

### Indexing Strategy
1. **Primary Keys**: All _id fields are automatically indexed
2. **Unique Fields**: code, email, contactNum fields have unique indexes
3. **Query Fields**: Frequently queried fields like status, isActive
4. **Compound Indexes**: Multi-field queries like { name: 1, isActive: 1 }
5. **Text Indexes**: For search functionality on name and description fields

### Query Optimization
1. **Populate Selectively**: Only populate required fields
2. **Limit Results**: Use pagination for large datasets
3. **Project Fields**: Select only needed fields in queries
4. **Use Lean**: For read-only operations, use .lean() for better performance

This comprehensive model documentation provides the foundation for understanding the FMS data structure and implementing effective queries and relationships.