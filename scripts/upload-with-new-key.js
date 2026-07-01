const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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

// Function to initialize Firebase with new service account
function initializeFirebase(serviceAccountPath, projectId) {
  try {
    // Load service account key
    const serviceAccount = require(serviceAccountPath);
    
    // Initialize Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId
    });

    const db = admin.firestore();
    console.log(`✅ Firebase initialized with project: ${projectId}`);
    return db;
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error.message);
    throw error;
  }
}

// Function to test Firebase connection
async function testConnection(db) {
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

// Function to upload categorized products to Firebase
async function uploadCategorizedProducts(db, projectId) {
  try {
    console.log(`Starting upload of categorized products to ${projectId}...`);
    
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
      for (const [category, products] of Object.entries(storeData.categories)) {
        console.log(`   📁 Uploading category: ${category} (${products.length} products)`);
        
        // Create category document
        const categoryRef = db.collection('stores').doc(storeId).collection('categories').doc(category);
        await categoryRef.set({
          name: category,
          productCount: products.length,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });

        // Upload products in batches
        const batch = db.batch();
        let batchCount = 0;
        const maxBatchSize = 500; // Firestore batch limit

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

        // Commit remaining operations for this category
        if (batchCount > 0) {
          await batch.commit();
          console.log(`   ✅ Final batch committed (${batchCount} operations)`);
        }
      }

      console.log(`   🎉 Completed upload for ${storeData.name}`);
    }

    // Generate upload summary
    const uploadSummary = {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      stores: Object.keys(categorizedData.stores),
      totalProducts: categorizedData.summary.totalProducts,
      totalStores: categorizedData.summary.totalStores,
      categories: categorizedData.summary.categories
    };

    // Save upload summary
    const summaryPath = path.join(__dirname, `../data/upload-summary-${projectId}.json`);
    fs.writeFileSync(summaryPath, JSON.stringify(uploadSummary, null, 2));

    console.log('\n🎉 All products uploaded successfully!');
    console.log(`📊 Summary saved to: ${summaryPath}`);
    console.log(`\n📋 Upload Summary:`);
    console.log(`   Project: ${projectId}`);
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

// Main function to run the upload
async function runUpload(serviceAccountPath, projectId) {
  try {
    console.log('🚀 Starting Grogo Product Upload');
    console.log('================================\n');
    
    // Initialize Firebase
    const db = initializeFirebase(serviceAccountPath, projectId);
    
    // Test connection
    const connectionOk = await testConnection(db);
    if (!connectionOk) {
      console.log('\n❌ Firebase connection failed. Please check:');
      console.log('1. Service account key file exists and is valid');
      console.log('2. Firestore database is enabled in the project');
      console.log('3. Project ID is correct');
      process.exit(1);
    }

    // Upload products
    await uploadCategorizedProducts(db, projectId);
    console.log('\n✅ Upload completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Upload failed:', error);
    process.exit(1);
  }
}

// Command line usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node upload-with-new-key.js <service-account-path> <project-id>');
    console.log('Example: node upload-with-new-key.js ../new-service-account.json grogo-stores-12345');
    process.exit(1);
  }
  
  const [serviceAccountPath, projectId] = args;
  runUpload(serviceAccountPath, projectId);
}

module.exports = {
  runUpload,
  initializeFirebase,
  testConnection,
  uploadCategorizedProducts
};
