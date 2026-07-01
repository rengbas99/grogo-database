/**
 * Enhanced Essentials Scraper with Price Tracking & Availability Monitoring
 * Runs every 10 minutes to monitor price changes and availability
 */

const admin = require('firebase-admin');
const SainsburysFinalScraper = require('./sainsburys-final-scraper');
const LidlFinalScraper = require('./lidl-final-scraper');
const IcelandFinalScraper = require('./iceland-final-scraper');
const AldiFinalScraper = require('./aldi-final-scraper');
const TescoFinalScraper = require('./tesco-final-scraper');
const fs = require('fs').promises;
const path = require('path');

class EnhancedEssentialsScraper {
  constructor() {
    this.stores = {
      'Tesco': { postcode: 'UB8 1ND', scraper: new TescoFinalScraper() },
      'Sainsburys': { postcode: 'UB8 1QW', scraper: new SainsburysFinalScraper() },
      'Lidl': { postcode: 'UB8 1ND', scraper: new LidlFinalScraper() },
      'Iceland': { postcode: 'UB8 1ND', scraper: new IcelandFinalScraper() },
      'Aldi': { postcode: 'UB8 1ND', scraper: new AldiFinalScraper() }
    };
    
    // Essential categories only
    this.essentials = {
      'Cooking Essentials': [
        'oil', 'salt', 'pepper', 'garlic', 'onion', 'tomato', 'herbs', 'spices'
      ],
      'Staples': [
        'bread', 'rice', 'pasta', 'cereal', 'flour', 'sugar'
      ],
      'Dairy/Protein': [
        'milk', 'cheese', 'eggs', 'chicken', 'beef', 'pork', 'yogurt', 'butter'
      ],
      'Snacks': [
        'chocolate', 'biscuits', 'crisps', 'nuts'
      ],
      'Fruits': [
        'apple', 'banana', 'orange', 'grapes', 'strawberries'
      ],
      'Household Essentials': [
        'toilet paper', 'cleaning', 'laundry', 'soap', 'shampoo'
      ],
      'Sanitary & Personal Care': [
        'sanitary pads', 'tampons', 'toothpaste', 'deodorant', 'shampoo', 'conditioner'
      ]
    };
    
    this.results = {
      timestamp: new Date().toISOString(),
      totalProducts: 0,
      newProducts: 0,
      updatedProducts: 0,
      priceChanges: 0,
      availabilityChanges: 0,
      products: [],
      priceAlerts: [],
      availabilityAlerts: [],
      errors: []
    };
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

  async getExistingProducts() {
    const db = admin.firestore();
    const snapshot = await db.collection('products').get();
    const existingProducts = {};
    
    snapshot.forEach(doc => {
      const product = doc.data();
      const key = `${product.store}_${product.name}`.toLowerCase();
      existingProducts[key] = {
        id: doc.id,
        ...product
      };
    });
    
    return existingProducts;
  }

  async checkPriceChange(existingProduct, newProduct) {
    if (!existingProduct.price || !newProduct.price) return null;
    
    const oldPrice = parseFloat(existingProduct.price.replace('£', ''));
    const newPrice = parseFloat(newProduct.price.replace('£', ''));
    
    if (isNaN(oldPrice) || isNaN(newPrice)) return null;
    
    const change = newPrice - oldPrice;
    const changePercent = (change / oldPrice) * 100;
    
    if (Math.abs(change) > 0.01) { // More than 1p change
      return {
        product: newProduct.name,
        store: newProduct.store,
        oldPrice: existingProduct.price,
        newPrice: newProduct.price,
        change: change,
        changePercent: changePercent,
        type: change > 0 ? 'increase' : 'decrease'
      };
    }
    
    return null;
  }

  async checkAvailabilityChange(existingProduct, newProduct) {
    const oldAvailability = existingProduct.availability || 'Unknown';
    const newAvailability = newProduct.availability || 'Unknown';
    
    if (oldAvailability !== newAvailability) {
      return {
        product: newProduct.name,
        store: newProduct.store,
        oldAvailability: oldAvailability,
        newAvailability: newAvailability,
        type: newAvailability === 'Available' ? 'back_in_stock' : 'out_of_stock'
      };
    }
    
    return null;
  }

  async updateOrCreateProduct(product, existingProducts) {
    const db = admin.firestore();
    const key = `${product.store}_${product.name}`.toLowerCase();
    const existing = existingProducts[key];
    
    if (existing) {
      // Check for changes
      const priceChange = await this.checkPriceChange(existing, product);
      const availabilityChange = await this.checkAvailabilityChange(existing, product);
      
      if (priceChange) {
        this.results.priceChanges++;
        this.results.priceAlerts.push(priceChange);
        console.log(`💰 Price change: ${product.name} - ${existing.price} → ${product.price}`);
      }
      
      if (availabilityChange) {
        this.results.availabilityChanges++;
        this.results.availabilityAlerts.push(availabilityChange);
        console.log(`📦 Availability change: ${product.name} - ${existing.availability} → ${product.availability}`);
      }
      
      // Update product with tracking data
      const updatedProduct = {
        ...product,
        priceHistory: existing.priceHistory || [],
        availabilityHistory: existing.availabilityHistory || [],
        lastUpdated: new Date().toISOString(),
        updateCount: (existing.updateCount || 0) + 1
      };
      
      // Add current price to history if it changed
      if (priceChange) {
        updatedProduct.priceHistory.push({
          price: product.price,
          timestamp: new Date().toISOString(),
          change: priceChange.change,
          changePercent: priceChange.changePercent
        });
      }
      
      // Add current availability to history if it changed
      if (availabilityChange) {
        updatedProduct.availabilityHistory.push({
          availability: product.availability,
          timestamp: new Date().toISOString(),
          change: availabilityChange.type
        });
      }
      
      // Update in Firebase
      await db.collection('products').doc(existing.id).update(updatedProduct);
      this.results.updatedProducts++;
      
      console.log(`🔄 Updated: ${product.name} (${product.store})`);
      
    } else {
      // New product
      const newProduct = {
        ...product,
        priceHistory: [{
          price: product.price,
          timestamp: new Date().toISOString(),
          change: 0,
          changePercent: 0
        }],
        availabilityHistory: [{
          availability: product.availability,
          timestamp: new Date().toISOString(),
          change: 'initial'
        }],
        firstScraped: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        updateCount: 1
      };
      
      await db.collection('products').add(newProduct);
      this.results.newProducts++;
      
      console.log(`➕ New: ${product.name} (${product.store})`);
    }
  }

  async scrapeStore(storeName, storeConfig, category, searchTerms) {
    console.log(`\n🏪 Scraping ${storeName} for ${category}...`);
    const storeResults = {
      store: storeName,
      category: category,
      products: [],
      errors: []
    };

    for (const searchTerm of searchTerms) {
      try {
        console.log(`\n🔍 Searching ${storeName} for: "${searchTerm}"`);
        
        const products = await storeConfig.scraper.scrapeCompleteProducts(searchTerm);
        
        console.log(`✅ Found ${products.length} products for "${searchTerm}"`);
        
        // Enhanced logging with price and availability info
        products.forEach(product => {
          const hasPrice = product.price && product.price.trim() !== '';
          const availability = product.availability || 'Unknown';
          console.log(`   - ${product.name}: ${hasPrice ? '✅ ' + product.price : '❌ No price'} (${availability})`);
        });
        
        storeResults.products.push(...products);
        
      } catch (error) {
        console.error(`❌ Error scraping ${storeName} for "${searchTerm}":`, error.message);
        storeResults.errors.push({
          searchTerm: searchTerm,
          error: error.message
        });
        this.results.errors.push({
          store: storeName,
          searchTerm: searchTerm,
          error: error.message
        });
      }
    }

    return storeResults;
  }

  async run() {
    console.log('🚀 Starting Enhanced Essentials Scraper...');
    console.log('⏰ Running every 10 minutes for price & availability monitoring\n');
    
    const firebaseReady = await this.initializeFirebase();
    if (!firebaseReady) {
      console.log('❌ Cannot proceed without Firebase');
      return;
    }

    // Get existing products for comparison
    console.log('📊 Loading existing products for comparison...');
    const existingProducts = await this.getExistingProducts();
    console.log(`✅ Loaded ${Object.keys(existingProducts).length} existing products\n`);
    
    const allProducts = [];
    
    // Scrape each store
    for (const [storeName, storeConfig] of Object.entries(this.stores)) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏪 SCRAPING ${storeName.toUpperCase()}`);
      console.log(`${'='.repeat(60)}`);
      
      // Scrape each category
      for (const [category, searchTerms] of Object.entries(this.essentials)) {
        const storeResults = await this.scrapeStore(storeName, storeConfig, category, searchTerms);
        
        // Process each product
        for (const product of storeResults.products) {
          await this.updateOrCreateProduct(product, existingProducts);
          allProducts.push(product);
        }
      }
    }
    
    // Update results
    this.results.totalProducts = allProducts.length;
    this.results.products = allProducts;
    
    // Save monitoring report
    await this.saveMonitoringReport();
    
    // Print final summary
    this.printFinalSummary();
    
    return this.results;
  }

  async saveMonitoringReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results,
      monitoringDetails: {
        purpose: 'Price and availability monitoring for essential products',
        frequency: 'Every 10 minutes',
        stores: Object.keys(this.stores),
        categories: Object.keys(this.essentials)
      }
    };
    
    const reportPath = path.join(__dirname, '../data/enhanced-scraper-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📝 Monitoring report saved to: ${reportPath}`);
  }

  printFinalSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 ENHANCED ESSENTIALS SCRAPER SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\n📈 Scraping Results:`);
    console.log(`   Total Products Processed: ${this.results.totalProducts}`);
    console.log(`   New Products: ${this.results.newProducts} ➕`);
    console.log(`   Updated Products: ${this.results.updatedProducts} 🔄`);
    
    console.log(`\n💰 Price Monitoring:`);
    console.log(`   Price Changes Detected: ${this.results.priceChanges}`);
    if (this.results.priceAlerts.length > 0) {
      console.log(`   Price Alerts:`);
      this.results.priceAlerts.slice(0, 5).forEach((alert, i) => {
        console.log(`     ${i + 1}. ${alert.product} (${alert.store}): ${alert.oldPrice} → ${alert.newPrice} (${alert.changePercent.toFixed(1)}%)`);
      });
    }
    
    console.log(`\n📦 Availability Monitoring:`);
    console.log(`   Availability Changes: ${this.results.availabilityChanges}`);
    if (this.results.availabilityAlerts.length > 0) {
      console.log(`   Availability Alerts:`);
      this.results.availabilityAlerts.slice(0, 5).forEach((alert, i) => {
        console.log(`     ${i + 1}. ${alert.product} (${alert.store}): ${alert.oldAvailability} → ${alert.newAvailability}`);
      });
    }
    
    if (this.results.errors.length > 0) {
      console.log(`\n❌ Errors encountered: ${this.results.errors.length}`);
    }
    
    console.log('\n✅ Enhanced scraping complete!');
    console.log('⏰ Next run scheduled in 10 minutes...');
  }
}

// Run the enhanced scraper
const scraper = new EnhancedEssentialsScraper();
scraper.run().then(results => {
  console.log('\n🎉 Enhanced scraping completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Enhanced scraping failed:', error);
  process.exit(1);
});
