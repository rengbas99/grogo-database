const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

// Initialize Firebase Admin with the existing project configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "your_api_key",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "your_auth_domain",
  projectId: process.env.FIREBASE_PROJECT_ID || "your_project_id",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "your_storage_bucket",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "your_messaging_sender_id",
  appId: process.env.FIREBASE_APP_ID || "your_app_id"
};

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID || 'grogo-mvp'
});

const db = admin.firestore();

// Store configuration
const STORES = {
  tesco_uxbridge: {
    name: "Tesco Uxbridge",
    address: "62 High St, Uxbridge UB8 1ND",
    storeId: "tesco_uxbridge"
  },
  sainsbury_uxbridge: {
    name: "Sainsbury Uxbridge", 
    address: "York Rd, Uxbridge UB8 1QW",
    storeId: "sainsbury_uxbridge"
  },
  aldi_west_drayton: {
    name: "Aldi West Drayton",
    address: "High St, West Drayton UB7 7QN", 
    storeId: "aldi_west_drayton"
  },
  lidl_uxbridge_cowley: {
    name: "Lidl Uxbridge",
    address: "137 Cowley Rd, Uxbridge, London UB8 2AG",
    storeId: "lidl_uxbridge_cowley"
  },
  lidl_uxbridge_high_st: {
    name: "Lidl Uxbridge",
    address: "High St, Uxbridge UB8 1LA", 
    storeId: "lidl_uxbridge_high_st"
  }
};

// Function to test Firebase connection
async function testConnection() {
  try {
    console.log('Testing Firebase connection to grogo-mvp...');
    
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

// Function to upload categorized products to Firebase
async function uploadCategorizedProducts() {
  try {
    console.log('Starting upload of categorized products to grogo-mvp Firebase...');
    
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
      projectId: 'grogo-mvp',
      stores: Object.keys(categorizedData.stores),
      totalProducts: categorizedData.summary.totalProducts,
      totalStores: categorizedData.summary.totalStores,
      categories: categorizedData.summary.categories
    };

    // Save upload summary
    const summaryPath = path.join(__dirname, '../data/upload-summary-grogo-mvp.json');
    fs.writeFileSync(summaryPath, JSON.stringify(uploadSummary, null, 2));

    console.log('\n🎉 All products uploaded successfully to grogo-mvp!');
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

// Run the upload process
if (require.main === module) {
  (async () => {
    try {
      // First test the connection
      const connectionOk = await testConnection();
      if (!connectionOk) {
        console.log('\n❌ Firebase connection failed. Please check:');
        console.log('1. You are authenticated with Firebase CLI: firebase login');
        console.log('2. The grogo-mvp project exists and has Firestore enabled');
        console.log('3. You have proper permissions');
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






