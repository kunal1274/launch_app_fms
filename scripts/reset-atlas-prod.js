#!/usr/bin/env node

/**
 * Atlas Production Database Reset Script
 * ⚠️  WARNING: This will reset the PRODUCTION database!
 * Use with extreme caution - only for emergency situations
 */

import { MongoClient } from 'mongodb';

// Atlas Production Database URI
const ATLAS_URI_PROD = 'mongodb+srv://devratxen:4ylT1J9z1JNOfJ2Y@scalernodebackend2.pnctyau.mongodb.net/fms-cloud-prod-db?retryWrites=true&w=majority';
const DB_NAME = 'fms-cloud-prod-db';

async function resetProdDatabase() {
  let client;
  
  try {
    console.log('⚠️  WARNING: This will reset the PRODUCTION database!');
    console.log('🔄 Connecting to Atlas Production Database...');
    
    // Double confirmation for production
    console.log('🚨 PRODUCTION DATABASE RESET - CONFIRMATION REQUIRED');
    console.log('📊 Database:', DB_NAME);
    console.log('🔗 Atlas Cluster: scalernodebackend2.pnctyau.mongodb.net');
    console.log('⚠️  This action cannot be undone!');
    
    client = new MongoClient(ATLAS_URI_PROD);
    await client.connect();
    
    const db = client.db(DB_NAME);
    
    // Check if database exists
    const adminDb = client.db().admin();
    const databases = await adminDb.listDatabases();
    const dbExists = databases.databases.some(db => db.name === DB_NAME);
    
    if (!dbExists) {
      console.log('ℹ️  Production database does not exist yet');
      console.log('✅ Database will be created when first data is inserted');
      console.log('📊 Database:', DB_NAME);
      console.log('🔗 Atlas Cluster: scalernodebackend2.pnctyau.mongodb.net');
      return;
    }
    
    console.log('🗑️  Dropping PRODUCTION database...');
    await db.dropDatabase();
    
    console.log('✅ Production database reset completed successfully!');
    console.log('📊 Database:', DB_NAME);
    console.log('🔗 Atlas Cluster: scalernodebackend2.pnctyau.mongodb.net');
    
    // Verify database is empty
    try {
      const collections = await db.listCollections().toArray();
      console.log('📋 Collections after reset:', collections.length);
      
      if (collections.length === 0) {
        console.log('✅ Database is completely empty and ready for fresh setup!');
      } else {
        console.log('⚠️  Some collections still exist:', collections.map(c => c.name));
      }
    } catch (listError) {
      console.log('✅ Database successfully dropped and is ready for fresh setup!');
    }
    
  } catch (error) {
    console.error('❌ Production database reset failed:', error.message);
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
resetProdDatabase()
  .then(() => {
    console.log('🎉 Production database reset completed successfully!');
    console.log('🚀 Ready for fresh production setup!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Production database reset failed:', error);
    process.exit(1);
  });
