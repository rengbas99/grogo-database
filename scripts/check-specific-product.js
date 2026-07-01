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

async function checkSpecificProduct() {
  try {
    console.log('🔍 Checking specific product: Always Ultra Secure Night Extra Sanitary Towels');
    
    const storeRef = db.collection('stores').doc('tesco_uxbridge');
    const categoriesSnapshot = await storeRef.collection('categories').get();
    
    let found = false;
    
    for (const categoryDoc of categoriesSnapshot.docs) {
      const categoryName = categoryDoc.id;
      console.log(`\n📂 Checking category: ${categoryName}`);
      
      const productsSnapshot = await categoryDoc.ref.collection('products').get();
      
      for (const productDoc of productsSnapshot.docs) {
        const data = productDoc.data();
        if (data.name && data.name.includes('Always Ultra Secure Night Extra Sanitary Towels')) {
          found = true;
          console.log(`\n✅ FOUND PRODUCT:`);
          console.log(`   ID: ${productDoc.id}`);
          console.log(`   Name: ${data.name}`);
          console.log(`   Brand: ${data.brand}`);
          console.log(`   Category: ${categoryName}`);
          console.log(`   Price: £${data.price}`);
          console.log(`   Image URL: ${data.image || 'NO IMAGE'}`);
          console.log(`   Image exists: ${!!data.image}`);
          
          if (data.image) {
            try {
              const url = new URL(data.image);
              console.log(`   Image domain: ${url.hostname}`);
              console.log(`   Image protocol: ${url.protocol}`);
              
              // Check if it's a valid domain
              const validDomains = [
                'tesco.com',
                'digitalcontent.api.tesco.com',
                'sainsburys.co.uk',
                'assets.sainsburys-groceries.co.uk',
                'aldi.co.uk',
                'dm.emea.cms.aldi.cx',
                'lidl.co.uk',
                'iceland.co.uk',
                'assets.iceland.co.uk',
                'openfoodfacts.org',
                'images.openfoodfacts.org',
                'unsplash.com',
                'images.unsplash.com',
                'via.placeholder.com'
              ];
              
              const isValidDomain = validDomains.some(domain => url.hostname.includes(domain));
              console.log(`   Valid domain: ${isValidDomain}`);
              
              if (!isValidDomain) {
                console.log(`   ❌ INVALID DOMAIN: ${url.hostname}`);
              }
            } catch (e) {
              console.log(`   ❌ Invalid URL format: ${e.message}`);
            }
          }
          
          return; // Found the product, exit
        }
      }
    }
    
    if (!found) {
      console.log('❌ Product not found in any category');
    }
    
  } catch (error) {
    console.error('❌ Error checking specific product:', error);
  }
}

checkSpecificProduct();
