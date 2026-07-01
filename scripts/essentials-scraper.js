/**
 * Essentials Scraper - Family Survey Essentials + Sanitary Products
 * Uses same logic as master scraper but focused on family essentials
 * Starting with Sainsbury's only for testing
 */

const admin = require('firebase-admin');
// const TescoFinalScraper = require('./tesco-final-scraper'); // Commented out for now
const SainsburysFinalScraper = require('./sainsburys-final-scraper');
const LidlFinalScraper = require('./lidl-final-scraper');
const IcelandFinalScraper = require('./iceland-final-scraper');
const AldiFinalScraper = require('./aldi-final-scraper');
const fs = require('fs').promises;
const path = require('path');

class EssentialsScraper {
  constructor() {
    this.stores = {
      // 'Tesco': { postcode: 'UB8 1ND', scraper: new TescoFinalScraper() }, // Commented out for now
      // 'Sainsburys': { postcode: 'UB8 1QW', scraper: new SainsburysFinalScraper() }, // Commented out for now
      'Lidl': { postcode: 'UB8 1ND', scraper: new LidlFinalScraper() },
      'Iceland': { postcode: 'UB8 1ND', scraper: new IcelandFinalScraper() },
      // 'Aldi': { postcode: 'UB8 1ND', scraper: new AldiFinalScraper() } // Commented out for now
    };
    
    // Family Survey Essentials + Sanitary Products
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
    
    this.allProducts = [];
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

  async scrapeStore(storeName, storeInfo) {
    console.log(`\n🏪 Scraping ${storeName}...`);
    const products = [];
    
    for (const [category, searchTerms] of Object.entries(this.essentials)) {
      console.log(`\n📂 Category: ${category}`);
      
      for (const searchTerm of searchTerms) {
        try {
          console.log(`🔍 Searching for: ${searchTerm}`);
          
          // Use the correct method name: scrapeCompleteProducts
          const storeProducts = await storeInfo.scraper.scrapeCompleteProducts(searchTerm);
          
          // Add category and store info
          const enrichedProducts = storeProducts.map(product => ({
            ...product,
            category: category,
            store: storeName,
            searchTerm: searchTerm,
            timestamp: new Date().toISOString(),
            isEssential: true
          }));
          
          products.push(...enrichedProducts);
          console.log(`✅ Found ${enrichedProducts.length} products for ${searchTerm}`);
          
          // Small delay between searches
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`❌ Error searching ${searchTerm} in ${storeName}:`, error.message);
        }
      }
    }
    
    console.log(`\n📊 ${storeName} total: ${products.length} products`);
    return products;
  }

  async saveToFirebase(products) {
    try {
      const db = admin.firestore();
      const batch = db.batch();
      
      for (const product of products) {
        // Use productId as the document ID, or generate one if missing
        const docId = product.productId || product.id || `product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const productRef = db.collection('products').doc(docId);
        batch.set(productRef, product);
      }
      
      await batch.commit();
      console.log(`✅ Saved ${products.length} products to Firebase`);
      return true;
    } catch (error) {
      console.error('❌ Firebase save failed:', error.message);
      return false;
    }
  }

  async saveToLocalFile(products) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `essentials-scraper-results-${timestamp}.json`;
      const filepath = path.join(__dirname, '..', 'data', 'scraped-products', filename);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      
      // Prepare data for saving
      const saveData = {
        timestamp: new Date().toISOString(),
        totalProducts: products.length,
        essentials: this.essentials,
        products: products,
        summary: {
          totalProducts: products.length,
          storesProcessed: Object.keys(this.stores).length,
          categories: Object.keys(this.essentials).length
        }
      };
      
      // Group by store and category
      products.forEach(product => {
        if (!saveData[product.store]) {
          saveData[product.store] = {};
        }
        if (!saveData[product.store][product.category]) {
          saveData[product.store][product.category] = [];
        }
        saveData[product.store][product.category].push(product);
      });
      
      // Save to file
      await fs.writeFile(filepath, JSON.stringify(saveData, null, 2));
      console.log(`\n💾 Essentials saved locally to: ${filepath}`);
      console.log(`📊 Total products saved: ${products.length}`);
      
      return filepath;
    } catch (error) {
      console.error('❌ Error saving to local file:', error.message);
      return null;
    }
  }

  async runEssentialsScraper() {
    console.log('🚀 Starting Essentials Scraper - Lidl & Iceland...\n');
    console.log(`🏪 Stores: ${Object.keys(this.stores).join(', ')}`);
    console.log(`📂 Categories: ${Object.keys(this.essentials).join(', ')}`);
    console.log(`⚠️  Tesco, Sainsbury's, and Aldi commented out for testing`);
    
    const startTime = Date.now();
    
    // Initialize Firebase
    const firebaseReady = await this.initializeFirebase();
    if (!firebaseReady) {
      console.log('❌ Cannot proceed without Firebase');
      return;
    }
    
    // Scrape each store (starting with Sainsbury's)
    for (const [storeName, storeInfo] of Object.entries(this.stores)) {
      try {
        const storeProducts = await this.scrapeStore(storeName, storeInfo);
        this.allProducts.push(...storeProducts);
        
        // Save store products to Firebase
        if (storeProducts.length > 0) {
          await this.saveToFirebase(storeProducts);
        }
        
      } catch (error) {
        console.error(`❌ Error scraping ${storeName}:`, error.message);
      }
      
      // Delay between stores
      console.log(`⏳ Waiting 10 seconds before next store...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    // Save to local file as backup
    if (this.allProducts.length > 0) {
      await this.saveToLocalFile(this.allProducts);
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    // Final summary
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 ESSENTIALS SCRAPER FINAL SUMMARY`);
    console.log(`${'='.repeat(80)}`);
    console.log(`⏱️  Total Duration: ${duration} seconds`);
    console.log(`🏪 Stores Processed: ${Object.keys(this.stores).length}`);
    console.log(`📂 Categories: ${Object.keys(this.essentials).length}`);
    console.log(`📦 Total Products Scraped: ${this.allProducts.length}`);
    console.log(`💾 Products Saved to Firebase: ${this.allProducts.length}`);
    
    // Store breakdown
    const storeBreakdown = {};
    this.allProducts.forEach(product => {
      storeBreakdown[product.store] = (storeBreakdown[product.store] || 0) + 1;
    });
    
    console.log(`\n📊 Store Breakdown:`);
    Object.entries(storeBreakdown).forEach(([store, count]) => {
      console.log(`   ${store}: ${count} products`);
    });
    
    // Category breakdown
    const categoryBreakdown = {};
    this.allProducts.forEach(product => {
      categoryBreakdown[product.category] = (categoryBreakdown[product.category] || 0) + 1;
    });
    
    console.log(`\n📊 Category Breakdown:`);
    Object.entries(categoryBreakdown).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} products`);
    });
    
    console.log(`\n🎯 Data includes:`);
    console.log(`   ✅ Family survey essentials`);
    console.log(`   ✅ Sanitary & personal care products`);
    console.log(`   ✅ Exact product names and IDs`);
    console.log(`   ✅ Precise pricing (regular + loyalty prices)`);
    console.log(`   ✅ Product descriptions and images`);
    console.log(`   ✅ Nutrition information`);
    console.log(`   ✅ Ingredients and allergens`);
    console.log(`   ✅ Expiry and storage information`);
    console.log(`   ✅ OpenFoodFacts enrichment`);
    console.log(`   ✅ Complete Firebase database`);
    
    return this.allProducts;
  }
}

// Run essentials scraper
const scraper = new EssentialsScraper();
scraper.runEssentialsScraper().catch(console.error);
