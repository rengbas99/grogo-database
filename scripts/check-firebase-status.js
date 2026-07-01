#!/usr/bin/env node

/**
 * Check Firebase Server Status
 * Verify if Firebase is running and accessible
 */

const admin = require('firebase-admin');

class FirebaseStatusChecker {
  constructor() {
    this.db = null;
    this.status = {
      connected: false,
      projectId: null,
      collections: [],
      totalDocuments: 0,
      error: null,
      startTime: new Date()
    };
  }

  async checkFirebaseStatus() {
    try {
      console.log('🔥 Checking Firebase Server Status...');
      console.log('=' .repeat(50));

      // Initialize Firebase
      await this.initializeFirebase();

      // Test connection
      await this.testConnection();

      // Get basic stats
      await this.getBasicStats();

      // Display results
      this.displayResults();

    } catch (error) {
      console.error('❌ Error checking Firebase status:', error);
      this.status.error = error.message;
      this.displayResults();
    }
  }

  async initializeFirebase() {
    try {
      if (!admin.apps.length) {
        const serviceAccount = require('../config/firebase-service-account.json');
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
        
        this.status.projectId = serviceAccount.project_id;
        console.log(`✅ Firebase initialized for project: ${serviceAccount.project_id}`);
      } else {
        this.status.projectId = admin.app().options.projectId;
        console.log(`✅ Firebase already initialized for project: ${this.status.projectId}`);
      }
      
      this.db = admin.firestore();
      this.status.connected = true;
      
    } catch (error) {
      throw new Error(`Failed to initialize Firebase: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      console.log('🔍 Testing Firebase connection...');
      
      // Try to read from a collection
      const testSnapshot = await this.db.collection('stores').limit(1).get();
      
      if (testSnapshot) {
        console.log('✅ Firebase connection successful');
        this.status.connected = true;
      } else {
        throw new Error('Connection test failed');
      }
      
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  async getBasicStats() {
    try {
      console.log('📊 Gathering basic statistics...');
      
      // Get collections
      const collections = ['stores', 'products', 'store_products'];
      
      for (const collectionName of collections) {
        try {
          const snapshot = await this.db.collection(collectionName).get();
          const count = snapshot.size;
          
          this.status.collections.push({
            name: collectionName,
            count: count,
            accessible: true
          });
          
          this.status.totalDocuments += count;
          console.log(`   📁 ${collectionName}: ${count} documents`);
          
        } catch (error) {
          this.status.collections.push({
            name: collectionName,
            count: 0,
            accessible: false,
            error: error.message
          });
          console.log(`   ❌ ${collectionName}: Not accessible (${error.message})`);
        }
      }
      
    } catch (error) {
      console.log(`⚠️  Error gathering stats: ${error.message}`);
    }
  }

  displayResults() {
    const duration = (new Date() - this.status.startTime) / 1000;
    
    console.log('\n🔥 FIREBASE STATUS REPORT');
    console.log('=' .repeat(50));
    console.log(`⏱️  Check Duration: ${duration.toFixed(2)} seconds`);
    console.log(`🏗️  Project ID: ${this.status.projectId || 'Unknown'}`);
    console.log(`🔗 Connection Status: ${this.status.connected ? '✅ CONNECTED' : '❌ DISCONNECTED'}`);
    
    if (this.status.error) {
      console.log(`❌ Error: ${this.status.error}`);
    }
    
    console.log('\n📊 COLLECTION STATUS:');
    console.log('─'.repeat(30));
    
    this.status.collections.forEach(collection => {
      const status = collection.accessible ? '✅' : '❌';
      const count = collection.count || 0;
      console.log(`${status} ${collection.name}: ${count} documents`);
      
      if (collection.error) {
        console.log(`   Error: ${collection.error}`);
      }
    });
    
    console.log(`\n📈 TOTAL DOCUMENTS: ${this.status.totalDocuments}`);
    
    // Overall status
    if (this.status.connected && this.status.totalDocuments > 0) {
      console.log('\n🎉 Firebase is running and accessible!');
      console.log('✅ Your mobile app should be able to connect to the database');
    } else if (this.status.connected) {
      console.log('\n⚠️  Firebase is connected but has no data');
      console.log('💡 You may need to upload products to the database');
    } else {
      console.log('\n❌ Firebase is not accessible');
      console.log('💡 Check your internet connection and Firebase configuration');
    }
    
    // Service account check
    try {
      const serviceAccount = require('../config/firebase-service-account.json');
      console.log('\n🔑 SERVICE ACCOUNT:');
      console.log(`   Project ID: ${serviceAccount.project_id}`);
      console.log(`   Client Email: ${serviceAccount.client_email}`);
      console.log(`   Private Key: ${serviceAccount.private_key ? 'Present' : 'Missing'}`);
    } catch (error) {
      console.log('\n❌ SERVICE ACCOUNT:');
      console.log('   Error: Service account file not found or invalid');
    }
  }
}

// Main execution
async function main() {
  const checker = new FirebaseStatusChecker();
  await checker.checkFirebaseStatus();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = FirebaseStatusChecker;

