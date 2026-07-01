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

async function updateCadburyImages() {
  try {
    console.log('🍫 Updating Cadbury product images and descriptions...');
    
    const storeRef = db.collection('stores').doc('tesco_uxbridge');
    const categoriesSnapshot = await storeRef.collection('categories').get();
    
    // Product updates
    const updates = [
      {
        name: "Cadbury Dairy Milk Chocolate Buttons Bag 100G",
        image: "https://digitalcontent.api.tesco.com/v2/media/ghs/d8afd3e0-1983-4ef4-8826-0ec129c5de16/1e3fa604-3c48-47c5-811f-9e8b07a6c046_1711989792.jpeg",
        description: "Milk chocolate buttons in a resealable bag"
      },
      {
        name: "Cadbury Timeout Wafer Chocolate Biscuit Bars 6 Pack 108g",
        image: "https://digitalcontent.api.tesco.com/v2/media/ghs/f4382052-8e99-41e0-be27-7cee9bef7214/b5c2cf4a-dd51-499c-a5c6-70212ae63473_673627383.jpeg",
        description: "Wafer (19%) With A Cocoa Filling (35%) Covered With Milk Chocolate (44%)"
      }
    ];
    
    for (const update of updates) {
      console.log(`\n🔍 Looking for: ${update.name}`);
      
      let found = false;
      
      // Search through all categories
      for (const categoryDoc of categoriesSnapshot.docs) {
        const categoryName = categoryDoc.id;
        const productsSnapshot = await categoryDoc.ref.collection('products')
          .where('name', '==', update.name)
          .get();
        
        if (!productsSnapshot.empty) {
          const productDoc = productsSnapshot.docs[0];
          const productData = productDoc.data();
          
          console.log(`   Found in category: ${categoryName}`);
          console.log(`   Current image: ${productData.image || 'NO IMAGE'}`);
          console.log(`   Current description: ${productData.description || 'NO DESCRIPTION'}`);
          
          // Update the product
          await productDoc.ref.update({
            image: update.image,
            description: update.description,
            updatedAt: new Date()
          });
          
          console.log(`   ✅ Updated with new image and description`);
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.log(`   ❌ Product not found: ${update.name}`);
      }
    }
    
    // Check why descriptions aren't showing in the app
    console.log(`\n🔍 Checking product descriptions in database...`);
    
    let productsWithDescriptions = 0;
    let productsWithoutDescriptions = 0;
    let sampleProducts = [];
    
    for (const categoryDoc of categoriesSnapshot.docs) {
      const productsSnapshot = await categoryDoc.ref.collection('products').limit(10).get();
      
      for (const productDoc of productsSnapshot.docs) {
        const data = productDoc.data();
        if (data.description && data.description.trim() !== '') {
          productsWithDescriptions++;
          if (sampleProducts.length < 5) {
            sampleProducts.push({
              name: data.name,
              description: data.description,
              hasDescription: true
            });
          }
        } else {
          productsWithoutDescriptions++;
          if (sampleProducts.length < 10) {
            sampleProducts.push({
              name: data.name,
              description: data.description,
              hasDescription: false
            });
          }
        }
      }
    }
    
    console.log(`\n📊 Description Statistics:`);
    console.log(`   Products with descriptions: ${productsWithDescriptions}`);
    console.log(`   Products without descriptions: ${productsWithoutDescriptions}`);
    console.log(`   Description coverage: ${((productsWithDescriptions / (productsWithDescriptions + productsWithoutDescriptions)) * 100).toFixed(1)}%`);
    
    console.log(`\n📋 Sample Products:`);
    sampleProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name.substring(0, 50)}...`);
      console.log(`   Description: ${product.hasDescription ? product.description.substring(0, 100) + '...' : 'NONE'}`);
    });
    
    console.log(`\n✅ Cadbury image updates completed!`);
    
  } catch (error) {
    console.error('❌ Error updating Cadbury images:', error);
  }
}

updateCadburyImages();
