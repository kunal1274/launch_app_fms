# 🗄️ Aligned Database Reset Guide

## 🎯 **Database Configuration (Aligned)**

### **Environment Variables:**
```env
# use for local testing or dev server testing if mongodb is not installed locally 
LOCAL_MONGODB_URI=mongodb://localhost:27017/fms_test_database

# Development Database (Atlas)
ATLAS_URI_DEV=mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority

# use for deployed on render test server 
ATLAS_URI_TEST=mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-test-db?retryWrites=true&w=majority

# use for deployed on render prod server 
ATLAS_URI_PROD=mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-prod-db?retryWrites=true&w=majority
```

### **Database Names:**
- **Local**: `fms_test_database`
- **Development**: `fms-cloud-dev-db`
- **Test**: `fms-cloud-test-db`
- **Production**: `fms-cloud-prod-db`

## 🚀 **Reset Commands (All Options)**

### **1. Local Database Reset:**
```bash
cd /Users/ratxensolutionspvtltd/Desktop/4_LiveClients/FmsRatxen/launch_app_fms
node scripts/reset-local.js
```

### **2. Development Database Reset:**
```bash
cd /Users/ratxensolutionspvtltd/Desktop/4_LiveClients/FmsRatxen/launch_app_fms
node scripts/reset-atlas-dev.js
```

### **3. Test Database Reset:**
```bash
cd /Users/ratxensolutionspvtltd/Desktop/4_LiveClients/FmsRatxen/launch_app_fms
node scripts/reset-atlas-test.js
```

### **4. Production Database Reset (⚠️ WARNING):**
```bash
cd /Users/ratxensolutionspvtltd/Desktop/4_LiveClients/FmsRatxen/launch_app_fms
node scripts/reset-atlas-prod.js
```

### **5. Generic Reset (with environment variables):**
```bash
# Local database
RESET_TARGET=local node scripts/reset-database.js

# Development database
RESET_TARGET=dev node scripts/reset-database.js

# Test database
RESET_TARGET=test node scripts/reset-database.js

# Production database
RESET_TARGET=prod node scripts/reset-database.js
```

## 📊 **Script Output Examples:**

### **Local Database Reset:**
```
🔄 Connecting to Local MongoDB Database...
ℹ️  Local database does not exist yet - this is normal for a fresh setup
✅ Database will be created when first data is inserted
📊 Database: fms_test_database
🔗 Local MongoDB: localhost:27017
🔌 Database connection closed
🎉 Local database reset completed successfully!
🚀 Ready for fresh local testing!
```

### **Development Database Reset:**
```
🔄 Connecting to Atlas Development Database...
🗑️  Dropping development database...
✅ Development database reset completed successfully!
📊 Database: fms-cloud-dev-db
🔗 Atlas Cluster: scalernodebackend2.pnctyau.mongodb.net
📋 Collections after reset: 0
✅ Database is completely empty and ready for fresh testing!
🔌 Database connection closed
🎉 Development database reset completed successfully!
🚀 Ready for fresh testing!
```

### **Production Database Reset (⚠️ WARNING):**
```
⚠️  WARNING: This will reset the PRODUCTION database!
🔄 Connecting to Atlas Production Database...
🚨 PRODUCTION DATABASE RESET - CONFIRMATION REQUIRED
📊 Database: fms-cloud-prod-db
🔗 Atlas Cluster: scalernodebackend2.pnctyau.mongodb.net
⚠️  This action cannot be undone!
🗑️  Dropping PRODUCTION database...
✅ Production database reset completed successfully!
📊 Database: fms-cloud-prod-db
🔗 Atlas Cluster: scalernodebackend2.pnctyau.mongodb.net
📋 Collections after reset: 0
✅ Database is completely empty and ready for fresh setup!
🔌 Database connection closed
🎉 Production database reset completed successfully!
🚀 Ready for fresh production setup!
```

## ⚙️ **Environment Configuration:**

### **Backend (.env):**
```env
# Database Configuration
LOCAL_MONGODB_URI=mongodb://localhost:27017/fms_test_database
ATLAS_URI_DEV=mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority
ATLAS_URI_TEST=mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-test-db?retryWrites=true&w=majority
ATLAS_URI_PROD=mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-prod-db?retryWrites=true&w=majority

# Default Database (Development)
ATLAS_URI=mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority

# Development Settings
SKIP_EMAIL=true
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
CORS_ALLOW_WILDCARD_DEV=true
```

### **Frontend (.env):**
```env
VITE_API_BASE=http://localhost:3000/fms/api/v0
VITE_PROXY_TARGET=http://localhost:3000
```

## 🧪 **Testing After Reset:**

### **1. Start Services:**
```bash
# Terminal 1: Backend
cd launch_app_fms
npm run dev

# Terminal 2: Frontend
cd fms-dev
npm run dev
```

### **2. Test Scenarios:**
- [ ] User registration
- [ ] OTP login (with SKIP_EMAIL=true)
- [ ] Password login
- [ ] Company management
- [ ] Token persistence

## 📋 **Available Reset Scripts:**

1. **`reset-local.js`** - Local MongoDB database
2. **`reset-atlas-dev.js`** - Development database (Atlas)
3. **`reset-atlas-test.js`** - Test database (Atlas)
4. **`reset-atlas-prod.js`** - Production database (Atlas) ⚠️
5. **`reset-database.js`** - Generic reset with environment variables

## 🚨 **Important Notes:**

### **Database Safety:**
- **Local**: Safe to reset frequently
- **Development**: Safe to reset for testing
- **Test**: Safe to reset for testing
- **Production**: ⚠️ **NEVER reset unless absolutely necessary**

### **Reset Considerations:**
- **Local**: Requires MongoDB running locally
- **Development**: Safe for frequent testing
- **Test**: Safe for deployment testing
- **Production**: ⚠️ **Emergency use only**

### **Troubleshooting:**
```bash
# Check local MongoDB
brew services start mongodb-community

# Check Atlas connection
mongosh "mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority"
```

## ✅ **Quick Reset Commands:**

### **For Development Testing:**
```bash
# Reset development database (recommended)
node scripts/reset-atlas-dev.js
```

### **For Local Testing:**
```bash
# Reset local database
node scripts/reset-local.js
```

### **For Test Server:**
```bash
# Reset test database
node scripts/reset-atlas-test.js
```

### **For Production (⚠️ Emergency Only):**
```bash
# Reset production database
node scripts/reset-atlas-prod.js
```

## 🎯 **Ready for Fresh Testing!**

**All database configurations are now aligned and ready for use!** 🚀

Choose your preferred reset method based on your testing needs:
- **Local**: For offline development
- **Development**: For cloud development testing
- **Test**: For deployment testing
- **Production**: ⚠️ For emergency situations only
