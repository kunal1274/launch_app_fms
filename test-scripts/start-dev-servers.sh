#!/bin/bash

# FMS Development Servers Startup Script
# This script starts both the backend and frontend development servers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

# Function to kill process on port
kill_port() {
    if port_in_use $1; then
        print_warning "Port $1 is already in use. Attempting to kill existing process..."
        lsof -ti :$1 | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Check prerequisites
print_status "Checking prerequisites..."

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_success "Prerequisites check passed"

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/workspace/frontend"

# Check if frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    print_error "Frontend directory not found at: $FRONTEND_DIR"
    exit 1
fi

# Check if package.json exists in frontend
if [ ! -f "$FRONTEND_DIR/package.json" ]; then
    print_error "Frontend package.json not found. Please ensure the frontend is properly set up."
    exit 1
fi

print_status "Starting FMS Development Servers..."
print_status "Backend will run on: http://localhost:3000"
print_status "Frontend will run on: http://localhost:5173"

# Kill existing processes on ports 3000 and 5173
kill_port 3000
kill_port 5173

# Create a function to handle cleanup
cleanup() {
    print_status "Shutting down servers..."
    jobs -p | xargs -r kill 2>/dev/null || true
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start backend server
print_status "Starting backend server..."
cd "$PROJECT_ROOT"
npm start &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if ! port_in_use 3000; then
    print_error "Backend failed to start on port 3000"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

print_success "Backend server started successfully (PID: $BACKEND_PID)"

# Start frontend server
print_status "Starting frontend server..."
cd "$FRONTEND_DIR"

# Install frontend dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing frontend dependencies..."
    npm install
fi

npm run dev &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 5

# Check if frontend started successfully
if ! port_in_use 5173; then
    print_error "Frontend failed to start on port 5173"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit 1
fi

print_success "Frontend server started successfully (PID: $FRONTEND_PID)"

# Display success message
echo ""
print_success "🎉 Both servers are now running!"
echo ""
echo -e "${BLUE}📱 Frontend:${NC} http://localhost:5173"
echo -e "${BLUE}🔧 Backend:${NC} http://localhost:3000"
echo -e "${BLUE}📊 API Base:${NC} http://localhost:3000/fms/api/v0"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "   • Press Ctrl+C to stop both servers"
echo "   • Check the integration guide: docs/FRONTEND_BACKEND_INTEGRATION.md"
echo "   • Run integration tests: node test-scripts/test-frontend-backend.js"
echo ""

# Wait for user to stop the servers
print_status "Servers are running. Press Ctrl+C to stop..."

# Keep the script running and wait for the background processes
wait
