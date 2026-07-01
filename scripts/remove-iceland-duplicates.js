const admin = require('firebase-admin');
const serviceAccount = require('../config/firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();
const storeId = 'iceland_uxbridge';
const storeRef = db.collection('stores').doc(storeId);

async function removeDuplicates() {
  console.log('🔍 Starting duplicate removal for Iceland products...');
  
  try {
    // Get all categories
    const categoriesSnapshot = await storeRef.collection('categories').get();
    let totalRemoved = 0;
    let totalProducts = 0;
    
    for (const categoryDoc of categoriesSnapshot.docs) {
      const categoryName = categoryDoc.id;
      console.log(`\n📂 Processing category: ${categoryName}`);
      
      // Get all products in this category
      const productsSnapshot = await categoryDoc.ref.collection('products').get();
      const products = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      totalProducts += products.length;
      console.log(`  Found ${products.length} products`);
      
      // Group products by name to find duplicates
      const productGroups = {};
      products.forEach(product => {
        const key = product.name.toLowerCase().trim();
        if (!productGroups[key]) {
          productGroups[key] = [];
        }
        productGroups[key].push(product);
      });
      
      // Find and remove duplicates
      const duplicates = Object.entries(productGroups).filter(([name, products]) => products.length > 1);
      
      if (duplicates.length > 0) {
        console.log(`  Found ${duplicates.length} duplicate groups:`);
        
        for (const [productName, duplicateProducts] of duplicates) {
          console.log(`    "${productName}": ${duplicateProducts.length} copies`);
          
          // Keep the first one, remove the rest
          const toKeep = duplicateProducts[0];
          const toRemove = duplicateProducts.slice(1);
          
          console.log(`      Keeping: ${toKeep.id}`);
          
          // Delete duplicates
          const batch = db.batch();
          toRemove.forEach(product => {
            console.log(`      Removing: ${product.id}`);
            batch.delete(categoryDoc.ref.collection('products').doc(product.id));
            totalRemoved++;
          });
          
          await batch.commit();
        }
      } else {
        console.log(`  No duplicates found`);
      }
    }
    
    console.log(`\n✅ Duplicate removal completed!`);
    console.log(`📊 Summary:`);
    console.log(`  Total products processed: ${totalProducts}`);
    console.log(`  Duplicates removed: ${totalRemoved}`);
    console.log(`  Products remaining: ${totalProducts - totalRemoved}`);
    
    // Update store product count
    const finalCount = totalProducts - totalRemoved;
    await storeRef.update({
      productCount: finalCount,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`\n🎉 Iceland now has ${finalCount} unique products (no duplicates)`);
    
  } catch (error) {
    console.error('❌ Error removing duplicates:', error);
  }
}

removeDuplicates();
