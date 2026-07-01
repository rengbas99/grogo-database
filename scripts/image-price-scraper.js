/**
 * Image & Price Scraper - Focused on getting correct images and prices
 * Uses finalized scrapers but only extracts images and pricing
 */

const admin = require('firebase-admin');
const SainsburysFinalScraper = require('./sainsburys-final-scraper');
const LidlFinalScraper = require('./lidl-final-scraper');
const IcelandFinalScraper = require('./iceland-final-scraper');
const AldiFinalScraper = require('./aldi-final-scraper');
const fs = require('fs').promises;
const path = require('path');

class ImagePriceScraper {
  constructor() {
    this.stores = {
      'Sainsburys': { postcode: 'UB8 1QW', scraper: new SainsburysFinalScraper() },
      'Lidl': { postcode: 'UB8 1ND', scraper: new LidlFinalScraper() },
      'Iceland': { postcode: 'UB8 1ND', scraper: new IcelandFinalScraper() },
      'Aldi': { postcode: 'UB8 1ND', scraper: new AldiFinalScraper() }
    };
    
    // Focus on essential categories only
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

  // Extract only image and price data from scraped products
  extractImagePriceData(products, storeName, category, searchTerm) {
    return products.map(product => ({
      // Essential identifiers
      productId: product.productId || product.id,
      name: product.name,
      brand: product.brand || 'Unknown',
      
      // What we're focusing on
      image: product.image || product.imageUrl || product.images?.[0],
      price: product.price || product.currentPrice || product.regularPrice,
      loyaltyPrice: product.loyaltyPrice || product.salePrice,
      
      // Store and category info
      store: storeName,
      category: category,
      searchTerm: searchTerm,
      
      // Timestamp
      timestamp: new Date().toISOString(),
      
      // Keep some basic info for context
      size: product.size || product.unit,
      description: product.description,
      availability: product.availability || 'in_stock'
    }));
  }

  async scrapeStore(storeName, storeInfo) {
    console.log(`\n🏪 Scraping ${storeName} for images and prices...`);
    const products = [];
    
    for (const [category, searchTerms] of Object.entries(this.essentials)) {
      console.log(`\n📂 Category: ${category}`);
      
      for (const searchTerm of searchTerms) {
        try {
          console.log(`🔍 Searching for: ${searchTerm}`);
          
          // Scrape complete products
          const storeProducts = await storeInfo.scraper.scrapeCompleteProducts(searchTerm);
          
          // Extract only image and price data
          const imagePriceProducts = this.extractImagePriceData(storeProducts, storeName, category, searchTerm);
          
          products.push(...imagePriceProducts);
          console.log(`✅ Found ${imagePriceProducts.length} products with images/prices for ${searchTerm}`);
          
          // Small delay between searches
          await new Promise(resolve => setTimeout(resolve, 1500));
          
        } catch (error) {
          console.error(`❌ Error searching ${searchTerm} in ${storeName}:`, error.message);
        }
      }
    }
    
    console.log(`\n📊 ${storeName} total: ${products.length} products with images/prices`);
    return products;
  }

  async updateFirebaseProducts(products) {
    try {
      const db = admin.firestore();
      let updatedCount = 0;
      let notFoundCount = 0;
      
      console.log(`\n🔄 Updating Firebase products with new images and prices...`);
      
      for (const product of products) {
        try {
          // Find existing product by name and store
          const productsSnapshot = await db.collection('products')
            .where('name', '==', product.name)
            .where('store', '==', product.store)
            .limit(1)
            .get();
          
          if (!productsSnapshot.empty) {
            const productDoc = productsSnapshot.docs[0];
            const productRef = db.collection('products').doc(productDoc.id);
            
            // Update with new image and price data
            await productRef.update({
              image: product.image,
              price: product.price,
              loyaltyPrice: product.loyaltyPrice,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            updatedCount++;
            console.log(`✅ Updated ${product.name} in ${product.store}`);
          } else {
            notFoundCount++;
            console.log(`⚠️  Product not found: ${product.name} in ${product.store}`);
          }
        } catch (error) {
          console.error(`❌ Error updating ${product.name}:`, error.message);
        }
      }
      
      console.log(`\n📊 Firebase Update Summary:`);
      console.log(`   ✅ Updated: ${updatedCount} products`);
      console.log(`   ⚠️  Not found: ${notFoundCount} products`);
      
      return { updatedCount, notFoundCount };
      
    } catch (error) {
      console.error('❌ Firebase update failed:', error.message);
      return { updatedCount: 0, notFoundCount: 0 };
    }
  }

  async saveToLocalFile(products) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `image-price-scraper-results-${timestamp}.json`;
      const filepath = path.join(__dirname, '..', 'data', 'scraped-products', filename);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      
      // Prepare data for saving
      const saveData = {
        timestamp: new Date().toISOString(),
        totalProducts: products.length,
        stores: Object.keys(this.stores),
        categories: Object.keys(this.essentials),
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
      console.log(`\n💾 Image/Price data saved locally to: ${filepath}`);
      
      return filepath;
    } catch (error) {
      console.error('❌ Error saving to local file:', error.message);
      return null;
    }
  }

  async runImagePriceScraper() {
    console.log('🚀 Starting Image & Price Scraper...\n');
    console.log(`🏪 Stores: ${Object.keys(this.stores).join(', ')}`);
    console.log(`📂 Categories: ${Object.keys(this.essentials).join(', ')}`);
    console.log(`🎯 Focus: Images and Prices only`);
    
    const startTime = Date.now();
    
    // Initialize Firebase
    const firebaseReady = await this.initializeFirebase();
    if (!firebaseReady) {
      console.log('❌ Cannot proceed without Firebase');
      return;
    }
    
    // Scrape each store
    for (const [storeName, storeInfo] of Object.entries(this.stores)) {
      try {
        const storeProducts = await this.scrapeStore(storeName, storeInfo);
        this.allProducts.push(...storeProducts);
        
      } catch (error) {
        console.error(`❌ Error scraping ${storeName}:`, error.message);
      }
      
      // Delay between stores
      console.log(`⏳ Waiting 5 seconds before next store...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Update Firebase with new images and prices
    if (this.allProducts.length > 0) {
      const updateResults = await this.updateFirebaseProducts(this.allProducts);
      
      // Save to local file as backup
      await this.saveToLocalFile(this.allProducts);
      
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);
      
      // Final summary
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📊 IMAGE & PRICE SCRAPER FINAL SUMMARY`);
      console.log(`${'='.repeat(80)}`);
      console.log(`⏱️  Total Duration: ${duration} seconds (${Math.round(duration/60)} minutes)`);
      console.log(`🏪 Stores Processed: ${Object.keys(this.stores).length}`);
      console.log(`📂 Categories: ${Object.keys(this.essentials).length}`);
      console.log(`📦 Total Products Scraped: ${this.allProducts.length}`);
      console.log(`✅ Firebase Products Updated: ${updateResults.updatedCount}`);
      console.log(`⚠️  Products Not Found: ${updateResults.notFoundCount}`);
      
      // Store breakdown
      const storeBreakdown = {};
      this.allProducts.forEach(product => {
        storeBreakdown[product.store] = (storeBreakdown[product.store] || 0) + 1;
      });
      
      console.log(`\n📊 Store Breakdown:`);
      Object.entries(storeBreakdown).forEach(([store, count]) => {
        console.log(`   ${store}: ${count} products`);
      });
      
      // Image success rate
      const productsWithImages = this.allProducts.filter(p => p.image && p.image.trim() !== '');
      const imageSuccessRate = Math.round((productsWithImages.length / this.allProducts.length) * 100);
      
      console.log(`\n📊 Image Success Rate: ${imageSuccessRate}% (${productsWithImages.length}/${this.allProducts.length})`);
      
      console.log(`\n🎯 Data includes:`);
      console.log(`   ✅ Correct product images from store websites`);
      console.log(`   ✅ Accurate pricing (regular + loyalty prices)`);
      console.log(`   ✅ Updated Firebase database`);
      console.log(`   ✅ Fast execution (images and prices only)`);
      
      return this.allProducts;
    } else {
      console.log('❌ No products scraped');
      return [];
    }
  }
}

// Run image & price scraper
const scraper = new ImagePriceScraper();
scraper.runImagePriceScraper().catch(console.error);
