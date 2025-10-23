# ✅ Fresh Testing Checklist

## 🚀 **Pre-Testing Setup**

### **1. Database Reset**
```bash
# Option A: Use the reset script
cd launch_app_fms
node scripts/reset-database.js

# Option B: Manual MongoDB reset
mongo
use fms_ratxen
db.dropDatabase()
exit
```

### **2. Environment Configuration**
```bash
# Backend (.env)
SKIP_EMAIL=true
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
CORS_ALLOW_WILDCARD_DEV=true

# Frontend (.env)
VITE_API_BASE=http://localhost:3000/fms/api/v0
VITE_PROXY_TARGET=http://localhost:3000
```

### **3. Start Services**
```bash
# Terminal 1: Backend
cd launch_app_fms
npm run dev

# Terminal 2: Frontend
cd fms-dev
npm run dev
```

## 🧪 **Testing Scenarios**

### **Scenario 1: User Registration**
- [ ] Navigate to `/register`
- [ ] Fill form: email, name, password, confirm password
- [ ] Submit form
- [ ] Verify success message
- [ ] Check database for new user
- [ ] Verify password is hashed

### **Scenario 2: OTP Login (Development Mode)**
- [ ] Navigate to `/login`
- [ ] Select "OTP Login" method
- [ ] Enter email: `test@example.com`
- [ ] Click "Send OTP"
- [ ] Verify OTP in response (not email)
- [ ] Enter OTP manually
- [ ] Click "Verify OTP"
- [ ] Verify login success and redirect to dashboard

### **Scenario 3: Password Login**
- [ ] Navigate to `/login`
- [ ] Select "Password Login" method
- [ ] Enter email: `test@example.com`
- [ ] Enter password
- [ ] Click "Sign In"
- [ ] Verify login success and redirect to dashboard

### **Scenario 4: Token Persistence**
- [ ] Login successfully
- [ ] Refresh browser page
- [ ] Verify still logged in
- [ ] Close browser and reopen
- [ ] Navigate to app URL
- [ ] Verify still logged in

### **Scenario 5: Company Management**
- [ ] Login to dashboard
- [ ] Navigate to Companies
- [ ] Click "Add New Company"
- [ ] Fill company form
- [ ] Submit form
- [ ] Verify company appears in list
- [ ] Test edit company
- [ ] Test delete company (custom dialog)
- [ ] Verify data refresh after operations

### **Scenario 6: Error Handling**
- [ ] Test invalid email format
- [ ] Test invalid OTP
- [ ] Test invalid password
- [ ] Test network errors
- [ ] Verify error messages are user-friendly

## 🔍 **Key Areas to Test**

### **Authentication System**
- [ ] **Dual Login Methods**: Both OTP and Password work
- [ ] **Method Switching**: Can switch between methods
- [ ] **Token Generation**: JWT tokens created correctly
- [ ] **Token Storage**: Tokens stored in localStorage
- [ ] **Token Persistence**: Tokens persist across sessions

### **Email System**
- [ ] **Development Mode**: `SKIP_EMAIL=true` works
- [ ] **OTP Generation**: OTPs generated and stored
- [ ] **Response Handling**: OTP returned in response
- [ ] **Error Handling**: Graceful email failure handling

### **UI/UX Components**
- [ ] **Modal Functionality**: Add/Edit company modals work
- [ ] **Custom Dialogs**: Delete confirmations work
- [ ] **Form Validation**: Input validation works
- [ ] **Loading States**: Loading indicators show
- [ ] **Error Messages**: Clear error messages

### **API Integration**
- [ ] **RTK Query**: API calls work correctly
- [ ] **Error Handling**: API errors handled gracefully
- [ ] **Data Refresh**: Data updates after operations
- [ ] **CORS**: No CORS errors in console

## 🐛 **Common Issues to Watch For**

### **Backend Issues**
- [ ] **Database Connection**: MongoDB connection works
- [ ] **Email Configuration**: Email settings correct
- [ ] **CORS Configuration**: CORS allows frontend
- [ ] **JWT Secret**: JWT secret is set
- [ ] **Port Conflicts**: No port conflicts

### **Frontend Issues**
- [ ] **API Base URL**: Correct API endpoint
- [ ] **Environment Variables**: All env vars set
- [ ] **Redux Store**: Store state management
- [ ] **Local Storage**: Token storage works
- [ ] **Routing**: Navigation works correctly

### **Integration Issues**
- [ ] **Authentication Flow**: End-to-end auth works
- [ ] **Data Persistence**: Data saves correctly
- [ ] **Error Propagation**: Errors show in UI
- [ ] **Loading States**: UI responds to API calls

## 📊 **Success Criteria**

### **Must Work**
- [ ] User registration creates account
- [ ] OTP login works (with SKIP_EMAIL=true)
- [ ] Password login works
- [ ] Token persistence across sessions
- [ ] Company CRUD operations work
- [ ] Custom dialogs work
- [ ] No console errors

### **Should Work**
- [ ] Method switching between OTP/Password
- [ ] Form validation and error messages
- [ ] Loading states and user feedback
- [ ] Data refresh after operations
- [ ] Responsive UI components

### **Nice to Have**
- [ ] Smooth animations
- [ ] Professional error messages
- [ ] Fast loading times
- [ ] Intuitive user flow

## 🚨 **Rollback Plan**

### **If Critical Issues Found**
1. **Stop Services**: `Ctrl+C` on both terminals
2. **Check Logs**: Review error logs
3. **Database Check**: Verify database state
4. **Environment Check**: Verify all env vars
5. **Code Check**: Verify all files are correct

### **If Database Issues**
```bash
# Reset database again
node scripts/reset-database.js

# Or manual reset
mongo
use fms_ratxen
db.dropDatabase()
exit
```

### **If Code Issues**
```bash
# Check git status
git status

# Revert if needed
git checkout -- .

# Restart services
npm run dev
```

## ✅ **Testing Complete Checklist**

- [ ] All authentication flows work
- [ ] All CRUD operations work
- [ ] No console errors
- [ ] No network errors
- [ ] UI components function correctly
- [ ] Data persists correctly
- [ ] Error handling works
- [ ] User experience is smooth

## 🎉 **Ready for Production**

Once all tests pass:
- [ ] Deploy backend to Render
- [ ] Deploy frontend to Vercel
- [ ] Set production environment variables
- [ ] Test production deployment
- [ ] Monitor for issues

**Happy Testing!** 🚀
