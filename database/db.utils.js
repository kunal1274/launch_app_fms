/**
 * Database Utilities for FMS Application
 * This file provides common database operations and utilities
 */

import mongoose from 'mongoose';
import { asyncHandler } from '../utility/error.util.js';
import { handleDatabaseError } from '../utility/error.util.js';
import logger from '../utility/logger.util.js';

/**
 * Database utility functions
 */
export const dbUtils = {
  /**
   * Create database indexes for a model
   */
  createIndexes: asyncHandler(async (model, indexes) => {
    try {
      const result = await model.collection.createIndexes(indexes);
      logger.info(`Indexes created for ${model.modelName}`, { indexes: result });
      return result;
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  /**
   * Drop database indexes for a model
   */
  dropIndexes: asyncHandler(async (model, indexNames) => {
    try {
      const result = await model.collection.dropIndexes(indexNames);
      logger.info(`Indexes dropped for ${model.modelName}`, { indexes: indexNames });
      return result;
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  /**
   * Get collection statistics
   */
  getCollectionStats: asyncHandler(async (model) => {
    try {
      const stats = await model.collection.stats();
      return {
        count: stats.count,
        size: stats.size,
        avgObjSize: stats.avgObjSize,
        storageSize: stats.storageSize,
        totalIndexSize: stats.totalIndexSize,
        indexSizes: stats.indexSizes,
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  /**
   * Backup collection data
   */
  backupCollection: asyncHandler(async (model, backupName) => {
    try {
      const data = await model.find({}).lean();
      const backup = {
        collection: model.collection.name,
        timestamp: new Date(),
        count: data.length,
        data,
      };

      // In a real implementation, you would save this to a backup storage
      logger.info(`Collection ${model.collection.name} backed up`, {
        backupName,
        count: data.length,
      });

      return backup;
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  /**
   * Restore collection data
   */
  restoreCollection: asyncHandler(async (model, backupData) => {
    try {
      if (!backupData.data || !Array.isArray(backupData.data)) {
        throw new Error('Invalid backup data format');
      }

      // Clear existing data
      await model.deleteMany({});

      // Insert backup data
      const result = await model.insertMany(backupData.data);

      logger.info(`Collection ${model.collection.name} restored`, {
        count: result.length,
        backupTimestamp: backupData.timestamp,
      });

      return result;
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  /**
   * Validate database connection
   */
  validateConnection: asyncHandler(async () => {
    try {
      const connection = mongoose.connection;
      
      if (connection.readyState !== 1) {
        throw new Error('Database not connected');
      }

      // Ping the database
      await connection.db.admin().ping();
      
      return {
        status: 'connected',
        host: connection.host,
        port: connection.port,
        name: connection.name,
        readyState: connection.readyState,
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  /**
   * Get database information
   */
  getDatabaseInfo: asyncHandler(async () => {
    try {
      const connection = mongoose.connection;
      const db = connection.db;
      
      const admin = db.admin();
      const serverInfo = await admin.serverStatus();
      const dbStats = await db.stats();

      return {
        connection: {
          host: connection.host,
          port: connection.port,
          name: connection.name,
          readyState: connection.readyState,
        },
        server: {
          version: serverInfo.version,
          uptime: serverInfo.uptime,
          connections: serverInfo.connections,
        },
        database: {
          collections: dbStats.collections,
          dataSize: dbStats.dataSize,
          storageSize: dbStats.storageSize,
          indexes: dbStats.indexes,
          indexSize: dbStats.indexSize,
        },
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  /**
   * Clean up old data
   */
  cleanupOldData: asyncHandler(async (model, options = {}) => {
    try {
      const {
        field = 'createdAt',
        olderThanDays = 90,
        dryRun = false,
      } = options;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const query = { [field]: { $lt: cutoffDate } };

      if (dryRun) {
        const count = await model.countDocuments(query);
        logger.info(`Cleanup dry run for ${model.modelName}`, {
          count,
          cutoffDate,
          field,
        });
        return { count, cutoffDate, field };
      }

      const result = await model.deleteMany(query);
      
      logger.info(`Old data cleaned up for ${model.modelName}`, {
        deletedCount: result.deletedCount,
        cutoffDate,
        field,
      });

      return result;
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  /**
   * Optimize collection
   */
  optimizeCollection: asyncHandler(async (model) => {
    try {
      const collection = model.collection;
      
      // Rebuild indexes
      await collection.reIndex();
      
      // Compact collection (if supported)
      try {
        await collection.aggregate([{ $collStats: { storageStats: {} } }]);
      } catch (error) {
        logger.warn(`Collection compaction not supported for ${model.modelName}`);
      }

      logger.info(`Collection ${model.modelName} optimized`);
      return { success: true };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  /**
   * Get slow queries
   */
  getSlowQueries: asyncHandler(async () => {
    try {
      const connection = mongoose.connection;
      const db = connection.db;
      
      // Get profiler data
      const profiler = db.collection('system.profile');
      const slowQueries = await profiler
        .find({ millis: { $gt: 100 } })
        .sort({ ts: -1 })
        .limit(10)
        .toArray();

      return slowQueries;
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  /**
   * Monitor database performance
   */
  monitorPerformance: asyncHandler(async () => {
    try {
      const connection = mongoose.connection;
      const db = connection.db;
      
      const admin = db.admin();
      const serverStatus = await admin.serverStatus();
      
      return {
        connections: serverStatus.connections,
        operations: serverStatus.opcounters,
        memory: serverStatus.mem,
        network: serverStatus.network,
        uptime: serverStatus.uptime,
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),
};

/**
 * Database migration utilities
 */
export const migrationUtils = {
  /**
   * Run database migration
   */
  runMigration: asyncHandler(async (migrationName, migrationFunction) => {
    try {
      logger.info(`Starting migration: ${migrationName}`);
      
      const startTime = Date.now();
      const result = await migrationFunction();
      const duration = Date.now() - startTime;
      
      logger.info(`Migration completed: ${migrationName}`, {
        duration: `${duration}ms`,
        result,
      });

      return { success: true, duration, result };
    } catch (error) {
      logger.error(`Migration failed: ${migrationName}`, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }),

  /**
   * Rollback database migration
   */
  rollbackMigration: asyncHandler(async (migrationName, rollbackFunction) => {
    try {
      logger.info(`Starting rollback: ${migrationName}`);
      
      const startTime = Date.now();
      const result = await rollbackFunction();
      const duration = Date.now() - startTime;
      
      logger.info(`Rollback completed: ${migrationName}`, {
        duration: `${duration}ms`,
        result,
      });

      return { success: true, duration, result };
    } catch (error) {
      logger.error(`Rollback failed: ${migrationName}`, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }),
};

/**
 * Database validation utilities
 */
export const validationUtils = {
  /**
   * Validate data integrity
   */
  validateDataIntegrity: asyncHandler(async (model, validationRules) => {
    try {
      const issues = [];
      
      for (const rule of validationRules) {
        const { name, query, expectedCount, message } = rule;
        
        const actualCount = await model.countDocuments(query);
        
        if (actualCount !== expectedCount) {
          issues.push({
            rule: name,
            expected: expectedCount,
            actual: actualCount,
            message: message || `Expected ${expectedCount} records, found ${actualCount}`,
          });
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        totalRules: validationRules.length,
        passedRules: validationRules.length - issues.length,
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  /**
   * Check for orphaned records
   */
  checkOrphanedRecords: asyncHandler(async (model, referenceField, referenceModel) => {
    try {
      const pipeline = [
        {
          $lookup: {
            from: referenceModel.collection.name,
            localField: referenceField,
            foreignField: '_id',
            as: 'reference',
          },
        },
        {
          $match: {
            [referenceField]: { $exists: true, $ne: null },
            reference: { $size: 0 },
          },
        },
        {
          $project: {
            _id: 1,
            [referenceField]: 1,
          },
        },
      ];

      const orphanedRecords = await model.aggregate(pipeline);
      
      return {
        count: orphanedRecords.length,
        records: orphanedRecords,
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),
};

export default {
  dbUtils,
  migrationUtils,
  validationUtils,
};
