#!/usr/bin/env node

/**
 * Check Firebase Products and Images
 * Analyzes what product data and images are currently stored in Firebase
 */

const FirebaseService = require('../src/services/FirebaseService');
const fs = require('fs');
const path = require('path');

class FirebaseProductChecker {
  constructor() {
    this.firebase = FirebaseService;
    this.results = {
      totalProducts: 0,
      totalStoreProducts: 0,
      imageAnalysis: {
        totalWithImages: 0,
        cdnImages: 0,
        openfoodfactsImages: 0,
        placeholderImages: 0,
        noImages: 0,
        imageSources: {}
      },
      storeBreakdown: {},
      categories: {},
      recentProducts: []
    };
  }

  async checkProducts() {
    try {
      console.log('🔍 Checking Firebase Products...');
      console.log('=' .repeat(60));

      // Initialize Firebase
      await this.firebase.initialize();

      // Get all products
      console.log('📦 Fetching products...');
      const productsSnapshot = await this.firebase.db.collection('products').get();
      this.results.totalProducts = productsSnapshot.size;

      // Get all store products
      console.log('🏪 Fetching store products...');
      const storeProductsSnapshot = await this.firebase.db.collection('store_products').get();
      this.results.totalStoreProducts = storeProductsSnapshot.size;

      console.log(`\n📊 FIREBASE DATA SUMMARY:`);
      console.log(`   Products: ${this.results.totalProducts}`);
      console.log(`   Store Products: ${this.results.totalStoreProducts}`);

      // Analyze products
      if (productsSnapshot.size > 0) {
        console.log('\n🔍 Analyzing product images...');
        await this.analyzeProducts(productsSnapshot);
      }

      // Analyze store products
      if (storeProductsSnapshot.size > 0) {
        console.log('\n🏪 Analyzing store products...');
        await this.analyzeStoreProducts(storeProductsSnapshot);
      }

      // Display results
      this.displayResults();

      // Save detailed report
      await this.saveReport();

    } catch (error) {
      console.error('❌ Error checking Firebase products:', error);
    }
  }

  async analyzeProducts(productsSnapshot) {
    let processed = 0;
    
    productsSnapshot.forEach(doc => {
      const data = doc.data();
      processed++;
      
      if (processed % 100 === 0) {
        console.log(`   Processed ${processed}/${this.results.totalProducts} products...`);
      }

      // Analyze image
      this.analyzeImage(data.image, data.name);

      // Track categories
      if (data.category) {
        this.results.categories[data.category] = (this.results.categories[data.category] || 0) + 1;
      }

      // Track recent products
      if (data.createdAt && this.results.recentProducts.length < 10) {
        this.results.recentProducts.push({
          id: doc.id,
          name: data.name,
          category: data.category,
          image: data.image,
          createdAt: data.createdAt
        });
      }
    });

    console.log(`   ✅ Analyzed ${processed} products`);
  }

  async analyzeStoreProducts(storeProductsSnapshot) {
    let processed = 0;
    
    storeProductsSnapshot.forEach(doc => {
      const data = doc.data();
      processed++;
      
      if (processed % 100 === 0) {
        console.log(`   Processed ${processed}/${this.results.totalStoreProducts} store products...`);
      }

      // Track store breakdown
      if (data.storeName) {
        this.results.storeBreakdown[data.storeName] = (this.results.storeBreakdown[data.storeName] || 0) + 1;
      }

      // Analyze image if present
      if (data.image) {
        this.analyzeImage(data.image, data.productName || data.name);
      }
    });

    console.log(`   ✅ Analyzed ${processed} store products`);
  }

