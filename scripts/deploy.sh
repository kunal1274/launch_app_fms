#!/bin/bash

# ERP Backend Deployment Script
# This script handles the deployment of the ERP backend system

set -e  # Exit on any error

# Configuration
APP_NAME="erp-backend"
NODE_VERSION="18"
PM2_APP_NAME="erp-backend"
DEPLOY_DIR="/var/www/erp-backend"
BACKUP_DIR="/var/backups/erp-backend"
LOG_DIR="/var/log/erp-backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VER" -lt "$NODE_VERSION" ]; then
        error "Node.js version $NODE_VERSION or higher is required. Current version: $(node -v)"
        exit 1
    fi
    
    # Check PM2
    if ! command -v pm2 &> /dev/null; then
        warning "PM2 is not installed. Installing PM2..."
        npm install -g pm2
    fi
    
    # Check MongoDB
    if ! command -v mongod &> /dev/null; then
        warning "MongoDB is not installed. Please install MongoDB before deployment."
    fi
    
    success "System requirements check completed"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    sudo mkdir -p $DEPLOY_DIR
    sudo mkdir -p $BACKUP_DIR
    sudo mkdir -p $LOG_DIR
    sudo mkdir -p $DEPLOY_DIR/logs
    
    # Set permissions
    sudo chown -R $USER:$USER $DEPLOY_DIR
    sudo chown -R $USER:$USER $BACKUP_DIR
    sudo chown -R $USER:$USER $LOG_DIR
    
    success "Directories created successfully"
}

# Backup current deployment
backup_current() {
    if [ -d "$DEPLOY_DIR" ] && [ "$(ls -A $DEPLOY_DIR)" ]; then
        log "Backing up current deployment..."
        
        BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
        sudo cp -r $DEPLOY_DIR $BACKUP_DIR/$BACKUP_NAME
        
        success "Backup created: $BACKUP_DIR/$BACKUP_NAME"
    fi
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    cd $DEPLOY_DIR
    
    # Install production dependencies
    npm ci --only=production
    
    # Install PM2 if not already installed
    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2
    fi
    
    success "Dependencies installed successfully"
}

# Configure environment
configure_environment() {
    log "Configuring environment..."
    
    # Create .env file if it doesn't exist
    if [ ! -f "$DEPLOY_DIR/.env" ]; then
        cat > $DEPLOY_DIR/.env << EOF
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/erp_production
MONGODB_OPTIONS={"useNewUrlParser":true,"useUnifiedTopology":true}

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d
BCRYPT_ROUNDS=12

# Redis Configuration
REDIS_URL=redis://localhost:6379

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Company Configuration
COMPANY_PREFIX=ERP
COMPANY_NAME=Your Company Name

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
        warning "Please update the .env file with your actual configuration values"
    fi
    
    success "Environment configured"
}

# Start services
start_services() {
    log "Starting services..."
    
    # Start MongoDB if not running
    if ! pgrep -x "mongod" > /dev/null; then
        log "Starting MongoDB..."
        sudo systemctl start mongod
        sleep 5
    fi
    
    # Start Redis if not running
    if ! pgrep -x "redis-server" > /dev/null; then
        log "Starting Redis..."
        sudo systemctl start redis
        sleep 3
    fi
    
    success "Services started"
}

# Deploy application
deploy_application() {
    log "Deploying application..."
    
    cd $DEPLOY_DIR
    
    # Stop existing PM2 process
    pm2 stop $PM2_APP_NAME 2>/dev/null || true
    pm2 delete $PM2_APP_NAME 2>/dev/null || true
    
    # Start application with PM2
    pm2 start index.js --name $PM2_APP_NAME --env production
    
    # Save PM2 configuration
    pm2 save
    pm2 startup
    
    success "Application deployed successfully"
}

# Run health checks
health_check() {
    log "Running health checks..."
    
    # Wait for application to start
    sleep 10
    
    # Check if application is running
    if pm2 list | grep -q "$PM2_APP_NAME.*online"; then
        success "Application is running"
    else
        error "Application failed to start"
        pm2 logs $PM2_APP_NAME --lines 50
        exit 1
    fi
    
    # Check if application responds
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        success "Application is responding to requests"
    else
        warning "Application is not responding to health checks"
    fi
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Create log rotation configuration
    sudo tee /etc/logrotate.d/erp-backend > /dev/null << EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
    
    # Setup PM2 monitoring
    pm2 install pm2-logrotate
    
    success "Monitoring setup completed"
}

# Main deployment function
main() {
    log "Starting ERP Backend deployment..."
    
    check_root
    check_requirements
    create_directories
    backup_current
    install_dependencies
    configure_environment
    start_services
    deploy_application
    health_check
    setup_monitoring
    
    success "Deployment completed successfully!"
    log "Application is running at: http://localhost:3000"
    log "PM2 status: pm2 status"
    log "PM2 logs: pm2 logs $PM2_APP_NAME"
    log "PM2 restart: pm2 restart $PM2_APP_NAME"
}

# Handle script arguments
case "${1:-}" in
    "deploy")
        main
        ;;
    "backup")
        backup_current
        ;;
    "restart")
        pm2 restart $PM2_APP_NAME
        ;;
    "stop")
        pm2 stop $PM2_APP_NAME
        ;;
    "start")
        pm2 start $PM2_APP_NAME
        ;;
    "logs")
        pm2 logs $PM2_APP_NAME
        ;;
    "status")
        pm2 status
        ;;
    "health")
        health_check
        ;;
    *)
        echo "Usage: $0 {deploy|backup|restart|stop|start|logs|status|health}"
        echo ""
        echo "Commands:"
        echo "  deploy  - Full deployment process"
        echo "  backup  - Backup current deployment"
        echo "  restart - Restart application"
        echo "  stop    - Stop application"
        echo "  start   - Start application"
        echo "  logs    - Show application logs"
        echo "  status  - Show PM2 status"
        echo "  health  - Run health checks"
        exit 1
        ;;
esac