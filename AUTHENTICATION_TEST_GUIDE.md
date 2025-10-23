# 🧪 Authentication Test Guide - Complete Scenarios

## 🎯 **Authentication Requirements:**

### **1. OTP Login (Universal)**
- ✅ **Works for ALL existing users** (Google, password, or OTP signup)
- ✅ **Creates new users** if they don't exist
- ✅ **Sets signInMethod: "otp"** for new users

### **2. Password Login (Restricted)**
- ✅ **Only works for users with passwords**
- ✅ **Checks user existence first**
- ✅ **Validates password correctly**

### **3. User Creation via OTP**
- ✅ **Creates new users** with `signInMethod: "otp"`
- ✅ **Sets proper user fields** (email, name, isActive, etc.)

## 🧪 **Test Scenarios:**

### **Scenario 1: Existing User with Password (kunal1274@gmail.com)**

#### **Test 1.1: Password Login (Should Work)**
```bash
curl -X POST http://localhost:3000/fms/api/v0/otp-auth/login-password \
  -H "Content-Type: application/json" \
  -d '{"email":"kunal1274@gmail.com","password":"your_password"}'
```

**Expected Result:**
- ✅ User found in database
- ✅ Password verification successful
- ✅ JWT token generated
- ✅ Login successful

#### **Test 1.2: OTP Login (Should Work)**
```bash
# Step 1: Send OTP
curl -X POST http://localhost:3000/fms/api/v0/otp-auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"kunal1274@gmail.com","method":"email"}'

# Step 2: Verify OTP (use OTP from response or email)
curl -X POST http://localhost:3000/fms/api/v0/otp-auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"kunal1274@gmail.com","otp":"123456"}'
```

**Expected Result:**
- ✅ OTP sent to email
- ✅ Existing user verified
- ✅ JWT token generated
- ✅ Login successful

### **Scenario 2: Existing User with OTP Signup (ctrmratxen@gmail.com)**

#### **Test 2.1: OTP Login (Should Work)**
```bash
# Step 1: Send OTP
curl -X POST http://localhost:3000/fms/api/v0/otp-auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"ctrmratxen@gmail.com","method":"email"}'

# Step 2: Verify OTP
curl -X POST http://localhost:3000/fms/api/v0/otp-auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"ctrmratxen@gmail.com","otp":"123456"}'
```

**Expected Result:**
- ✅ OTP sent to email
- ✅ Existing user verified
- ✅ JWT token generated
- ✅ Login successful

#### **Test 2.2: Password Login (Should Fail)**
```bash
curl -X POST http://localhost:3000/fms/api/v0/otp-auth/login-password \
  -H "Content-Type: application/json" \
  -d '{"email":"ctrmratxen@gmail.com","password":"any_password"}'
```

**Expected Result:**
- ❌ "Password not set for this account. Please use OTP login or register first."

### **Scenario 3: New User (Direct OTP Login)**

#### **Test 3.1: New User OTP Login (Should Create User)**
```bash
# Step 1: Send OTP to new email
curl -X POST http://localhost:3000/fms/api/v0/otp-auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@gmail.com","method":"email"}'

# Step 2: Verify OTP
curl -X POST http://localhost:3000/fms/api/v0/otp-auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@gmail.com","otp":"123456"}'
```

**Expected Result:**
- ✅ OTP sent to email
- ✅ New user created in database
- ✅ signInMethod: "otp"
- ✅ JWT token generated
- ✅ Login successful

#### **Test 3.2: New User Password Login (Should Fail)**
```bash
curl -X POST http://localhost:3000/fms/api/v0/otp-auth/login-password \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@gmail.com","password":"any_password"}'
```

**Expected Result:**
- ❌ "Invalid email or password" (user doesn't exist)

## 📊 **Expected Server Logs:**

### **For OTP Login (Existing User):**
```
OTP requested for existing user { email: 'kunal1274@gmail.com', userId: '...', signInMethod: 'password' }
📧 Attempting to send email (attempt 1/3)...
✅ OTP sent via email successfully
Existing user verified via OTP { userId: '...', email: 'kunal1274@gmail.com', signInMethod: 'password' }
```

### **For OTP Login (New User):**
```
OTP requested for new user - will be created after verification { email: 'newuser@gmail.com' }
📧 Attempting to send email (attempt 1/3)...
✅ OTP sent via email successfully
New user created via OTP { userId: '...', email: 'newuser@gmail.com', phoneNumber: null, signInMethod: 'otp' }
```

### **For Password Login:**
```
🔐 Password verification debug: {
  email: 'kunal1274@gmail.com',
  hasPassword: true,
  passwordLength: 60,
  signInMethod: 'password',
  userId: '...'
}
🔐 Password comparison result: true
Password verification successful { email: 'kunal1274@gmail.com', userId: '...', signInMethod: 'password' }
```

## 🔍 **Debugging Commands:**

### **Check User in Database:**
```bash
# Connect to MongoDB and check user
mongosh "mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority"
db.userglobals.find({email: "kunal1274@gmail.com"}).pretty()
db.userglobals.find({email: "ctrmratxen@gmail.com"}).pretty()
```

### **Check OTP Records:**
```bash
db.otps.find({email: "kunal1274@gmail.com"}).pretty()
```

## ✅ **Expected Database States:**

### **After Password Registration (kunal1274@gmail.com):**
```json
{
  "_id": "...",
  "email": "kunal1274@gmail.com",
  "password": "$2a$12$...",
  "signInMethod": "password",
  "isActive": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### **After OTP Signup (ctrmratxen@gmail.com):**
```json
{
  "_id": "...",
  "email": "ctrmratxen@gmail.com",
  "signInMethod": "otp",
  "isActive": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### **After New User OTP Login (newuser@gmail.com):**
```json
{
  "_id": "...",
  "email": "newuser@gmail.com",
  "signInMethod": "otp",
  "name": "newuser",
  "isActive": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```

## 🚀 **Testing Steps:**

### **1. Restart Server:**
```bash
# Stop current server (Ctrl+C)
npm run dev
```

### **2. Test All Scenarios:**
1. **Password login** for kunal1274@gmail.com
2. **OTP login** for kunal1274@gmail.com
3. **OTP login** for ctrmratxen@gmail.com
4. **Password login** for ctrmratxen@gmail.com (should fail)
5. **OTP login** for new email (should create user)

### **3. Check Server Logs:**
- Look for debug messages
- Check email sending attempts
- Verify user creation/verification

### **4. Check Database:**
- Verify user records
- Check signInMethod values
- Confirm OTP records are cleaned up

## ✅ **All Authentication Scenarios Should Work:**

- ✅ **OTP works for ALL users** (existing and new)
- ✅ **Password works only for users with passwords**
- ✅ **New users created via OTP** with correct signInMethod
- ✅ **Proper error messages** for invalid attempts
- ✅ **Email sending** works in development mode

**Test all scenarios and verify the authentication flow works correctly!** 🎉
