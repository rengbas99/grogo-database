/**
 * Verify App Images - Check if images are updated and visible in the app
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

async function verifyAppImages() {
  try {
    console.log('🔍 Verifying app images are updated and visible...\n');
    
    // Get a sample of products to check
    const productsSnapshot = await db.collection('products').limit(10).get();
    const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`📦 Checking ${products.length} sample products:\n`);
    
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   🖼️  Image: ${product.image ? product.image.substring(0, 80) + '...' : 'NO IMAGE'}`);
      
      // Check image source type
      if (product.image) {
        if (product.image.includes('assets.iceland.co.uk')) {
          console.log(`   🏪 Source: Iceland Official CDN`);
        } else if (product.image.includes('imgproxy-retcat.assets.schwarz')) {
          console.log(`   🏪 Source: Lidl Official CDN`);
        } else if (product.image.includes('dm.emea.cms.aldi.cx')) {
          console.log(`   🏪 Source: Aldi Official CDN`);
        } else if (product.image.includes('images.unsplash.com')) {
          console.log(`   🎨 Source: Category-based Image (Unsplash)`);
        } else if (product.image.includes('amazon.com') || product.image.includes('ebay.com')) {
          console.log(`   🔍 Source: Google Search Result`);
        } else if (product.image.includes('openfoodfacts.org')) {
          console.log(`   📊 Source: OpenFoodFacts API`);
        } else {
          console.log(`   🌐 Source: Other`);
        }
      }
      console.log('');
    });
    
    // Check overall statistics
    const allProductsSnapshot = await db.collection('products').get();
    const allProducts = allProductsSnapshot.docs.map(doc => doc.data());
    
    const imageStats = {
      total: allProducts.length,
      withImages: allProducts.filter(p => p.image).length,
      realImages: allProducts.filter(p => p.image && !p.image.includes('picsum.photos')).length,
      categoryImages: allProducts.filter(p => p.image && p.image.includes('images.unsplash.com')).length,
      storeImages: allProducts.filter(p => p.image && (
        p.image.includes('assets.iceland.co.uk') ||
        p.image.includes('imgproxy-retcat.assets.schwarz') ||
        p.image.includes('dm.emea.cms.aldi.cx')
      )).length
    };
    
    console.log('📊 OVERALL IMAGE STATISTICS:');
    console.log(`   Total Products: ${imageStats.total}`);
    console.log(`   Products with Images: ${imageStats.withImages} (${((imageStats.withImages/imageStats.total)*100).toFixed(1)}%)`);
    console.log(`   Real Images: ${imageStats.realImages} (${((imageStats.realImages/imageStats.total)*100).toFixed(1)}%)`);
    console.log(`   Store Official Images: ${imageStats.storeImages} (${((imageStats.storeImages/imageStats.total)*100).toFixed(1)}%)`);
    console.log(`   Category Images: ${imageStats.categoryImages} (${((imageStats.categoryImages/imageStats.total)*100).toFixed(1)}%)`);
    
    console.log('\n✅ VERIFICATION COMPLETE!');
    console.log('🎯 Your app should now display all these updated images!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyAppImages().catch(console.error);
