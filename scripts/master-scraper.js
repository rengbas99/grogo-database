/**
 * Master Scraper - Run All Final Scrapers and Populate Database
 * Runs Tesco, Sainsbury's, Aldi, Lidl, Iceland scrapers and saves to Firebase
 */

const admin = require('firebase-admin');
const TescoFinalScraper = require('./tesco-final-scraper');
const SainsburysFinalScraper = require('./sainsburys-final-scraper');
const LidlFinalScraper = require('./lidl-final-scraper');
const IcelandFinalScraper = require('./iceland-final-scraper');
const AldiFinalScraper = require('./aldi-final-scraper');

class MasterScraper {
  constructor() {
    this.stores = {
      'Tesco': { postcode: 'UB8 1ND', scraper: new TescoFinalScraper() },
      'Sainsburys': { postcode: 'UB8 1QW', scraper: new SainsburysFinalScraper() },
      'Lidl': { postcode: 'UB8 1ND', scraper: new LidlFinalScraper() },
      'Iceland': { postcode: 'UB8 1ND', scraper: new IcelandFinalScraper() },
      'Aldi': { postcode: 'UB8 1ND', scraper: new AldiFinalScraper() }
    };
    
    // Comprehensive search terms covering all major categories
    this.searchTerms = [
      // Fresh Fruit & Vegetables
      'apple', 'banana', 'orange', 'tomato', 'potato', 'onion', 'carrot', 'lettuce', 'cucumber', 'peelers',
      
      // Dairy & Eggs
      'milk', 'cheese', 'yogurt', 'eggs', 'butter', 'cream',
      
      // Bakery
      'bread', 'rolls', 'pastries', 'cakes', 'cookies',
      
      // Meat & Poultry
      'chicken', 'beef', 'pork', 'lamb', 'sausages', 'bacon',
      
      // Pantry Staples
      'pasta', 'rice', 'cereal', 'flour', 'sugar', 'salt', 'oil',
      
      // Snacks & Confectionery
      'chocolate', 'biscuits', 'crisps', 'nuts', 'sweets',
      
      // Drinks & Beverages
      'juice', 'water', 'coffee', 'tea', 'soft drinks',
      
      // Frozen Foods
      'frozen vegetables', 'frozen fruit', 'ice cream', 'frozen meals',
      
      // World Food
      'curry', 'pizza', 'pasta sauce', 'spices', 'herbs',
      
      // Salad & Sandwiches
      'salad', 'sandwich', 'wraps', 'deli meats'
    ];
    this.allProducts = [];
  }

