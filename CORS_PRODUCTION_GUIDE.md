# CORS Production Configuration Guide

## ✅ Current Status
CORS is now properly configured for both development and production environments.

## 🔧 Development Configuration

### Backend (.env)
```env
# Development origins
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:5173

# Enable wildcard for development
CORS_ALLOW_WILDCARD_DEV=true
```

### Frontend (.env)
```env
VITE_API_BASE=http://localhost:3000/fms/api/v0
VITE_PROXY_TARGET=http://localhost:3000
```

## 🚀 Production Configuration

### Backend (Render/Heroku/etc.)
```env
# Production origins - ACTUAL DOMAINS
ALLOWED_ORIGINS_PROD=https://launch-fms-test.vercel.app

# Disable wildcard for production
CORS_ALLOW_WILDCARD_DEV=false

# Set environment
NODE_ENV=production
```

### Frontend (Vercel/Netlify/etc.)
```env
VITE_API_BASE=https://fms-qkmw.onrender.com/fms/api/v0
VITE_PROXY_TARGET=https://fms-qkmw.onrender.com
```

## 🔒 Security Features

### Content Security Policy (CSP)
- Configured to allow connections to localhost in development
- Restrictive in production for security
- Allows necessary resources (scripts, styles, images)

### CORS Headers
- `Access-Control-Allow-Origin`: Set based on environment
- `Access-Control-Allow-Credentials`: true (for authentication)
- `Access-Control-Allow-Methods`: GET, POST, PUT, PATCH, DELETE, OPTIONS
- `Access-Control-Allow-Headers`: Content-Type

## 📋 Deployment Checklist

### Backend Deployment
1. ✅ Set `NODE_ENV=production`
2. ✅ Update `ALLOWED_ORIGINS_PROD` with your frontend domain
3. ✅ Set `CORS_ALLOW_WILDCARD_DEV=false`
4. ✅ Verify CSP allows your frontend domain

### Frontend Deployment
1. ✅ Update `VITE_API_BASE` to your backend URL
2. ✅ Update `VITE_PROXY_TARGET` to your backend URL
3. ✅ Test API calls work in production

## 🧪 Testing

### Development
```bash
# Test CORS preflight
curl -X OPTIONS http://localhost:3000/fms/api/v0/otp-auth/send-otp \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST"

# Test actual request
curl -X POST http://localhost:3000/fms/api/v0/otp-auth/send-otp \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"email":"test@example.com","method":"email"}'
```

### Production
Replace `localhost:3000` with your production backend URL.

## 🚨 Common Issues

### "CORS request did not succeed"
- Check if backend is running
- Verify `ALLOWED_ORIGINS` includes your frontend domain
- Check CSP `connect-src` directive

### "Access-Control-Allow-Origin" missing
- Verify CORS middleware is configured
- Check environment variables are loaded
- Restart backend server

### Production deployment issues
- Update `ALLOWED_ORIGINS_PROD` with actual domains
- Set `NODE_ENV=production`
- Verify HTTPS URLs in production

## 📝 Environment Variables Reference

| Variable | Development | Production |
|----------|-------------|------------|
| `NODE_ENV` | `development` | `production` |
| `ALLOWED_ORIGINS` | `http://localhost:5173,...` | `https://your-domain.com` |
| `CORS_ALLOW_WILDCARD_DEV` | `true` | `false` |
| `VITE_API_BASE` | `http://localhost:3000/fms/api/v0` | `https://your-backend.com/fms/api/v0` |
