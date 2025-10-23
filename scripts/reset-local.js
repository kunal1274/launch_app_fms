#!/usr/bin/env node

/**
 * Local MongoDB Database Reset Script
 * Resets the local MongoDB database for development testing
 */

import { MongoClient } from 'mongodb';

// Local MongoDB Database URI
const LOCAL_MONGODB_URI = 'mongodb://localhost:27017/fms_test_database';
const DB_NAME = 'fms_test_database';

async function resetLocalDatabase() {
  let client;
  
  try {
    console.log('🔄 Connecting to Local MongoDB Database...');
    client = new MongoClient(LOCAL_MONGODB_URI);
    await client.connect();
    
    const db = client.db(DB_NAME);
    
    // Check if database exists
    const adminDb = client.db().admin();
    const databases = await adminDb.listDatabases();
    const dbExists = databases.databases.some(db => db.name === DB_NAME);
    
    if (!dbExists) {
      console.log('ℹ️  Local database does not exist yet - this is normal for a fresh setup');
      console.log('✅ Database will be created when first data is inserted');
      console.log('📊 Database:', DB_NAME);
      console.log('🔗 Local MongoDB: localhost:27017');
      return;
    }
    
    console.log('🗑️  Dropping local database...');
    await db.dropDatabase();
    
    console.log('✅ Local database reset completed successfully!');
    console.log('📊 Database:', DB_NAME);
    console.log('🔗 Local MongoDB: localhost:27017');
    
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
    console.error('❌ Local database reset failed:', error.message);
    console.error('💡 Make sure MongoDB is running locally on localhost:27017');
    console.error('🔍 Error details:', error.code || 'Unknown error');
    console.error('💡 To start MongoDB locally: brew services start mongodb-community');
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the reset
resetLocalDatabase()
  .then(() => {
    console.log('🎉 Local database reset completed successfully!');
    console.log('🚀 Ready for fresh local testing!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Local database reset failed:', error);
    process.exit(1);
  });
