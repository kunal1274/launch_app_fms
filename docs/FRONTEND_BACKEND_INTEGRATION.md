# Frontend-Backend Integration Guide

## Overview

The FMS application consists of:
- **Backend**: Node.js/Express API server (port 3000)
- **Frontend**: React + Vite + Tailwind CSS (port 5173)

## Frontend Technology Stack

- **React 18.3.1** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling framework
- **React Router DOM** - Client-side routing

## Project Structure

```
workspace/frontend/
├── src/
│   ├── App.tsx          # Main application component
│   ├── main.tsx         # Application entry point
│   └── assets/          # Static assets
├── public/
│   └── ui-mocks/        # UI mockups and wireframes
├── package.json         # Dependencies and scripts
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # Tailwind CSS configuration
└── tsconfig.json        # TypeScript configuration
```

## Running the Frontend

### Prerequisites

1. **Node.js** (v16 or higher)
2. **npm** or **yarn**

### Installation

```bash
# Navigate to frontend directory
cd workspace/frontend

# Install dependencies
npm install
```

### Development Server

```bash
# Start development server
npm run dev
```

The frontend will be available at: `http://localhost:5173`

### Build for Production

```bash
# Build the application
npm run build

# Preview production build
npm run preview
```

## Backend Integration

### API Configuration

The frontend is configured to communicate with the backend through:

1. **API Base URL**: `/fms/api/v0` (proxied to backend)
2. **Proxy Configuration**: Vite proxies API calls to `http://localhost:3000`
3. **Environment Variables**: Configurable via `VITE_PROXY_TARGET`

### Current API Endpoints Used

The frontend currently integrates with these backend endpoints:

#### 1. Accounts API
- **GET** `/fms/api/v0/accounts?includeArchived=false`
- **Purpose**: Fetch ledger accounts for the accounts page
- **Response**: List of account objects with properties:
  - `_id`, `accountCode`, `accountName`, `type`, `currency`
  - `isLeaf`, `allowManualPost`, `isArchived`

#### 2. GL Journals API
- **POST** `/fms/api/v0/gl-journals`
- **Purpose**: Create new general ledger journals
- **Payload**: Journal with lines, reference, and journal date

#### 3. Journal Posting API
- **POST** `/fms/api/v0/gl-journals/{id}/post`
- **Purpose**: Post a journal entry to create vouchers

#### 4. Subledger API
- **GET** `/fms/api/v0/subledgers?sourceId={id}&sourceType=JOURNAL&limit=100`
- **Purpose**: Fetch GL transactions for a specific journal

## Frontend Features

### 1. Dashboard
- **Route**: `/`
- **Features**: Overview statistics (placeholder)
- **Components**: Stat cards for accounts, journals, vouchers

### 2. Accounts Page
- **Route**: `/accounts`
- **Features**:
  - Display all ledger accounts in a table
  - Statistics: Total accounts, leaf accounts, manual post accounts, archived accounts
  - Real-time data fetching from backend
  - Error handling and loading states

### 3. Journals Page
- **Route**: `/journals`
- **Features**:
  - Create new GL journals with multiple lines
  - Real-time balance validation (debit = credit)
  - Post journals to create vouchers
  - View generated subledger transactions
  - Multi-currency support with exchange rates

### 4. Navigation
- **Header**: Sticky navigation with FMS branding
- **Routes**: Accounts, GL Journals
- **Responsive**: Mobile-friendly design

## Testing the Integration

### 1. Start Both Servers

**Terminal 1 - Backend:**
```bash
# From project root
npm start
# or
node index.js
```

**Terminal 2 - Frontend:**
```bash
# From workspace/frontend
npm run dev
```

### 2. Test API Connectivity

1. **Open Frontend**: Navigate to `http://localhost:5173`
2. **Check Accounts**: Go to `/accounts` - should load account data
3. **Test Journals**: Go to `/journals` - should allow creating and posting journals

### 3. Verify Data Flow

1. **Create Journal**: Use the journal form to create a new entry
2. **Post Journal**: Click "Post Journal" to create vouchers
3. **View Transactions**: Check the subledger transactions table

## Environment Configuration

### Frontend Environment Variables

Create `.env` file in `workspace/frontend/`:

```env
# API Configuration
VITE_API_BASE=/fms/api/v0
VITE_PROXY_TARGET=http://localhost:3000

# Optional: Custom API base for production
# VITE_API_BASE=https://your-api-domain.com/fms/api/v0
```

### Backend Environment Variables

Ensure your backend `.env` file includes:

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database
ATLAS_URI=your_mongodb_connection_string

# CORS (if needed)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure backend allows frontend origin
   - Check `ALLOWED_ORIGINS` in backend `.env`

2. **API Connection Failed**
   - Verify backend is running on port 3000
   - Check proxy configuration in `vite.config.ts`
   - Ensure API routes match frontend expectations

3. **Build Errors**
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Check TypeScript errors: `npm run build`

4. **Styling Issues**
   - Ensure Tailwind CSS is properly configured
   - Check if custom brand colors are defined

### Debug Mode

Enable debug logging:

```bash
# Backend
DEBUG=fms:* npm start

# Frontend (browser dev tools)
# Check Network tab for API calls
# Check Console for JavaScript errors
```

## Development Workflow

### 1. Backend-First Development
1. Implement API endpoints in backend
2. Test with Postman/curl
3. Update frontend to consume new endpoints

### 2. Frontend-First Development
1. Create UI components with mock data
2. Implement API integration
3. Test with real backend data

### 3. Full-Stack Testing
1. Start both servers
2. Test complete user workflows
3. Verify data persistence and consistency

## Production Deployment

### Frontend Build
```bash
cd workspace/frontend
npm run build
# Output: dist/ folder with static files
```

### Backend Deployment
```bash
# From project root
npm start
# or use PM2 for production
pm2 start index.js --name fms-backend
```

### Environment Setup
- Update `VITE_API_BASE` to production API URL
- Configure CORS for production domains
- Set up proper environment variables

## Next Steps

1. **Authentication**: Implement login/logout functionality
2. **Error Handling**: Add comprehensive error boundaries
3. **Loading States**: Improve loading indicators
4. **Form Validation**: Add client-side validation
5. **Testing**: Add unit and integration tests
6. **State Management**: Consider Redux/Zustand for complex state
7. **API Client**: Create dedicated API client with interceptors
