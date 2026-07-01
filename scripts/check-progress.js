/**
 * Check Progress - Monitor the image update progress
 */

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

async function checkProgress() {
  try {
    console.log('📊 Checking image update progress...\n');
    
    // Get all products
    const productsSnapshot = await db.collection('products').get();
    const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`📦 Total products: ${products.length}`);
    
    // Count different image types
    const imageStats = {
      realImages: 0,
      openFoodFacts: 0,
      placeholder: 0,
      noImage: 0
    };
    
    products.forEach(product => {
      if (!product.image) {
        imageStats.noImage++;
      } else if (product.image.includes('openfoodfacts.org')) {
        imageStats.openFoodFacts++;
      } else if (product.image.includes('picsum.photos')) {
        imageStats.placeholder++;
      } else {
        imageStats.realImages++;
      }
    });
    
    console.log('\n🖼️  Image Statistics:');
    console.log(`   ✅ Real images: ${imageStats.realImages}`);
    console.log(`   🔍 OpenFoodFacts: ${imageStats.openFoodFacts}`);
    console.log(`   📦 Placeholders: ${imageStats.placeholder}`);
    console.log(`   ❌ No image: ${imageStats.noImage}`);
    
    const realImagePercentage = ((imageStats.realImages / products.length) * 100).toFixed(1);
    console.log(`\n📈 Real image coverage: ${realImagePercentage}%`);
    
    // Show some examples of real images
    const realImageProducts = products.filter(p => p.image && !p.image.includes('openfoodfacts.org') && !p.image.includes('picsum.photos'));
    
    if (realImageProducts.length > 0) {
      console.log('\n🎯 Sample real images found:');
      realImageProducts.slice(0, 5).forEach(product => {
        console.log(`   • ${product.name}: ${product.image.substring(0, 80)}...`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking progress:', error);
  }
}

checkProgress().catch(console.error);
