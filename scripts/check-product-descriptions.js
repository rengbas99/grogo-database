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

async function checkProductDescriptions() {
  try {
    console.log('🔍 Checking product descriptions in Firebase...');
    
    const storeRef = db.collection('stores').doc('tesco_uxbridge');
    const categoriesSnapshot = await storeRef.collection('categories').get();
    
    let sampleProducts = [];
    let totalProducts = 0;
    let productsWithDescriptions = 0;
    
    // Check a few products from each category
    for (const categoryDoc of categoriesSnapshot.docs) {
      const categoryName = categoryDoc.id;
      const productsSnapshot = await categoryDoc.ref.collection('products').limit(3).get();
      
      console.log(`\n📂 Category: ${categoryName} (${productsSnapshot.size} products checked)`);
      
      for (const productDoc of productsSnapshot.docs) {
        const data = productDoc.data();
        totalProducts++;
        
        const hasDescription = data.description && data.description.trim() !== '';
        if (hasDescription) productsWithDescriptions++;
        
        if (sampleProducts.length < 10) {
          sampleProducts.push({
            name: data.name,
            description: data.description,
            hasDescription: hasDescription,
            category: categoryName,
            allFields: Object.keys(data)
          });
        }
        
        console.log(`  - ${data.name.substring(0, 40)}...`);
        console.log(`    Description: ${hasDescription ? data.description.substring(0, 50) + '...' : 'NONE'}`);
        console.log(`    Fields: ${Object.keys(data).join(', ')}`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total products checked: ${totalProducts}`);
    console.log(`   Products with descriptions: ${productsWithDescriptions}`);
    console.log(`   Description coverage: ${((productsWithDescriptions / totalProducts) * 100).toFixed(1)}%`);
    
    console.log(`\n📋 Sample Products with Field Analysis:`);
    sampleProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name.substring(0, 50)}...`);
      console.log(`   Description: ${product.hasDescription ? product.description.substring(0, 80) + '...' : 'NONE'}`);
      console.log(`   Available fields: ${product.allFields.join(', ')}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error checking product descriptions:', error);
  }
}

checkProductDescriptions();
