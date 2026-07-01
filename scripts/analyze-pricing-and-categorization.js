/**
 * Analyze Pricing and Categorization Issues
 * Identifies products missing prices and uncategorized products
 */

const admin = require('firebase-admin');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

class PricingAndCategorizationAnalyzer {
  constructor() {
    this.allProducts = [];
    this.productsWithPrices = [];
    this.productsWithoutPrices = [];
    this.uncategorizedProducts = [];
    this.categorizedProducts = [];
    this.pricingIssues = [];
  }

  async initializeFirebase() {
    try {
      if (admin.apps.length === 0) {
        const serviceAccount = require('../config/firebase-service-account.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      }
      console.log('✅ Firebase initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error.message);
      return false;
    }
  }

  async loadAllProducts() {
    console.log('🔥 Loading products from Firebase...');
    try {
      const db = admin.firestore();
      const productsSnapshot = await db.collection('products').get();
      
      if (productsSnapshot.empty) {
        console.log('❌ No products found in Firebase');
        return [];
      }
      
      const products = [];
      productsSnapshot.forEach(doc => {
        const product = doc.data();
        products.push({
          ...product,
          id: doc.id,
          source: 'firebase'
        });
      });
      
      console.log(`✅ Loaded ${products.length} products from Firebase`);
      return products;
    } catch (error) {
      console.error('❌ Error loading Firebase products:', error.message);
      return [];
    }
  }

  analyzePricing(product) {
    const price = product.price;
    const hasPrice = price && price !== '' && price !== 'undefined' && price !== 'N/A';
    
    if (hasPrice) {
      this.productsWithPrices.push(product);
      return {
        hasPrice: true,
        price: price,
        priceType: this.determinePriceType(price)
      };
    } else {
      this.productsWithoutPrices.push(product);
      return {
        hasPrice: false,
        price: price || 'Missing',
        issue: this.determinePricingIssue(product)
      };
    }
  }

  determinePriceType(price) {
    if (typeof price === 'string') {
      if (price.includes('£')) return 'GBP';
      if (price.includes('$')) return 'USD';
      if (price.includes('€')) return 'EUR';
      if (price.match(/^\d+\.?\d*$/)) return 'Numeric';
      return 'Text';
    }
    return 'Unknown';
  }

  determinePricingIssue(product) {
    const price = product.price;
    
    if (!price) return 'No price field';
    if (price === '') return 'Empty price string';
    if (price === 'undefined') return 'Undefined value';
    if (price === 'N/A') return 'N/A value';
    if (price === 'null') return 'Null value';
    
    return 'Other issue';
  }

  analyzeCategorization(product) {
    const hasCategory = product.category && product.category !== '' && product.category !== 'undefined';
    const hasCategorizedCategory = product.categorizedCategory && product.categorizedCategory !== 'Uncategorized';
    
    if (hasCategory || hasCategorizedCategory) {
      this.categorizedProducts.push(product);
      return {
        isCategorized: true,
        originalCategory: product.category,
        categorizedCategory: product.categorizedCategory
      };
    } else {
      this.uncategorizedProducts.push(product);
      return {
        isCategorized: false,
        originalCategory: product.category || 'Missing',
        categorizedCategory: product.categorizedCategory || 'Uncategorized',
        issue: this.determineCategorizationIssue(product)
      };
    }
  }

  determineCategorizationIssue(product) {
    if (!product.category) return 'No category field';
    if (product.category === '') return 'Empty category string';
    if (product.category === 'undefined') return 'Undefined category';
    if (product.categorizedCategory === 'Uncategorized') return 'Failed categorization';
    
    return 'Other issue';
  }

  async analyzeAllProducts() {
    console.log('🔍 Starting pricing and categorization analysis...\n');
    
    // Initialize Firebase
    const firebaseReady = await this.initializeFirebase();
    if (!firebaseReady) {
      console.log('❌ Cannot proceed without Firebase');
      return;
    }
    
    // Load products
    this.allProducts = await this.loadAllProducts();
    console.log(`\n📊 Total products to analyze: ${this.allProducts.length}`);
    
    // Analyze each product
    console.log('\n🔍 Analyzing products...');
    for (const product of this.allProducts) {
      const pricingAnalysis = this.analyzePricing(product);
      const categorizationAnalysis = this.analyzeCategorization(product);
      
      // Store analysis results
      product.pricingAnalysis = pricingAnalysis;
      product.categorizationAnalysis = categorizationAnalysis;
    }
    
    // Generate reports
    await this.generateAnalysisReports();
    
    // Print summary
    this.printAnalysisSummary();
  }

  async generateAnalysisReports() {
    console.log('\n📋 Generating analysis reports...');
    
    // Generate pricing issues CSV
    await this.generatePricingIssuesCSV();
    
    // Generate categorization issues CSV
    await this.generateCategorizationIssuesCSV();
    
    // Generate detailed analysis log
    await this.generateDetailedAnalysisLog();
  }

  async generatePricingIssuesCSV() {
    console.log('📄 Generating pricing issues CSV...');
    
    const csvHeaders = [
      'ID', 'Name', 'Store', 'Category', 'Price', 'Price Issue', 'Price Type',
      'Has Image', 'Has Description', 'Has Expiry', 'Search Term', 'Scraped At'
    ];
    
    let csvContent = csvHeaders.join(',') + '\n';
    
    for (const product of this.productsWithoutPrices) {
      const row = [
        product.id || '',
        `"${(product.name || '').replace(/"/g, '""')}"`,
        product.store || '',
        product.category || '',
        product.price || '',
        product.pricingAnalysis.issue || '',
        product.pricingAnalysis.priceType || '',
        product.image || product.imageUrl ? 'Yes' : 'No',
        product.description || product.desc ? 'Yes' : 'No',
        product.expiry || product.expiryDate || product.bestBefore ? 'Yes' : 'No',
        product.searchTerm || '',
        product.scrapedAt || ''
      ];
      csvContent += row.join(',') + '\n';
    }
    
    const csvPath = path.join(__dirname, '../data/products-missing-prices.csv');
    await fsPromises.writeFile(csvPath, csvContent);
    console.log(`✅ Pricing issues CSV saved to: ${csvPath}`);
  }

  async generateCategorizationIssuesCSV() {
    console.log('📄 Generating categorization issues CSV...');
    
    const csvHeaders = [
      'ID', 'Name', 'Store', 'Original Category', 'Categorized Category', 'Categorization Issue',
      'Has Image', 'Has Description', 'Has Expiry', 'Price', 'Search Term', 'Scraped At'
    ];
    
    let csvContent = csvHeaders.join(',') + '\n';
    
    for (const product of this.uncategorizedProducts) {
      const row = [
        product.id || '',
        `"${(product.name || '').replace(/"/g, '""')}"`,
        product.store || '',
        product.category || '',
        product.categorizedCategory || '',
        product.categorizationAnalysis.issue || '',
        product.image || product.imageUrl ? 'Yes' : 'No',
        product.description || product.desc ? 'Yes' : 'No',
        product.expiry || product.expiryDate || product.bestBefore ? 'Yes' : 'No',
        product.price || '',
        product.searchTerm || '',
        product.scrapedAt || ''
      ];
      csvContent += row.join(',') + '\n';
    }
    
    const csvPath = path.join(__dirname, '../data/uncategorized-products.csv');
    await fsPromises.writeFile(csvPath, csvContent);
    console.log(`✅ Categorization issues CSV saved to: ${csvPath}`);
  }

  async generateDetailedAnalysisLog() {
    console.log('📝 Generating detailed analysis log...');
    
    const logContent = {
      timestamp: new Date().toISOString(),
      summary: {
        totalProducts: this.allProducts.length,
        productsWithPrices: this.productsWithPrices.length,
        productsWithoutPrices: this.productsWithoutPrices.length,
        categorizedProducts: this.categorizedProducts.length,
        uncategorizedProducts: this.uncategorizedProducts.length,
        pricingCoverage: Math.round((this.productsWithPrices.length / this.allProducts.length) * 100),
        categorizationCoverage: Math.round((this.categorizedProducts.length / this.allProducts.length) * 100)
      },
      pricingAnalysis: {
        priceTypes: this.analyzePriceTypes(),
        pricingIssues: this.analyzePricingIssues(),
        storeBreakdown: this.analyzePricingByStore()
      },
      categorizationAnalysis: {
        categorizationIssues: this.analyzeCategorizationIssues(),
        storeBreakdown: this.analyzeCategorizationByStore()
      },
      recommendations: this.generateRecommendations()
    };
    
    const logPath = path.join(__dirname, '../data/pricing-categorization-analysis.json');
    await fsPromises.writeFile(logPath, JSON.stringify(logContent, null, 2));
    console.log(`✅ Detailed analysis log saved to: ${logPath}`);
  }

  analyzePriceTypes() {
    const priceTypes = {};
    this.productsWithPrices.forEach(product => {
      const type = product.pricingAnalysis.priceType;
      priceTypes[type] = (priceTypes[type] || 0) + 1;
    });
    return priceTypes;
  }

  analyzePricingIssues() {
    const issues = {};
    this.productsWithoutPrices.forEach(product => {
      const issue = product.pricingAnalysis.issue;
      issues[issue] = (issues[issue] || 0) + 1;
    });
    return issues;
  }

  analyzeCategorizationIssues() {
    const issues = {};
    this.uncategorizedProducts.forEach(product => {
      const issue = product.categorizationAnalysis.issue;
      issues[issue] = (issues[issue] || 0) + 1;
    });
    return issues;
  }

  analyzePricingByStore() {
    const storeBreakdown = {};
    this.allProducts.forEach(product => {
      const store = product.store || 'undefined';
      if (!storeBreakdown[store]) {
        storeBreakdown[store] = { total: 0, withPrices: 0, withoutPrices: 0 };
      }
      storeBreakdown[store].total++;
      if (product.pricingAnalysis.hasPrice) {
        storeBreakdown[store].withPrices++;
      } else {
        storeBreakdown[store].withoutPrices++;
      }
    });
    return storeBreakdown;
  }

  analyzeCategorizationByStore() {
    const storeBreakdown = {};
    this.allProducts.forEach(product => {
      const store = product.store || 'undefined';
      if (!storeBreakdown[store]) {
        storeBreakdown[store] = { total: 0, categorized: 0, uncategorized: 0 };
      }
      storeBreakdown[store].total++;
      if (product.categorizationAnalysis.isCategorized) {
        storeBreakdown[store].categorized++;
      } else {
        storeBreakdown[store].uncategorized++;
      }
    });
    return storeBreakdown;
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.productsWithoutPrices.length > 0) {
      recommendations.push({
        issue: 'Missing Prices',
        count: this.productsWithoutPrices.length,
        recommendation: 'Re-run scrapers with improved price extraction logic',
        priority: 'High'
      });
    }
    
    if (this.uncategorizedProducts.length > 0) {
      recommendations.push({
        issue: 'Uncategorized Products',
        count: this.uncategorizedProducts.length,
        recommendation: 'Improve categorization algorithm or add manual categorization',
        priority: 'Medium'
      });
    }
    
    const undefinedStoreCount = this.allProducts.filter(p => !p.store || p.store === 'undefined').length;
    if (undefinedStoreCount > 0) {
      recommendations.push({
        issue: 'Undefined Store Names',
        count: undefinedStoreCount,
        recommendation: 'Fix store name assignment in scrapers',
        priority: 'High'
      });
    }
    
    return recommendations;
  }

  printAnalysisSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 PRICING & CATEGORIZATION ANALYSIS SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\n📈 Overall Statistics:`);
    console.log(`   Total Products: ${this.allProducts.length}`);
    console.log(`   Products with Prices: ${this.productsWithPrices.length} (${Math.round((this.productsWithPrices.length / this.allProducts.length) * 100)}%)`);
    console.log(`   Products without Prices: ${this.productsWithoutPrices.length} (${Math.round((this.productsWithoutPrices.length / this.allProducts.length) * 100)}%)`);
    console.log(`   Categorized Products: ${this.categorizedProducts.length} (${Math.round((this.categorizedProducts.length / this.allProducts.length) * 100)}%)`);
    console.log(`   Uncategorized Products: ${this.uncategorizedProducts.length} (${Math.round((this.uncategorizedProducts.length / this.allProducts.length) * 100)}%)`);
    
    console.log(`\n💰 Pricing Issues:`);
    const pricingIssues = this.analyzePricingIssues();
    Object.entries(pricingIssues).forEach(([issue, count]) => {
      console.log(`   ${issue}: ${count} products`);
    });
    
    console.log(`\n🏷️  Categorization Issues:`);
    const categorizationIssues = this.analyzeCategorizationIssues();
    Object.entries(categorizationIssues).forEach(([issue, count]) => {
      console.log(`   ${issue}: ${count} products`);
    });
    
    console.log(`\n📁 Files Generated:`);
    console.log(`   📄 Missing Prices: data/products-missing-prices.csv`);
    console.log(`   📄 Uncategorized: data/uncategorized-products.csv`);
    console.log(`   📝 Analysis Log: data/pricing-categorization-analysis.json`);
    
    console.log('\n✅ Analysis complete!');
  }
}

// Run the analyzer
const analyzer = new PricingAndCategorizationAnalyzer();
analyzer.analyzeAllProducts().then(() => {
  console.log('\n🎉 Pricing and categorization analysis completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});
