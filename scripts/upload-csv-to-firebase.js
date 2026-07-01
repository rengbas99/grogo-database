/**
 * Upload CSV Data to Firebase
 * Uploads the essentials-only-categorized.csv data to Firebase for the mobile app
 */

const admin = require('firebase-admin');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../config/firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'grogo-mvp'
});

const db = admin.firestore();

// Store mapping
const STORE_MAPPING = {
  'Tesco': 'tesco_uxbridge',
  'Sainsburys': 'sainsbury_uxbridge', 
  'Aldi': 'aldi_west_drayton',
  'Lidl': 'lidl_uxbridge_cowley',
  'Iceland': 'iceland_uxbridge'
};

// Category mapping
const CATEGORY_MAPPING = {
  'Cooking Essentials': 'cooking_essentials',
  'Household Essentials': 'household_essentials',
  'Sanitary & Personal Care': 'personal_care',
  'Fruits': 'fruits',
  'Staples': 'staples',
  'Dairy/Protein': 'dairy_protein',
  'Snacks': 'snacks',
  'meat_fish': 'meat_fish'
};

async function uploadCSVToFirebase() {
  try {
    console.log('🚀 Starting CSV upload to Firebase...');
    
    const csvPath = path.join(__dirname, '../data/essentials-only-categorized.csv');
    
    if (!fs.existsSync(csvPath)) {
      throw new Error('CSV file not found: ' + csvPath);
    }

    const products = [];
    const storeStats = {};
    
    // Read CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          if (row.Name && row.Store && row['Categorized Category']) {
            const product = {
              id: row['t ID'] || `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: row.Name,
              store: row.Store,
              category: row['Categorized Category'],
              price: parseFloat(row.Price) || 0,
              searchTerm: row['Search Term'] || row.Name.toLowerCase(),
              hasImage: row['Has Image'] === 'Yes',
              hasDescription: row['Has Description'] === 'Yes',
              hasExpiry: row['Has Expiry'] === 'Yes',
              hasPrice: row['Has Price'] === 'Yes',
              imageUrl: row['Image URL'] || '',
              description: row.Description || '',
              expiryDate: row['Expiry Date'] || '',
              storageInfo: row['Storage Info'] || '',
              ingredients: row.Ingredients || '',
              allergens: row.Allergens || '',
              nutritionInfo: row['Nutrition Info'] || '',
              scrapedAt: row['Scraped At'] || new Date().toISOString(),
              source: row.Source || 'firebase',
              isEssential: row['Is Essential'] === 'Yes',
              categoryScore: parseInt(row['Category Score']) || 0
            };
            
            products.push(product);
            
            // Track store stats
            if (!storeStats[product.store]) {
              storeStats[product.store] = 0;
            }
            storeStats[product.store]++;
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`📊 Loaded ${products.length} products from CSV`);
    console.log('Store breakdown:', storeStats);

    // Group products by store
    const productsByStore = {};
    products.forEach(product => {
      const storeId = STORE_MAPPING[product.store] || product.store.toLowerCase().replace(/\s+/g, '_');
      if (!productsByStore[storeId]) {
        productsByStore[storeId] = [];
      }
      productsByStore[storeId].push(product);
    });

    // Upload to Firebase
    for (const [storeId, storeProducts] of Object.entries(productsByStore)) {
      console.log(`\n🏪 Uploading ${storeProducts.length} products to store: ${storeId}`);
      
      // Create store document
      const storeRef = db.collection('stores').doc(storeId);
      await storeRef.set({
        id: storeId,
        name: storeProducts[0].store,
        address: getStoreAddress(storeId),
        productCount: storeProducts.length,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Group products by category
      const productsByCategory = {};
      storeProducts.forEach(product => {
        const categoryId = CATEGORY_MAPPING[product.category] || product.category.toLowerCase().replace(/\s+/g, '_');
        if (!productsByCategory[categoryId]) {
          productsByCategory[categoryId] = [];
        }
        productsByCategory[categoryId].push(product);
      });

      // Upload products by category
      for (const [categoryId, categoryProducts] of Object.entries(productsByCategory)) {
        console.log(`  📂 Uploading ${categoryProducts.length} products to category: ${categoryId}`);
        
        // Create category document
        const categoryRef = storeRef.collection('categories').doc(categoryId);
        await categoryRef.set({
          id: categoryId,
          name: categoryProducts[0].category,
          productCount: categoryProducts.length,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });

        // Upload products in batches
        const batch = db.batch();
        let batchCount = 0;
        const BATCH_SIZE = 500;

        for (const product of categoryProducts) {
          const productRef = categoryRef.collection('products').doc(product.id);
          batch.set(productRef, {
            ...product,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          batchCount++;
          
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`    ✅ Uploaded batch of ${batchCount} products`);
            batchCount = 0;
          }
        }

        // Commit remaining products
        if (batchCount > 0) {
          await batch.commit();
          console.log(`    ✅ Uploaded final batch of ${batchCount} products`);
        }
      }
    }

    console.log('\n🎉 CSV upload completed successfully!');
    console.log('📊 Final stats:');
    Object.entries(storeStats).forEach(([store, count]) => {
      console.log(`  ${store}: ${count} products`);
    });

  } catch (error) {
    console.error('❌ Error uploading CSV to Firebase:', error);
    throw error;
  }
}

function getStoreAddress(storeId) {
  const addresses = {
    'tesco_uxbridge': '62 High St, Uxbridge UB8 1ND',
    'sainsbury_uxbridge': 'York Rd, Uxbridge UB8 1QW',
    'aldi_west_drayton': 'High St, West Drayton UB7 7QN',
    'lidl_uxbridge_cowley': '137 Cowley Rd, Uxbridge, London UB8 2AG',
    'iceland_uxbridge': "27 Grainge's Yard, Uxbridge UB8 1LH"
  };
  return addresses[storeId] || 'Address not available';
}

// Run the upload
if (require.main === module) {
  uploadCSVToFirebase()
    .then(() => {
      console.log('✅ Upload completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Upload failed:', error);
      process.exit(1);
    });
}

module.exports = { uploadCSVToFirebase };
