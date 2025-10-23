# 🗄️ Atlas Database Reset Guide

## 🎯 **Database Configuration**

### **Atlas URIs:**
```env
# Development Database
ATLAS_URI_DEV=mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority

# Test Database  
ATLAS_URI_TEST=mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-test-db?retryWrites=true&w=majority
```

### **Database Names:**
- **Development**: `fms-cloud-dev-db`
- **Test**: `fms-cloud-test-db`

## 🔄 **Reset Methods**

### **Method 1: Using Reset Script (Recommended)**

#### **Reset Development Database:**
```bash
cd launch_app_fms
RESET_TARGET=dev node scripts/reset-database.js
```

#### **Reset Test Database:**
```bash
cd launch_app_fms
RESET_TARGET=test node scripts/reset-database.js
```

#### **Reset with Environment Variables:**
```bash
# Set environment variables
export ATLAS_URI_DEV="mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority"
export ATLAS_URI_TEST="mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-test-db?retryWrites=true&w=majority"

# Reset development database
RESET_TARGET=dev node scripts/reset-database.js

# Reset test database
RESET_TARGET=test node scripts/reset-database.js
```

### **Method 2: Manual MongoDB Commands**

#### **Connect to Development Database:**
```bash
mongosh "mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority"
```

#### **Connect to Test Database:**
```bash
mongosh "mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-test-db?retryWrites=true&w=majority"
```

#### **Reset Commands:**
```javascript
// Drop entire database
db.dropDatabase()

// Or reset specific collections
db.users.deleteMany({})
db.companies.deleteMany({})
db.otps.deleteMany({})
db.items.deleteMany({})
db.customers.deleteMany({})
db.vendors.deleteMany({})
db.salesorders.deleteMany({})
db.purchaseorders.deleteMany({})

// Exit
exit
```

### **Method 3: Using MongoDB Compass**

1. **Connect to Atlas Cluster**
2. **Navigate to Database**
3. **Right-click on Database**
4. **Select "Drop Database"**
5. **Confirm Deletion**

## ⚙️ **Environment Configuration**

### **Backend Environment (.env):**
```env
# Database Configuration
MONGODB_URI=mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority
DB_NAME=fms-cloud-dev-db

# Alternative URIs for different environments
ATLAS_URI_DEV=mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority
ATLAS_URI_TEST=mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-test-db?retryWrites=true&w=majority

# Development Settings
SKIP_EMAIL=true
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
CORS_ALLOW_WILDCARD_DEV=true

# Authentication
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### **Frontend Environment (.env):**
```env
# API Configuration
VITE_API_BASE=http://localhost:3000/fms/api/v0
VITE_PROXY_TARGET=http://localhost:3000

# Environment
NODE_ENV=development
```

## 🧪 **Testing After Reset**

### **1. Verify Database Reset:**
```bash
# Check if database is empty
mongosh "mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority"
db.stats()
show collections
exit
```

### **2. Test Application:**
```bash
# Start backend
cd launch_app_fms
npm run dev

# Start frontend (new terminal)
cd fms-dev
npm run dev
```

### **3. Test Scenarios:**
- [ ] User registration
- [ ] OTP login (with SKIP_EMAIL=true)
- [ ] Password login
- [ ] Company management
- [ ] Token persistence

## 🔧 **Reset Script Usage**

### **Basic Usage:**
```bash
# Reset development database (default)
node scripts/reset-database.js

# Reset test database
RESET_TARGET=test node scripts/reset-database.js
```

### **Advanced Usage:**
```bash
# With custom environment variables
ATLAS_URI_DEV="your_dev_uri" ATLAS_URI_TEST="your_test_uri" RESET_TARGET=dev node scripts/reset-database.js
```

### **Script Output:**
```
🔄 Connecting to MongoDB...
🗑️  Dropping database...
✅ Database reset completed successfully!
📊 Database: fms-cloud-dev-db
🎯 Target: dev
🔗 Connection: mongodb+srv://***:***@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority
📋 Collections after reset: 0
✅ Database is completely empty and ready for fresh testing!
🔌 Database connection closed
🎉 Database reset completed successfully!
```

## 🚨 **Important Notes**

### **Database Safety:**
- **Backup First**: Always backup important data before reset
- **Environment Check**: Verify you're resetting the correct database
- **Credentials**: Keep Atlas credentials secure
- **Network**: Ensure stable internet connection

### **Reset Considerations:**
- **Development**: Safe to reset frequently
- **Test**: Safe to reset for testing
- **Production**: Never reset production database
- **Backup**: Consider creating backups before major resets

### **Troubleshooting:**
```bash
# Check connection
mongosh "mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority"

# Check database status
db.adminCommand("listDatabases")

# Check collections
show collections

# Check specific collection
db.users.find().limit(5)
```

## ✅ **Post-Reset Verification**

### **1. Database Verification:**
- [ ] Database is empty
- [ ] No collections exist
- [ ] Connection works
- [ ] No errors in logs

### **2. Application Verification:**
- [ ] Backend starts without errors
- [ ] Frontend connects to backend
- [ ] No CORS errors
- [ ] Authentication works
- [ ] CRUD operations work

### **3. Fresh Testing:**
- [ ] User registration works
- [ ] Login methods work
- [ ] Company management works
- [ ] No console errors
- [ ] All features functional

## 🎯 **Quick Reset Commands**

### **Development Database:**
```bash
cd launch_app_fms
RESET_TARGET=dev node scripts/reset-database.js
```

### **Test Database:**
```bash
cd launch_app_fms
RESET_TARGET=test node scripts/reset-database.js
```

### **Manual Reset:**
```bash
mongosh "mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority"
db.dropDatabase()
exit
```

**Ready for fresh testing with the correct Atlas database configuration!** 🚀
