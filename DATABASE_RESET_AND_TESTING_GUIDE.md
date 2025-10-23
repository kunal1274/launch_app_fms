# 🗄️ Database Reset & Fresh Testing Guide

## 🚨 **Important Areas to Consider**

### **1. Database Reset Methods**

#### **Option A: Complete Database Reset (Recommended)**
```bash
# Connect to MongoDB and drop all collections
mongo
use fms_ratxen
db.dropDatabase()
```

#### **Option B: Individual Collection Reset**
```bash
# Reset specific collections
db.users.deleteMany({})
db.companies.deleteMany({})
db.otps.deleteMany({})
db.items.deleteMany({})
db.customers.deleteMany({})
db.vendors.deleteMany({})
db.salesorders.deleteMany({})
db.purchaseorders.deleteMany({})
```

#### **Option C: Development Database Reset**
```bash
# If using separate dev database
mongo
use fms_ratxen_dev
db.dropDatabase()
```

### **2. Environment Configuration**

#### **Backend Environment Variables:**
```env
# Database
MONGODB_URI=mongodb://localhost:27017/fms_ratxen
DB_NAME=fms_ratxen

# Authentication
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
SKIP_EMAIL=true  # For testing without email sending

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
CORS_ALLOW_WILDCARD_DEV=true
NODE_ENV=development
```

#### **Frontend Environment Variables:**
```env
# API Configuration
VITE_API_BASE=http://localhost:3000/fms/api/v0
VITE_PROXY_TARGET=http://localhost:3000

# Environment
NODE_ENV=development
```

### **3. Key Changes Since Last Reset**

#### **🔐 Authentication System:**
- **Dual Login Methods**: OTP + Password login
- **Email Retry Logic**: 3 attempts with exponential backoff
- **Development Mode**: Skip email sending with `SKIP_EMAIL=true`
- **Token Persistence**: Fixed localStorage token handling
- **User Registration**: Email/password registration flow

#### **📧 Email System:**
- **User-Friendly Templates**: Professional OTP email design
- **Retry Mechanism**: Automatic retry on email failures
- **Fallback Response**: Return OTP in response if email fails
- **Development Bypass**: Skip email sending in dev mode

#### **🎨 Frontend Components:**
- **Custom Confirmation Dialogs**: Replaced browser confirm dialogs
- **Modal Improvements**: Fixed height and scrolling issues
- **Form Validation**: Enhanced error handling
- **Loading States**: Better user feedback

#### **🔧 API Improvements:**
- **RTK Query Integration**: Consolidated API endpoints
- **Error Handling**: Improved error messages
- **Token Management**: Proper JWT handling
- **CORS Configuration**: Dynamic CORS for dev/prod

### **4. Testing Checklist**

#### **🔐 Authentication Testing:**

**User Registration:**
- [ ] Create new user with email/password
- [ ] Verify user data in database
- [ ] Test password hashing
- [ ] Verify JWT token generation

**OTP Login:**
- [ ] Send OTP to email (with `SKIP_EMAIL=true`)
- [ ] Verify OTP in database
- [ ] Test OTP verification
- [ ] Test token generation

**Password Login:**
- [ ] Login with email/password
- [ ] Test invalid credentials
- [ ] Test user without password
- [ ] Verify token generation

**Token Persistence:**
- [ ] Refresh page - should stay logged in
- [ ] Close browser - should stay logged in
- [ ] Test token expiration
- [ ] Test logout functionality

#### **📧 Email System Testing:**

**With SKIP_EMAIL=true:**
- [ ] OTP generation works
- [ ] OTP returned in response
- [ ] No email sending attempted
- [ ] Database OTP storage works

**With SKIP_EMAIL=false:**
- [ ] Email sending attempts (3 retries)
- [ ] Fallback response with OTP
- [ ] Error handling for email failures
- [ ] Database OTP storage works

#### **🎨 UI/UX Testing:**

**Login Flow:**
- [ ] Method selection (OTP/Password)
- [ ] Form validation
- [ ] Error messages
- [ ] Loading states
- [ ] Navigation between steps

**Company Management:**
- [ ] Add new company
- [ ] Edit company details
- [ ] Delete company (custom dialog)
- [ ] Bulk delete companies
- [ ] Data refresh after operations

**Modal Components:**
- [ ] Height and scrolling
- [ ] Button visibility
- [ ] Form submission
- [ ] Close functionality

### **5. Database Schema Verification**

