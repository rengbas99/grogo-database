#!/usr/bin/env node

/**
 * Check Firebase Duplicates
 * Analyze the Firebase database for duplicate products across all stores
 */

const admin = require('firebase-admin');

class FirebaseDuplicateChecker {
  constructor() {
    this.db = null;
    this.duplicates = [];
    this.stats = {
      totalProducts: 0,
      duplicatesFound: 0,
      stores: {},
      startTime: new Date()
    };
  }

  async checkFirebaseDuplicates() {
    try {
      console.log('🔍 Checking Firebase Database for Duplicates...');
      console.log('=' .repeat(60));

      // Initialize Firebase
      await this.initializeFirebase();

      // Get all stores
      const storesSnapshot = await this.db.collection('stores').get();
      console.log(`📊 Found ${storesSnapshot.size} stores`);

      // Process each store
      for (const storeDoc of storesSnapshot.docs) {
        const storeData = storeDoc.data();
        console.log(`\n🏪 Checking ${storeData.name}...`);
        await this.checkStoreDuplicates(storeDoc.id, storeData);
      }

      // Display results
      this.displayResults();

    } catch (error) {
      console.error('❌ Error checking Firebase duplicates:', error);
    }
  }

  async initializeFirebase() {
    if (!admin.apps.length) {
      const serviceAccount = require('../config/firebase-service-account.json');
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    }
    this.db = admin.firestore();
    console.log('✅ Firebase connected');
  }

  async checkStoreDuplicates(storeId, storeData) {
    this.stats.stores[storeData.name] = {
      totalProducts: 0,
      duplicates: 0,
      categories: {}
    };

    // Get all categories for this store
    const categoriesSnapshot = await this.db.collection('stores').doc(storeId).collection('categories').get();
    
    for (const categoryDoc of categoriesSnapshot.docs) {
      await this.checkCategoryDuplicates(storeId, storeData.name, categoryDoc.id, categoryDoc.ref);
    }
  }

  async checkCategoryDuplicates(storeId, storeName, categoryName, categoryRef) {
    const productsSnapshot = await categoryRef.collection('products').get();
    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ref: doc.ref,
      ...doc.data()
    }));

    this.stats.totalProducts += products.length;
    this.stats.stores[storeName].totalProducts += products.length;

    if (!this.stats.stores[storeName].categories[categoryName]) {
      this.stats.stores[storeName].categories[categoryName] = {
        total: 0,
        duplicates: 0
      };
    }

    this.stats.stores[storeName].categories[categoryName].total = products.length;

    console.log(`   📁 ${categoryName}: ${products.length} products`);

    // Check for duplicates within this category
    const duplicates = this.findDuplicatesInCategory(products, storeName, categoryName);
    
    if (duplicates.length > 0) {
      this.stats.stores[storeName].categories[categoryName].duplicates = duplicates.length;
      this.stats.stores[storeName].duplicates += duplicates.length;
      this.stats.duplicatesFound += duplicates.length;
      this.duplicates.push(...duplicates);
      
      console.log(`   ⚠️  Found ${duplicates.length} duplicates in ${categoryName}`);
    }
  }

  findDuplicatesInCategory(products, storeName, categoryName) {
    const productMap = new Map();
    const duplicates = [];

    for (const product of products) {
      // Create a key for duplicate detection
      const key = this.createDuplicateKey(product);
      
      if (productMap.has(key)) {
        const existing = productMap.get(key);
        duplicates.push({
          store: storeName,
          category: categoryName,
          duplicate: product,
          original: existing,
          key: key
        });
      } else {
        productMap.set(key, product);
      }
    }

    return duplicates;
  }

  createDuplicateKey(product) {
    // Create a key based on name, brand, and price for duplicate detection
    const name = (product.name || '').toLowerCase().trim();
    const brand = (product.brand || '').toLowerCase().trim();
    const price = product.price || 0;
    
    // Normalize the name for better matching
    const normalizedName = name
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();
    
    return `${brand}|${normalizedName}|${price}`;
  }

  displayResults() {
    const duration = (new Date() - this.stats.startTime) / 1000;
    
    console.log('\n📊 FIREBASE DUPLICATE ANALYSIS RESULTS');
    console.log('=' .repeat(60));
    console.log(`⏱️  Analysis Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📦 Total Products Analyzed: ${this.stats.totalProducts}`);
    console.log(`🔄 Duplicates Found: ${this.stats.duplicatesFound}`);
    
    console.log('\n📊 BY STORE:');
    console.log('─'.repeat(40));
    
    Object.entries(this.stats.stores).forEach(([store, stats]) => {
      console.log(`\n🏪 ${store.toUpperCase()}:`);
      console.log(`   Total Products: ${stats.totalProducts}`);
      console.log(`   Duplicates: ${stats.duplicates}`);
      console.log(`   Duplicate Rate: ${((stats.duplicates/stats.totalProducts)*100).toFixed(1)}%`);
      
      if (stats.duplicates > 0) {
        console.log(`   Categories with duplicates:`);
        Object.entries(stats.categories).forEach(([category, catStats]) => {
          if (catStats.duplicates > 0) {
            console.log(`     - ${category}: ${catStats.duplicates}/${catStats.total} (${((catStats.duplicates/catStats.total)*100).toFixed(1)}%)`);
          }
        });
      }
    });

    if (this.duplicates.length > 0) {
      console.log('\n🔍 SAMPLE DUPLICATES:');
      console.log('─'.repeat(30));
      
      // Show first 10 duplicates as examples
      this.duplicates.slice(0, 10).forEach((duplicate, index) => {
        console.log(`${index + 1}. ${duplicate.store} - ${duplicate.category}`);
        console.log(`   Original: "${duplicate.original.name}" (${duplicate.original.id})`);
        console.log(`   Duplicate: "${duplicate.duplicate.name}" (${duplicate.duplicate.id})`);
        console.log(`   Key: ${duplicate.key}`);
        console.log('');
      });

      if (this.duplicates.length > 10) {
        console.log(`... and ${this.duplicates.length - 10} more duplicates`);
      }

      console.log('\n💡 RECOMMENDATIONS:');
      console.log('─'.repeat(25));
      console.log('1. Run the duplicate removal script to clean up the database');
      console.log('2. Check if products are being uploaded multiple times');
      console.log('3. Verify the upload process to prevent future duplicates');
    } else {
      console.log('\n✅ No duplicates found in Firebase database!');
    }
  }
}

// Main execution
async function main() {
  const checker = new FirebaseDuplicateChecker();
  await checker.checkFirebaseDuplicates();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = FirebaseDuplicateChecker;
