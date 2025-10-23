# 📚 FMS (Financial Management System) - Complete Documentation Suite

## 🎯 Overview

This repository contains comprehensive documentation for the **Financial Management System (FMS)**, a full-stack business management application built with Node.js, Express.js, MongoDB, and modern frontend technologies. The documentation includes API references, data models, component libraries, integration guides, and UI design patterns based on the clean, professional dashboard approach shown in your reference image.

## 📖 Documentation Structure

### 📋 Core Documentation Files

| Document | Description | Key Features |
|----------|-------------|--------------|
| **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** | Complete REST API reference with examples | Authentication, CRUD operations, error handling |
| **[MODELS_DOCUMENTATION.md](./MODELS_DOCUMENTATION.md)** | Comprehensive data model specifications | Schema definitions, relationships, validation |
| **[COMPONENTS_DOCUMENTATION.md](./COMPONENTS_DOCUMENTATION.md)** | Reusable components and utilities | Middleware, services, React components |
| **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** | Practical integration examples and workflows | Real-world scenarios, performance optimization |

## 🏗️ System Architecture

### 🔧 Technology Stack
- **Backend**: Node.js with Express.js framework
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT + Passport.js + Google OAuth
- **Security**: Helmet, XSS protection, rate limiting
- **File Management**: Multer-based uploads
- **Logging**: Winston with daily rotation
- **Testing**: Jest with MongoDB Memory Server

### 🏢 Service Architecture
```
FMS System
├── BB0 (Core Services)
│   ├── Account Management Service
│   ├── Accounts Receivable Service
│   └── Shared Management Service
├── BB1 (Business Services)
│   ├── Customer Management
│   ├── Inventory Management
│   ├── Sales Management
│   └── Company Management
├── BB3 (Extended Services)
│   ├── Purchase Management
│   └── Advanced Sales Features
├── Shared Services
│   ├── File Upload Service
│   ├── Email Service
│   └── Authentication Service
└── Support Services
    ├── Role-Based Access Control
    ├── Audit Logging
    └── AI Integration (ChatGPT)
```

## 🎨 UI Design Guidelines

### Design Philosophy
Based on your school management dashboard reference, the FMS system follows these design principles:

#### ✨ Visual Design Principles
- **Clean & Minimal**: White backgrounds with subtle shadows and borders
- **Card-Based Layout**: Information organized in clean, clickable cards
- **Consistent Typography**: Modern sans-serif fonts with clear hierarchy
- **Professional Color Scheme**: Blue primary, green secondary, with accent colors
- **Intuitive Navigation**: Left sidebar with organized sections

#### 🎨 Color Palette
```css
:root {
  --primary-blue: #2563eb;      /* Main actions, links */
  --secondary-green: #10b981;   /* Success states, positive actions */
  --accent-purple: #8b5cf6;     /* Special features, highlights */
  --accent-orange: #f59e0b;     /* Warnings, pending states */
  --neutral-gray: #6b7280;      /* Secondary text, borders */
  --background-light: #f8fafc;  /* Page backgrounds */
  --card-background: #ffffff;   /* Card/content backgrounds */
  --text-primary: #1f2937;      /* Main text */
  --text-secondary: #6b7280;    /* Secondary text */
  --border-light: #e5e7eb;      /* Borders, dividers */
}
```

### 📱 Layout Structure

#### Dashboard Overview Cards
Following the school management pattern with sections for:
- **Customers** (like Students) - Customer records and relationships
- **Vendors** (like Teachers) - Vendor management and procurement
- **Inventory** (like Transport) - Stock and warehouse management
- **Sales Orders** - Order lifecycle management
- **Accounting** (like Fee Management) - Financial journals and transactions

#### Navigation Structure
```
📊 Dashboard
├── 👥 Core Modules
│   ├── Customers
│   ├── Vendors
│   ├── Items
│   └── Companies
├── 💰 Sales & Procurement
│   ├── Sales Orders
│   └── Purchase Orders
├── 📦 Inventory
│   ├── Warehouses
│   ├── Locations
│   └── Stock Balance
└── 📚 Accounting
    ├── Accounts
    ├── GL Journals
    └── Banks
```

## 🚀 Quick Start Guide

### 1. Environment Setup
```bash
# Clone the repository
git clone <repository-url>
cd fms-backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configurations

# Start MongoDB
mongod

# Run the application
npm run dev
```

### 2. Key Environment Variables
```bash
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/fms_dev
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## 📊 Core Features & APIs

### 🧑‍💼 Customer Management
- **CRUD Operations**: Create, read, update, delete customers
- **Global Party Integration**: Unified party management system
- **Business Type Classification**: Individual, Manufacturing, Trading, etc.
- **Contact Management**: Multiple contact persons and addresses
- **Financial Integration**: Credit limits, payment terms

### 📦 Inventory Management
- **Multi-level Storage**: Sites → Warehouses → Zones → Locations → Racks → Shelves → Bins
- **Product Dimensions**: Configuration, Color, Size, Style, Version
- **Tracking Dimensions**: Batch and Serial number tracking
- **Stock Management**: Real-time balance, reservations, transactions

### 💼 Sales Order Management
- **Complete Order Lifecycle**: Draft → Approved → Shipped → Delivered → Invoiced
- **Line Item Management**: Multiple items per order with dimensions
- **Pricing & Discounts**: Line-level and order-level discounts
- **File Attachments**: Document management with orders
- **Email Integration**: Automated confirmation emails

### 💰 Accounting Module
- **Chart of Accounts**: Hierarchical account structure
- **General Ledger**: Double-entry journal system
- **Journal Templates**: Reusable journal entry templates
- **Bank Management**: Multiple bank account support

## 🔐 Authentication & Security

### JWT Authentication Flow
```javascript
// Login Request
POST /fms/api/v0/auth/login
{
  "email": "user@example.com",
  "password": "password"
}

