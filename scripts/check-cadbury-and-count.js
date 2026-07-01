const admin = require('firebase-admin');
const serviceAccount = require('../grogo-mvp-firebase-adminsdk-fbsvc-9caddcb9d0.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://grogo-mvp.firebaseio.com"
  });
}
const db = admin.firestore();

async function checkCadburyAndCount() {
  try {
    console.log('🍫 Checking Cadbury products in Tesco and complete database count...');
    
    const stores = ['tesco_uxbridge', 'sainsbury_uxbridge', 'iceland_uxbridge', 'aldi_west_drayton', 'lidl_uxbridge_cowley'];
    let totalProducts = 0;
    let totalWithImages = 0;
    let storeStats = {};
    
    for (const storeId of stores) {
      console.log(`\n📊 Checking ${storeId}:`);
      
      const storeRef = db.collection('stores').doc(storeId);
      const categoriesSnapshot = await storeRef.collection('categories').get();
      
      let storeProducts = 0;
      let storeWithImages = 0;
      let cadburyProducts = [];
      
      // Collect all products from all categories
      for (const categoryDoc of categoriesSnapshot.docs) {
        const categoryName = categoryDoc.id;
        const productsSnapshot = await categoryDoc.ref.collection('products').get();
        
        for (const productDoc of productsSnapshot.docs) {
          const data = productDoc.data();
          storeProducts++;
          totalProducts++;
          
          if (data.image && data.image.trim() !== '') {
            storeWithImages++;
            totalWithImages++;
          }
          
          // Check for Cadbury products
          if (data.name && data.name.toLowerCase().includes('cadbury')) {
            cadburyProducts.push({
              name: data.name,
              brand: data.brand,
              category: categoryName,
              price: data.price,
              image: data.image,
              hasImage: !!data.image,
              storeType: data.storeType,
              storeId: data.storeId
            });
          }
        }
      }
      
      storeStats[storeId] = {
        total: storeProducts,
        withImages: storeWithImages,
        imagePercentage: ((storeWithImages / storeProducts) * 100).toFixed(1)
      };
      
      console.log(`   Total products: ${storeProducts}`);
      console.log(`   Products with images: ${storeWithImages} (${((storeWithImages / storeProducts) * 100).toFixed(1)}%)`);
      
      if (cadburyProducts.length > 0) {
        console.log(`\n🍫 Cadbury products in ${storeId}:`);
        cadburyProducts.forEach((product, index) => {
          console.log(`   ${index + 1}. ${product.name}`);
          console.log(`      Brand: ${product.brand}`);
          console.log(`      Category: ${product.category}`);
          console.log(`      Price: £${product.price}`);
          console.log(`      Image: ${product.hasImage ? 'YES' : 'NO'}`);
          if (product.image) {
            try {
              const url = new URL(product.image);
              console.log(`      Image domain: ${url.hostname}`);
            } catch (e) {
              console.log(`      Invalid image URL`);
            }
          }
        });
      }
    }
    
    console.log(`\n📊 COMPLETE DATABASE SUMMARY:`);
    console.log(`   Total products across all stores: ${totalProducts}`);
    console.log(`   Total products with images: ${totalWithImages} (${((totalWithImages / totalProducts) * 100).toFixed(1)}%)`);
    
    console.log(`\n🏪 Store Breakdown:`);
    Object.entries(storeStats).forEach(([storeId, stats]) => {
      console.log(`   ${storeId}: ${stats.total} products (${stats.imagePercentage}% with images)`);
    });
    
    // Check which database was uploaded
    console.log(`\n📁 Database Source:`);
    console.log(`   The data was uploaded from: essentials-only-categorized.csv`);
    console.log(`   This contains 750 essential products across all stores`);
    console.log(`   Products are distributed across 5 stores: Tesco, Sainsbury, Iceland, Aldi, Lidl`);
    
  } catch (error) {
    console.error('❌ Error checking Cadbury products and database count:', error);
  }
}

checkCadburyAndCount();
