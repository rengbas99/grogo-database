/**
 * Check Firebase Backend Data
 * Shows what products are currently stored in Firebase
 */

const admin = require('firebase-admin');

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

async function checkFirebaseData() {
  console.log('�� Checking Firebase backend data...\n');
  
  try {
    // Initialize Firebase first
    const firebaseReady = await initializeFirebase();
    if (!firebaseReady) {
      console.log('❌ Cannot check Firebase - initialization failed');
      return;
    }
    
    const db = admin.firestore();
    
    // Get all products from Firebase
    const productsSnapshot = await db.collection('products').get();
    
    if (productsSnapshot.empty) {
      console.log('❌ No products found in Firebase');
      return;
    }
    
    console.log(`✅ Found ${productsSnapshot.size} products in Firebase\n`);
    
    // Group by store
    const storeBreakdown = {};
    const categoryBreakdown = {};
    const recentProducts = [];
    
    productsSnapshot.forEach(doc => {
      const product = doc.data();
      
      // Store breakdown
      storeBreakdown[product.store] = (storeBreakdown[product.store] || 0) + 1;
      
      // Category breakdown
      categoryBreakdown[product.category] = (categoryBreakdown[product.category] || 0) + 1;
      
      // Recent products (last 10)
      recentProducts.push({
        id: doc.id,
        name: product.name,
        store: product.store,
        price: product.price,
        scrapedAt: product.scrapedAt,
        category: product.category
      });
    });
    
    // Sort recent products by scrapedAt
    recentProducts.sort((a, b) => new Date(b.scrapedAt) - new Date(a.scrapedAt));
    
    console.log('📊 Store Breakdown:');
    Object.entries(storeBreakdown).forEach(([store, count]) => {
      console.log(`   ${store}: ${count} products`);
    });
    
    console.log('\n📊 Category Breakdown:');
    Object.entries(categoryBreakdown).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} products`);
    });
    
    console.log('\n�� Recent Products (Last 10):');
    recentProducts.slice(0, 10).forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name}`);
      console.log(`      Store: ${product.store} | Price: ${product.price} | Category: ${product.category}`);
      console.log(`      Scraped: ${product.scrapedAt ? new Date(product.scrapedAt).toLocaleString() : 'Invalid Date'}`);
      console.log(`      ID: ${product.id}`);
      console.log('');
    });
    
    // Check for today's data
    const today = new Date().toISOString().split('T')[0];
    const todayProducts = recentProducts.filter(p => p.scrapedAt && typeof p.scrapedAt === 'string' && p.scrapedAt.startsWith(today));
    
    console.log(`📅 Products scraped today (${today}): ${todayProducts.length}`);
    
    if (todayProducts.length > 0) {
      console.log('\n🕒 Today\'s Products:');
      todayProducts.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name} (${product.store}) - ${product.price}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking Firebase data:', error.message);
  }
}

// Run the check
checkFirebaseData().then(() => {
  console.log('\n✅ Firebase data check complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Check failed:', error);
  process.exit(1);
});
