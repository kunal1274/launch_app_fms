# Test Scripts

This directory contains scripts to help you test and run the FMS application.

## Available Scripts

### 1. `setup-frontend.sh`
Sets up the frontend development environment.

**Usage:**
```bash
./test-scripts/setup-frontend.sh
```

**What it does:**
- Checks Node.js and npm versions
- Installs frontend dependencies
- Creates `.env` file with default configuration
- Tests the build process
- Provides next steps

### 2. `start-dev-servers.sh`
Starts both backend and frontend development servers simultaneously.

**Usage:**
```bash
./test-scripts/start-dev-servers.sh
```

**What it does:**
- Kills any existing processes on ports 3000 and 5173
- Starts the backend server (port 3000)
- Starts the frontend server (port 5173)
- Provides URLs and helpful tips
- Handles graceful shutdown with Ctrl+C

### 3. `test-frontend-backend.js`
Integration test script that verifies the API endpoints used by the frontend.

**Usage:**
```bash
node test-scripts/test-frontend-backend.js
```

**What it tests:**
- Backend health check
- Accounts API endpoint
- GL Journals creation
- Response validation
- Frontend accessibility

## Quick Start

### Option 1: Automated Setup
```bash
# Setup frontend
./test-scripts/setup-frontend.sh

# Start both servers
./test-scripts/start-dev-servers.sh
```

### Option 2: Manual Setup
```bash
# Terminal 1 - Backend
npm start

# Terminal 2 - Frontend
cd workspace/frontend
npm install
npm run dev
```

## Testing the Integration

1. **Start both servers** using one of the methods above
2. **Run integration tests:**
   ```bash
   node test-scripts/test-frontend-backend.js
   ```
3. **Open the frontend** in your browser: http://localhost:5173
4. **Test the features:**
   - Navigate to `/accounts` to see ledger accounts
   - Navigate to `/journals` to create and post journals

## Troubleshooting

### Common Issues

1. **Port already in use**
   - The scripts automatically kill existing processes
   - If issues persist, manually kill processes:
     ```bash
     lsof -ti :3000 | xargs kill -9
     lsof -ti :5173 | xargs kill -9
     ```

2. **Frontend dependencies not installed**
   - Run: `./test-scripts/setup-frontend.sh`
   - Or manually: `cd workspace/frontend && npm install`

3. **Backend not starting**
   - Check if MongoDB is running
   - Verify `.env` file configuration
   - Check logs for specific errors

4. **API connection issues**
   - Ensure backend is running on port 3000
   - Check CORS configuration
   - Verify API routes match frontend expectations

### Debug Mode

Enable debug logging for more detailed information:

```bash
# Backend with debug
DEBUG=fms:* npm start

# Frontend (check browser console)
# Open browser dev tools and check Network tab
```

## Environment Configuration

### Backend (.env)
```env
NODE_ENV=development
PORT=3000
ATLAS_URI=your_mongodb_connection_string
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend (.env)
```env
VITE_API_BASE=/fms/api/v0
VITE_PROXY_TARGET=http://localhost:3000
```

## API Endpoints Tested

The integration test verifies these endpoints:

- `GET /fms/api/v0/health` - Backend health check
- `GET /fms/api/v0/accounts` - Fetch ledger accounts
- `POST /fms/api/v0/gl-journals` - Create GL journals
- `POST /fms/api/v0/gl-journals/{id}/post` - Post journals
- `GET /fms/api/v0/subledgers` - Fetch subledger transactions

## Frontend Features

The frontend includes:

1. **Dashboard** (`/`) - Overview with statistics
2. **Accounts Page** (`/accounts`) - View and manage ledger accounts
3. **Journals Page** (`/journals`) - Create and post GL journals
4. **Responsive Design** - Mobile-friendly interface
5. **Real-time Validation** - Balance checking for journals

## Development Workflow

1. **Make backend changes** - Update API endpoints
2. **Test with integration script** - Verify API functionality
3. **Update frontend** - Modify UI to use new endpoints
4. **Test full integration** - Verify end-to-end functionality

## Production Deployment

### Frontend Build
```bash
cd workspace/frontend
npm run build
# Output: dist/ folder
```

### Backend Deployment
```bash
npm start
# Or use PM2: pm2 start index.js --name fms-backend
```

## Support

- **Documentation**: `docs/FRONTEND_BACKEND_INTEGRATION.md`
- **API Documentation**: `API_DOCUMENTATION.md`
- **Component Documentation**: `COMPONENTS_DOCUMENTATION.md`

## Script Dependencies

The test scripts require:
- Node.js (v16 or higher)
- npm
- `node-fetch` (for integration tests)
- `chalk` (for colored output)

Install test dependencies:
```bash
npm install node-fetch chalk
```
