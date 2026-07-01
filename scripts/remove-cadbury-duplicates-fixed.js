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

async function removeCadburyDuplicatesFixed() {
  try {
    console.log('🍫 Removing duplicate Cadbury products without images (FIXED)...');
    
    const storeRef = db.collection('stores').doc('tesco_uxbridge');
    
    // Get the food-cupboard category specifically
    const foodCupboardRef = storeRef.collection('categories').doc('food-cupboard');
    const foodCupboardSnapshot = await foodCupboardRef.collection('products').get();
    
    let cadburyProductsToDelete = [];
    
    console.log(`\n📊 Found ${foodCupboardSnapshot.size} products in food-cupboard category`);
    
    // Find Cadbury products in food-cupboard category (these are the ones without images)
    for (const productDoc of foodCupboardSnapshot.docs) {
      const data = productDoc.data();
      if (data.name && data.name.toLowerCase().includes('cadbury')) {
        cadburyProductsToDelete.push({
          id: productDoc.id,
          name: data.name,
          category: 'food-cupboard',
          price: data.price,
          hasImage: !!data.image,
          ref: productDoc.ref
        });
      }
    }
    
    console.log(`\n🍫 Cadbury products in food-cupboard category (to delete):`);
    cadburyProductsToDelete.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Price: £${product.price}`);
      console.log(`   Image: ${product.hasImage ? 'YES' : 'NO'}`);
    });
    
    console.log(`\n🗑️  Deleting ${cadburyProductsToDelete.length} Cadbury products from food-cupboard category...`);
    
    for (const product of cadburyProductsToDelete) {
      try {
        await product.ref.delete();
        console.log(`   ✅ Deleted: ${product.name} from food-cupboard`);
      } catch (error) {
        console.log(`   ❌ Failed to delete: ${product.name} - ${error.message}`);
      }
    }
    
    console.log(`\n✅ Cleanup completed! Deleted ${cadburyProductsToDelete.length} duplicate Cadbury products.`);
    
    // Verify remaining Cadbury products
    console.log(`\n🔍 Verifying remaining Cadbury products...`);
    const categoriesSnapshot = await storeRef.collection('categories').get();
    const remainingCadbury = [];
    
    for (const categoryDoc of categoriesSnapshot.docs) {
      const productsSnapshot = await categoryDoc.ref.collection('products').get();
      for (const productDoc of productsSnapshot.docs) {
        const data = productDoc.data();
        if (data.name && data.name.toLowerCase().includes('cadbury')) {
          remainingCadbury.push({
            name: data.name,
            category: categoryDoc.id,
            hasImage: !!data.image
          });
        }
      }
    }
    
    console.log(`\n📊 Remaining Cadbury products (${remainingCadbury.length}):`);
    remainingCadbury.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} - ${product.category} (${product.hasImage ? 'HAS IMAGE' : 'NO IMAGE'})`);
    });
    
  } catch (error) {
    console.error('❌ Error removing Cadbury duplicates:', error);
  }
}

removeCadburyDuplicatesFixed();
