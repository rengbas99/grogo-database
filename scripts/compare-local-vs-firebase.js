#!/usr/bin/env node

/**
 * Compare Local Data vs Firebase Data
 * Checks if the complete-essentials-with-prices data matches Firebase
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

class DataComparator {
  constructor() {
    this.localData = null;
    this.firebaseData = null;
    this.comparison = {
      localProducts: 0,
      firebaseProducts: 0,
      matchingProducts: 0,
      missingInFirebase: [],
      extraInFirebase: [],
      priceDifferences: [],
      imageDifferences: []
    };
  }

  async compareData() {
    try {
      console.log('🔍 Comparing Local vs Firebase Data...');
      console.log('=' .repeat(60));

      // Initialize Firebase
      await this.initializeFirebase();

      // Load local data
      await this.loadLocalData();

      // Load Firebase data
      await this.loadFirebaseData();

      // Compare the data
      await this.performComparison();

      // Display results
      this.displayResults();

    } catch (error) {
      console.error('❌ Error comparing data:', error);
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

  async loadLocalData() {
    const filePath = path.join(__dirname, '..', 'data', 'essentials', 'complete-essentials-with-prices-2025-09-20.json');
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Local data file not found');
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    this.localData = data.products || data;
    this.comparison.localProducts = this.localData.length;
    
    console.log(`📂 Loaded ${this.localData.length} local products`);
  }

  async loadFirebaseData() {
    const snapshot = await this.db.collection('products').get();
    this.firebaseData = [];
    
    snapshot.forEach(doc => {
      this.firebaseData.push({
        id: doc.id,
        ...doc.data()
      });
    });

    this.comparison.firebaseProducts = this.firebaseData.length;
    console.log(`🔥 Loaded ${this.firebaseData.length} Firebase products`);
  }

  async performComparison() {
    console.log('\n🔍 Performing detailed comparison...');

    // Create lookup maps for efficient comparison
    const localMap = new Map();
    const firebaseMap = new Map();

    // Index local products by name + store
    this.localData.forEach(product => {
      const key = `${product.name?.toLowerCase()}_${product.store?.toLowerCase()}`;
      localMap.set(key, product);
    });

    // Index Firebase products by name + store
    this.firebaseData.forEach(product => {
      const key = `${product.name?.toLowerCase()}_${product.store?.toLowerCase()}`;
      firebaseMap.set(key, product);
    });

    // Find matches and differences
    for (const [key, localProduct] of localMap) {
      const firebaseProduct = firebaseMap.get(key);
      
      if (firebaseProduct) {
        this.comparison.matchingProducts++;
        
        // Compare prices
        if (localProduct.price !== firebaseProduct.price) {
          this.comparison.priceDifferences.push({
            name: localProduct.name,
            store: localProduct.store,
            localPrice: localProduct.price,
            firebasePrice: firebaseProduct.price
          });
        }

        // Compare images
        if (localProduct.image !== firebaseProduct.image) {
          this.comparison.imageDifferences.push({
            name: localProduct.name,
            store: localProduct.store,
            localImage: localProduct.image,
            firebaseImage: firebaseProduct.image
          });
        }
      } else {
        this.comparison.missingInFirebase.push({
          name: localProduct.name,
          store: localProduct.store,
          price: localProduct.price
        });
      }
    }

    // Find products in Firebase but not in local data
    for (const [key, firebaseProduct] of firebaseMap) {
      if (!localMap.has(key)) {
        this.comparison.extraInFirebase.push({
          name: firebaseProduct.name,
          store: firebaseProduct.store,
          price: firebaseProduct.price
        });
      }
    }
  }

  displayResults() {
    console.log('\n📊 COMPARISON RESULTS:');
    console.log('=' .repeat(60));
    
    console.log(`📦 Local Products: ${this.comparison.localProducts}`);
    console.log(`🔥 Firebase Products: ${this.comparison.firebaseProducts}`);
    console.log(`✅ Matching Products: ${this.comparison.matchingProducts}`);
    
    const matchPercentage = ((this.comparison.matchingProducts / Math.max(this.comparison.localProducts, this.comparison.firebaseProducts)) * 100).toFixed(1);
    console.log(`📈 Match Percentage: ${matchPercentage}%`);

    // Missing in Firebase
    if (this.comparison.missingInFirebase.length > 0) {
      console.log(`\n❌ Missing in Firebase (${this.comparison.missingInFirebase.length}):`);
      this.comparison.missingInFirebase.slice(0, 10).forEach(product => {
        console.log(`   - ${product.name} (${product.store}) - £${product.price}`);
      });
      if (this.comparison.missingInFirebase.length > 10) {
        console.log(`   ... and ${this.comparison.missingInFirebase.length - 10} more`);
      }
    }

    // Extra in Firebase
    if (this.comparison.extraInFirebase.length > 0) {
      console.log(`\n➕ Extra in Firebase (${this.comparison.extraInFirebase.length}):`);
      this.comparison.extraInFirebase.slice(0, 10).forEach(product => {
        console.log(`   - ${product.name} (${product.store}) - £${product.price}`);
      });
      if (this.comparison.extraInFirebase.length > 10) {
        console.log(`   ... and ${this.comparison.extraInFirebase.length - 10} more`);
      }
    }

    // Price differences
    if (this.comparison.priceDifferences.length > 0) {
      console.log(`\n💰 Price Differences (${this.comparison.priceDifferences.length}):`);
      this.comparison.priceDifferences.slice(0, 5).forEach(diff => {
        console.log(`   - ${diff.name} (${diff.store}):`);
        console.log(`     Local: £${diff.localPrice} | Firebase: £${diff.firebasePrice}`);
      });
      if (this.comparison.priceDifferences.length > 5) {
        console.log(`   ... and ${this.comparison.priceDifferences.length - 5} more`);
      }
    }

    // Image differences
    if (this.comparison.imageDifferences.length > 0) {
      console.log(`\n🖼️  Image Differences (${this.comparison.imageDifferences.length}):`);
      this.comparison.imageDifferences.slice(0, 3).forEach(diff => {
        console.log(`   - ${diff.name} (${diff.store}):`);
        console.log(`     Local: ${diff.localImage?.substring(0, 50)}...`);
        console.log(`     Firebase: ${diff.firebaseImage?.substring(0, 50)}...`);
      });
      if (this.comparison.imageDifferences.length > 3) {
        console.log(`   ... and ${this.comparison.imageDifferences.length - 3} more`);
      }
    }

    // Summary
    console.log('\n📋 SUMMARY:');
    console.log('=' .repeat(30));
    
    if (this.comparison.matchingProducts === this.comparison.localProducts && 
        this.comparison.localProducts === this.comparison.firebaseProducts) {
      console.log('✅ Perfect match! Local and Firebase data are identical');
    } else if (this.comparison.matchingProducts > this.comparison.localProducts * 0.9) {
      console.log('✅ Very close match! Data is mostly synchronized');
    } else if (this.comparison.missingInFirebase.length > 0) {
      console.log('⚠️  Local data has more products than Firebase');
    } else if (this.comparison.extraInFirebase.length > 0) {
      console.log('⚠️  Firebase has more products than local data');
    } else {
      console.log('❌ Significant differences found between local and Firebase data');
    }
  }
}

// Main execution
async function main() {
  const comparator = new DataComparator();
  await comparator.compareData();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DataComparator;


