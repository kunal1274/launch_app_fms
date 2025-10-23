# 🚀 Quick Database Reset Commands

## 🎯 **Atlas Database Reset Options**

### **Option 1: Reset Development Database (Recommended)**
```bash
cd launch_app_fms
node scripts/reset-atlas-dev.js
```

### **Option 2: Reset Test Database**
```bash
cd launch_app_fms
node scripts/reset-atlas-test.js
```

### **Option 3: Manual MongoDB Commands**

#### **Development Database:**
```bash
mongosh "mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority"
db.dropDatabase()
exit
```

#### **Test Database:**
```bash
mongosh "mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-test-db?retryWrites=true&w=majority"
db.dropDatabase()
exit
```

## ⚙️ **Environment Setup**

### **Backend (.env):**
```env
# Database
ATLAS_URI=mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority
DB_NAME=fms-cloud-dev-db

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

## 🧪 **Testing After Reset**

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

## ✅ **Ready for Fresh Testing!**

**Choose your reset method and start testing!** 🚀
