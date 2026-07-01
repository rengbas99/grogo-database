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

// Valid Tesco CDN domains
const VALID_TESCO_DOMAINS = [
  'digitalcontent.api.tesco.com',
  'tesco.com'
];

// Products that should be in Health & Beauty category
const HEALTH_BEAUTY_PRODUCTS = [
  'always',
  'tampax',
  'bodyform',
  'listerine',
  'colgate',
  'oral-b',
  'sensitive',
  'sanitary',
  'tampons',
  'pads',
  'toothpaste',
  'mouthwash',
  'shampoo',
  'conditioner',
  'soap',
  'deodorant',
  'razor',
  'blade'
];

async function cleanupAllDuplicates() {
  try {
    console.log('🧹 Starting comprehensive cleanup of all duplicate products...');
    
    const storeRef = db.collection('stores').doc('tesco_uxbridge');
    const categoriesSnapshot = await storeRef.collection('categories').get();
    
    let allProducts = [];
    let duplicatesFound = [];
    let productsToMove = [];
    let productsToDelete = [];
    
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
    
    // Process duplicates
    for (const [productName, products] of productMap) {
      if (products.length > 1) {
        console.log(`\n🔄 Found ${products.length} duplicates for: "${productName}"`);
        
        // Find the best version (has valid image, proper category)
        const bestProduct = findBestProduct(products);
        const duplicates = products.filter(p => p.id !== bestProduct.id);
        
        duplicatesFound.push({
          name: productName,
          best: bestProduct,
          duplicates: duplicates
        });
        
        // Mark duplicates for deletion
        duplicates.forEach(dup => {
          productsToDelete.push(dup);
        });
        
        // Check if best product needs to be moved to proper category
        if (shouldMoveToHealthBeauty(bestProduct)) {
          productsToMove.push(bestProduct);
        }
      } else {
        // Single product - check if it needs to be moved
        const product = products[0];
        if (shouldMoveToHealthBeauty(product)) {
          productsToMove.push(product);
        }
      }
    }
    
    console.log(`\n📋 Cleanup Summary:`);
    console.log(`   Duplicate groups found: ${duplicatesFound.length}`);
    console.log(`   Products to delete: ${productsToDelete.length}`);
    console.log(`   Products to move to Health & Beauty: ${productsToMove.length}`);
    
    // Show detailed breakdown
    console.log(`\n🔍 Duplicate Details:`);
    duplicatesFound.forEach((group, index) => {
      console.log(`\n${index + 1}. "${group.name}"`);
      console.log(`   Best version: ${group.best.category} (${group.best.hasValidImage ? 'HAS IMAGE' : 'NO IMAGE'})`);
      group.duplicates.forEach(dup => {
        console.log(`   Duplicate: ${dup.category} (${dup.hasValidImage ? 'HAS IMAGE' : 'NO IMAGE'}) - TO DELETE`);
      });
    });
    
    // Execute cleanup
    console.log(`\n🚀 Starting cleanup process...`);
    
    // 1. Delete duplicate products
    console.log(`\n🗑️  Deleting ${productsToDelete.length} duplicate products...`);
    for (const product of productsToDelete) {
      try {
        await product.ref.delete();
        console.log(`   ✅ Deleted: ${product.name} from ${product.category}`);
      } catch (error) {
        console.log(`   ❌ Failed to delete: ${product.name} - ${error.message}`);
      }
    }
    
    // 2. Move products to Health & Beauty category
    console.log(`\n📦 Moving ${productsToMove.length} products to Health & Beauty category...`);
    
    // Ensure Health & Beauty category exists
    const healthBeautyRef = storeRef.collection('categories').doc('Health & Beauty');
    const healthBeautyDoc = await healthBeautyRef.get();
    if (!healthBeautyDoc.exists) {
      await healthBeautyRef.set({
        name: 'Health & Beauty',
        description: 'Health and beauty products',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`   ✅ Created Health & Beauty category`);
    }
    
    for (const product of productsToMove) {
      try {
        // Add to Health & Beauty category
        const newProductRef = healthBeautyRef.collection('products').doc(product.id);
        await newProductRef.set({
          ...product.data,
          category: 'Health & Beauty',
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Delete from old category
        await product.ref.delete();
        
        console.log(`   ✅ Moved: ${product.name} from ${product.category} to Health & Beauty`);
      } catch (error) {
        console.log(`   ❌ Failed to move: ${product.name} - ${error.message}`);
      }
    }
    
    console.log(`\n✅ Cleanup completed successfully!`);
    console.log(`   Deleted: ${productsToDelete.length} duplicate products`);
    console.log(`   Moved: ${productsToMove.length} products to Health & Beauty`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

function isValidTescoImage(imageUrl) {
  if (!imageUrl) return false;
  
  try {
    const url = new URL(imageUrl);
    return VALID_TESCO_DOMAINS.some(domain => url.hostname.includes(domain));
  } catch {
    return false;
  }
}

function shouldMoveToHealthBeauty(product) {
  if (product.category === 'Health & Beauty') return false;
  
  const nameLower = product.name.toLowerCase();
  const brandLower = (product.brand || '').toLowerCase();
  
  return HEALTH_BEAUTY_PRODUCTS.some(keyword => 
    nameLower.includes(keyword) || brandLower.includes(keyword)
  );
}

function findBestProduct(products) {
  // Priority: 1. Has valid Tesco image, 2. Proper category, 3. Lower price
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

cleanupAllDuplicates();
