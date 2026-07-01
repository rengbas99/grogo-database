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

async function copyAlwaysImage() {
  try {
    console.log('🖼️  Copying Always product image...');
    
    const storeRef = db.collection('stores').doc('tesco_uxbridge');
    
    // Find the Always product with image
    const healthBeautyRef = storeRef.collection('categories').doc('Health & Beauty');
    const productsSnapshot = await healthBeautyRef.collection('products').get();
    
    let sourceProduct = null;
    let targetProduct = null;
    
    for (const productDoc of productsSnapshot.docs) {
      const data = productDoc.data();
      if (data.name && data.name.toLowerCase().includes('always')) {
        if (data.image && data.image.includes('digitalcontent.api.tesco.com')) {
          sourceProduct = { ref: productDoc.ref, data: data };
          console.log(`✅ Found source product with image: ${data.name}`);
        } else if (data.name.includes('Always Ultra Secure Night Extra Sanitary Towels')) {
          targetProduct = { ref: productDoc.ref, data: data };
          console.log(`🎯 Found target product without image: ${data.name}`);
        }
      }
    }
    
    if (sourceProduct && targetProduct) {
      console.log(`\n📋 Copying image from "${sourceProduct.data.name}" to "${targetProduct.data.name}"`);
      
      // Copy the image URL
      await targetProduct.ref.update({
        image: sourceProduct.data.image,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ Successfully copied image!`);
      console.log(`   Image URL: ${sourceProduct.data.image}`);
    } else {
      console.log('❌ Could not find both source and target products');
      if (!sourceProduct) console.log('   Missing: Source product with image');
      if (!targetProduct) console.log('   Missing: Target product without image');
    }
    
  } catch (error) {
    console.error('❌ Error copying Always image:', error);
  }
}

copyAlwaysImage();
