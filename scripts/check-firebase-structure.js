const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../grogo-mvp-firebase-adminsdk-fbsvc-9caddcb9d0.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkFirebaseStructure() {
  try {
    console.log('🔍 Checking Firebase collections...');
    
    // List all collections
    const collections = await db.listCollections();
    console.log('📁 Available collections:');
    collections.forEach(collection => {
      console.log(`- ${collection.id}`);
    });
    
    // Check products collection
    console.log('\n🔍 Checking products collection...');
    const productsSnapshot = await db.collection('products').limit(5).get();
    console.log(`📊 Products collection has ${productsSnapshot.size} documents (showing first 5)`);
    
    productsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- ID: ${doc.id}`);
      console.log(`  Name: ${data.name}`);
      console.log(`  Store Type: ${data.storeType}`);
      console.log(`  Store ID: ${data.storeId}`);
      console.log('---');
    });
    
    // Check specifically for Lidl products
    console.log('\n🔍 Checking for Lidl products...');
    const lidlSnapshot = await db.collection('products')
      .where('storeType', '==', 'lidl')
      .limit(5)
      .get();
    console.log(`📊 Found ${lidlSnapshot.size} Lidl products`);
    
    lidlSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- ID: ${doc.id} - ${data.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking Firebase structure:', error);
  } finally {
    process.exit(0);
  }
}

// Run the check
checkFirebaseStructure();
