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

async function checkHoneyAndImages() {
  try {
    console.log('🔍 Checking honey products and image issues...');
    
    // Check Sainsbury's honey products
    console.log('\n🍯 Sainsbury\'s Honey Products:');
    const sainsburyRef = db.collection('stores').doc('sainsbury_uxbridge');
    const sainsburyCategoriesSnapshot = await sainsburyRef.collection('categories').get();
    
    let sainsburyHoneyProducts = [];
    for (const categoryDoc of sainsburyCategoriesSnapshot.docs) {
      const categoryName = categoryDoc.id;
      if (['Dairy & Eggs', 'Fruits & Vegetables', 'Uncategorized'].includes(categoryName)) {
        const productsSnapshot = await categoryDoc.ref.collection('products').get();
        
        for (const productDoc of productsSnapshot.docs) {
          const data = productDoc.data();
          const productName = data.name ? data.name.toLowerCase() : '';
          const productDescription = (data.description && typeof data.description === 'string') ? data.description.toLowerCase() : '';
          
          if (productName.includes('honey') || productDescription.includes('honey')) {
            sainsburyHoneyProducts.push({
              name: data.name,
              category: categoryName,
              price: data.price,
              image: data.image,
              hasImage: !!data.image,
              description: data.description
            });
          }
        }
      }
    }
    
    console.log(`Found ${sainsburyHoneyProducts.length} honey products in Sainsbury's:`);
    sainsburyHoneyProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Price: £${product.price}`);
      console.log(`   Image: ${product.hasImage ? 'YES' : 'NO'}`);
      console.log(`   Description: ${product.description || 'NONE'}`);
    });
    
    // Check Tesco products with missing images
    console.log('\n🖼️ Tesco Products with Image Issues:');
    const tescoRef = db.collection('stores').doc('tesco_uxbridge');
    const tescoCategoriesSnapshot = await tescoRef.collection('categories').get();
    
    let tescoProductsWithoutImages = [];
    let totalTescoProducts = 0;
    
    for (const categoryDoc of tescoCategoriesSnapshot.docs) {
      const categoryName = categoryDoc.id;
      if (['Dairy & Eggs', 'Fruits & Vegetables', 'Meat & Seafood', 'Bakery & Bread', 'Pantry Essentials', 'Snacks & Beverages', 'Frozen Foods', 'Household & Cleaning', 'Health & Beauty', 'Uncategorized'].includes(categoryName)) {
        const productsSnapshot = await categoryDoc.ref.collection('products').limit(10).get();
        
        for (const productDoc of productsSnapshot.docs) {
          const data = productDoc.data();
          totalTescoProducts++;
          
          if (!data.image || data.image.trim() === '') {
            tescoProductsWithoutImages.push({
              name: data.name,
              category: categoryName,
              price: data.price,
              image: data.image
            });
          }
        }
      }
    }
    
    console.log(`\nTesco Image Analysis:`);
    console.log(`   Total products checked: ${totalTescoProducts}`);
    console.log(`   Products without images: ${tescoProductsWithoutImages.length}`);
    console.log(`   Image coverage: ${(((totalTescoProducts - tescoProductsWithoutImages.length) / totalTescoProducts) * 100).toFixed(1)}%`);
    
    if (tescoProductsWithoutImages.length > 0) {
      console.log(`\nProducts without images:`);
      tescoProductsWithoutImages.slice(0, 10).forEach((product, index) => {
        console.log(`${index + 1}. ${product.name} - ${product.category} - £${product.price}`);
      });
    }
    
    // Check specific Cadbury products
    console.log('\n🍫 Cadbury Products in Tesco:');
    const cadburyProducts = [];
    for (const categoryDoc of tescoCategoriesSnapshot.docs) {
      const categoryName = categoryDoc.id;
      if (['Dairy & Eggs', 'Fruits & Vegetables', 'Meat & Seafood', 'Bakery & Bread', 'Pantry Essentials', 'Snacks & Beverages', 'Frozen Foods', 'Household & Cleaning', 'Health & Beauty', 'Uncategorized'].includes(categoryName)) {
        const productsSnapshot = await categoryDoc.ref.collection('products').get();
        
        for (const productDoc of productsSnapshot.docs) {
          const data = productDoc.data();
          if (data.name && data.name.toLowerCase().includes('cadbury')) {
            cadburyProducts.push({
              name: data.name,
              category: categoryName,
              price: data.price,
              image: data.image,
              hasImage: !!data.image,
              description: data.description
            });
          }
        }
      }
    }
    
    console.log(`Found ${cadburyProducts.length} Cadbury products:`);
    cadburyProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Price: £${product.price}`);
      console.log(`   Image: ${product.hasImage ? 'YES' : 'NO'}`);
      console.log(`   Description: ${product.description || 'NONE'}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking honey and images:', error);
  }
}

checkHoneyAndImages();
