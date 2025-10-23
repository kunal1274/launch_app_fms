# CORS Configuration for Production Deployment

This guide explains how to configure CORS for deploying your FMS application with backend on Render and frontend on Vercel.

## Environment Variables Setup

### For Render (Backend Deployment)

Set these environment variables in your Render dashboard:

#### Required Variables:
```bash
NODE_ENV=production
PORT=3000
ATLAS_URI=your_mongodb_connection_string
SESSION_SECRET=your_super_secret_session_key_here
JWT_SECRET=your_jwt_secret_key_here
```

#### CORS Configuration:
```bash
# Development origins (for testing)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:5173

# Production origins (replace with your actual Vercel domain)
ALLOWED_ORIGINS_PROD=https://your-app-name.vercel.app,https://your-custom-domain.com

# Disable wildcard for production
CORS_ALLOW_WILDCARD_DEV=false
```

### For Vercel (Frontend Deployment)

Set these environment variables in your Vercel dashboard:

#### Required Variables:
```bash
# API Configuration
VITE_API_BASE=https://your-render-app-name.onrender.com/fms/api/v0
VITE_PROXY_TARGET=https://your-render-app-name.onrender.com
```

## How the CORS Configuration Works

### Development Mode (`NODE_ENV=development`)
- Uses `ALLOWED_ORIGINS` for specific localhost origins
- If `CORS_ALLOW_WILDCARD_DEV=true`, allows any origin (useful for development)
- Logs all CORS decisions for debugging

### Production Mode (`NODE_ENV=production`)
- Combines `ALLOWED_ORIGINS` and `ALLOWED_ORIGINS_PROD`
- Automatically allows any `*.vercel.app` domain (for Vercel preview deployments)
- Rejects all other origins for security

## Step-by-Step Deployment

### 1. Deploy Backend to Render

1. Connect your GitHub repository to Render
2. Set the environment variables listed above
3. Replace `your-render-app-name` with your actual Render app name
4. Deploy

### 2. Deploy Frontend to Vercel

1. Connect your GitHub repository to Vercel
2. Set the environment variables listed above
3. Replace `your-render-app-name` with your actual Render app name
4. Deploy

### 3. Update CORS Configuration

After getting your Vercel domain, update the `ALLOWED_ORIGINS_PROD` in Render:

```bash
ALLOWED_ORIGINS_PROD=https://your-actual-vercel-domain.vercel.app
```

Then redeploy your backend on Render.

## Testing the Configuration

### Development Testing:
```bash
# Start backend
cd launch_app_fms
npm start

# Start frontend
cd fms-dev
npm run dev
```

### Production Testing:
1. Test your Vercel frontend can connect to Render backend
2. Check browser console for CORS errors
3. Verify API calls work correctly

## Troubleshooting

### Common Issues:

1. **CORS Error in Production**
   - Check that `ALLOWED_ORIGINS_PROD` includes your Vercel domain
   - Ensure `NODE_ENV=production` is set in Render
   - Verify the domain format (include `https://`)

2. **Vercel Preview Deployments**
   - The configuration automatically allows `*.vercel.app` domains
   - No additional configuration needed for preview deployments

3. **API Connection Issues**
   - Verify `VITE_API_BASE` points to your Render backend
   - Check that Render backend is running and accessible

### Debug Mode:
Enable debug logging by setting:
```bash
DEBUG=fms:*
```

This will show detailed CORS decisions in the logs.

## Security Notes

- In production, never set `CORS_ALLOW_WILDCARD_DEV=true`
- Always use HTTPS in production
- Regularly review and update allowed origins
- Monitor logs for rejected CORS requests

## Example Configuration

### Render Environment Variables:
```bash
NODE_ENV=production
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173
ALLOWED_ORIGINS_PROD=https://fms-app.vercel.app,https://fms.yourdomain.com
CORS_ALLOW_WILDCARD_DEV=false
```

### Vercel Environment Variables:
```bash
VITE_API_BASE=https://fms-backend.onrender.com/fms/api/v0
VITE_PROXY_TARGET=https://fms-backend.onrender.com
```
