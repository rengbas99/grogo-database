const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../grogo-mvp-firebase-adminsdk-fbsvc-9caddcb9d0.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkAllStoreImages() {
  try {
    console.log('🔍 Checking all store product images...');
    
    const stores = ['tesco_uxbridge', 'sainsbury_uxbridge', 'aldi_west_drayton', 'lidl_uxbridge_cowley', 'iceland_uxbridge'];
    const imageDomains = new Set();
    
    for (const storeId of stores) {
      console.log(`\n🏪 Checking ${storeId}...`);
      
      try {
        const storeRef = db.collection('stores').doc(storeId);
        const categoriesSnapshot = await storeRef.collection('categories').get();
        
        let totalProducts = 0;
        let productsWithImages = 0;
        let sampleImages = [];
        
        // Check first 2 categories for each store
        for (let i = 0; i < Math.min(2, categoriesSnapshot.size); i++) {
          const categoryDoc = categoriesSnapshot.docs[i];
          const categoryName = categoryDoc.id;
          
          const productsSnapshot = await categoryDoc.ref.collection('products').limit(3).get();
          
          productsSnapshot.forEach(doc => {
            const data = doc.data();
            totalProducts++;
            
            if (data.image && data.image.trim() !== '') {
              productsWithImages++;
              if (sampleImages.length < 5) {
                try {
                  const url = new URL(data.image);
                  imageDomains.add(url.hostname);
                  sampleImages.push({
                    name: data.name,
                    image: data.image,
                    domain: url.hostname,
                    category: categoryName
                  });
                } catch (e) {
                  console.log(`Invalid URL: ${data.image}`);
                }
              }
            }
          });
        }
        
        console.log(`  📦 Products: ${totalProducts}, Images: ${productsWithImages} (${((productsWithImages / totalProducts) * 100).toFixed(1)}%)`);
        
        if (sampleImages.length > 0) {
          console.log(`  🖼️ Sample images:`);
          sampleImages.forEach((img, index) => {
            console.log(`    ${index + 1}. ${img.name.substring(0, 30)}...`);
            console.log(`       Domain: ${img.domain}`);
          });
        }
        
      } catch (error) {
        console.log(`  ❌ Error checking ${storeId}: ${error.message}`);
      }
    }
    
    console.log(`\n🌐 All image domains found:`);
    Array.from(imageDomains).sort().forEach(domain => {
      console.log(`  - ${domain}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking images:', error);
  } finally {
    process.exit(0);
  }
}

// Run the check
checkAllStoreImages();
