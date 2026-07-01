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

async function testStoreData() {
  try {
    console.log('🧪 Testing store data integrity...');
    
    const stores = ['tesco_uxbridge', 'sainsbury_uxbridge', 'iceland_uxbridge', 'aldi_west_drayton', 'lidl_uxbridge_cowley'];
    
    for (const storeId of stores) {
      console.log(`\n📊 Testing ${storeId}:`);
      
      const storeRef = db.collection('stores').doc(storeId);
      const categoriesSnapshot = await storeRef.collection('categories').get();
      
      let totalProducts = 0;
      let productsWithImages = 0;
      let sampleProducts = [];
      
      for (const categoryDoc of categoriesSnapshot.docs) {
        const productsSnapshot = await categoryDoc.ref.collection('products').limit(3).get();
        totalProducts += productsSnapshot.size;
        
        productsSnapshot.forEach(productDoc => {
          const data = productDoc.data();
          if (data.image && data.image.trim() !== '') {
            productsWithImages++;
          }
          if (sampleProducts.length < 3) {
            sampleProducts.push({
              name: data.name,
              storeType: data.storeType,
              storeId: data.storeId,
              hasImage: !!data.image
            });
          }
        });
      }
      
      console.log(`   Total products: ${totalProducts}`);
      console.log(`   Products with images: ${productsWithImages} (${((productsWithImages / totalProducts) * 100).toFixed(1)}%)`);
      console.log(`   Sample products:`);
      sampleProducts.forEach((product, index) => {
        console.log(`     ${index + 1}. ${product.name.substring(0, 40)}...`);
        console.log(`        Store: ${product.storeType} (${product.storeId})`);
        console.log(`        Image: ${product.hasImage ? 'YES' : 'NO'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing store data:', error);
  }
}

testStoreData();
