/**
 * Health Check Script
 * Used by Docker and PM2 for health monitoring
 */

import http from 'http';
import mongoose from 'mongoose';
import redis from 'redis';

const HEALTH_CHECK_PORT = process.env.HEALTH_CHECK_PORT || 3001;
const MONGODB_URI = process.env.ATLAS_URI || process.env.ATLAS_URI_DEV || process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017/fms_test_database';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class HealthChecker {
  constructor() {
    this.checks = {
      database: false,
      redis: false,
      memory: false,
      disk: false
    };
  }

  async checkDatabase() {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
      });
      
      // Test a simple query
      await mongoose.connection.db.admin().ping();
      
      this.checks.database = true;
      return { status: 'healthy', message: 'Database connection successful' };
    } catch (error) {
      this.checks.database = false;
      return { status: 'unhealthy', message: `Database error: ${error.message}` };
    }
  }

  async checkRedis() {
    try {
      const client = redis.createClient({ url: REDIS_URL });
      await client.connect();
      
      // Test a simple operation
      await client.ping();
      await client.disconnect();
      
      this.checks.redis = true;
      return { status: 'healthy', message: 'Redis connection successful' };
    } catch (error) {
      this.checks.redis = false;
      return { status: 'unhealthy', message: `Redis error: ${error.message}` };
    }
  }

  checkMemory() {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const memoryUsagePercent = (heapUsedMB / heapTotalMB) * 100;

      // Consider unhealthy if memory usage is above 90%
      if (memoryUsagePercent > 90) {
        this.checks.memory = false;
        return { 
          status: 'unhealthy', 
          message: `High memory usage: ${memoryUsagePercent.toFixed(2)}%` 
        };
      }

      this.checks.memory = true;
      return { 
        status: 'healthy', 
        message: `Memory usage: ${memoryUsagePercent.toFixed(2)}%` 
      };
    } catch (error) {
      this.checks.memory = false;
      return { status: 'unhealthy', message: `Memory check error: ${error.message}` };
    }
  }

  checkDisk() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Check if we can write to the uploads directory
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Test write access
      const testFile = path.join(uploadsDir, 'health-check-test.txt');
      fs.writeFileSync(testFile, 'health check test');
      fs.unlinkSync(testFile);
      
      this.checks.disk = true;
      return { status: 'healthy', message: 'Disk write access successful' };
    } catch (error) {
      this.checks.disk = false;
      return { status: 'unhealthy', message: `Disk check error: ${error.message}` };
    }
  }

  async runAllChecks() {
    const results = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {}
    };

    // Run all checks
    results.checks.database = await this.checkDatabase();
    results.checks.redis = await this.checkRedis();
    results.checks.memory = this.checkMemory();
    results.checks.disk = this.checkDisk();

    // Determine overall status
    const allHealthy = Object.values(this.checks).every(check => check === true);
    results.status = allHealthy ? 'healthy' : 'unhealthy';

    return results;
  }

  getOverallStatus() {
    const allHealthy = Object.values(this.checks).every(check => check === true);
    return allHealthy ? 'healthy' : 'unhealthy';
  }
}

// Create health checker instance
const healthChecker = new HealthChecker();

// Create HTTP server for health checks
const server = http.createServer(async (req, res) => {
  if (req.url === '/health' || req.url === '/healthcheck') {
    try {
      const healthStatus = await healthChecker.runAllChecks();
      
      res.writeHead(healthStatus.status === 'healthy' ? 200 : 503, {
        'Content-Type': 'application/json'
      });
      
      res.end(JSON.stringify(healthStatus, null, 2));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'unhealthy',
        message: 'Health check failed',
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  } else if (req.url === '/ready') {
    // Readiness check - just check if the service is ready to accept requests
    const isReady = healthChecker.getOverallStatus() === 'healthy';
    
    res.writeHead(isReady ? 200 : 503, {
      'Content-Type': 'application/json'
    });
    
    res.end(JSON.stringify({
      status: isReady ? 'ready' : 'not ready',
      timestamp: new Date().toISOString()
    }));
  } else if (req.url === '/live') {
    // Liveness check - just check if the process is alive
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not found',
      message: 'Available endpoints: /health, /ready, /live'
    }));
  }
});

// Start the health check server
server.listen(HEALTH_CHECK_PORT, '0.0.0.0', () => {
  console.log(`Health check server running on port ${HEALTH_CHECK_PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Health check server shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Health check server shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

export default healthChecker;