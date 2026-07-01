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

async function finalCleanupDuplicates() {
  try {
    console.log('🧹 Final cleanup of remaining duplicates...');
    
    const storeRef = db.collection('stores').doc('tesco_uxbridge');
    const categoriesSnapshot = await storeRef.collection('categories').get();
    
    let allProducts = [];
    
    // Collect all products from all categories
    for (const categoryDoc of categoriesSnapshot.docs) {
      const categoryName = categoryDoc.id;
      const productsSnapshot = await categoryDoc.ref.collection('products').get();
      
      for (const productDoc of productsSnapshot.docs) {
        const data = productDoc.data();
        allProducts.push({
          id: productDoc.id,
          name: data.name,
          brand: data.brand,
          category: categoryName,
          price: data.price,
          image: data.image || null,
          hasValidImage: data.image && isValidTescoImage(data.image),
          ref: productDoc.ref,
          data: data
        });
      }
    }
    
    console.log(`📊 Found ${allProducts.length} total products across all categories`);
    
    // Find duplicates by name (case insensitive)
    const productMap = new Map();
    allProducts.forEach(product => {
      const key = product.name.toLowerCase().trim();
      if (productMap.has(key)) {
        productMap.get(key).push(product);
      } else {
        productMap.set(key, [product]);
      }
    });
    
    let duplicatesToDelete = [];
    let productsToUpdate = [];
    
    // Process duplicates
    for (const [productName, products] of productMap) {
      if (products.length > 1) {
        console.log(`\n🔄 Found ${products.length} duplicates for: "${productName}"`);
        
        // Find the best version (has valid image, proper category)
        const bestProduct = findBestProduct(products);
        const duplicates = products.filter(p => p.id !== bestProduct.id);
        
        console.log(`   Best version: ${bestProduct.category} (${bestProduct.hasValidImage ? 'HAS IMAGE' : 'NO IMAGE'})`);
        duplicates.forEach(dup => {
          console.log(`   Duplicate: ${dup.category} (${dup.hasValidImage ? 'HAS IMAGE' : 'NO IMAGE'}) - TO DELETE`);
          duplicatesToDelete.push(dup);
        });
        
        // If best product doesn't have image but a duplicate does, copy the image
        if (!bestProduct.hasValidImage) {
          const duplicateWithImage = duplicates.find(dup => dup.hasValidImage);
          if (duplicateWithImage) {
            console.log(`   📋 Will copy image from duplicate to best product`);
            productsToUpdate.push({
              product: bestProduct,
              imageUrl: duplicateWithImage.image
            });
          }
        }
      }
    }
    
    console.log(`\n📋 Final Cleanup Summary:`);
    console.log(`   Duplicate groups found: ${Array.from(productMap.values()).filter(p => p.length > 1).length}`);
    console.log(`   Products to delete: ${duplicatesToDelete.length}`);
    console.log(`   Products to update with images: ${productsToUpdate.length}`);
    
    // Execute cleanup
    console.log(`\n🚀 Starting final cleanup process...`);
    
    // 1. Delete duplicate products
    console.log(`\n🗑️  Deleting ${duplicatesToDelete.length} duplicate products...`);
    for (const product of duplicatesToDelete) {
      try {
        await product.ref.delete();
        console.log(`   ✅ Deleted: ${product.name} from ${product.category}`);
      } catch (error) {
        console.log(`   ❌ Failed to delete: ${product.name} - ${error.message}`);
      }
    }
    
    // 2. Update products with images from duplicates
    console.log(`\n🖼️  Updating ${productsToUpdate.length} products with images...`);
    for (const update of productsToUpdate) {
      try {
        await update.product.ref.update({
          image: update.imageUrl,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`   ✅ Updated: ${update.product.name} with image from duplicate`);
      } catch (error) {
        console.log(`   ❌ Failed to update: ${update.product.name} - ${error.message}`);
      }
    }
    
    console.log(`\n✅ Final cleanup completed successfully!`);
    console.log(`   Deleted: ${duplicatesToDelete.length} duplicate products`);
    console.log(`   Updated: ${productsToUpdate.length} products with images`);
    
  } catch (error) {
    console.error('❌ Error during final cleanup:', error);
  }
}

function isValidTescoImage(imageUrl) {
  if (!imageUrl) return false;
  
  try {
    const url = new URL(imageUrl);
    return url.hostname.includes('digitalcontent.api.tesco.com') || url.hostname.includes('tesco.com');
  } catch {
    return false;
  }
}

function findBestProduct(products) {
  // Priority: 1. Has valid Tesco image, 2. Health & Beauty category, 3. Lower price
  return products.reduce((best, current) => {
    // If current has valid image and best doesn't, choose current
    if (current.hasValidImage && !best.hasValidImage) return current;
    
    // If best has valid image and current doesn't, keep best
    if (best.hasValidImage && !current.hasValidImage) return best;
    
    // If both have same image status, prefer Health & Beauty category
    if (current.category === 'Health & Beauty' && best.category !== 'Health & Beauty') return current;
    if (best.category === 'Health & Beauty' && current.category !== 'Health & Beauty') return best;
    
    // If both have same category, prefer lower price
    if (current.price < best.price) return current;
    
    return best;
  });
}

finalCleanupDuplicates();
