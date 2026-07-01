#!/usr/bin/env node

/**
 * Analyze Current Database
 * Check what's currently in Firebase that's being fed to the app
 */

const admin = require('firebase-admin');

class DatabaseAnalyzer {
  constructor() {
    this.db = null;
    this.analysis = {
      totalProducts: 0,
      totalStoreProducts: 0,
      stores: {},
      categories: {},
      brands: {},
      priceStats: {
        withPrice: 0,
        withoutPrice: 0,
        averagePrice: 0
      },
      imageStats: {
        withImage: 0,
        withoutImage: 0,
        cdnImages: 0,
        otherImages: 0
      }
    };
  }

  async analyzeDatabase() {
    try {
      console.log('🔍 Analyzing Current Firebase Database...');
      console.log('=' .repeat(60));

      // Initialize Firebase
      await this.initializeFirebase();

      // Analyze products collection
      await this.analyzeProducts();

      // Analyze store_products collection
      await this.analyzeStoreProducts();

      // Analyze stores collection
      await this.analyzeStores();

      // Display comprehensive results
      this.displayResults();

    } catch (error) {
      console.error('❌ Error analyzing database:', error);
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

  async analyzeProducts() {
    console.log('\n📦 Analyzing Products Collection...');
    
    const productsSnapshot = await this.db.collection('products').get();
    this.analysis.totalProducts = productsSnapshot.size;
    
    console.log(`   Total Products: ${this.analysis.totalProducts}`);

    // Sample some products for detailed analysis
    const sampleSize = Math.min(100, productsSnapshot.size);
    const sampleProducts = productsSnapshot.docs.slice(0, sampleSize);

    let totalPrice = 0;
    let priceCount = 0;

    sampleProducts.forEach(doc => {
      const product = doc.data();
      
      // Store analysis
      const store = product.store || 'Unknown';
      if (!this.analysis.stores[store]) {
        this.analysis.stores[store] = { count: 0, withPrice: 0, withImage: 0 };
      }
      this.analysis.stores[store].count++;

      // Category analysis
      const category = product.category || 'Uncategorized';
      this.analysis.categories[category] = (this.analysis.categories[category] || 0) + 1;

      // Brand analysis
      const brand = product.brand || 'Unknown';
      this.analysis.brands[brand] = (this.analysis.brands[brand] || 0) + 1;

      // Price analysis
      if (product.price && typeof product.price === 'number' && product.price > 0) {
        this.analysis.priceStats.withPrice++;
        this.analysis.stores[store].withPrice++;
        totalPrice += product.price;
        priceCount++;
      } else {
        this.analysis.priceStats.withoutPrice++;
      }

      // Image analysis
      if (product.image && product.image !== 'placeholder') {
        this.analysis.imageStats.withImage++;
        this.analysis.stores[store].withImage++;
        
        if (product.image.includes('cdn') || product.image.includes('digitalcontent.api')) {
          this.analysis.imageStats.cdnImages++;
        } else {
          this.analysis.imageStats.otherImages++;
        }
      } else {
        this.analysis.imageStats.withoutImage++;
      }
    });

    // Calculate average price
    if (priceCount > 0) {
      this.analysis.priceStats.averagePrice = (totalPrice / priceCount).toFixed(2);
    }
  }

  async analyzeStoreProducts() {
    console.log('\n🏪 Analyzing Store Products Collection...');
    
    const storeProductsSnapshot = await this.db.collection('store_products').get();
    this.analysis.totalStoreProducts = storeProductsSnapshot.size;
    
    console.log(`   Total Store Products: ${this.analysis.totalStoreProducts}`);

    // Analyze by store
    const storeBreakdown = {};
    storeProductsSnapshot.forEach(doc => {
      const storeProduct = doc.data();
      const storeName = storeProduct.storeName || 'Unknown';
      storeBreakdown[storeName] = (storeBreakdown[storeName] || 0) + 1;
    });

    console.log('\n   Store Breakdown:');
    Object.entries(storeBreakdown).forEach(([store, count]) => {
      console.log(`   - ${store}: ${count} products`);
    });
  }

  async analyzeStores() {
    console.log('\n🏬 Analyzing Stores Collection...');
    
    const storesSnapshot = await this.db.collection('stores').get();
    console.log(`   Total Stores: ${storesSnapshot.size}`);

    storesSnapshot.forEach(doc => {
      const store = doc.data();
      console.log(`   - ${store.name} (${store.storeId}): ${store.productCount || 'Unknown'} products`);
    });
  }

  displayResults() {
    console.log('\n📊 COMPREHENSIVE DATABASE ANALYSIS');
    console.log('=' .repeat(60));
    
    console.log(`\n📦 PRODUCTS COLLECTION:`);
    console.log(`   Total Products: ${this.analysis.totalProducts}`);
    console.log(`   With Prices: ${this.analysis.priceStats.withPrice} (${((this.analysis.priceStats.withPrice/this.analysis.totalProducts)*100).toFixed(1)}%)`);
    console.log(`   Without Prices: ${this.analysis.priceStats.withoutPrice} (${((this.analysis.priceStats.withoutPrice/this.analysis.totalProducts)*100).toFixed(1)}%)`);
    console.log(`   Average Price: £${this.analysis.priceStats.averagePrice}`);
    
    console.log(`\n🖼️  IMAGE STATISTICS:`);
    console.log(`   With Images: ${this.analysis.imageStats.withImage} (${((this.analysis.imageStats.withImage/this.analysis.totalProducts)*100).toFixed(1)}%)`);
    console.log(`   Without Images: ${this.analysis.imageStats.withoutImage} (${((this.analysis.imageStats.withoutImage/this.analysis.totalProducts)*100).toFixed(1)}%)`);
    console.log(`   CDN Images: ${this.analysis.imageStats.cdnImages}`);
    console.log(`   Other Images: ${this.analysis.imageStats.otherImages}`);

    console.log(`\n🏪 STORES IN PRODUCTS:`);
    Object.entries(this.analysis.stores).forEach(([store, stats]) => {
      const priceRate = ((stats.withPrice/stats.count)*100).toFixed(1);
      const imageRate = ((stats.withImage/stats.count)*100).toFixed(1);
      console.log(`   ${store}: ${stats.count} products (${priceRate}% with prices, ${imageRate}% with images)`);
    });

    console.log(`\n📂 TOP CATEGORIES:`);
    const sortedCategories = Object.entries(this.analysis.categories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    sortedCategories.forEach(([category, count]) => {
      console.log(`   ${category}: ${count} products`);
    });

    console.log(`\n🏷️  TOP BRANDS:`);
    const sortedBrands = Object.entries(this.analysis.brands)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    sortedBrands.forEach(([brand, count]) => {
      console.log(`   ${brand}: ${count} products`);
    });

    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total Products: ${this.analysis.totalProducts}`);
    console.log(`   Total Store Products: ${this.analysis.totalStoreProducts}`);
    console.log(`   Stores: ${Object.keys(this.analysis.stores).length}`);
    console.log(`   Categories: ${Object.keys(this.analysis.categories).length}`);
    console.log(`   Brands: ${Object.keys(this.analysis.brands).length}`);

    // Data quality assessment
    const priceQuality = ((this.analysis.priceStats.withPrice/this.analysis.totalProducts)*100).toFixed(1);
    const imageQuality = ((this.analysis.imageStats.withImage/this.analysis.totalProducts)*100).toFixed(1);
    
    console.log(`\n🎯 DATA QUALITY:`);
    console.log(`   Price Coverage: ${priceQuality}%`);
    console.log(`   Image Coverage: ${imageQuality}%`);
    
    if (parseFloat(priceQuality) >= 90 && parseFloat(imageQuality) >= 90) {
      console.log(`   ✅ Excellent data quality!`);
    } else if (parseFloat(priceQuality) >= 70 && parseFloat(imageQuality) >= 70) {
      console.log(`   ⚠️  Good data quality, some improvements needed`);
    } else {
      console.log(`   ❌ Data quality needs improvement`);
    }
  }
}

// Main execution
async function main() {
  const analyzer = new DatabaseAnalyzer();
  await analyzer.analyzeDatabase();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DatabaseAnalyzer;

