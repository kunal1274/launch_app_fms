#!/usr/bin/env node

/**
 * Database Reset Script
 * This script will completely reset the FMS database for fresh testing
 */

import { MongoClient } from 'mongodb';

// Database configuration - Use Atlas URIs
const LOCAL_MONGODB_URI = process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017/fms_test_database';
const ATLAS_URI_DEV = process.env.ATLAS_URI_DEV || 'mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority';
const ATLAS_URI_TEST = process.env.ATLAS_URI_TEST || 'mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-test-db?retryWrites=true&w=majority';
const ATLAS_URI_PROD = process.env.ATLAS_URI_PROD || 'mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-prod-db?retryWrites=true&w=majority';

// Choose which database to reset
const RESET_TARGET = process.env.RESET_TARGET || 'dev'; // 'local', 'dev', 'test', 'prod'

let MONGODB_URI, DB_NAME;

switch (RESET_TARGET) {
  case 'local':
    MONGODB_URI = LOCAL_MONGODB_URI;
    DB_NAME = 'fms_test_database';
    break;
  case 'test':
    MONGODB_URI = ATLAS_URI_TEST;
    DB_NAME = 'fms-cloud-test-db';
    break;
  case 'prod':
    MONGODB_URI = ATLAS_URI_PROD;
    DB_NAME = 'fms-cloud-prod-db';
    break;
  case 'dev':
  default:
    MONGODB_URI = ATLAS_URI_DEV;
    DB_NAME = 'fms-cloud-dev-db';
    break;
}

async function resetDatabase() {
  let client;
  
  try {
    console.log('🔄 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(DB_NAME);
    
    // Check if database exists
    const adminDb = client.db().admin();
    const databases = await adminDb.listDatabases();
    const dbExists = databases.databases.some(db => db.name === DB_NAME);
    
    if (!dbExists) {
      console.log('ℹ️  Database does not exist yet - this is normal for a fresh setup');
      console.log('✅ Database will be created when first data is inserted');
      console.log('📊 Database:', DB_NAME);
      console.log('🎯 Target:', RESET_TARGET);
      console.log('🔗 Connection:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials
      return;
    }
    
    console.log('🗑️  Dropping database...');
    await db.dropDatabase();
    
    console.log('✅ Database reset completed successfully!');
    console.log('📊 Database:', DB_NAME);
    console.log('🎯 Target:', RESET_TARGET);
    console.log('🔗 Connection:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials
    
    // Verify database is empty
    try {
      const collections = await db.listCollections().toArray();
      console.log('📋 Collections after reset:', collections.length);
      
      if (collections.length === 0) {
        console.log('✅ Database is completely empty and ready for fresh testing!');
      } else {
        console.log('⚠️  Some collections still exist:', collections.map(c => c.name));
      }
    } catch (listError) {
      console.log('✅ Database successfully dropped and is ready for fresh testing!');
    }
    
  } catch (error) {
    console.error('❌ Database reset failed:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the reset
resetDatabase()
  .then(() => {
    console.log('🎉 Database reset completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Database reset failed:', error);
    process.exit(1);
  });
