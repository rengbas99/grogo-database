const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../grogo-mvp-firebase-adminsdk-fbsvc-9caddcb9d0.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkTescoImages() {
  try {
    console.log('🔍 Checking Tesco product images...');
    
    // Get Tesco store
    const storeRef = db.collection('stores').doc('tesco_uxbridge');
    const categoriesSnapshot = await storeRef.collection('categories').get();
    
    console.log(`📊 Found ${categoriesSnapshot.size} categories`);
    
    let totalProducts = 0;
    let productsWithImages = 0;
    let sampleImages = [];
    
    // Check first few categories for image samples
    for (let i = 0; i < Math.min(3, categoriesSnapshot.size); i++) {
      const categoryDoc = categoriesSnapshot.docs[i];
      const categoryName = categoryDoc.id;
      console.log(`\n🔍 Checking category: ${categoryName}`);
      
      const productsSnapshot = await categoryDoc.ref.collection('products').limit(5).get();
      
      console.log(`📦 Found ${productsSnapshot.size} products in ${categoryName}`);
      
      productsSnapshot.forEach(doc => {
        const data = doc.data();
        totalProducts++;
        
        if (data.image && data.image.trim() !== '') {
          productsWithImages++;
          if (sampleImages.length < 10) {
            sampleImages.push({
              name: data.name,
              image: data.image,
              category: categoryName
            });
          }
        }
      });
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`- Total products checked: ${totalProducts}`);
    console.log(`- Products with images: ${productsWithImages}`);
    console.log(`- Image coverage: ${((productsWithImages / totalProducts) * 100).toFixed(1)}%`);
    
    console.log(`\n🖼️ Sample images:`);
    sampleImages.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Image URL: ${product.image}`);
      console.log(`   Domain: ${new URL(product.image).hostname}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Error checking images:', error);
  } finally {
    process.exit(0);
  }
}

// Run the check
checkTescoImages();