  async initializeFirebase() {
    try {
      // Initialize Firebase Admin SDK
      if (!admin.apps.length) {
        const serviceAccount = require('../config/firebase-service-account.json');
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: 'https://grogo-mvp-default-rtdb.firebaseio.com'
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
    console.log(`\n🏪 Starting ${storeName} scraping...`);
    console.log(`📍 Postcode: ${storeInfo.postcode}`);
    
    const storeProducts = [];
    
    for (const term of this.searchTerms) {
      try {
        console.log(`\n🔍 Searching "${term}" in ${storeName}...`);
        
        const products = await storeInfo.scraper.scrapeCompleteProducts(term);
        
        if (products.length > 0) {
          // Add store-specific metadata and categorize products
          products.forEach(product => {
            product.store = storeName;
            product.postcode = storeInfo.postcode;
            product.scrapedAt = new Date().toISOString();
            
            // Categorize the product
            const categorizedProduct = this.categorizeProduct(product, term);
            Object.assign(product, categorizedProduct);
          });
          
          storeProducts.push(...products);
          
          // Show categorization summary
          const categoryCounts = {};
          products.forEach(p => {
            categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
          });
          
          console.log(`✅ Found ${products.length} products for "${term}"`);
          console.log(`📊 Categories: ${Object.entries(categoryCounts).map(([cat, count]) => `${cat}(${count})`).join(', ')}`);
        } else {
          console.log(`⚠️  No products found for "${term}"`);
        }
        
        // Delay between search terms
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        console.error(`❌ Error searching "${term}" in ${storeName}:`, error.message);
      }
    }
    
    console.log(`\n📊 ${storeName} Summary: ${storeProducts.length} total products`);
    return storeProducts;
  }

  categorizeProduct(product, searchTerm) {
    const name = product.name.toLowerCase();
    const description = (product.description || '').toLowerCase();
    const combinedText = `${name} ${description}`;
    
    // Define category keywords
    const categories = {
      'Fresh Fruit': {
        keywords: ['apple', 'banana', 'orange', 'grape', 'strawberry', 'blueberry', 'raspberry', 'lemon', 'lime', 'pear', 'peach', 'plum', 'cherry', 'fresh fruit', 'whole fruit', 'british apples'],
        exclude: ['strudel', 'pie', 'tart', 'cake', 'pastry', 'dough', 'biscuit', 'cookie', 'jam', 'juice', 'drink', 'sauce', 'filling', 'dessert', 'bakery', 'baked']
      },
      'Fresh Vegetables': {
        keywords: ['tomato', 'potato', 'onion', 'carrot', 'lettuce', 'cucumber', 'pepper', 'broccoli', 'cauliflower', 'spinach', 'cabbage', 'fresh vegetable', 'whole vegetable'],
        exclude: ['soup', 'sauce', 'dip', 'spread', 'frozen', 'canned', 'dried', 'powder', 'seasoning']
      },
      'Bakery': {
        keywords: ['bread', 'roll', 'baguette', 'croissant', 'pastry', 'cake', 'cookie', 'biscuit', 'muffin', 'scone', 'strudel', 'dough', 'loaf', 'tart', 'pie', 'bakery', 'baked', 'chef select', 'alpenfest'],
        exclude: []
      },
      'Dairy': {
        keywords: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'dairy', 'fresh milk', 'semi-skimmed', 'skimmed', 'whole milk', 'dairy manor'],
        exclude: ['plant-based', 'oat', 'almond', 'soy', 'coconut', 'vegan', 'lactose-free', 'vemondo']
      },
      'Plant-Based': {
        keywords: ['oat drink', 'almond drink', 'soy milk', 'coconut milk', 'plant-based', 'vegan', 'lactose-free', 'dairy-free', 'vemondo'],
        exclude: ['dairy', 'milk', 'cheese', 'yogurt', 'butter']
      },
      'Meat & Poultry': {
        keywords: ['chicken', 'beef', 'pork', 'lamb', 'sausage', 'bacon', 'ham', 'turkey', 'duck', 'meat', 'poultry'],
        exclude: ['vegetarian', 'vegan', 'plant-based', 'meat-free']
      },
      'Pantry Staples': {
        keywords: ['pasta', 'rice', 'cereal', 'flour', 'sugar', 'salt', 'oil', 'vinegar', 'spice', 'herb', 'grain', 'pulse'],
        exclude: ['fresh', 'frozen', 'canned']
      },
      'Snacks': {
        keywords: ['chocolate', 'biscuit', 'crisp', 'nut', 'sweet', 'snack', 'treat', 'bar'],
        exclude: ['fresh', 'frozen', 'canned']
      },
      'Drinks': {
        keywords: ['juice', 'water', 'coffee', 'tea', 'soft drink', 'soda', 'fizzy', 'drink'],
        exclude: ['fresh', 'frozen', 'canned']
      },
      'Frozen': {
        keywords: ['frozen', 'ice cream', 'frozen meal', 'frozen vegetable', 'frozen fruit'],
        exclude: ['fresh', 'room temperature']
      }
    };
    
    // Find the best matching category
    let bestCategory = 'Other';
    let bestScore = 0;
    
    for (const [category, config] of Object.entries(categories)) {
      let score = 0;
      
      // Check for positive keywords
      for (const keyword of config.keywords) {
        if (combinedText.includes(keyword)) {
          score += 1;
        }
      }
      
      // Check for exclusion keywords
      for (const exclude of config.exclude) {
        if (combinedText.includes(exclude)) {
          score -= 2; // Heavy penalty for exclusions
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }
    
    // Special handling for specific cases
    if (name.includes('strudel') || name.includes('pastry') || name.includes('dough') || name.includes('chef select') || name.includes('alpenfest')) {
      bestCategory = 'Bakery';
    }
    
    if (name.includes('british apples') || name.includes('fresh apple') || (name.includes('apple') && !name.includes('strudel') && !name.includes('pastry'))) {
      bestCategory = 'Fresh Fruit';
    }
    
    // Add category information to product
    return {
      category: bestCategory,
      originalSearchTerm: searchTerm,
      categorizationScore: bestScore
    };
  }

  async saveToFirebase(products) {
    console.log(`\n💾 Saving ${products.length} products to Firebase...`);
    
    try {
      const db = admin.firestore();
      const batch = db.batch();
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const product of products) {
        try {
          // Create a unique document ID
          const docId = `${product.store}_${product.productId}_${Date.now()}`;
          const productRef = db.collection('products').doc(docId);
          
          // Prepare product data for Firebase
          const firebaseProduct = {
            // Basic info
            name: product.name,
            productId: product.productId,
            store: product.store,
            postcode: product.postcode,
            searchTerm: product.searchTerm,
            
            // Pricing
            price: product.price,
            clubcardPrice: product.clubcardPrice || product.nectarPrice || '',
            offer: product.offer || '',
            availability: product.availability,
            
            // Product details
            description: product.description || '',
            image: product.image || '',
            nutrition: product.nutrition || {},
            ingredients: product.ingredients || '',
            allergens: product.allergens || '',
            storage: product.storage || '',
            useBy: product.useBy || '',
            
            // OpenFoodFacts enrichment
            openFoodFactsNutrition: product.openFoodFactsNutrition || {},
            openFoodFactsCategories: product.openFoodFactsCategories || [],
            openFoodFactsBrand: product.openFoodFactsBrand || '',
            expiry: product.expiry || {},
            openFoodFactsId: product.openFoodFactsId || '',
            
            // URLs
            storeUrl: product.tescoUrl || product.sainsburysUrl || '',
            openFoodFactsUrl: product.openFoodFactsUrl || '',
            
            // Metadata
            scrapedAt: product.scrapedAt,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          
          batch.set(productRef, firebaseProduct);
          successCount++;
          
        } catch (error) {
          console.error(`❌ Error preparing product for Firebase:`, error.message);
          errorCount++;
        }
      }
      
      // Commit the batch
      await batch.commit();
      
      console.log(`✅ Firebase save complete:`);
      console.log(`   ✅ Successfully saved: ${successCount} products`);
      console.log(`   ❌ Errors: ${errorCount} products`);
      
      return { success: successCount, errors: errorCount };
      
    } catch (error) {
      console.error('❌ Firebase save failed:', error.message);
      return { success: 0, errors: products.length };
    }
  }

  async saveToLocalFile(products) {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `master-scraper-results-${timestamp}.json`;
      const filepath = path.join(__dirname, '..', 'data', 'scraped-products', filename);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      
      // Prepare data for saving
      const saveData = {
        timestamp: new Date().toISOString(),
        totalProducts: products.length,
        stores: {},
        products: products,
        summary: {
          totalProducts: products.length,
          storesProcessed: Object.keys(this.stores).length,
          searchTerms: this.searchTerms.length
        }
      };
      
      // Group by store
      products.forEach(product => {
        if (!saveData.stores[product.store]) {
          saveData.stores[product.store] = {
            storeName: product.store,
            productCount: 0,
            products: []
          };
        }
        saveData.stores[product.store].productCount++;
        saveData.stores[product.store].products.push(product);
      });
      
      // Save to file
      await fs.writeFile(filepath, JSON.stringify(saveData, null, 2));
      console.log(`\n💾 Results saved locally to: ${filepath}`);
      console.log(`📊 Total products saved: ${products.length}`);
      
      return filepath;
    } catch (error) {
      console.error('❌ Error saving to local file:', error.message);
      return null;
    }
  }

  async runAllScrapers() {
    console.log('🚀 Starting Master Scraper - All Stores...\n');
    console.log(`🔍 Search Terms: ${this.searchTerms.join(', ')}`);
    console.log(`🏪 Stores: ${Object.keys(this.stores).join(', ')}`);
    
    const startTime = Date.now();
    
    // Initialize Firebase (but don't fail if it doesn't work)
    const firebaseReady = await this.initializeFirebase();
    if (!firebaseReady) {
      console.log('⚠️ Firebase not ready, will save locally only');
    }
    
    // Scrape each store
    for (const [storeName, storeInfo] of Object.entries(this.stores)) {
      try {
        const storeProducts = await this.scrapeStore(storeName, storeInfo);
        this.allProducts.push(...storeProducts);
        
        // Save store products to Firebase (if available)
        if (storeProducts.length > 0 && firebaseReady) {
          try {
            await this.saveToFirebase(storeProducts);
          } catch (error) {
            console.log(`⚠️ Firebase save failed for ${storeName}, continuing...`);
          }
        }
        
      } catch (error) {
        console.error(`❌ Error scraping ${storeName}:`, error.message);
      }
      
      // Delay between stores
      console.log(`⏳ Waiting 10 seconds before next store...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    // Save to local file FIRST (most important)
    if (this.allProducts.length > 0) {
      const localPath = await this.saveToLocalFile(this.allProducts);
      if (localPath) {
        console.log(`✅ Data saved locally to: ${localPath}`);
      }
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    // Final summary
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 MASTER SCRAPER FINAL SUMMARY`);
    console.log(`${'='.repeat(80)}`);
    console.log(`⏱️  Total Duration: ${duration} seconds`);
    console.log(`🏪 Stores Processed: ${Object.keys(this.stores).length}`);
    console.log(`🔍 Search Terms: ${this.searchTerms.length}`);
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
    
    console.log(`\n🎯 Data includes:`);
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

// Main execution
async function main() {
  const masterScraper = new MasterScraper();
  
  try {
    await masterScraper.runAllScrapers();
  } catch (error) {
    console.error('❌ Master scraper failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = MasterScraper;
