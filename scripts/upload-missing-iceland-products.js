const admin = require('firebase-admin');
const serviceAccount = require('../config/firebase-service-account.json');
const fs = require('fs');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

async function uploadMissingIcelandProducts() {
  console.log('🚀 Starting Iceland Products Upload...');
  
  try {
    // Load Iceland backup data
    const icelandBackup = JSON.parse(fs.readFileSync('/Users/renganatharaam/Documents/Grogo_Products_Backup/backup-2025-09-20/Iceland Products/iceland-products.json', 'utf8'));
    const backupProducts = icelandBackup.products || [];
    
    console.log(`📦 Found ${backupProducts.length} products in backup`);
    
    // Get current Firebase Iceland products
    const icelandStoreRef = db.collection('stores').doc('iceland_uxbridge');
    const icelandStore = await icelandStoreRef.get();
    
    if (!icelandStore.exists) {
      console.log('❌ Iceland store not found in Firebase');
      return;
    }
    
    // Get all current products from Firebase
    const currentProducts = new Set();
    const categoriesSnapshot = await icelandStoreRef.collection('categories').get();
    
    for (const categoryDoc of categoriesSnapshot.docs) {
      const productsSnapshot = await categoryDoc.ref.collection('products').get();
      productsSnapshot.docs.forEach(productDoc => {
        currentProducts.add(productDoc.data().name.toLowerCase().trim());
      });
    }
    
    console.log(`📊 Current products in Firebase: ${currentProducts.size}`);
    
    // Find missing products
    const missingProducts = backupProducts.filter(product => {
      const productName = product.name.toLowerCase().trim();
      return !currentProducts.has(productName);
    });
    
    console.log(`🔍 Missing products: ${missingProducts.length}`);
    
    if (missingProducts.length === 0) {
      console.log('✅ All products are already in Firebase');
      return;
    }
    
    // Categorize missing products
    const categorizedProducts = {};
    
    missingProducts.forEach(product => {
      let category = product.category || 'Uncategorized';
      // Clean category name for Firestore document ID
      category = category.replace(/[\/\\]/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
      if (!categorizedProducts[category]) {
        categorizedProducts[category] = [];
      }
      categorizedProducts[category].push(product);
    });
    
    console.log('\n📂 Categories to update:');
    Object.entries(categorizedProducts).forEach(([category, products]) => {
      console.log(`  ${category}: ${products.length} products`);
    });
    
    // Upload missing products
    let uploadedCount = 0;
    let errorCount = 0;
    
    for (const [categoryName, products] of Object.entries(categorizedProducts)) {
      console.log(`\n📦 Processing category: ${categoryName}`);
      
      // Get or create category
      let categoryRef = icelandStoreRef.collection('categories').doc(categoryName);
      let categoryDoc = await categoryRef.get();
      
      if (!categoryDoc.exists) {
        console.log(`  Creating new category: ${categoryName}`);
        await categoryRef.set({
          name: categoryName,
          productCount: 0,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Upload products in batches
      const batch = db.batch();
      let batchCount = 0;
      
      for (const product of products) {
        try {
          // Generate unique ID
          const productId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Clean and format product data
          const productData = {
            id: productId,
            name: product.name.trim(),
            price: parseFloat(product.price) || 0,
            currency: 'GBP',
            image: product.image || '',
            description: product.description || '',
            brand: product.brand || '',
            category: product.category || 'Uncategorized', // Use original category name
            subcategory: product.subcategory || '',
            inStock: true,
            storeType: 'iceland',
            storeId: 'iceland_uxbridge',
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          };
          
          // Add to batch
          batch.set(categoryRef.collection('products').doc(productId), productData);
          batchCount++;
          uploadedCount++;
          
          // Commit batch every 500 products
          if (batchCount >= 500) {
            await batch.commit();
            console.log(`  ✅ Uploaded batch of ${batchCount} products`);
            batchCount = 0;
          }
          
        } catch (error) {
          console.error(`  ❌ Error processing product ${product.name}:`, error.message);
          errorCount++;
        }
      }
      
      // Commit remaining products
      if (batchCount > 0) {
        await batch.commit();
        console.log(`  ✅ Uploaded final batch of ${batchCount} products`);
      }
      
      // Update category product count
      const newProductCount = products.length;
      const currentCount = categoryDoc.exists ? (categoryDoc.data().productCount || 0) : 0;
      
      await categoryRef.update({
        productCount: currentCount + newProductCount,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`  ✅ Updated category ${categoryName} with ${newProductCount} products`);
    }
    
    // Update store total product count
    const storeData = icelandStore.data();
    const newTotalCount = (storeData.productCount || 0) + uploadedCount;
    
    await icelandStoreRef.update({
      productCount: newTotalCount,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('\n🎉 Iceland Products Upload Completed!');
    console.log(`📊 Summary:`);
    console.log(`  ✅ Products uploaded: ${uploadedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📦 New total products: ${newTotalCount}`);
    
    return {
      success: true,
      uploaded: uploadedCount,
      errors: errorCount,
      totalProducts: newTotalCount
    };
    
  } catch (error) {
    console.error('❌ Error during Iceland products upload:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run upload
uploadMissingIcelandProducts()
  .then(result => {
    if (result.success) {
      console.log('\n✅ Upload process completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Upload process failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Upload process crashed:', error);
    process.exit(1);
  });
