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

async function checkAlwaysProducts() {
  try {
    console.log('🔍 Checking all Always products in Firebase...');
    
    const storeRef = db.collection('stores').doc('tesco_uxbridge');
    const categoriesSnapshot = await storeRef.collection('categories').get();
    
    let foundProducts = [];
    
    for (const categoryDoc of categoriesSnapshot.docs) {
      const categoryName = categoryDoc.id;
      const productsSnapshot = await categoryDoc.ref.collection('products').get();
      
      for (const productDoc of productsSnapshot.docs) {
        const data = productDoc.data();
        if (data.name && data.name.toLowerCase().includes('always')) {
          foundProducts.push({
            id: productDoc.id,
            name: data.name,
            brand: data.brand,
            category: categoryName,
            price: data.price,
            image: data.image || 'NO IMAGE',
            hasImage: !!data.image
          });
        }
      }
    }
    
    console.log(`\n📊 Found ${foundProducts.length} Always products:`);
    foundProducts.forEach((product, index) => {
      console.log(`\n${index + 1}. ${product.name}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Brand: ${product.brand}`);
      console.log(`   Price: £${product.price}`);
      console.log(`   Image: ${product.hasImage ? 'YES' : 'NO'}`);
      if (product.image !== 'NO IMAGE') {
        try {
          const url = new URL(product.image);
          console.log(`   Domain: ${url.hostname}`);
        } catch (e) {
          console.log(`   Invalid URL: ${product.image}`);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking Always products:', error);
  }
}

checkAlwaysProducts();
