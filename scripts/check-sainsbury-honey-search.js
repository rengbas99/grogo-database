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

async function checkSainsburyHoneySearch() {
  try {
    console.log('🍯 Checking Sainsbury honey products and search functionality...');
    
    const storeRef = db.collection('stores').doc('sainsbury_uxbridge');
    const categoriesSnapshot = await storeRef.collection('categories').get();
    
    let allHoneyProducts = [];
    let totalProducts = 0;
    
    // Search through all categories for honey products
    for (const categoryDoc of categoriesSnapshot.docs) {
      const categoryName = categoryDoc.id;
      const productsSnapshot = await categoryDoc.ref.collection('products').get();
      totalProducts += productsSnapshot.size;
      
      for (const productDoc of productsSnapshot.docs) {
        const data = productDoc.data();
        const productName = data.name ? data.name.toLowerCase() : '';
        const productDescription = (data.description && typeof data.description === 'string') ? data.description.toLowerCase() : '';
        
        // Check if product contains "honey" in name or description
        if (productName.includes('honey') || productDescription.includes('honey')) {
          allHoneyProducts.push({
            id: productDoc.id,
            name: data.name,
            brand: data.brand,
            category: categoryName,
            price: data.price,
            image: data.image,
            description: data.description,
            hasImage: !!data.image
          });
        }
      }
    }
    
    console.log(`\n📊 Sainsbury's Total Products: ${totalProducts}`);
    console.log(`🍯 Honey Products Found: ${allHoneyProducts.length}`);
    
    if (allHoneyProducts.length > 0) {
      console.log(`\n🍯 All Honey Products in Sainsbury's:`);
      allHoneyProducts.forEach((product, index) => {
        console.log(`${index + 1}. ${product.name}`);
        console.log(`   Brand: ${product.brand || 'N/A'}`);
        console.log(`   Category: ${product.category}`);
        console.log(`   Price: £${product.price || 'N/A'}`);
        console.log(`   Image: ${product.hasImage ? 'YES' : 'NO'}`);
        console.log(`   Description: ${(product.description && typeof product.description === 'string') ? product.description.substring(0, 100) + '...' : 'N/A'}`);
        console.log('');
      });
    } else {
      console.log(`\n❌ No honey products found in Sainsbury's!`);
    }
    
    // Check specific products mentioned by user
    const specificProducts = [
      'Odysea Greek Pine & Fir Tree Raw Honey 250g',
      'Sainsbury\'s MGO 100+ Manuka Honey, Taste the Difference 225g',
      'Rowse Original Squeezy Honey 680g',
      'Rowse Greek Squeezy Honey 250g',
      'Rowse Clear Honey 340g'
    ];
    
    console.log(`\n🔍 Checking for specific honey products:`);
    for (const specificProduct of specificProducts) {
      const found = allHoneyProducts.find(p => 
        p.name.toLowerCase().includes(specificProduct.toLowerCase()) ||
        specificProduct.toLowerCase().includes(p.name.toLowerCase())
      );
      
      if (found) {
        console.log(`✅ Found: ${found.name} in ${found.category}`);
      } else {
        console.log(`❌ Not found: ${specificProduct}`);
      }
    }
    
    // Test search functionality
    console.log(`\n🔍 Testing search functionality:`);
    const searchQuery = 'honey';
    const searchResults = allHoneyProducts.filter(product => {
      const name = product.name ? product.name.toLowerCase() : '';
      const description = (product.description && typeof product.description === 'string') ? product.description.toLowerCase() : '';
      return name.includes(searchQuery) || description.includes(searchQuery);
    });
    
    console.log(`Search for "${searchQuery}" returned ${searchResults.length} results:`);
    searchResults.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking Sainsbury honey search:', error);
  }
}

checkSainsburyHoneySearch();
