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

async function removeCadburyDuplicates() {
  try {
    console.log('🍫 Removing duplicate Cadbury products without images...');
    
    const storeRef = db.collection('stores').doc('tesco_uxbridge');
    const categoriesSnapshot = await storeRef.collection('categories').get();
    
    let allCadburyProducts = [];
    
    // Collect all Cadbury products from all categories
    for (const categoryDoc of categoriesSnapshot.docs) {
      const categoryName = categoryDoc.id;
      const productsSnapshot = await categoryDoc.ref.collection('products').get();
      
      for (const productDoc of productsSnapshot.docs) {
        const data = productDoc.data();
        if (data.name && data.name.toLowerCase().includes('cadbury')) {
          allCadburyProducts.push({
            id: productDoc.id,
            name: data.name,
            brand: data.brand,
            category: categoryName,
            price: data.price,
            image: data.image,
            hasImage: !!data.image,
            ref: productDoc.ref
          });
        }
      }
    }
    
    console.log(`\n📊 Found ${allCadburyProducts.length} Cadbury products in Tesco:`);
    allCadburyProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Price: £${product.price}`);
      console.log(`   Image: ${product.hasImage ? 'YES' : 'NO'}`);
    });
    
    // Group by product name to find duplicates
    const productGroups = {};
    allCadburyProducts.forEach(product => {
      const key = product.name.toLowerCase().trim();
      if (!productGroups[key]) {
        productGroups[key] = [];
      }
      productGroups[key].push(product);
    });
    
    let productsToDelete = [];
    
    // Process each group of duplicates
    Object.entries(productGroups).forEach(([productName, products]) => {
      if (products.length > 1) {
        console.log(`\n🔄 Processing duplicates for: "${productName}"`);
        
        // Find the best version (has image, proper category)
        const bestProduct = products.reduce((best, current) => {
          // If current has image and best doesn't, choose current
          if (current.hasImage && !best.hasImage) return current;
          
          // If best has image and current doesn't, keep best
          if (best.hasImage && !current.hasImage) return best;
          
          // If both have same image status, prefer Dairy & Eggs category
          if (current.category === 'Dairy & Eggs' && best.category !== 'Dairy & Eggs') return current;
          if (best.category === 'Dairy & Eggs' && current.category !== 'Dairy & Eggs') return best;
          
          // If both have same category, prefer lower price
          if (current.price < best.price) return current;
          
          return best;
        });
        
        const duplicates = products.filter(p => p.id !== bestProduct.id);
        
        console.log(`   Best version: ${bestProduct.category} (${bestProduct.hasImage ? 'HAS IMAGE' : 'NO IMAGE'})`);
        duplicates.forEach(dup => {
          console.log(`   Duplicate to delete: ${dup.category} (${dup.hasImage ? 'HAS IMAGE' : 'NO IMAGE'})`);
          productsToDelete.push(dup);
        });
      }
    });
    
    console.log(`\n🗑️  Deleting ${productsToDelete.length} duplicate Cadbury products...`);
    
    for (const product of productsToDelete) {
      try {
        await product.ref.delete();
        console.log(`   ✅ Deleted: ${product.name} from ${product.category}`);
      } catch (error) {
        console.log(`   ❌ Failed to delete: ${product.name} - ${error.message}`);
      }
    }
    
    console.log(`\n✅ Cleanup completed! Deleted ${productsToDelete.length} duplicate Cadbury products.`);
    
    // Verify remaining Cadbury products
    console.log(`\n🔍 Verifying remaining Cadbury products...`);
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

removeCadburyDuplicates();
