# ERP Backend Documentation

## Overview
This documentation provides comprehensive information about the ERP backend system built with Node.js, Express, and MongoDB. The system includes modules for Purchase Management, Sales Management, Inventory Management, and General Ledger.

## Documentation Structure

### 📁 Architecture
- System architecture and design patterns
- Database schema and relationships
- API design principles
- Security considerations

### 📁 Modules
- **Purchase Management**: Purchase orders, vendors, procurement workflows
- **Sales Management**: Sales orders, customers, sales workflows  
- **Inventory Management**: Items, inventory dimensions, stock management
- **General Ledger**: Accounts, journal entries, financial transactions

### 📁 Standards
- Coding conventions and best practices
- API design standards
- Database design patterns
- Error handling guidelines

### 📁 API
- REST API documentation
- Endpoint specifications
- Request/response schemas
- Authentication and authorization

### 📁 Deployment
- Environment setup
- Configuration management
- Deployment procedures
- Monitoring and logging

### 📁 Testing
- Testing strategies
- Unit testing guidelines
- Integration testing
- Performance testing

## Quick Start

### Prerequisites
- Node.js (v18+)
- MongoDB (v5+)
- Redis (optional, for caching)

### Installation
```bash
npm install
npm run dev
```

### Environment Variables
Create a `.env` file with required configuration:
```env
PORT=3000
ATLAS_URI=mongodb://localhost:27017/erp_db
SESSION_SECRET=your_secret_key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Current Status
- ✅ Core modules implemented
- 🔄 Code standardization in progress
- 📋 Testing framework setup pending
- 🚀 Production deployment preparation

## Version History
- **v1.0.0** - Initial implementation with basic modules
- **v1.1.0** - Current version with enhanced features (in progress)

---
*Last updated: $(date)*