  analyzeImage(imageUrl, productName) {
    if (!imageUrl) {
      this.results.imageAnalysis.noImages++;
      return;
    }

    this.results.imageAnalysis.totalWithImages++;

    // Categorize image source
    if (imageUrl.includes('assets.iceland.co.uk')) {
      this.results.imageAnalysis.cdnImages++;
      this.results.imageAnalysis.imageSources['Iceland CDN'] = (this.results.imageAnalysis.imageSources['Iceland CDN'] || 0) + 1;
    } else if (imageUrl.includes('dm.emea.cms.aldi.cx')) {
      this.results.imageAnalysis.cdnImages++;
      this.results.imageAnalysis.imageSources['Aldi CDN'] = (this.results.imageAnalysis.imageSources['Aldi CDN'] || 0) + 1;
    } else if (imageUrl.includes('openfoodfacts.org')) {
      this.results.imageAnalysis.openfoodfactsImages++;
      this.results.imageAnalysis.imageSources['OpenFoodFacts'] = (this.results.imageAnalysis.imageSources['OpenFoodFacts'] || 0) + 1;
    } else if (imageUrl.includes('placeholder') || imageUrl.includes('logo') || imageUrl.includes('default')) {
      this.results.imageAnalysis.placeholderImages++;
      this.results.imageAnalysis.imageSources['Placeholder'] = (this.results.imageAnalysis.imageSources['Placeholder'] || 0) + 1;
    } else {
      this.results.imageAnalysis.imageSources['Other'] = (this.results.imageAnalysis.imageSources['Other'] || 0) + 1;
    }
  }

  displayResults() {
    console.log('\n📊 DETAILED ANALYSIS:');
    console.log('=' .repeat(60));

    // Image Analysis
    console.log('\n🖼️  IMAGE ANALYSIS:');
    console.log(`   Total with Images: ${this.results.imageAnalysis.totalWithImages}`);
    console.log(`   CDN Images: ${this.results.imageAnalysis.cdnImages}`);
    console.log(`   OpenFoodFacts Images: ${this.results.imageAnalysis.openfoodfactsImages}`);
    console.log(`   Placeholder Images: ${this.results.imageAnalysis.placeholderImages}`);
    console.log(`   No Images: ${this.results.imageAnalysis.noImages}`);

    console.log('\n📊 IMAGE SOURCES:');
    Object.entries(this.results.imageAnalysis.imageSources).forEach(([source, count]) => {
      const percentage = ((count / this.results.imageAnalysis.totalWithImages) * 100).toFixed(1);
      console.log(`   ${source}: ${count} (${percentage}%)`);
    });

    // Store Breakdown
    if (Object.keys(this.results.storeBreakdown).length > 0) {
      console.log('\n🏪 STORE BREAKDOWN:');
      Object.entries(this.results.storeBreakdown).forEach(([store, count]) => {
        console.log(`   ${store}: ${count} products`);
      });
    }

    // Categories
    if (Object.keys(this.results.categories).length > 0) {
      console.log('\n📂 TOP CATEGORIES:');
      const sortedCategories = Object.entries(this.results.categories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
      
      sortedCategories.forEach(([category, count]) => {
        console.log(`   ${category}: ${count} products`);
      });
    }

    // Recent Products
    if (this.results.recentProducts.length > 0) {
      console.log('\n🆕 RECENT PRODUCTS:');
      this.results.recentProducts.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name} (${product.category})`);
        console.log(`      Image: ${product.image ? '✅' : '❌'}`);
        if (product.image) {
          console.log(`      Source: ${this.getImageSource(product.image)}`);
        }
      });
    }
  }

  getImageSource(imageUrl) {
    if (imageUrl.includes('assets.iceland.co.uk')) return 'Iceland CDN';
    if (imageUrl.includes('dm.emea.cms.aldi.cx')) return 'Aldi CDN';
    if (imageUrl.includes('openfoodfacts.org')) return 'OpenFoodFacts';
    if (imageUrl.includes('placeholder') || imageUrl.includes('logo')) return 'Placeholder';
    return 'Other';
  }

  async saveReport() {
    try {
      const reportPath = path.join(__dirname, '..', 'data', 'firebase-analysis-report.json');
      const report = {
        timestamp: new Date().toISOString(),
        ...this.results
      };

      // Ensure data directory exists
      const dataDir = path.dirname(reportPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n💾 Detailed report saved: ${reportPath}`);
    } catch (error) {
      console.error('❌ Error saving report:', error);
    }
  }
}

// Main execution
async function main() {
  const checker = new FirebaseProductChecker();
  await checker.checkProducts();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = FirebaseProductChecker;
