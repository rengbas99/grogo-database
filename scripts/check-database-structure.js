const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('../config/firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://grogo-mvp.firebaseio.com"
  });
}

const db = admin.firestore();

async function checkDatabaseStructure() {
  try {
    console.log('🔍 Checking database structure...\n');
    
    // Check products collection
    const productsSnapshot = await db.collection('products').limit(5).get();
    console.log(`📦 Products collection: ${productsSnapshot.size} samples`);
    productsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${doc.id}: ${data.name} (store: ${data.store || 'N/A'})`);
    });
    
    // Check store_products collection
    const storeProductsSnapshot = await db.collection('store_products').limit(5).get();
    console.log(`\n🏪 Store Products collection: ${storeProductsSnapshot.size} samples`);
    storeProductsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${doc.id}: ${data.productName || data.name} (store: ${data.storeName || 'N/A'}, productId: ${data.productId || 'N/A'})`);
    });
    
    // Check stores collection
    const storesSnapshot = await db.collection('stores').limit(5).get();
    console.log(`\n🏬 Stores collection: ${storesSnapshot.size} samples`);
    storesSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${doc.id}: ${data.name} (postcode: ${data.postcode || 'N/A'})`);
    });
    
    // Check for connections
    console.log('\n🔗 Checking connections...');
    const allStoreProducts = await db.collection('store_products').get();
    const productIds = new Set();
    const storeNames = new Set();
    
    allStoreProducts.forEach(doc => {
      const data = doc.data();
      if (data.productId) productIds.add(data.productId);
      if (data.storeName) storeNames.add(data.storeName);
    });
    
    console.log(`   Unique product IDs in store_products: ${productIds.size}`);
    console.log(`   Unique store names in store_products: ${Array.from(storeNames).join(', ')}`);
    
    // Check if products exist for these IDs
    let foundProducts = 0;
    for (const productId of Array.from(productIds).slice(0, 10)) {
      const productDoc = await db.collection('products').doc(productId).get();
      if (productDoc.exists) {
        foundProducts++;
        console.log(`   ✅ Product ${productId} exists: ${productDoc.data().name}`);
      } else {
        console.log(`   ❌ Product ${productId} NOT FOUND`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Products with store connections: ${foundProducts}/${Math.min(10, productIds.size)}`);
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  }
}

checkDatabaseStructure().catch(console.error);
