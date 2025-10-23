import dotenv from 'dotenv';
dotenv.config(); // Loads .env into process.env
import mongoose from 'mongoose';
import logger from '../utility/logger.util.js';

/**
 * Database connection configuration
 */
const dbConfig = {
  maxPoolSize: parseInt(process.env.DB_POOL_SIZE) || 10,
  minPoolSize: parseInt(process.env.DB_POOL_MIN) || 2,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  sanitizeFilter: true, // to do the filter on query
};

/**
 * Connect to MongoDB database
 */
const connectToDb = async () => {
  try {
    // Use ATLAS_URI if available, otherwise construct from individual components
    let uri;
    if (process.env.ATLAS_URI) {
      uri = process.env.ATLAS_URI;
    } else if (process.env.DATABASE_USERNAME && process.env.DATABASE_PASSWORD && process.env.PROJECT_NAME && process.env.DATABASE_NAME) {
      uri = `mongodb+srv://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.PROJECT_NAME}.pnctyau.mongodb.net/${process.env.DATABASE_NAME}?retryWrites=true&w=majority&appName=${process.env.APP_NAME}`;
    } else {
      throw new Error('Database URI is not configured. Please set ATLAS_URI or individual database environment variables.');
    }

    const { connection } = await mongoose.connect(uri, dbConfig);
    
    if (connection) {
      logger.info('MongoDB connected successfully', {
        message: `Server is connected to database version 1.0.0 ( major.minor.patch ) successfully at ${connection.host}`,
        host: connection.host,
        port: connection.port,
        dbName: connection.name,
        readyState: connection.readyState,
      });

      // Set up connection event listeners
      setupConnectionListeners(connection);
    }

    return connection;
  } catch (error) {
    logger.error('MongoDB connection failed', {
      message: `The error has been caught while connecting to the mongo db : ${error}`,
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

/**
 * Setup database connection event listeners
 */
const setupConnectionListeners = (connection) => {
  connection.on('connected', () => {
    logger.info('MongoDB connection established');
  });

  connection.on('error', (error) => {
    logger.error('MongoDB connection error', {
      error: error.message,
      stack: error.stack,
    });
  });

  connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  // Handle application termination
  process.on('SIGINT', async () => {
    try {
      await connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    } catch (error) {
      logger.error('Error closing MongoDB connection', {
        error: error.message,
      });
      process.exit(1);
    }
  });
};

/**
 * Get database connection status
 */
const getConnectionStatus = () => {
  const connection = mongoose.connection;
  return {
    readyState: connection.readyState,
    host: connection.host,
    port: connection.port,
    name: connection.name,
    isConnected: connection.readyState === 1,
  };
};

/**
 * Health check for database
 */
const healthCheck = async () => {
  try {
    const connection = mongoose.connection;
    
    if (connection.readyState !== 1) {
      return {
        status: 'unhealthy',
        message: 'Database not connected',
        readyState: connection.readyState,
      };
    }

    // Ping the database
    await connection.db.admin().ping();
    
    return {
      status: 'healthy',
      message: 'Database is responsive',
      readyState: connection.readyState,
      host: connection.host,
      port: connection.port,
      name: connection.name,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
      error: error.message,
    };
  }
};

/**
 * Graceful shutdown
 */
const gracefulShutdown = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed gracefully');
  } catch (error) {
    logger.error('Error during MongoDB graceful shutdown', {
      error: error.message,
    });
    throw error;
  }
};

export default connectToDb;
export { getConnectionStatus, healthCheck, gracefulShutdown };