#### **User Collection:**
```javascript
{
  _id: ObjectId,
  email: String (unique, lowercase),
  name: String,
  password: String (bcrypt hashed),
  role: String (default: 'user'),
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

#### **OTP Collection:**
```javascript
{
  _id: ObjectId,
  email: String,
  phoneNumber: String,
  otp: String,
  method: String ('email', 'sms', 'whatsapp'),
  otpType: String ('numeric', 'alphanumeric'),
  expiresAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### **Company Collection:**
```javascript
{
  _id: ObjectId,
  companyCode: String (unique),
  companyName: String,
  contactPerson: String,
  email: String,
  phone: String,
  address: Object,
  status: String ('active', 'inactive'),
  createdAt: Date,
  updatedAt: Date
}
```

### **6. Pre-Testing Setup**

#### **Backend Setup:**
```bash
cd launch_app_fms
npm install
# Set environment variables
cp "env copy" .env
# Start server
npm run dev
```

#### **Frontend Setup:**
```bash
cd fms-dev
npm install
# Set environment variables
echo "VITE_API_BASE=http://localhost:3000/fms/api/v0" > .env
# Start development server
npm run dev
```

### **7. Testing Scenarios**

#### **Scenario 1: New User Registration**
1. Go to `/register`
2. Fill registration form
3. Submit form
4. Verify user in database
5. Test login with password

#### **Scenario 2: OTP Login (Development Mode)**
1. Go to `/login`
2. Select "OTP Login"
3. Enter email
4. Click "Send OTP"
5. Verify OTP in response
6. Enter OTP manually
7. Verify login success

#### **Scenario 3: Password Login**
1. Go to `/login`
2. Select "Password Login"
3. Enter email and password
4. Click "Sign In"
5. Verify login success

#### **Scenario 4: Company Management**
1. Login to dashboard
2. Go to Companies
3. Add new company
4. Edit company details
5. Delete company (test custom dialog)
6. Verify data refresh

### **8. Common Issues & Solutions**

#### **Issue: OTP Not Working**
**Solution:**
- Set `SKIP_EMAIL=true` in backend
- Check OTP in response
- Verify database OTP storage

#### **Issue: CORS Errors**
**Solution:**
- Check `ALLOWED_ORIGINS` in backend
- Verify frontend URL in CORS config
- Test with `CORS_ALLOW_WILDCARD_DEV=true`

#### **Issue: Token Persistence**
**Solution:**
- Check localStorage in browser
- Verify token in Redux store
- Test page refresh

#### **Issue: Modal Issues**
**Solution:**
- Check modal height settings
- Verify button visibility
- Test scrolling behavior

### **9. Post-Reset Verification**

#### **Database Verification:**
```bash
# Check collections exist
mongo
use fms_ratxen
show collections

# Check user collection
db.users.find().pretty()

# Check OTP collection
db.otps.find().pretty()
```

#### **API Verification:**
```bash
# Test health endpoint
curl http://localhost:3000/fms/api/v0/health

# Test OTP endpoint
curl -X POST http://localhost:3000/fms/api/v0/otp-auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","method":"email"}'
```

#### **Frontend Verification:**
- [ ] Login page loads
- [ ] Registration page loads
- [ ] Dashboard loads after login
- [ ] Company management works
- [ ] No console errors

### **10. Monitoring & Debugging**

#### **Backend Logs:**
```bash
# Check server logs
tail -f logs/error.log
tail -f logs/combined.log

# Check console output
# Look for authentication logs
# Check email sending logs
```

#### **Frontend Debugging:**
```javascript
// Check Redux store
console.log(store.getState())

// Check localStorage
console.log(localStorage.getItem('token'))
console.log(localStorage.getItem('user'))

// Check API calls
// Open Network tab in DevTools
```

### **11. Rollback Plan**

#### **If Issues Occur:**
1. **Database Rollback:**
   ```bash
   # Restore from backup if available
   mongorestore --db fms_ratxen backup/
   ```

2. **Code Rollback:**
   ```bash
   # Revert to previous commit
   git reset --hard HEAD~1
   git push --force-with-lease
   ```

3. **Environment Rollback:**
   ```bash
   # Revert environment variables
   # Check previous working configuration
   ```

### **✅ Ready for Fresh Testing!**

**The system is now ready for comprehensive testing with:**
- ✅ Clean database
- ✅ Updated authentication system
- ✅ Dual login methods
- ✅ Improved UI components
- ✅ Better error handling
- ✅ Enhanced user experience

**Start testing with the scenarios above and monitor for any issues!** 🚀
