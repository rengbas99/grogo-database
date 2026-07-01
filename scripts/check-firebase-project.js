#!/usr/bin/env node

/**
 * Check Firebase Project Configuration
 * Verifies which Firebase project we're connected to
 */

const admin = require('firebase-admin');

async function checkFirebaseProject() {
  try {
    console.log('🔍 Checking Firebase Project Configuration...');
    console.log('=' .repeat(60));

    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      const serviceAccount = require('../config/firebase-service-account.json');
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    }

    const app = admin.app();
    const db = admin.firestore();

    // Get project information
    console.log('📋 FIREBASE PROJECT DETAILS:');
    console.log('=' .repeat(40));
    console.log(`Project ID: ${app.options.projectId}`);
    console.log(`Service Account: ${app.options.credential?.clientEmail || 'Unknown'}`);
    
    // Check service account file
    const serviceAccount = require('../config/firebase-service-account.json');
    console.log(`Service Account Project: ${serviceAccount.project_id}`);
    console.log(`Service Account Email: ${serviceAccount.client_email}`);

    // Test database connection and get info
    console.log('\n🗄️  DATABASE CONNECTION:');
    console.log('=' .repeat(40));
    
    // Get database ID
    const databaseId = app.options.projectId;
    console.log(`Database ID: ${databaseId}`);
    
    // Check if we can access the database
    try {
      const testRef = db.collection('_test_connection').doc('test');
      await testRef.set({ test: true, timestamp: admin.firestore.FieldValue.serverTimestamp() });
      await testRef.delete();
      console.log('✅ Database connection successful');
    } catch (error) {
      console.log('❌ Database connection failed:', error.message);
    }

    // Get all collections to see what's available
    console.log('\n📂 AVAILABLE COLLECTIONS:');
    console.log('=' .repeat(40));
    const collections = await db.listCollections();
    console.log(`Found ${collections.length} collections:`);
    
    for (const collection of collections) {
      const snapshot = await collection.limit(1).get();
      console.log(`- ${collection.id}: ${snapshot.size > 0 ? 'Has data' : 'Empty'}`);
    }

    // Check if there are multiple Firebase projects configured
    console.log('\n🔍 CHECKING FOR MULTIPLE PROJECTS:');
    console.log('=' .repeat(40));
    
    const apps = admin.apps;
    console.log(`Active Firebase apps: ${apps.length}`);
    
    apps.forEach((app, index) => {
      console.log(`App ${index + 1}:`);
      console.log(`  - Name: ${app.name}`);
      console.log(`  - Project ID: ${app.options.projectId}`);
    });

    // Check environment variables that might affect project selection
    console.log('\n🌍 ENVIRONMENT VARIABLES:');
    console.log('=' .repeat(40));
    console.log(`FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID || 'Not set'}`);
    console.log(`GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS || 'Not set'}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'Not set'}`);

    // Check if there are other Firebase config files
    console.log('\n📁 CHECKING FOR OTHER FIREBASE CONFIGS:');
    console.log('=' .repeat(40));
    
    const fs = require('fs');
    const path = require('path');
    
    const possibleConfigs = [
      '../config/firebase-config.json',
      '../config/firebase.json',
      '../firebase.json',
      '../.firebaserc'
    ];
    
    for (const configPath of possibleConfigs) {
      const fullPath = path.join(__dirname, configPath);
      if (fs.existsSync(fullPath)) {
        console.log(`✅ Found: ${configPath}`);
        try {
          const config = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          if (config.projectId) {
            console.log(`   Project ID: ${config.projectId}`);
          }
        } catch (error) {
          console.log(`   (Could not parse JSON)`);
        }
      } else {
        console.log(`❌ Not found: ${configPath}`);
      }
    }

    console.log('\n✅ Firebase project check completed!');

  } catch (error) {
    console.error('❌ Error checking Firebase project:', error);
  }
}

// Main execution
async function main() {
  await checkFirebaseProject();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = checkFirebaseProject;
