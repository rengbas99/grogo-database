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

async function checkSainsburyHoney() {
  try {
    console.log('🍯 Checking Sainsbury for honey products...');
    
    const storeRef = db.collection('stores').doc('sainsbury_uxbridge');
    const categoriesSnapshot = await storeRef.collection('categories').get();
    
    let allProducts = [];
    let honeyProducts = [];
    
    // Collect all products from all categories
    for (const categoryDoc of categoriesSnapshot.docs) {
      const categoryName = categoryDoc.id;
      const productsSnapshot = await categoryDoc.ref.collection('products').get();
      
      for (const productDoc of productsSnapshot.docs) {
        const data = productDoc.data();
        allProducts.push({
          name: data.name,
          brand: data.brand,
          category: categoryName,
          price: data.price,
          image: data.image,
          storeType: data.storeType,
          storeId: data.storeId
        });
        
        // Check if product contains "honey" (case insensitive)
        if (data.name && data.name.toLowerCase().includes('honey')) {
          honeyProducts.push({
            name: data.name,
            brand: data.brand,
            category: categoryName,
            price: data.price,
            image: data.image,
            storeType: data.storeType,
            storeId: data.storeId
          });
        }
      }
    }
    
    console.log(`\n📊 Sainsbury Product Summary:`);
    console.log(`   Total products: ${allProducts.length}`);
    console.log(`   Honey products found: ${honeyProducts.length}`);
    
    if (honeyProducts.length > 0) {
      console.log(`\n🍯 Honey Products in Sainsbury:`);
      honeyProducts.forEach((product, index) => {
        console.log(`\n${index + 1}. ${product.name}`);
        console.log(`   Brand: ${product.brand}`);
        console.log(`   Category: ${product.category}`);
        console.log(`   Price: £${product.price}`);
        console.log(`   Store: ${product.storeType} (${product.storeId})`);
        console.log(`   Image: ${product.image ? 'YES' : 'NO'}`);
        if (product.image) {
          try {
            const url = new URL(product.image);
            console.log(`   Image domain: ${url.hostname}`);
          } catch (e) {
            console.log(`   Invalid image URL`);
          }
        }
      });
    } else {
      console.log(`\n❌ No honey products found in Sainsbury`);
    }
    
    // Also check for any products that might be mislabeled
    console.log(`\n🔍 Checking for potential honey-related products...`);
    const potentialHoney = allProducts.filter(product => 
      product.name.toLowerCase().includes('handwash') || 
      product.name.toLowerCase().includes('soap') ||
      product.name.toLowerCase().includes('wash')
    );
    
    if (potentialHoney.length > 0) {
      console.log(`\n🧼 Handwash/Soap products that might be confused with honey:`);
      potentialHoney.slice(0, 5).forEach((product, index) => {
        console.log(`${index + 1}. ${product.name} - £${product.price}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking Sainsbury honey products:', error);
  }
}

checkSainsburyHoney();
