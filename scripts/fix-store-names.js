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

async function fixStoreNames() {
  try {
    console.log('🔧 Fixing store names in store_products collection...\n');
    
    // Get all store_products
    const storeProductsSnapshot = await db.collection('store_products').get();
    console.log(`📊 Found ${storeProductsSnapshot.size} store_products entries`);
    
    // Get all products to map productId to store
    const productsSnapshot = await db.collection('products').get();
    const productToStoreMap = new Map();
    
    productsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.store) {
        productToStoreMap.set(doc.id, data.store);
      }
    });
    
    console.log(`📊 Mapped ${productToStoreMap.size} products to stores`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let batchCount = 0;
    let batch = db.batch();
    
    for (const doc of storeProductsSnapshot.docs) {
      const data = doc.data();
      const productId = data.productId;
      
      if (productId && productToStoreMap.has(productId)) {
        const storeName = productToStoreMap.get(productId);
        
        // Update the store_products document
        batch.update(doc.ref, {
          storeName: storeName,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        updatedCount++;
        batchCount++;
        
        // Commit batch every 500 operations
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`✅ Committed batch of ${batchCount} updates`);
          batchCount = 0;
          batch = db.batch(); // Create new batch
        }
        
        if (updatedCount % 100 === 0) {
          console.log(`📈 Progress: ${updatedCount} updated`);
        }
      } else {
        skippedCount++;
        if (skippedCount % 100 === 0) {
          console.log(`⏭️  Skipped: ${skippedCount} (no store mapping)`);
        }
      }
    }
    
    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final batch of ${batchCount} updates`);
    }
    
    console.log(`\n🎉 Store names fix completed!`);
    console.log(`✅ Updated: ${updatedCount} store_products`);
    console.log(`⏭️  Skipped: ${skippedCount} store_products`);
    
    // Verify the fix
    console.log(`\n🔍 Verifying fix...`);
    const verifySnapshot = await db.collection('store_products').limit(5).get();
    verifySnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${doc.id}: storeName = ${data.storeName || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing store names:', error);
  }
}

fixStoreNames().catch(console.error);