#!/bin/bash

# Frontend Setup Script
# This script sets up the frontend development environment

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

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/workspace/frontend"

print_status "Setting up FMS Frontend Development Environment..."

# Check if frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    print_error "Frontend directory not found at: $FRONTEND_DIR"
    exit 1
fi

# Check if package.json exists
if [ ! -f "$FRONTEND_DIR/package.json" ]; then
    print_error "Frontend package.json not found. Please ensure the frontend is properly set up."
    exit 1
fi

# Navigate to frontend directory
cd "$FRONTEND_DIR"

# Check Node.js version
print_status "Checking Node.js version..."
NODE_VERSION=$(node --version)
print_success "Node.js version: $NODE_VERSION"

# Check npm version
print_status "Checking npm version..."
NPM_VERSION=$(npm --version)
print_success "npm version: $NPM_VERSION"

# Install dependencies
print_status "Installing frontend dependencies..."
if npm install; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Create .env file if it doesn't exist
ENV_FILE="$FRONTEND_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    print_status "Creating .env file..."
    cat > "$ENV_FILE" << EOF
# Frontend Environment Configuration
VITE_API_BASE=/fms/api/v0
VITE_PROXY_TARGET=http://localhost:3000
EOF
    print_success ".env file created"
else
    print_warning ".env file already exists"
fi

# Check if build works
print_status "Testing build process..."
if npm run build; then
    print_success "Build test passed"
    # Clean up build artifacts
    rm -rf dist
else
    print_error "Build test failed"
    exit 1
fi

# Display setup completion
echo ""
print_success "🎉 Frontend setup completed successfully!"
echo ""
echo -e "${BLUE}📁 Frontend Directory:${NC} $FRONTEND_DIR"
echo -e "${BLUE}🌐 Development Server:${NC} npm run dev"
echo -e "${BLUE}🔧 Build Command:${NC} npm run build"
echo -e "${BLUE}👀 Preview Command:${NC} npm run preview"
echo ""
echo -e "${YELLOW}💡 Next Steps:${NC}"
echo "   1. Start the backend server: npm start (from project root)"
echo "   2. Start the frontend server: npm run dev (from workspace/frontend)"
echo "   3. Or use the convenience script: ./test-scripts/start-dev-servers.sh"
echo ""
echo -e "${BLUE}📖 Documentation:${NC} docs/FRONTEND_BACKEND_INTEGRATION.md"
