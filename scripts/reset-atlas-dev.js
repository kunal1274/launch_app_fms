#!/usr/bin/env node

/**
 * Atlas Development Database Reset Script
 * Resets the fms-cloud-dev-db database for fresh testing
 */

import { MongoClient } from 'mongodb';

// Atlas Development Database URI
const ATLAS_URI_DEV = 'mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-dev-db?retryWrites=true&w=majority';
const DB_NAME = 'fms-cloud-dev-db';

async function resetDevDatabase() {
  let client;
  
  try {
    console.log('🔄 Connecting to Atlas Development Database...');
    client = new MongoClient(ATLAS_URI_DEV);
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
      console.log('🔗 Atlas Cluster: scalernodebackend2.pnctyau.mongodb.net');
      return;
    }
    
    console.log('🗑️  Dropping development database...');
    await db.dropDatabase();
    
    console.log('✅ Development database reset completed successfully!');
    console.log('📊 Database:', DB_NAME);
    console.log('🔗 Atlas Cluster: scalernodebackend2.pnctyau.mongodb.net');
    
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
    console.error('💡 Make sure you have internet connection and Atlas credentials are correct');
    console.error('🔍 Error details:', error.code || 'Unknown error');
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the reset
resetDevDatabase()
  .then(() => {
    console.log('🎉 Development database reset completed successfully!');
    console.log('🚀 Ready for fresh testing!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Database reset failed:', error);
    process.exit(1);
  });
