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
    console.log('🔍 Fetching Lidl products from store structure...');
    
    // Get the Lidl store reference
    const lidlStoreRef = db.collection('stores').doc('lidl_uxbridge_cowley');
    const lidlStoreDoc = await lidlStoreRef.get();
    
    if (!lidlStoreDoc.exists) {
      console.log('❌ Lidl store not found');
      return;
    }
    
    console.log('✅ Lidl store found');
    
    // Get all categories
    const categoriesSnapshot = await lidlStoreRef.collection('categories').get();
    console.log(`📊 Found ${categoriesSnapshot.size} categories`);
    
    let totalProducts = 0;
    let duplicatesFound = 0;
    const duplicatesToDelete = [];
    
    // Process each category
    for (const categoryDoc of categoriesSnapshot.docs) {
      const categoryName = categoryDoc.id;
      console.log(`\n🔍 Processing category: ${categoryName}`);
      
      const productsSnapshot = await categoryDoc.ref.collection('products').get();
      console.log(`📊 Found ${productsSnapshot.size} products in ${categoryName}`);
      totalProducts += productsSnapshot.size;
      
      // Group products by name to find duplicates
      const productsByName = {};
      
      productsSnapshot.forEach(doc => {
        const data = doc.data();
        const productName = data.name;
        
        if (!productsByName[productName]) {
          productsByName[productName] = [];
        }
        
        productsByName[productName].push({
          id: doc.id,
          data: data,
          docRef: doc.ref,
          category: categoryName
        });
      });
      
      // Find duplicates in this category
      Object.entries(productsByName).forEach(([name, products]) => {
        if (products.length > 1) {
          console.log(`🔄 Found ${products.length} duplicates for: ${name}`);
          duplicatesFound += products.length - 1;
          
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
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`- Total products found: ${totalProducts}`);
    console.log(`- Duplicates found: ${duplicatesFound}`);
    console.log(`- Products to delete: ${duplicatesToDelete.length}`);
    
    if (duplicatesToDelete.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }
    
    // Delete duplicates in batches
    console.log('\n🗑️  Deleting duplicates...');
    const batchSize = 10;
    for (let i = 0; i < duplicatesToDelete.length; i += batchSize) {
      const batch = db.batch();
      const batchItems = duplicatesToDelete.slice(i, i + batchSize);
      
      batchItems.forEach(item => {
        console.log(`🗑️  Deleting: ${item.id} - ${item.data.name} (${item.category})`);
        batch.delete(item.docRef);
      });
      
      await batch.commit();
      console.log(`✅ Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(duplicatesToDelete.length / batchSize)}`);
    }
    
    // Verify the cleanup
    console.log('\n🔍 Verifying cleanup...');
    let finalCount = 0;
    const finalCategoriesSnapshot = await lidlStoreRef.collection('categories').get();
    
    for (const categoryDoc of finalCategoriesSnapshot.docs) {
      const productsSnapshot = await categoryDoc.ref.collection('products').get();
      finalCount += productsSnapshot.size;
    }
    
    console.log(`✅ Cleanup complete! Lidl now has ${finalCount} unique products`);
    
  } catch (error) {
    console.error('❌ Error removing duplicates:', error);
  } finally {
    process.exit(0);
  }
}

// Run the cleanup
removeLidlDuplicates();