// Response
{
  "status": "success",
  "data": {
    "user": { "id": "...", "name": "...", "role": "..." },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}

// Authenticated Requests
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Security Features
- **JWT Token Authentication** with 7-day expiry
- **Role-Based Access Control** (Admin, Manager, User)
- **Rate Limiting**: 100 requests per 30 minutes
- **XSS Protection**: Input sanitization
- **CORS Configuration**: Specific origin allowlist
- **Password Hashing**: bcrypt with 12 rounds

## 📡 API Examples

### Customer API
```javascript
// Create Customer
POST /fms/api/v0/customers
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
  }
}

// Get Customers with Filters
GET /fms/api/v0/customers?page=1&limit=10&businessType=Trading&isActive=true

// Update Customer
PUT /fms/api/v0/customers/60f7d1234567890abcdef123
{
  "creditLimit": 150000,
  "paymentTerms": "Net 60"
}
```

### Sales Order API
```javascript
// Create Sales Order
POST /fms/api/v0/salesorders
{
  "customerId": "60f7d1234567890abcdef123",
  "orderDate": "2023-07-20",
  "requiredDate": "2023-07-30",
  "salesOrderLines": [
    {
      "itemId": "60f7d1234567890abcdef456",
      "quantity": 10,
      "unitPrice": 100.00
    }
  ]
}
```

## 🧩 Reusable Components

### React Components
- **DashboardCard**: Overview statistics cards
- **DataTable**: Sortable, filterable tables with pagination
- **Form**: Dynamic form generator with validation
- **FileUpload**: Multi-file upload with progress tracking

### Backend Utilities
- **Logger**: Winston-based structured logging
- **Error Handler**: Standardized error responses
- **File Service**: Multer-based file management
- **Email Service**: Nodemailer email notifications

## 📈 Performance Optimizations

### Database Optimization
- **Indexes**: Strategic indexing on frequently queried fields
- **Lean Queries**: Using `.lean()` for read-only operations
- **Pagination**: Efficient pagination with count optimization
- **Aggregation**: Complex queries using MongoDB aggregation pipeline

### Frontend Optimization
- **API Caching**: 5-minute cache for static data
- **Lazy Loading**: Code splitting for route-based loading
- **Memoization**: React.memo for expensive components
- **Debouncing**: Search input debouncing

## 🔧 Development Workflow

### Code Organization
```
src/
├── controllers/     # Business logic
├── models/         # Data models
├── routes/         # API endpoints
├── middleware/     # Custom middleware
├── services/       # External services
├── utilities/      # Helper functions
└── components/     # Reusable UI components
```

### Testing Strategy
- **Unit Tests**: Jest for individual functions
- **Integration Tests**: API endpoint testing
- **Database Tests**: MongoDB Memory Server
- **Frontend Tests**: React Testing Library

## 📝 Best Practices

### API Design
- **RESTful Endpoints**: Standard HTTP methods and status codes
- **Consistent Response Format**: Standardized success/error responses
- **Input Validation**: Comprehensive validation with clear error messages
- **Documentation**: Complete OpenAPI/Swagger documentation

### UI/UX Design
- **Responsive Design**: Mobile-first approach
- **Loading States**: Clear feedback during async operations
- **Error Handling**: User-friendly error messages
- **Accessibility**: WCAG 2.1 compliance

## 🚀 Deployment

### Production Setup
```bash
# Build for production
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Environment variables
NODE_ENV=production
MONGODB_URI=mongodb://prod-server:27017/fms_prod
JWT_SECRET=secure_production_secret
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📞 Support & Contributing

### Getting Help
- 📖 **Documentation**: Check the relevant documentation files
- 🐛 **Issues**: Create GitHub issues for bugs
- 💡 **Features**: Submit feature requests
- 📧 **Contact**: Reach out to the development team

### Contributing Guidelines
1. Fork the repository
2. Create a feature branch
3. Follow coding standards
4. Write tests for new features
5. Submit a pull request

## 📄 License

This project is proprietary software developed by **Ratxen Solutions Private Limited**. All rights reserved.

---

**Note**: This documentation provides a comprehensive overview of the FMS system with design patterns similar to your school management dashboard reference. The clean, professional interface with card-based layouts, consistent navigation, and modern styling creates an excellent user experience for business management applications.

For specific implementation details, refer to the individual documentation files listed above. Each file contains detailed examples, code snippets, and best practices for implementing the respective components.