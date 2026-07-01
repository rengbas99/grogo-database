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

async function verifyHoneyProducts() {
  try {
    console.log('🍯 Verifying honey products in Sainsbury\'s...');
    
    const storeRef = db.collection('stores').doc('sainsbury_uxbridge');
    const categoriesSnapshot = await storeRef.collection('categories').get();
    
    // Check specific honey products you mentioned
    const targetHoneyProducts = [
      'Odysea Greek Pine & Fir Tree Raw Honey 250g',
      'Sainsbury\'s MGO 100+ Manuka Honey, Taste the Difference 225g',
      'Rowse Original Squeezy Honey 680g',
      'Rowse Greek Squeezy Honey 250g',
      'Rowse Clear Honey 340g'
    ];
    
    console.log('\n🔍 Looking for specific honey products:');
    
    for (const targetProduct of targetHoneyProducts) {
      let found = false;
      
      for (const categoryDoc of categoriesSnapshot.docs) {
        const categoryName = categoryDoc.id;
        const productsSnapshot = await categoryDoc.ref.collection('products')
          .where('name', '==', targetProduct)
          .get();
        
        if (!productsSnapshot.empty) {
          const productData = productsSnapshot.docs[0].data();
          console.log(`✅ Found: ${targetProduct}`);
          console.log(`   Category: ${categoryName}`);
          console.log(`   Price: £${productData.price}`);
          console.log(`   Image: ${productData.image ? 'YES' : 'NO'}`);
          console.log(`   Description: ${productData.description || 'NONE'}`);
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.log(`❌ NOT FOUND: ${targetProduct}`);
      }
    }
    
    // Also check for any products containing "honey" in name
    console.log('\n🔍 All products containing "honey" in name:');
    let allHoneyProducts = [];
    
    for (const categoryDoc of categoriesSnapshot.docs) {
      const categoryName = categoryDoc.id;
      const productsSnapshot = await categoryDoc.ref.collection('products').get();
      
      for (const productDoc of productsSnapshot.docs) {
        const data = productDoc.data();
        const productName = data.name ? data.name.toLowerCase() : '';
        
        if (productName.includes('honey')) {
          allHoneyProducts.push({
            name: data.name,
            category: categoryName,
            price: data.price,
            image: data.image,
            hasImage: !!data.image
          });
        }
      }
    }
    
    console.log(`Found ${allHoneyProducts.length} products with "honey" in name:`);
    allHoneyProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Price: £${product.price}`);
      console.log(`   Image: ${product.hasImage ? 'YES' : 'NO'}`);
    });
    
    // Check if the issue is with the search function
    console.log('\n🔍 Testing search function logic:');
    const searchQuery = 'honey';
    const searchResults = allHoneyProducts.filter(product => {
      const name = product.name.toLowerCase();
      const query = searchQuery.toLowerCase();
      return name.includes(query);
    });
    
    console.log(`Search for "${searchQuery}" should return ${searchResults.length} results:`);
    searchResults.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error verifying honey products:', error);
  }
}

verifyHoneyProducts();
