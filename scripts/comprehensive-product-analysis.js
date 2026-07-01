/**
 * Comprehensive Product Analysis
 * Analyzes Firebase data and local backups to categorize products by store
 * and check for photos, descriptions, and expiry timings
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase
async function initializeFirebase() {
  try {
    if (admin.apps.length === 0) {
      const serviceAccount = require('../config/firebase-service-account.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    console.log('✅ Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    return false;
  }
}

// Analyze local backup files
function analyzeLocalBackups() {
  console.log('📁 Analyzing local backup files...\n');
  
  const backupDir = path.join(__dirname, '../data/scraped-products');
  const files = fs.readdirSync(backupDir).filter(file => file.endsWith('.json'));
  
  const storeBreakdown = {};
  const totalProducts = 0;
  const dataFields = {
    hasPhotos: 0,
    hasDescriptions: 0,
    hasExpiryTimings: 0,
    hasPrices: 0,
    hasCategories: 0
  };
  
  files.forEach(file => {
    console.log(`📄 Analyzing ${file}...`);
    try {
      const filePath = path.join(backupDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Check if it's a product array or structured data
      let products = [];
      if (Array.isArray(data)) {
        products = data;
      } else if (data.products && Array.isArray(data.products)) {
        products = data.products;
      } else if (data.essentials) {
        // This is the essentials file with different structure
        console.log(`   📊 Essentials file with ${data.totalProducts} products`);
        return;
      }
      
      console.log(`   📊 Found ${products.length} products`);
      
      products.forEach(product => {
        // Count by store
        if (product.store) {
          storeBreakdown[product.store] = (storeBreakdown[product.store] || 0) + 1;
        }
        
        // Check data fields
        if (product.image || product.photo || product.imageUrl) dataFields.hasPhotos++;
        if (product.description || product.desc) dataFields.hasDescriptions++;
        if (product.expiry || product.expiryDate || product.bestBefore) dataFields.hasExpiryTimings++;
        if (product.price) dataFields.hasPrices++;
        if (product.category) dataFields.hasCategories++;
      });
      
    } catch (error) {
      console.log(`   ❌ Error reading ${file}: ${error.message}`);
    }
  });
  
  console.log('\n📊 Local Backup Store Breakdown:');
  Object.entries(storeBreakdown).forEach(([store, count]) => {
    console.log(`   ${store}: ${count} products`);
  });
  
  console.log('\n📊 Local Backup Data Fields:');
  console.log(`   Photos: ${dataFields.hasPhotos} products`);
  console.log(`   Descriptions: ${dataFields.hasDescriptions} products`);
  console.log(`   Expiry Timings: ${dataFields.hasExpiryTimings} products`);
  console.log(`   Prices: ${dataFields.hasPrices} products`);
  console.log(`   Categories: ${dataFields.hasCategories} products`);
  
  return { storeBreakdown, dataFields };
}

// Analyze Firebase data with detailed field analysis
async function analyzeFirebaseData() {
  console.log('\n🔥 Analyzing Firebase data...\n');
  
  try {
    const db = admin.firestore();
    const productsSnapshot = await db.collection('products').get();
    
    if (productsSnapshot.empty) {
      console.log('❌ No products found in Firebase');
      return;
    }
    
    console.log(`✅ Found ${productsSnapshot.size} products in Firebase\n`);
    
    const storeBreakdown = {};
    const categoryBreakdown = {};
    const dataFields = {
      hasPhotos: 0,
      hasDescriptions: 0,
      hasExpiryTimings: 0,
      hasPrices: 0,
      hasCategories: 0,
      hasImages: 0,
      hasImageUrls: 0
    };
    
    const sampleProducts = [];
    
    productsSnapshot.forEach(doc => {
      const product = doc.data();
      
      // Store breakdown
      const store = product.store || 'undefined';
      storeBreakdown[store] = (storeBreakdown[store] || 0) + 1;
      
      // Category breakdown
      if (product.category) {
        categoryBreakdown[product.category] = (categoryBreakdown[product.category] || 0) + 1;
      }
      
      // Check data fields
      if (product.image || product.photo || product.imageUrl || product.images) dataFields.hasPhotos++;
      if (product.description || product.desc) dataFields.hasDescriptions++;
      if (product.expiry || product.expiryDate || product.bestBefore || product.expiryTiming) dataFields.hasExpiryTimings++;
      if (product.price && product.price !== '') dataFields.hasPrices++;
      if (product.category) dataFields.hasCategories++;
      if (product.image) dataFields.hasImages++;
      if (product.imageUrl) dataFields.hasImageUrls++;
      
      // Collect sample products for detailed analysis
      if (sampleProducts.length < 10) {
        sampleProducts.push({
          id: doc.id,
          name: product.name,
          store: product.store,
          price: product.price,
          category: product.category,
          hasImage: !!(product.image || product.imageUrl),
          hasDescription: !!(product.description || product.desc),
          hasExpiry: !!(product.expiry || product.expiryDate || product.bestBefore),
          scrapedAt: product.scrapedAt
        });
      }
    });
    
    console.log('📊 Firebase Store Breakdown:');
    Object.entries(storeBreakdown).forEach(([store, count]) => {
      console.log(`   ${store}: ${count} products`);
    });
    
    console.log('\n📊 Firebase Category Breakdown:');
    Object.entries(categoryBreakdown).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} products`);
    });
    
    console.log('\n📊 Firebase Data Fields Analysis:');
    console.log(`   Photos/Images: ${dataFields.hasPhotos} products`);
    console.log(`   Descriptions: ${dataFields.hasDescriptions} products`);
    console.log(`   Expiry Timings: ${dataFields.hasExpiryTimings} products`);
    console.log(`   Prices: ${dataFields.hasPrices} products`);
    console.log(`   Categories: ${dataFields.hasCategories} products`);
    console.log(`   Image URLs: ${dataFields.hasImageUrls} products`);
    
    console.log('\n🔍 Sample Products Analysis:');
    sampleProducts.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name}`);
      console.log(`      Store: ${product.store || 'undefined'}`);
      console.log(`      Price: ${product.price || 'N/A'}`);
      console.log(`      Category: ${product.category || 'N/A'}`);
      console.log(`      Image: ${product.hasImage ? '✅' : '❌'}`);
      console.log(`      Description: ${product.hasDescription ? '✅' : '❌'}`);
      console.log(`      Expiry: ${product.hasExpiry ? '✅' : '❌'}`);
      console.log(`      Scraped: ${product.scrapedAt ? new Date(product.scrapedAt).toLocaleString() : 'Invalid Date'}`);
      console.log('');
    });
    
    return { storeBreakdown, categoryBreakdown, dataFields };
    
  } catch (error) {
    console.error('❌ Error analyzing Firebase data:', error.message);
    return null;
  }
}

// Main analysis function
async function runComprehensiveAnalysis() {
  console.log('🔍 Comprehensive Product Analysis\n');
  console.log('=' .repeat(50));
  
  // Initialize Firebase
  const firebaseReady = await initializeFirebase();
  if (!firebaseReady) {
    console.log('❌ Cannot analyze Firebase - initialization failed');
    return;
  }
  
  // Analyze local backups
  const localData = analyzeLocalBackups();
  
  // Analyze Firebase data
  const firebaseData = await analyzeFirebaseData();
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📋 SUMMARY');
  console.log('=' .repeat(50));
  
  if (firebaseData) {
    console.log('\n🔥 Firebase Status:');
    console.log(`   Total Products: ${Object.values(firebaseData.storeBreakdown).reduce((a, b) => a + b, 0)}`);
    console.log(`   Stores with Data: ${Object.keys(firebaseData.storeBreakdown).length}`);
    console.log(`   Data Completeness:`);
    console.log(`     - Photos: ${firebaseData.dataFields.hasPhotos} products`);
    console.log(`     - Descriptions: ${firebaseData.dataFields.hasDescriptions} products`);
    console.log(`     - Expiry Timings: ${firebaseData.dataFields.hasExpiryTimings} products`);
  }
  
  console.log('\n📁 Local Backups Status:');
  console.log(`   Backup Files: ${fs.readdirSync(path.join(__dirname, '../data/scraped-products')).filter(f => f.endsWith('.json')).length}`);
  console.log(`   Stores in Backups: ${Object.keys(localData.storeBreakdown).length}`);
  
  console.log('\n⚠️  Missing Store Data:');
  const expectedStores = ['Tesco', 'Sainsburys', 'Lidl', 'Aldi', 'Iceland'];
  const firebaseStores = firebaseData ? Object.keys(firebaseData.storeBreakdown) : [];
  const missingStores = expectedStores.filter(store => !firebaseStores.includes(store));
  
  if (missingStores.length > 0) {
    console.log(`   Missing from Firebase: ${missingStores.join(', ')}`);
  } else {
    console.log('   ✅ All expected stores found in Firebase');
  }
}

// Run the analysis
runComprehensiveAnalysis().then(() => {
  console.log('\n✅ Comprehensive analysis complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});
