const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../grogo-mvp-firebase-adminsdk-fbsvc-9caddcb9d0.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkStoresStructure() {
  try {
    console.log('🔍 Checking stores collection...');
    
    // Check stores collection
    const storesSnapshot = await db.collection('stores').get();
    console.log(`📊 Stores collection has ${storesSnapshot.size} documents`);
    
    storesSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- Store ID: ${doc.id}`);
      console.log(`  Name: ${data.name}`);
      console.log(`  Type: ${data.type}`);
      console.log('---');
    });
    
    // Check if lidl_uxbridge_cowley store exists
    console.log('\n🔍 Checking lidl_uxbridge_cowley store...');
    const lidlStoreRef = db.collection('stores').doc('lidl_uxbridge_cowley');
    const lidlStoreDoc = await lidlStoreRef.get();
    
    if (lidlStoreDoc.exists) {
      console.log('✅ Lidl store exists');
      const storeData = lidlStoreDoc.data();
      console.log('Store data:', storeData);
      
      // Check categories subcollection
      const categoriesSnapshot = await lidlStoreRef.collection('categories').get();
      console.log(`📊 Lidl store has ${categoriesSnapshot.size} categories`);
      
      categoriesSnapshot.forEach(doc => {
        console.log(`- Category: ${doc.id}`);
      });
      
      // Check if there are products in any category
      if (categoriesSnapshot.size > 0) {
        const firstCategory = categoriesSnapshot.docs[0];
        const productsSnapshot = await firstCategory.ref.collection('products').limit(5).get();
        console.log(`📊 First category has ${productsSnapshot.size} products (showing first 5)`);
        
        productsSnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`- Product ID: ${doc.id} - ${data.name}`);
        });
      }
    } else {
      console.log('❌ Lidl store does not exist');
    }
    
  } catch (error) {
    console.error('❌ Error checking stores structure:', error);
  } finally {
    process.exit(0);
  }
}

// Run the check
checkStoresStructure();
