const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../grogo-mvp-firebase-adminsdk-fbsvc-9caddcb9d0.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function removeLidlDuplicates() {
  try {
    console.log('🔍 Fetching Lidl products...');
    
    // Get all Lidl products
    const lidlProductsRef = db.collection('products').where('storeType', '==', 'lidl');
    const snapshot = await lidlProductsRef.get();
    
    console.log(`📊 Found ${snapshot.size} total Lidl products`);
    
    // Group products by name to find duplicates
    const productsByName = {};
    const duplicatesToDelete = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const productName = data.name;
      
      if (!productsByName[productName]) {
        productsByName[productName] = [];
      }
      
      productsByName[productName].push({
        id: doc.id,
        data: data,
        docRef: doc.ref
      });
    });
    
    // Find duplicates and mark the "unknown-" prefixed ones for deletion
    Object.entries(productsByName).forEach(([name, products]) => {
      if (products.length > 1) {
        console.log(`🔄 Found ${products.length} duplicates for: ${name}`);
        
        // Sort by ID - keep the one without "unknown-" prefix
        products.sort((a, b) => {
          const aIsUnknown = a.id.startsWith('unknown-');
          const bIsUnknown = b.id.startsWith('unknown-');
          
          if (aIsUnknown && !bIsUnknown) return 1; // a is unknown, b is not - keep b
          if (!aIsUnknown && bIsUnknown) return -1; // a is not unknown, b is - keep a
          return 0; // both same type, keep first
        });
        
        // Mark all but the first (best) one for deletion
        for (let i = 1; i < products.length; i++) {
          duplicatesToDelete.push(products[i]);
        }
      }
    });
    
    console.log(`🗑️  Found ${duplicatesToDelete.length} duplicate products to delete`);
    
    // Delete duplicates in batches
    const batchSize = 10;
    for (let i = 0; i < duplicatesToDelete.length; i += batchSize) {
      const batch = db.batch();
      const batchItems = duplicatesToDelete.slice(i, i + batchSize);
      
      batchItems.forEach(item => {
        console.log(`🗑️  Deleting duplicate: ${item.id} - ${item.data.name}`);
        batch.delete(item.docRef);
      });
      
      await batch.commit();
      console.log(`✅ Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(duplicatesToDelete.length / batchSize)}`);
    }
    
    // Verify the cleanup
    const finalSnapshot = await lidlProductsRef.get();
    console.log(`✅ Cleanup complete! Lidl now has ${finalSnapshot.size} unique products`);
    
    // Show remaining products
    console.log('\n📋 Remaining Lidl products:');
    finalSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- ${data.name} (ID: ${doc.id})`);
    });
    
  } catch (error) {
    console.error('❌ Error removing duplicates:', error);
  } finally {
    process.exit(0);
  }
}

// Run the cleanup
removeLidlDuplicates();
