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

async function cleanupHoneyDuplicates() {
  try {
    console.log('🍯 Cleaning up duplicate honey products in Sainsbury\'s...');
    
    const storeRef = db.collection('stores').doc('sainsbury_uxbridge');
    const categoriesSnapshot = await storeRef.collection('categories').get();
    
    let allHoneyProducts = [];
    
    // Collect all honey products from all categories
    for (const categoryDoc of categoriesSnapshot.docs) {
      const categoryName = categoryDoc.id;
      const productsSnapshot = await categoryDoc.ref.collection('products').get();
      
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
            hasImage: !!data.image,
            ref: productDoc.ref
          });
        }
      }
    }
    
    console.log(`\n📊 Found ${allHoneyProducts.length} honey products total`);
    
    // Group by product name to find duplicates
    const productGroups = {};
    allHoneyProducts.forEach(product => {
      const key = product.name.toLowerCase().trim();
      if (!productGroups[key]) {
        productGroups[key] = [];
      }
      productGroups[key].push(product);
    });
    
    let productsToDelete = [];
    let productsToMove = [];
    
    // Process each group of duplicates
    Object.entries(productGroups).forEach(([productName, products]) => {
      if (products.length > 1) {
        console.log(`\n🔄 Processing duplicates for: "${productName}"`);
        
        // Find the best version (has image, proper category, valid price)
        const bestProduct = products.reduce((best, current) => {
          // If current has image and best doesn't, choose current
          if (current.hasImage && !best.hasImage) return current;
          
          // If best has image and current doesn't, keep best
          if (best.hasImage && !current.hasImage) return best;
          
          // If both have same image status, prefer proper categories
          const properCategories = ['Fruits & Vegetables', 'Uncategorized'];
          const currentIsProper = properCategories.includes(current.category);
          const bestIsProper = properCategories.includes(best.category);
          
          if (currentIsProper && !bestIsProper) return current;
          if (bestIsProper && !currentIsProper) return best;
          
          // If both have same category status, prefer valid price
          const currentHasValidPrice = current.price && typeof current.price === 'number' && current.price > 0;
          const bestHasValidPrice = best.price && typeof best.price === 'number' && best.price > 0;
          
          if (currentHasValidPrice && !bestHasValidPrice) return current;
          if (bestHasValidPrice && !currentHasValidPrice) return best;
          
          return best;
        });
        
        const duplicates = products.filter(p => p.id !== bestProduct.id);
        
        console.log(`   Best version: ${bestProduct.category} (${bestProduct.hasImage ? 'HAS IMAGE' : 'NO IMAGE'}) - £${bestProduct.price}`);
        duplicates.forEach(dup => {
          console.log(`   Duplicate to delete: ${dup.category} (${dup.hasImage ? 'HAS IMAGE' : 'NO IMAGE'}) - £${dup.price}`);
          productsToDelete.push(dup);
        });
      } else {
        // Single product - check if it needs to be moved to proper category
        const product = products[0];
        if (product.category === 'Dairy & Eggs' && product.name.toLowerCase().includes('honey')) {
          console.log(`\n🔄 Moving honey product from wrong category: ${product.name}`);
          productsToMove.push({
            product: product,
            newCategory: 'Fruits & Vegetables'
          });
        }
      }
    });
    
    console.log(`\n🗑️  Deleting ${productsToDelete.length} duplicate honey products...`);
    
    for (const product of productsToDelete) {
      try {
        await product.ref.delete();
        console.log(`   ✅ Deleted: ${product.name} from ${product.category}`);
      } catch (error) {
        console.log(`   ❌ Failed to delete: ${product.name} - ${error.message}`);
      }
    }
    
    console.log(`\n📦 Moving ${productsToMove.length} honey products to proper category...`);
    
    for (const { product, newCategory } of productsToMove) {
      try {
        // Create new product in correct category
        const newCategoryRef = storeRef.collection('categories').doc(newCategory);
        await newCategoryRef.collection('products').add({
          ...product,
          category: newCategory,
          movedAt: new Date()
        });
        
        // Delete from old category
        await product.ref.delete();
        console.log(`   ✅ Moved: ${product.name} from ${product.category} to ${newCategory}`);
      } catch (error) {
        console.log(`   ❌ Failed to move: ${product.name} - ${error.message}`);
      }
    }
    
    console.log(`\n✅ Cleanup completed! Deleted ${productsToDelete.length} duplicates and moved ${productsToMove.length} products.`);
    
  } catch (error) {
    console.error('❌ Error cleaning up honey duplicates:', error);
  }
}

cleanupHoneyDuplicates();
