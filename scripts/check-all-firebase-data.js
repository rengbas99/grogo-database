#!/usr/bin/env node

/**
 * Check All Firebase Data
 * Comprehensive check of all collections and data in Firebase
 */

const admin = require('firebase-admin');

async function checkAllFirebaseData() {
  try {
    console.log('🔍 Checking ALL Firebase Data...');
    console.log('=' .repeat(60));

    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      const serviceAccount = require('../config/firebase-service-account.json');
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      
      console.log('✅ Firebase Admin SDK initialized');
    }

    const db = admin.firestore();
    console.log('✅ Firestore database connected');

    // Get all collections
    console.log('\n📂 ALL COLLECTIONS:');
    console.log('=' .repeat(40));
    const collections = await db.listCollections();
    console.log(`Found ${collections.length} collections:`);
    
    for (const collection of collections) {
      console.log(`\n📁 Collection: ${collection.id}`);
      console.log('-'.repeat(30));
      
      // Get document count
      const snapshot = await collection.limit(1000).get();
      console.log(`   Documents: ${snapshot.size}`);
      
      if (snapshot.size > 0) {
        // Show sample documents
        console.log('   Sample documents:');
        let count = 0;
        snapshot.forEach(doc => {
          if (count < 3) { // Show first 3 documents
            const data = doc.data();
            console.log(`   - ID: ${doc.id}`);
            console.log(`     Data keys: ${Object.keys(data).join(', ')}`);
            
            // Show specific fields for products
            if (data.name) console.log(`     Name: ${data.name}`);
            if (data.store) console.log(`     Store: ${data.store}`);
            if (data.price) console.log(`     Price: ${data.price}`);
            if (data.image) console.log(`     Image: ${data.image.substring(0, 50)}...`);
            console.log('');
            count++;
          }
        });
        
        if (snapshot.size > 3) {
          console.log(`   ... and ${snapshot.size - 3} more documents`);
        }
      }
    }

    // Check for subcollections
    console.log('\n🔍 CHECKING FOR SUBCOLLECTIONS:');
    console.log('=' .repeat(40));
    
    for (const collection of collections) {
      const snapshot = await collection.limit(10).get();
      for (const doc of snapshot.docs) {
        const subcollections = await doc.ref.listCollections();
        if (subcollections.length > 0) {
          console.log(`\n📁 Document ${doc.id} in ${collection.id} has subcollections:`);
          for (const subcol of subcollections) {
            const subSnapshot = await subcol.limit(5).get();
            console.log(`   - ${subcol.id}: ${subSnapshot.size} documents`);
          }
        }
      }
    }

    // Check for products specifically
    console.log('\n🛍️  PRODUCTS ANALYSIS:');
    console.log('=' .repeat(40));
    
    const productsSnapshot = await db.collection('products').get();
    console.log(`Products collection: ${productsSnapshot.size} documents`);
    
    if (productsSnapshot.size > 0) {
      console.log('\nSample products:');
      let count = 0;
      productsSnapshot.forEach(doc => {
        if (count < 5) {
          const data = doc.data();
          console.log(`- ${data.name || 'Unknown'} (${data.store || 'Unknown Store'}) - £${data.price || 'N/A'}`);
          count++;
        }
      });
    }

    // Check store_products
    const storeProductsSnapshot = await db.collection('store_products').get();
    console.log(`\nStore Products collection: ${storeProductsSnapshot.size} documents`);
    
    if (storeProductsSnapshot.size > 0) {
      console.log('\nSample store products:');
      let count = 0;
      storeProductsSnapshot.forEach(doc => {
        if (count < 5) {
          const data = doc.data();
          console.log(`- ${data.productName || 'Unknown'} (${data.storeName || 'Unknown Store'}) - £${data.price || 'N/A'}`);
          count++;
        }
      });
    }

    // Check stores collection
    const storesSnapshot = await db.collection('stores').get();
    console.log(`\nStores collection: ${storesSnapshot.size} documents`);
    
    if (storesSnapshot.size > 0) {
      console.log('\nStores:');
      storesSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ${data.name || 'Unknown'} (${data.address || 'No address'})`);
      });
    }

    console.log('\n✅ Firebase data check completed!');

  } catch (error) {
    console.error('❌ Error checking Firebase data:', error);
  }
}

// Main execution
async function main() {
  await checkAllFirebaseData();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = checkAllFirebaseData;


