/**
 * Performance Monitoring Utility
 * Tracks and reports system performance metrics
 */

import winston from 'winston';

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        responseTimes: []
      },
      database: {
        queries: 0,
        averageQueryTime: 0,
        slowQueries: [],
        queryTimes: []
      },
      memory: {
        usage: [],
        peak: 0,
        current: 0
      },
      errors: {
        total: 0,
        byType: {},
        byEndpoint: {}
      }
    };

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/performance.log' }),
        new winston.transports.Console()
      ]
    });

    this.startTime = Date.now();
    this.setupMemoryMonitoring();
  }

  /**
   * Track API request performance
   */
  trackRequest(req, res, next) {
    const startTime = Date.now();
    const originalSend = res.send;

    res.send = function(data) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Update metrics
      this.metrics.requests.total++;
      this.metrics.requests.responseTimes.push(responseTime);
      
      if (res.statusCode >= 200 && res.statusCode < 300) {
        this.metrics.requests.successful++;
      } else {
        this.metrics.requests.failed++;
        this.trackError(req.path, res.statusCode, 'HTTP_ERROR');
      }

      // Calculate average response time
      this.metrics.requests.averageResponseTime = 
        this.metrics.requests.responseTimes.reduce((a, b) => a + b, 0) / 
        this.metrics.requests.responseTimes.length;

      // Log slow requests
      if (responseTime > 1000) {
        this.logger.warn('Slow request detected', {
          endpoint: req.path,
          method: req.method,
          responseTime,
          statusCode: res.statusCode
        });
      }

      // Log performance data
      this.logger.info('Request completed', {
        endpoint: req.path,
        method: req.method,
        responseTime,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      return originalSend.call(this, data);
    }.bind(this);

    next();
  }

  /**
   * Track database query performance
   */
  trackDatabaseQuery(query, startTime, endTime) {
    const queryTime = endTime - startTime;
    
    this.metrics.database.queries++;
    this.metrics.database.queryTimes.push(queryTime);
    
    // Calculate average query time
    this.metrics.database.averageQueryTime = 
      this.metrics.database.queryTimes.reduce((a, b) => a + b, 0) / 
      this.metrics.database.queryTimes.length;

    // Track slow queries
    if (queryTime > 100) {
      this.metrics.database.slowQueries.push({
        query: query.toString(),
        time: queryTime,
        timestamp: new Date()
      });

      this.logger.warn('Slow database query detected', {
        query: query.toString(),
        time: queryTime
      });
    }

    this.logger.debug('Database query executed', {
      query: query.toString(),
      time: queryTime
    });
  }

  /**
   * Track errors
   */
  trackError(endpoint, errorType, message, stack = null) {
    this.metrics.errors.total++;
    
    // Track by type
    if (!this.metrics.errors.byType[errorType]) {
      this.metrics.errors.byType[errorType] = 0;
    }
    this.metrics.errors.byType[errorType]++;

    // Track by endpoint
    if (!this.metrics.errors.byEndpoint[endpoint]) {
      this.metrics.errors.byEndpoint[endpoint] = 0;
    }
    this.metrics.errors.byEndpoint[endpoint]++;

    this.logger.error('Error tracked', {
      endpoint,
      errorType,
      message,
      stack,
      timestamp: new Date()
    });
  }

  /**
   * Setup memory monitoring
   */
  setupMemoryMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const currentUsage = memUsage.heapUsed / 1024 / 1024; // MB

      this.metrics.memory.usage.push({
        timestamp: new Date(),
        heapUsed: currentUsage,
        heapTotal: memUsage.heapTotal / 1024 / 1024,
        external: memUsage.external / 1024 / 1024
      });

      this.metrics.memory.current = currentUsage;
      
      if (currentUsage > this.metrics.memory.peak) {
        this.metrics.memory.peak = currentUsage;
      }

      // Keep only last 100 memory readings
      if (this.metrics.memory.usage.length > 100) {
        this.metrics.memory.usage = this.metrics.memory.usage.slice(-100);
      }

    }, 30000); // Every 30 seconds
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const uptime = Date.now() - this.startTime;
    
    return {
      ...this.metrics,
      uptime: uptime,
      uptimeFormatted: this.formatUptime(uptime),
      timestamp: new Date()
    };
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const metrics = this.getMetrics();
    
    return {
      uptime: metrics.uptimeFormatted,
      requests: {
        total: metrics.requests.total,
        successful: metrics.requests.successful,
        failed: metrics.requests.failed,
        successRate: ((metrics.requests.successful / metrics.requests.total) * 100).toFixed(2) + '%',
        averageResponseTime: Math.round(metrics.requests.averageResponseTime) + 'ms'
      },
      database: {
        totalQueries: metrics.database.queries,
        averageQueryTime: Math.round(metrics.database.averageQueryTime) + 'ms',
        slowQueries: metrics.database.slowQueries.length
      },
      memory: {
        current: Math.round(metrics.memory.current) + 'MB',
        peak: Math.round(metrics.memory.peak) + 'MB'
      },
      errors: {
        total: metrics.errors.total,
        byType: metrics.errors.byType,
        byEndpoint: metrics.errors.byEndpoint
      }
    };
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    const issues = [];

    // Check response time
    if (metrics.requests.averageResponseTime > 1000) {
      issues.push('High average response time');
    }

    // Check error rate
    const errorRate = (metrics.requests.failed / metrics.requests.total) * 100;
    if (errorRate > 5) {
      issues.push('High error rate');
    }

    // Check memory usage
    if (metrics.memory.current > 500) { // 500MB
      issues.push('High memory usage');
    }

    // Check slow queries
    if (metrics.database.slowQueries.length > 10) {
      issues.push('Multiple slow database queries');
    }

    return {
      status: issues.length === 0 ? 'healthy' : 'unhealthy',
      issues,
      timestamp: new Date()
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        responseTimes: []
      },
      database: {
        queries: 0,
        averageQueryTime: 0,
        slowQueries: [],
        queryTimes: []
      },
      memory: {
        usage: [],
        peak: 0,
        current: 0
      },
      errors: {
        total: 0,
        byType: {},
        byEndpoint: {}
      }
    };
    this.startTime = Date.now();
  }

  /**
   * Format uptime
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Export metrics to file
   */
  exportMetrics(filename = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `metrics-${timestamp}.json`;
    
    const fs = require('fs');
    const path = require('path');
    
    const exportPath = path.join(process.cwd(), 'logs', filename || defaultFilename);
    const metrics = this.getMetrics();
    
    fs.writeFileSync(exportPath, JSON.stringify(metrics, null, 2));
    
    this.logger.info('Metrics exported', { path: exportPath });
    return exportPath;
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;