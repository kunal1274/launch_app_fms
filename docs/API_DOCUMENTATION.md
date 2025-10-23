# FMS (Financial Management System) - API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Core API Modules](#core-api-modules)
5. [Data Models](#data-models)
6. [API Endpoints](#api-endpoints)
7. [Error Handling](#error-handling)
8. [Usage Examples](#usage-examples)
9. [UI Design Guidelines](#ui-design-guidelines)

## Overview

The FMS Backend is a comprehensive financial and business management system built with Node.js, Express.js, and MongoDB. It provides REST APIs for managing customers, vendors, inventory, sales orders, purchase orders, accounting, and more.

### Key Features
- **Modular Architecture**: Service-based architecture with BB0, BB1, BB3 service modules
- **Comprehensive Business Logic**: Customer management, inventory, sales, procurement, accounting
- **Security**: JWT authentication, rate limiting, CORS, XSS protection
- **Data Validation**: Mongoose schema validation with comprehensive error handling
- **File Management**: Multer-based file upload and management
- **Audit Logging**: Complete API flow recording and audit trails
- **AI Integration**: ChatGPT service for intelligent features

### Technology Stack
- **Runtime**: Node.js with ES6 modules
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT, Passport.js, Google OAuth
- **Security**: Helmet, XSS-Clean, Rate Limiting, HPP
- **File Upload**: Multer
- **Logging**: Winston with daily rotate files
- **Testing**: Jest with MongoDB Memory Server
- **Process Management**: PM2 support

## Architecture

### Service Architecture
The application follows a microservice-inspired modular architecture:

```
FMS Backend
├── bb0/ (Core Services)
│   ├── am_svc/ (Account Management Service)
│   ├── ar_svc/ (Accounts Receivable Service)
│   ├── gm_svc/ (General Management Service)
│   └── shm_svc/ (Shared Management Service)
├── bb1_*_management_service/ (Business Services)
│   ├── customer_management_service/
│   ├── inventory_management_service/
│   ├── sales_management_service/
│   ├── company_management_service/
│   └── audit_logging_service/
├── bb3_*_management_service/ (Extended Services)
│   ├── sales_management_service/
│   └── purchase_management_service/
├── role_based_access_control_service/
├── chatgpt_ai_service/
└── shared_service/
```

### Directory Structure
```
/
├── controllers/          # Business logic controllers
├── models/              # Mongoose data models
├── routes/              # Express route definitions
├── middleware/          # Custom middleware
├── utility/             # Helper utilities
├── config/              # Configuration files
├── database/            # Database connection setup
├── test/                # Test files
├── uploads/             # File upload storage
├── flows/               # Business flow definitions
├── seeds/               # Database seed files
└── services/            # External service integrations
```

## Authentication

### JWT Authentication
The system uses JSON Web Tokens for stateless authentication:

```javascript
// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
```

### Google OAuth Integration
Supports Google OAuth 2.0 for social login:

```javascript
// Google OAuth Routes
POST /fms/api/v0/auth/google
GET /fms/api/v0/auth/google/callback
```

### OTP Authentication
Phone-based OTP authentication system:

```javascript
// OTP Routes
POST /fms/api/v0/otp-auth/send-otp
POST /fms/api/v0/otp-auth/verify-otp
POST /fms/api/v0/otp-auth/me
```

## Core API Modules

### 1. User Management
- **User Registration & Authentication**
- **User Groups and Roles**
- **Global User Management**

### 2. Customer Management
- **Customer CRUD Operations**
- **Customer Groups and Attachments**
- **Global Party Integration**

### 3. Vendor Management
- **Vendor Registration and Management**
- **Vendor-Supplier Relationships**

### 4. Inventory Management
#### Storage Dimensions
- **Sites**: Physical locations
- **Warehouses**: Storage facilities
- **Zones**: Warehouse sections
- **Locations**: Specific areas
- **Aisles**: Aisle management
- **Racks**: Rack systems
- **Shelves**: Shelf management
- **Bins**: Smallest storage units

#### Product Dimensions
- **Configurations**: Product variants
- **Colors**: Color attributes
- **Sizes**: Size variants
- **Styles**: Style variations
- **Versions**: Product versions

#### Tracking Dimensions
- **Batches**: Batch tracking
- **Serial Numbers**: Individual item tracking

### 5. Sales Management
- **Sales Orders**: Complete order lifecycle
- **Sales Order Lines**: Line item management
- **Customer Integration**

### 6. Procurement Management
- **Purchase Orders**: Procurement workflow
- **Vendor Integration**
- **Approval Workflows**

### 7. Accounting Module
- **General Ledger**: Chart of accounts
- **GL Journals**: Journal entries
- **Journal Templates**: Reusable templates
- **Bank Management**: Bank account management
- **Cash Journals**: Cash transaction management

### 8. Inventory Journals
- **Inventory Transactions**: Stock movements
- **Stock Balance Management**: Real-time balances

## Data Models

### Customer Model
```javascript
{
  code: String,                    // Auto-generated unique code
  globalPartyId: ObjectId,         // Reference to GlobalParties
  businessType: Enum,              // Business classification
  name: String,                    // Customer name
  parentAccount: ObjectId,         // Hierarchical structure
  contactNum: String,              // 10-digit phone number
  email: String,                   // Email address
  contactPersonName: String,       // Contact person
  contactPersonPhone: String,      // Contact person phone
  contactPersonEmail: String,      // Contact person email
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  paymentTerms: String,           // Payment conditions
  creditLimit: Number,            // Credit limit
  currency: String,               // Base currency
  taxId: String,                  // Tax identification
  isActive: Boolean,              // Status flag
  createdAt: Date,
  updatedAt: Date
}
```

### Sales Order Model
```javascript
{
  orderNumber: String,            // Auto-generated
  customerId: ObjectId,           // Customer reference
  orderDate: Date,                // Order date
  requiredDate: Date,             // Required delivery date
  status: Enum,                   // Order status
  totalAmount: Number,            // Total order value
  currency: String,               // Order currency
  salesOrderLines: [{
    itemId: ObjectId,             // Product reference
    quantity: Number,             // Ordered quantity
    unitPrice: Number,            // Unit price
    lineTotal: Number,            // Line total
    productDimensions: {          // Product variants
      configId: ObjectId,
      colorId: ObjectId,
      sizeId: ObjectId,
      styleId: ObjectId,
      versionId: ObjectId
    },
    trackingDimensions: {         // Tracking info
      batchId: ObjectId,
      serialId: ObjectId
    }
  }],
  deliveryAddress: Object,        // Delivery details
  paymentTerms: String,
  notes: String,
  attachments: [String],          // File references
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Base URL
```
http://localhost:3000/fms/api/v0
```

### Customer Management APIs

#### Create Customer
```http
POST /customers
Content-Type: application/json

{
  "name": "ABC Corporation",
  "contactNum": "9876543210",
  "email": "contact@abc.com",
  "businessType": "Trading",
  "address": {
    "street": "123 Business Street",
    "city": "Bangalore",
    "state": "Karnataka",
    "zipCode": "560001",
    "country": "India"
  },
  "paymentTerms": "Net 30",
  "creditLimit": 100000,
  "currency": "INR"
}
```

**Response:**
```json
{
  "status": "Success",
  "message": "Customer created successfully",
  "data": {
    "_id": "60f7d1234567890abcdef123",
    "code": "CUST-000001",
    "name": "ABC Corporation",
    "contactNum": "9876543210",
    "email": "contact@abc.com",
    "businessType": "Trading",
    "isActive": true,
    "createdAt": "2023-07-20T10:30:00.000Z",
    "updatedAt": "2023-07-20T10:30:00.000Z"
  }
}
```

#### Get All Customers
```http
GET /customers
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Records per page (default: 10)
- `search`: Search term
- `businessType`: Filter by business type
- `isActive`: Filter by status

**Response:**
```json
{
  "status": "Success",
  "data": {
    "customers": [
      {
        "_id": "60f7d1234567890abcdef123",
        "code": "CUST-000001",
        "name": "ABC Corporation",
        "contactNum": "9876543210",
        "email": "contact@abc.com",
        "businessType": "Trading",
        "isActive": true
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalRecords": 45,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

#### Get Customer by ID
```http
GET /customers/{customerId}
```

#### Update Customer
```http
PUT /customers/{customerId}
Content-Type: application/json

{
  "name": "ABC Corporation Ltd",
  "email": "info@abc.com",
  "creditLimit": 150000
}
```

#### Delete Customer
```http
DELETE /customers/{customerId}
```

### Sales Order Management APIs

#### Create Sales Order
```http
POST /salesorders
Content-Type: application/json

{
  "customerId": "60f7d1234567890abcdef123",
  "orderDate": "2023-07-20",
  "requiredDate": "2023-07-30",
  "currency": "INR",
  "salesOrderLines": [
    {
      "itemId": "60f7d1234567890abcdef456",
      "quantity": 10,
      "unitPrice": 100.00,
      "productDimensions": {
        "configId": "60f7d1234567890abcdef789",
        "colorId": "60f7d1234567890abcdef101"
      }
    }
  ],
  "deliveryAddress": {
    "street": "456 Delivery Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "zipCode": "400001",
    "country": "India"
  },
  "paymentTerms": "Net 30",
  "notes": "Urgent delivery required"
}
```

### Inventory Management APIs

#### Create Item
```http
POST /items
Content-Type: application/json

{
  "itemNumber": "ITEM-001",
  "description": "Sample Product",
  "baseUOM": "EA",
  "itemType": "Finished Goods",
  "category": "Electronics",
  "unitCost": 75.00,
  "unitPrice": 100.00,
  "isActive": true
}
```

#### Inventory Transaction
```http
POST /invent-journals
Content-Type: application/json

{
  "transactionType": "Receipt",
  "itemId": "60f7d1234567890abcdef456",
  "quantity": 100,
  "unitCost": 75.00,
  "locationId": "60f7d1234567890abcdef789",
  "reference": "PO-001",
  "notes": "Initial stock receipt"
}
```

### Accounting APIs

#### Create GL Journal
```http
POST /gl-journals
Content-Type: application/json

{
  "journalNumber": "GJ-001",
  "journalDate": "2023-07-20",
  "description": "Sample journal entry",
  "journalLines": [
    {
      "accountId": "60f7d1234567890abcdef123",
      "debitAmount": 1000.00,
      "creditAmount": 0,
      "description": "Debit entry"
    },
    {
      "accountId": "60f7d1234567890abcdef456",
      "debitAmount": 0,
      "creditAmount": 1000.00,
      "description": "Credit entry"
    }
  ]
}
```

## Error Handling

### Standard Error Response Format
```json
{
  "status": "failure",
  "message": "Error description",
  "error": "Detailed error information",
  "timestamp": "2023-07-20T10:30:00.000Z",
  "path": "/fms/api/v0/customers"
}
```

### HTTP Status Codes
- **200**: Success
- **201**: Created
- **400**: Bad Request
- **401**: Unauthorized
- **403**: Forbidden
- **404**: Not Found
- **409**: Conflict (Duplicate)
- **422**: Validation Error
- **500**: Internal Server Error
- **503**: Service Unavailable

### Common Error Types

#### Validation Errors (422)
```json
{
  "status": "failure",
  "message": "Validation error during customer creation",
  "error": "Customer name and contact num are required"
}
```

#### Duplicate Key Errors (409)
```json
{
  "status": "failure",
  "message": "A customer with this contact number already exists"
}
```

#### Not Found Errors (404)
```json
{
  "status": "failure",
  "message": "Customer not found with the provided ID"
}
```

## Usage Examples

### Customer Management Workflow

```javascript
// 1. Create a new customer
const createCustomer = async () => {
  const response = await fetch('/fms/api/v0/customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      name: 'Tech Solutions Ltd',
      contactNum: '9876543210',
      email: 'info@techsolutions.com',
      businessType: 'ServiceProvider'
    })
  });
  return response.json();
};

// 2. Get customer details
const getCustomer = async (customerId) => {
  const response = await fetch(`/fms/api/v0/customers/${customerId}`, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });
  return response.json();
};

// 3. Update customer
const updateCustomer = async (customerId, updates) => {
  const response = await fetch(`/fms/api/v0/customers/${customerId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(updates)
  });
  return response.json();
};
```

### Sales Order Workflow

```javascript
// Complete sales order creation workflow
const createSalesOrderWorkflow = async () => {
  try {
    // 1. Get customer
    const customer = await getCustomer('60f7d1234567890abcdef123');
    
    // 2. Get available items
    const items = await fetch('/fms/api/v0/items').then(r => r.json());
    
    // 3. Create sales order
    const salesOrder = await fetch('/fms/api/v0/salesorders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        customerId: customer.data._id,
        orderDate: new Date().toISOString().split('T')[0],
        requiredDate: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0],
        salesOrderLines: [
          {
            itemId: items.data[0]._id,
            quantity: 5,
            unitPrice: 100.00
          }
        ]
      })
    });
    
    return salesOrder.json();
  } catch (error) {
    console.error('Sales order creation failed:', error);
  }
};
```

## UI Design Guidelines

Based on the school management dashboard pattern you provided, here are comprehensive UI design guidelines for the FMS system:

### Design Principles

#### 1. Dashboard-First Approach
- **Clean, Minimal Design**: Follow the dashboard pattern with clean white backgrounds and subtle shadows
- **Card-Based Layout**: Use cards for different modules (similar to Students, Teachers, Customers, Transport cards)
- **Consistent Spacing**: Maintain consistent padding and margins throughout the interface
- **Intuitive Navigation**: Left sidebar navigation with clear icons and module organization

#### 2. Color Scheme
```css
:root {
  --primary-blue: #2563eb;
  --secondary-green: #10b981;
  --accent-purple: #8b5cf6;
  --accent-orange: #f59e0b;
  --neutral-gray: #6b7280;
  --background-light: #f8fafc;
  --card-background: #ffffff;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --border-light: #e5e7eb;
}
```

#### 3. Typography
```css
/* Use modern, readable fonts */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

/* Hierarchy */
.heading-xl { font-size: 2.25rem; font-weight: 700; }
.heading-lg { font-size: 1.875rem; font-weight: 600; }
.heading-md { font-size: 1.5rem; font-weight: 600; }
.heading-sm { font-size: 1.25rem; font-weight: 600; }
.body-lg { font-size: 1.125rem; font-weight: 400; }
.body-md { font-size: 1rem; font-weight: 400; }
.body-sm { font-size: 0.875rem; font-weight: 400; }
```

### Layout Structure

#### 1. Main Dashboard Layout
```html
<div class="dashboard-container">
  <!-- Sidebar Navigation -->
  <aside class="sidebar">
    <div class="logo-section">
      <img src="logo.png" alt="FMS System" />
      <h2>Financial Management System</h2>
    </div>
    
    <nav class="navigation">
      <div class="nav-section">
        <h3>Main Navigation</h3>
        <ul>
          <li><a href="/dashboard"><icon>📊</icon> Dashboard</a></li>
        </ul>
      </div>
      
      <div class="nav-section">
        <h3>Core Modules</h3>
        <ul>
          <li><a href="/customers"><icon>👥</icon> Customers</a></li>
          <li><a href="/vendors"><icon>🏢</icon> Vendors</a></li>
          <li><a href="/items"><icon>📦</icon> Items</a></li>
          <li><a href="/companies"><icon>🏛️</icon> Companies</a></li>
        </ul>
      </div>
      
      <div class="nav-section">
        <h3>Sales & Procurement</h3>
        <ul>
          <li><a href="/sales-orders"><icon>📋</icon> Sales Orders</a></li>
          <li><a href="/purchase-orders"><icon>🛒</icon> Purchase Orders</a></li>
        </ul>
      </div>
      
      <div class="nav-section">
        <h3>Inventory</h3>
        <ul>
          <li><a href="/warehouses"><icon>🏪</icon> Warehouses</a></li>
          <li><a href="/locations"><icon>📍</icon> Locations</a></li>
          <li><a href="/stock-balance"><icon>📊</icon> Stock Balance</a></li>
        </ul>
      </div>
      
      <div class="nav-section">
        <h3>Accounting</h3>
        <ul>
          <li><a href="/accounts"><icon>💰</icon> Accounts</a></li>
          <li><a href="/gl-journals"><icon>📚</icon> GL Journals</a></li>
          <li><a href="/banks"><icon>🏦</icon> Banks</a></li>
        </ul>
      </div>
    </nav>
  </aside>
  
  <!-- Main Content Area -->
  <main class="main-content">
    <header class="top-header">
      <div class="breadcrumb">
        <span>Dashboard</span>
      </div>
      <div class="user-info">
        <span class="user-email">admin@example.com</span>
        <span class="user-role">admin</span>
        <button class="sign-out">Sign Out</button>
      </div>
    </header>
    
    <div class="content-area">
      <!-- Dashboard content goes here -->
    </div>
  </main>
</div>
```

#### 2. Dashboard Overview Cards
```html
<div class="dashboard-overview">
  <h1>Dashboard</h1>
  <p class="welcome-message">Welcome to the Financial Management System</p>
  
  <div class="user-greeting">
    <h2>Welcome back, Admin User!</h2>
    <p>Here's an overview of your financial management system</p>
    <div class="user-details">
      <span class="email">admin@example.com</span>
      <span class="role">admin</span>
    </div>
  </div>
  
  <div class="system-overview">
    <h3>System Overview</h3>
    
    <div class="overview-cards">
      <!-- Customers Card -->
      <div class="overview-card">
        <div class="card-icon customers">👥</div>
        <div class="card-content">
          <h4>Customers</h4>
          <p>Manage customer records and relationships</p>
          <div class="card-stats">
            <span class="main-stat">150</span>
            <span class="stat-label">Active Customers</span>
            <span class="total-stat">200 Total</span>
          </div>
        </div>
        <div class="card-arrow">→</div>
      </div>
      
      <!-- Vendors Card -->
      <div class="overview-card">
        <div class="card-icon vendors">🏢</div>
        <div class="card-content">
          <h4>Vendors</h4>
          <p>Manage vendor relationships and procurement</p>
          <div class="card-stats">
            <span class="main-stat">75</span>
            <span class="stat-label">Active Vendors</span>
            <span class="total-stat">95 Total</span>
          </div>
        </div>
        <div class="card-arrow">→</div>
      </div>
      
      <!-- Inventory Card -->
      <div class="overview-card">
        <div class="card-icon inventory">📦</div>
        <div class="card-content">
          <h4>Inventory</h4>
          <p>Track and manage inventory items</p>
          <div class="card-stats">
            <span class="main-stat">1,250</span>
            <span class="stat-label">Items in Stock</span>
            <span class="total-stat">1,500 Total Items</span>
          </div>
        </div>
        <div class="card-arrow">→</div>
      </div>
      
      <!-- Sales Orders Card -->
      <div class="overview-card">
        <div class="card-icon sales">📋</div>
        <div class="card-content">
          <h4>Sales Orders</h4>
          <p>Manage sales order lifecycle</p>
          <div class="card-stats">
            <span class="main-stat">45</span>
            <span class="stat-label">Pending Orders</span>
            <span class="total-stat">320 Total</span>
          </div>
        </div>
        <div class="card-arrow">→</div>
      </div>
      
      <!-- Accounting Card -->
      <div class="overview-card">
        <div class="card-icon accounting">💰</div>
        <div class="card-content">
          <h4>Accounting</h4>
          <p>Financial journals and transactions</p>
          <div class="card-stats">
            <span class="main-stat">₹125,000</span>
            <span class="stat-label">This Month</span>
            <span class="total-stat">₹2.5M Total</span>
          </div>
        </div>
        <div class="card-arrow">→</div>
      </div>
    </div>
  </div>
  
  <!-- Quick Actions -->
  <div class="quick-actions">
    <h3>+ Quick Actions</h3>
    <p>Common tasks and shortcuts</p>
    
    <div class="action-buttons">
      <button class="action-btn customer">
        <div class="btn-icon">👤</div>
        <div class="btn-content">
          <span class="btn-title">Add Customer</span>
          <span class="btn-subtitle">Register a new customer</span>
        </div>
      </button>
      
      <button class="action-btn vendor">
        <div class="btn-icon">🏢</div>
        <div class="btn-content">
          <span class="btn-title">Add Vendor</span>
          <span class="btn-subtitle">Register a new vendor</span>
        </div>
      </button>
      
      <button class="action-btn item">
        <div class="btn-icon">📦</div>
        <div class="btn-content">
          <span class="btn-title">Add Item</span>
          <span class="btn-subtitle">Create new inventory item</span>
        </div>
      </button>
      
      <button class="action-btn sales-order">
        <div class="btn-icon">📋</div>
        <div class="btn-content">
          <span class="btn-title">Create Sales Order</span>
          <span class="btn-subtitle">New customer order</span>
        </div>
      </button>
      
      <button class="action-btn journal">
        <div class="btn-icon">📚</div>
        <div class="btn-content">
          <span class="btn-title">GL Journal</span>
          <span class="btn-subtitle">Record journal entry</span>
        </div>
      </button>
    </div>
  </div>
  
  <!-- Recent Activity -->
  <div class="recent-activity">
    <h3>⚡ Recent Activity</h3>
    <p>Latest transactions and system activities</p>
    <!-- Activity feed content -->
  </div>
</div>
```

#### 3. Form Design Patterns
```html
<!-- Standard Create/Edit Form -->
<div class="form-container">
  <div class="form-header">
    <h2>Create New Customer</h2>
    <p>Enter customer information to create a new customer record</p>
  </div>
  
  <form class="standard-form">
    <div class="form-section">
      <h3>Basic Information</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="name">Customer Name *</label>
          <input type="text" id="name" name="name" placeholder="Enter customer name" required />
        </div>
        
        <div class="form-field">
          <label for="contactNum">Contact Number *</label>
          <input type="tel" id="contactNum" name="contactNum" 
                 placeholder="10-digit phone number" pattern="[0-9]{10}" required />
        </div>
        
        <div class="form-field">
          <label for="email">Email Address</label>
          <input type="email" id="email" name="email" placeholder="customer@example.com" />
        </div>
        
        <div class="form-field">
          <label for="businessType">Business Type</label>
          <select id="businessType" name="businessType">
            <option value="">Select business type</option>
            <option value="Individual">Individual</option>
            <option value="Manufacturing">Manufacturing</option>
            <option value="ServiceProvider">Service Provider</option>
            <option value="Trading">Trading</option>
            <option value="Distributor">Distributor</option>
            <option value="Retailer">Retailer</option>
            <option value="Wholesaler">Wholesaler</option>
          </select>
        </div>
      </div>
    </div>
    
    <div class="form-section">
      <h3>Address Information</h3>
      <div class="form-grid">
        <div class="form-field full-width">
          <label for="street">Street Address</label>
          <input type="text" id="street" name="address.street" placeholder="Enter street address" />
        </div>
        
        <div class="form-field">
          <label for="city">City</label>
          <input type="text" id="city" name="address.city" placeholder="Enter city" />
        </div>
        
        <div class="form-field">
          <label for="state">State</label>
          <input type="text" id="state" name="address.state" placeholder="Enter state" />
        </div>
        
        <div class="form-field">
          <label for="zipCode">ZIP Code</label>
          <input type="text" id="zipCode" name="address.zipCode" placeholder="Enter ZIP code" />
        </div>
        
        <div class="form-field">
          <label for="country">Country</label>
          <select id="country" name="address.country">
            <option value="">Select country</option>
            <option value="India">India</option>
            <option value="USA">United States</option>
            <option value="UK">United Kingdom</option>
          </select>
        </div>
      </div>
    </div>
    
    <div class="form-actions">
      <button type="button" class="btn-secondary">Cancel</button>
      <button type="submit" class="btn-primary">Create Customer</button>
    </div>
  </form>
</div>
```

#### 4. Data Table Design
```html
<!-- Standard Data Table -->
<div class="table-container">
  <div class="table-header">
    <div class="table-title">
      <h2>Customers</h2>
      <p>Manage customer records and relationships</p>
    </div>
    
    <div class="table-actions">
      <div class="search-box">
        <input type="search" placeholder="Search customers..." />
        <button class="search-btn">🔍</button>
      </div>
      
      <div class="filter-controls">
        <select class="filter-select">
          <option value="">All Business Types</option>
          <option value="Trading">Trading</option>
          <option value="Manufacturing">Manufacturing</option>
        </select>
        
        <select class="filter-select">
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      
      <button class="btn-primary">+ Add Customer</button>
    </div>
  </div>
  
  <div class="table-wrapper">
    <table class="data-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Name</th>
          <th>Contact</th>
          <th>Email</th>
          <th>Business Type</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>CUST-000001</td>
          <td>ABC Corporation</td>
          <td>9876543210</td>
          <td>contact@abc.com</td>
          <td><span class="badge trading">Trading</span></td>
          <td><span class="status-badge active">Active</span></td>
          <td>
            <div class="action-buttons">
              <button class="btn-icon" title="View">👁️</button>
              <button class="btn-icon" title="Edit">✏️</button>
              <button class="btn-icon" title="Delete">🗑️</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  
  <div class="table-footer">
    <div class="pagination-info">
      Showing 1-10 of 150 customers
    </div>
    
    <div class="pagination">
      <button class="page-btn" disabled>‹</button>
      <button class="page-btn active">1</button>
      <button class="page-btn">2</button>
      <button class="page-btn">3</button>
      <button class="page-btn">›</button>
    </div>
  </div>
</div>
```

### CSS Framework
```css
/* Component Library */
.btn-primary {
  background: var(--primary-blue);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
}

.btn-secondary {
  background: white;
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.form-field {
  margin-bottom: 20px;
}

.form-field label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: var(--text-primary);
}

.form-field input,
.form-field select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-field input:focus,
.form-field select:focus {
  outline: none;
  border-color: var(--primary-blue);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.overview-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
  transition: all 0.2s;
  cursor: pointer;
}

.overview-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.status-badge {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 0.875rem;
  font-weight: 600;
}

.status-badge.active {
  background: #dcfce7;
  color: #166534;
}

.status-badge.inactive {
  background: #fef2f2;
  color: #991b1b;
}
```

### Responsive Design
```css
/* Mobile-first responsive design */
@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
    transition: transform 0.3s;
  }
  
  .sidebar.open {
    transform: translateX(0);
  }
  
  .overview-cards {
    grid-template-columns: 1fr;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .table-wrapper {
    overflow-x: auto;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .form-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1025px) {
  .overview-cards {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .form-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Implementation Recommendations

1. **Use a Modern CSS Framework**: Consider Tailwind CSS for rapid development
2. **Component Library**: Build reusable React/Vue components
3. **State Management**: Use Redux/Vuex for complex state management
4. **Data Fetching**: Implement proper loading states and error handling
5. **Form Validation**: Use libraries like Formik/VeeValidate for form handling
6. **Responsive Tables**: Consider libraries like react-table for complex tables
7. **Icons**: Use consistent icon libraries like Heroicons or Lucide
8. **Animations**: Add subtle animations for better UX