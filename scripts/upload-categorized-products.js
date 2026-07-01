const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load service account key
const serviceAccount = require('../grogo-66a50-firebase-adminsdk-fbsvc-a39e0229e2.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'grogo-66a50'
});

const db = admin.firestore();

// Function to upload categorized products to Firebase
async function uploadCategorizedProducts() {
  try {
    console.log('Starting upload of categorized products to Firebase...');
    
    // Load categorized data
    const categorizedDataPath = path.join(__dirname, '../data/categorized-products.json');
    const categorizedData = JSON.parse(fs.readFileSync(categorizedDataPath, 'utf8'));
    
    console.log(`📊 Loaded categorized data: ${categorizedData.summary.totalProducts} products across ${categorizedData.summary.totalStores} stores`);

    // Upload store information first
    for (const [storeId, storeData] of Object.entries(categorizedData.stores)) {
      console.log(`\n🏪 Uploading store: ${storeData.name}`);
      
      // Upload store document
      await db.collection('stores').doc(storeId).set({
        name: storeData.name,
        address: storeData.address,
        storeId: storeData.storeId,
        productCount: storeData.productCount,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`   ✅ Store info uploaded`);

      // Upload products by category
      const batch = db.batch();
      let batchCount = 0;
      const maxBatchSize = 500; // Firestore batch limit

      for (const [category, products] of Object.entries(storeData.categories)) {
        console.log(`   📁 Uploading category: ${category} (${products.length} products)`);
        
        // Create category document
        const categoryRef = db.collection('stores').doc(storeId).collection('categories').doc(category);
        batch.set(categoryRef, {
          name: category,
          productCount: products.length,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        batchCount++;

        // Upload products in this category
        for (const product of products) {
          if (batchCount >= maxBatchSize) {
            await batch.commit();
            console.log(`   ✅ Batch committed (${batchCount} operations)`);
            batchCount = 0;
          }

          const productRef = categoryRef.collection('products').doc(product.id);
          batch.set(productRef, {
            ...product,
            storeId: storeId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          });
          batchCount++;
        }
      }

      // Commit remaining operations
      if (batchCount > 0) {
        await batch.commit();
        console.log(`   ✅ Final batch committed (${batchCount} operations)`);
      }

      console.log(`   🎉 Completed upload for ${storeData.name}`);
    }

    // Generate upload summary
    const uploadSummary = {
      timestamp: new Date().toISOString(),
      projectId: 'grogo-66a50',
      stores: Object.keys(categorizedData.stores),
      totalProducts: categorizedData.summary.totalProducts,
      totalStores: categorizedData.summary.totalStores,
      categories: categorizedData.summary.categories
    };

    // Save upload summary
    const summaryPath = path.join(__dirname, '../data/upload-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(uploadSummary, null, 2));

    console.log('\n🎉 All products uploaded successfully!');
    console.log(`📊 Summary saved to: ${summaryPath}`);
    console.log(`\n📋 Upload Summary:`);
    console.log(`   Total Products: ${uploadSummary.totalProducts}`);
    console.log(`   Total Stores: ${uploadSummary.totalStores}`);
    console.log(`   Stores: ${uploadSummary.stores.join(', ')}`);

    return uploadSummary;
    
  } catch (error) {
    console.error('❌ Error uploading products:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      details: error.details
    });
    throw error;
  }
}

// Function to test basic Firebase connection
async function testConnection() {
  try {
    console.log('Testing Firebase connection...');
    
    // Test basic connection
    const testRef = db.collection('test').doc('connection-test');
    await testRef.set({
      message: 'Connection test successful',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Write test successful');
    
    // Test read operation
    const doc = await testRef.get();
    if (doc.exists) {
      console.log('✅ Read test successful');
    }
    
    // Clean up test document
    await testRef.delete();
    console.log('✅ Cleanup successful');
    
    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return false;
  }
}

// Run the upload process
if (require.main === module) {
  (async () => {
    try {
      // First test the connection
      const connectionOk = await testConnection();
      if (!connectionOk) {
        console.log('\n❌ Firebase connection failed. Please check:');
        console.log('1. Firestore database is enabled in Firebase Console');
        console.log('2. Service account has proper permissions');
        console.log('3. Project ID is correct');
        process.exit(1);
      }

      // If connection is good, proceed with upload
      await uploadCategorizedProducts();
      console.log('\n✅ Upload completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Upload failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = {
  uploadCategorizedProducts,
  testConnection
};
