const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../grogo-mvp-firebase-adminsdk-fbsvc-9caddcb9d0.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkStoreProducts() {
  try {
    console.log('🔍 Checking store_products collection...');
    
    // Check store_products collection
    const storeProductsSnapshot = await db.collection('store_products').limit(10).get();
    console.log(`📊 Store products collection has ${storeProductsSnapshot.size} documents (showing first 10)`);
    
    storeProductsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- ID: ${doc.id}`);
      console.log(`  Name: ${data.name}`);
      console.log(`  Store Type: ${data.storeType}`);
      console.log(`  Store ID: ${data.storeId}`);
      console.log('---');
    });
    
    // Check specifically for Lidl products in store_products
    console.log('\n🔍 Checking for Lidl products in store_products...');
    const lidlSnapshot = await db.collection('store_products')
      .where('storeType', '==', 'lidl')
      .limit(5)
      .get();
    console.log(`📊 Found ${lidlSnapshot.size} Lidl products in store_products`);
    
    lidlSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- ID: ${doc.id} - ${data.name}`);
    });
    
    // Check for Lidl by storeId
    console.log('\n🔍 Checking for Lidl products by storeId...');
    const lidlByIdSnapshot = await db.collection('store_products')
      .where('storeId', '==', 'lidl_uxbridge_cowley')
      .limit(5)
      .get();
    console.log(`📊 Found ${lidlByIdSnapshot.size} Lidl products by storeId`);
    
    lidlByIdSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- ID: ${doc.id} - ${data.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking store_products:', error);
  } finally {
    process.exit(0);
  }
}

// Run the check
checkStoreProducts();
