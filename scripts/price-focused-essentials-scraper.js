/**
 * Price-Focused Essentials Scraper
 * Extracts exact prices for Iceland and Aldi products
 * Uses same logic as essentials scraper but with enhanced price extraction
 */

const admin = require('firebase-admin');
const IcelandFinalScraper = require('./iceland-final-scraper');
const AldiFinalScraper = require('./aldi-final-scraper');
const fs = require('fs').promises;
const path = require('path');

class PriceFocusedEssentialsScraper {
  constructor() {
    this.stores = {
      'Iceland': { postcode: 'UB8 1ND', scraper: new IcelandFinalScraper() },
      'Aldi': { postcode: 'UB8 1ND', scraper: new AldiFinalScraper() }
    };
    
    // Same essentials as the working scraper
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
      products: [],
      storeBreakdown: {},
      categoryBreakdown: {},
      priceAnalysis: {
        totalWithPrices: 0,
        totalWithoutPrices: 0,
        priceCoverage: 0
      },
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

  async scrapeStore(storeName, storeConfig, category, searchTerms) {
    console.log(`\n🏪 Scraping ${storeName} for ${category}...`);
    const storeResults = {
      store: storeName,
      category: category,
      searchTerms: searchTerms,
      products: [],
      errors: []
    };

    for (const searchTerm of searchTerms) {
      try {
        console.log(`\n🔍 Searching ${storeName} for: "${searchTerm}"`);
        
        // Use the store's scraper
        const products = await storeConfig.scraper.scrapeCompleteProducts(searchTerm);
        
        console.log(`✅ Found ${products.length} products for "${searchTerm}"`);
        
        // Enhanced price validation and logging
        products.forEach(product => {
          const hasPrice = product.price && product.price.trim() !== '' && product.price !== 'undefined';
          console.log(`   - ${product.name}: ${hasPrice ? '✅ ' + product.price : '❌ No price'}`);
          
          // Add enhanced price analysis
          product.priceAnalysis = {
            hasPrice: hasPrice,
            priceType: hasPrice ? this.analyzePriceType(product.price) : 'none',
            priceValue: hasPrice ? this.extractPriceValue(product.price) : null
          };
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

  analyzePriceType(price) {
    if (!price || price.trim() === '') return 'empty';
    
    const priceStr = price.toString().trim();
    
    if (priceStr.includes('£')) return 'pound';
    if (priceStr.includes('p')) return 'pence';
    if (priceStr.includes('$')) return 'dollar';
    if (priceStr.includes('€')) return 'euro';
    if (/^\d+\.?\d*$/.test(priceStr)) return 'numeric';
    
    return 'unknown';
  }

  extractPriceValue(price) {
    if (!price || price.trim() === '') return null;
    
    const priceStr = price.toString().trim();
    const match = priceStr.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : null;
  }

  async saveToFirebase(products) {
    console.log(`\n💾 Saving ${products.length} products to Firebase...`);
    
    const firebaseReady = await this.initializeFirebase();
    if (!firebaseReady) {
      console.log('❌ Cannot save to Firebase - initialization failed');
      return { saved: 0, errors: products.length };
    }

    const db = admin.firestore();
    let saved = 0;
    let errors = 0;

    for (const product of products) {
      try {
        // Prepare product data for Firebase
        const firebaseProduct = {
          name: product.name,
          price: product.price || '',
          store: product.store,
          category: product.category,
          searchTerm: product.searchTerm,
          scrapedAt: product.scrapedAt,
          image: product.image || '',
          description: product.description || '',
          ingredients: product.ingredients || '',
          allergens: product.allergens || '',
          storage: product.storage || '',
          useBy: product.useBy || '',
          availability: product.availability || '',
          offer: product.offer || '',
          postcode: product.postcode,
          productId: product.productId || '',
          url: product.url || '',
          openFoodFactsId: product.openFoodFactsId || '',
          openFoodFactsUrl: product.openFoodFactsUrl || '',
          openFoodFactsBrand: product.openFoodFactsBrand || '',
          openFoodFactsCategories: product.openFoodFactsCategories || [],
          openFoodFactsNutrition: product.openFoodFactsNutrition || {},
          nutrition: product.nutrition || {},
          expiry: product.expiry || {},
          timestamp: product.timestamp || new Date().toISOString(),
          isEssential: product.isEssential || true,
          source: 'price_focused_essentials_scraper',
          priceAnalysis: product.priceAnalysis || {}
        };
        
        // Upload to Firebase
        await db.collection('products').add(firebaseProduct);
        saved++;
        
        console.log(`✅ Saved: ${product.name} (${product.price || 'No price'})`);
        
      } catch (error) {
        errors++;
        console.error(`❌ Failed to save ${product.name}:`, error.message);
        this.results.errors.push({
          product: product.name,
          store: product.store,
          error: error.message
        });
      }
    }

    return { saved, errors };
  }

  async saveToLocalBackup(products) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `price-focused-essentials-${timestamp}.json`;
    const filepath = path.join(__dirname, '../data/scraped-products', filename);
    
    const backupData = {
      timestamp: new Date().toISOString(),
      totalProducts: products.length,
      products: products,
      summary: {
        stores: this.results.storeBreakdown,
        categories: this.results.categoryBreakdown,
        priceAnalysis: this.results.priceAnalysis
      }
    };
    
    await fs.writeFile(filepath, JSON.stringify(backupData, null, 2));
    console.log(`💾 Local backup saved: ${filename}`);
    return filepath;
  }

  async run() {
    console.log('🚀 Starting Price-Focused Essentials Scraper...');
    console.log('🎯 Focus: Iceland and Aldi with exact price extraction\n');
    
    const allProducts = [];
    
    // Scrape each store
    for (const [storeName, storeConfig] of Object.entries(this.stores)) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏪 SCRAPING ${storeName.toUpperCase()}`);
      console.log(`${'='.repeat(60)}`);
      
      this.results.storeBreakdown[storeName] = {
        totalProducts: 0,
        productsWithPrices: 0,
        productsWithoutPrices: 0,
        priceCoverage: 0
      };
      
      // Scrape each category
      for (const [category, searchTerms] of Object.entries(this.essentials)) {
        const storeResults = await this.scrapeStore(storeName, storeConfig, category, searchTerms);
        
        // Update results
        allProducts.push(...storeResults.products);
        this.results.storeBreakdown[storeName].totalProducts += storeResults.products.length;
        
        // Count products with/without prices
        const withPrices = storeResults.products.filter(p => p.price && p.price.trim() !== '');
        const withoutPrices = storeResults.products.filter(p => !p.price || p.price.trim() === '');
        
        this.results.storeBreakdown[storeName].productsWithPrices += withPrices.length;
        this.results.storeBreakdown[storeName].productsWithoutPrices += withoutPrices.length;
        
        console.log(`\n📊 ${storeName} - ${category} Results:`);
        console.log(`   Total products: ${storeResults.products.length}`);
        console.log(`   With prices: ${withPrices.length} ✅`);
        console.log(`   Without prices: ${withoutPrices.length} ❌`);
        console.log(`   Price coverage: ${Math.round((withPrices.length / storeResults.products.length) * 100)}%`);
        
        // Log products without prices for debugging
        if (withoutPrices.length > 0) {
          console.log(`\n❌ Products without prices:`);
          withoutPrices.slice(0, 5).forEach(p => {
            console.log(`   - ${p.name} (${p.searchTerm})`);
          });
          if (withoutPrices.length > 5) {
            console.log(`   ... and ${withoutPrices.length - 5} more`);
          }
        }
      }
      
      // Calculate store price coverage
      const storeTotal = this.results.storeBreakdown[storeName].totalProducts;
      const storeWithPrices = this.results.storeBreakdown[storeName].productsWithPrices;
      this.results.storeBreakdown[storeName].priceCoverage = storeTotal > 0 ? 
        Math.round((storeWithPrices / storeTotal) * 100) : 0;
    }
    
    // Update overall results
    this.results.totalProducts = allProducts.length;
    this.results.products = allProducts;
    
    const totalWithPrices = allProducts.filter(p => p.price && p.price.trim() !== '').length;
    const totalWithoutPrices = allProducts.length - totalWithPrices;
    
    this.results.priceAnalysis = {
      totalWithPrices,
      totalWithoutPrices,
      priceCoverage: Math.round((totalWithPrices / allProducts.length) * 100)
    };
    
    // Generate category breakdown
    allProducts.forEach(product => {
      this.results.categoryBreakdown[product.category] = 
        (this.results.categoryBreakdown[product.category] || 0) + 1;
    });
    
    // Save results
    const backupPath = await this.saveToLocalBackup(allProducts);
    const firebaseResults = await this.saveToFirebase(allProducts);
    
    // Print final summary
    this.printFinalSummary(firebaseResults);
    
    return {
      totalProducts: allProducts.length,
      productsWithPrices: totalWithPrices,
      productsWithoutPrices: totalWithoutPrices,
      priceCoverage: this.results.priceAnalysis.priceCoverage,
      backupPath: backupPath,
      firebaseResults: firebaseResults
    };
  }

  printFinalSummary(firebaseResults) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 PRICE-FOCUSED ESSENTIALS SCRAPER SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\n📈 Overall Results:`);
    console.log(`   Total Products Scraped: ${this.results.totalProducts}`);
    console.log(`   Products with Prices: ${this.results.priceAnalysis.totalWithPrices} ✅`);
    console.log(`   Products without Prices: ${this.results.priceAnalysis.totalWithoutPrices} ❌`);
    console.log(`   Overall Price Coverage: ${this.results.priceAnalysis.priceCoverage}%`);
    
    console.log(`\n🏪 Store Breakdown:`);
    Object.entries(this.results.storeBreakdown).forEach(([store, data]) => {
      console.log(`   ${store}:`);
      console.log(`     Total: ${data.totalProducts} products`);
      console.log(`     With prices: ${data.productsWithPrices} (${data.priceCoverage}%)`);
      console.log(`     Without prices: ${data.productsWithoutPrices}`);
    });
    
    console.log(`\n📊 Category Breakdown:`);
    Object.entries(this.results.categoryBreakdown).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} products`);
    });
    
    console.log(`\n💾 Data Storage:`);
    console.log(`   Firebase: ${firebaseResults.saved} saved, ${firebaseResults.errors} errors`);
    console.log(`   Local backup: Generated successfully`);
    
    if (this.results.errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      this.results.errors.slice(0, 5).forEach((error, i) => {
        console.log(`   ${i + 1}. ${error.store} - ${error.searchTerm || error.product}: ${error.error}`);
      });
      if (this.results.errors.length > 5) {
        console.log(`   ... and ${this.results.errors.length - 5} more errors`);
      }
    }
    
    console.log('\n✅ Price-focused scraping complete!');
  }
}

// Run the scraper
const scraper = new PriceFocusedEssentialsScraper();
scraper.run().then(results => {
  console.log('\n🎉 Scraping completed successfully!');
  console.log(`📊 Final results: ${results.totalProducts} products, ${results.priceCoverage}% price coverage`);
  process.exit(0);
}).catch(error => {
  console.error('❌ Scraping failed:', error);
  process.exit(1);
});
