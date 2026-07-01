#!/usr/bin/env node

/**
 * Unified Scraping Strategy
 * A comprehensive, robust scraping system that addresses all identified issues
 */

const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require('../config/firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

class UnifiedScrapingStrategy {
  constructor() {
    this.browser = null;
    this.stats = {
      totalProducts: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      productsWithPrices: 0,
      productsWithoutPrices: 0,
      storesProcessed: 0,
      errors: []
    };
    
    this.stores = {
      'Tesco': {
        baseUrl: 'https://www.tesco.com/groceries/en-GB/search',
        postcode: 'UB8 1ND',
        selectors: {
          productContainer: '[data-testid="product-tile"]',
          name: '[data-testid="product-title"]',
          price: '[data-testid="product-price"]',
          image: 'img[data-testid="product-image"]',
          availability: '[data-testid="product-availability"]'
        },
        priceExtraction: 'regex'
      },
      'Sainsburys': {
        baseUrl: 'https://www.sainsburys.co.uk/gol-ui/groceries',
        postcode: 'UB8 1QW',
        selectors: {
          productContainer: '.pt-grid-item',
          name: '.pt-title',
          price: '.pt-price',
          image: '.pt-image img',
          availability: '.pt-availability'
        },
        priceExtraction: 'text'
      },
      'Aldi': {
        baseUrl: 'https://www.aldi.co.uk/search',
        postcode: 'UB8 1LB',
        selectors: {
          productContainer: '.product-tile',
          name: '.product-title',
          price: '.product-price',
          image: '.product-image img',
          availability: '.product-availability'
        },
        priceExtraction: 'text'
      },
      'Lidl': {
        baseUrl: 'https://www.lidl.co.uk/q/search',
        postcode: 'UB8 1LA',
        selectors: {
          productContainer: '.product-item',
          name: '.product-name',
          price: '.product-price',
          image: '.product-image img',
          availability: '.product-stock'
        },
        priceExtraction: 'text'
      },
      'Iceland': {
        baseUrl: 'https://www.iceland.co.uk/search',
        postcode: 'UB8 1LH',
        selectors: {
          productContainer: '.product-tile',
          name: '.product-title',
          price: '.price',
          image: '.product-image img',
          availability: '.stock-status'
        },
        priceExtraction: 'text'
      }
    };
    
    this.searchTerms = [
      'apples', 'bananas', 'milk', 'bread', 'cheese', 'chicken', 'rice', 'pasta',
      'onions', 'potatoes', 'tomatoes', 'yogurt', 'butter', 'eggs', 'cereal',
      'oil', 'salt', 'pepper', 'sugar', 'flour', 'coffee', 'tea', 'juice'
    ];
  }

  async initialize() {
    console.log('🚀 Initializing Unified Scraping Strategy...');
    
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    console.log('✅ Browser initialized');
  }

  async scrapeAllStores() {
    console.log('🛒 Starting comprehensive scraping of all stores...');
    console.log(`📋 Search terms: ${this.searchTerms.join(', ')}`);
    console.log('');

    const allProducts = [];
    
    for (const [storeName, storeConfig] of Object.entries(this.stores)) {
      try {
        console.log(`\n🏪 Scraping ${storeName}...`);
        console.log('=' .repeat(50));
        
        const storeProducts = await this.scrapeStore(storeName, storeConfig);
        allProducts.push(...storeProducts);
        
        this.stats.storesProcessed++;
        console.log(`✅ ${storeName}: ${storeProducts.length} products found`);
        
        // Delay between stores to be respectful
        await this.delay(3000);
        
      } catch (error) {
        console.error(`❌ Error scraping ${storeName}:`, error.message);
        this.stats.errors.push(`${storeName}: ${error.message}`);
      }
    }
    
    // Process and save all products
    await this.processAndSaveProducts(allProducts);
    
    // Generate final report
    await this.generateScrapingReport();
    
    console.log('\n🎉 Scraping completed!');
    this.printStats();
  }

  async scrapeStore(storeName, storeConfig) {
    const page = await this.browser.newPage();
    const storeProducts = [];
    
    try {
      // Set up page
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Set postcode if needed
      if (storeConfig.postcode) {
        await this.setPostcode(page, storeName, storeConfig.postcode);
      }
      
      // Scrape each search term
      for (const searchTerm of this.searchTerms) {
        try {
          console.log(`  🔍 Searching for: ${searchTerm}`);
          
          const products = await this.scrapeSearchTerm(page, storeName, storeConfig, searchTerm);
          storeProducts.push(...products);
          
          console.log(`    Found ${products.length} products`);
          
          // Delay between searches
          await this.delay(2000);
          
        } catch (error) {
          console.error(`    ❌ Error searching for ${searchTerm}:`, error.message);
          this.stats.errors.push(`${storeName} - ${searchTerm}: ${error.message}`);
        }
      }
      
    } finally {
      await page.close();
    }
    
    return storeProducts;
  }

  async setPostcode(page, storeName, postcode) {
    try {
      // Navigate to store's main page
      await page.goto(this.stores[storeName].baseUrl, { waitUntil: 'networkidle2' });
      
      // Look for postcode input and set it
      const postcodeSelectors = [
        'input[placeholder*="postcode" i]',
        'input[placeholder*="post code" i]',
        'input[name*="postcode" i]',
        'input[id*="postcode" i]',
        '.postcode-input input',
        '.location-input input'
      ];
      
      for (const selector of postcodeSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.type(selector, postcode);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(2000);
          break;
        } catch (e) {
          // Try next selector
        }
      }
    } catch (error) {
      console.log(`    ⚠️ Could not set postcode for ${storeName}: ${error.message}`);
    }
  }

  async scrapeSearchTerm(page, storeName, storeConfig, searchTerm) {
    const products = [];
    
    try {
      // Navigate to search page
      const searchUrl = this.buildSearchUrl(storeName, searchTerm);
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      // Wait for products to load
      await page.waitForSelector(storeConfig.selectors.productContainer, { timeout: 10000 });
      
      // Extract products
      const productElements = await page.$$(storeConfig.selectors.productContainer);
      
      for (const element of productElements) {
        try {
          const product = await this.extractProductData(element, storeName, storeConfig, searchTerm);
          if (product && this.validateProduct(product)) {
            products.push(product);
            this.stats.successfulScrapes++;
          }
        } catch (error) {
          this.stats.failedScrapes++;
          this.stats.errors.push(`Product extraction error: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.error(`    ❌ Error scraping ${searchTerm} from ${storeName}:`, error.message);
      this.stats.errors.push(`${storeName} - ${searchTerm} scraping error: ${error.message}`);
    }
    
    return products;
  }

  buildSearchUrl(storeName, searchTerm) {
    const store = this.stores[storeName];
    
    switch (storeName) {
      case 'Tesco':
        return `${store.baseUrl}?query=${encodeURIComponent(searchTerm)}`;
      case 'Sainsburys':
        return `${store.baseUrl}/search?query=${encodeURIComponent(searchTerm)}`;
      case 'Aldi':
        return `${store.baseUrl}?q=${encodeURIComponent(searchTerm)}`;
      case 'Lidl':
        return `${store.baseUrl}?query=${encodeURIComponent(searchTerm)}`;
      case 'Iceland':
        return `${store.baseUrl}?q=${encodeURIComponent(searchTerm)}`;
      default:
        return `${store.baseUrl}?search=${encodeURIComponent(searchTerm)}`;
    }
  }

  async extractProductData(element, storeName, storeConfig, searchTerm) {
    const product = {
      name: '',
      brand: '',
      price: 0,
      originalPrice: null,
      isOnOffer: false,
      offerText: '',
      availability: 'unknown',
      imageUrl: '',
      url: '',
      storeName: storeName,
      storeBrand: storeName,
      category: '',
      subcategory: '',
      searchTerm: searchTerm,
      scrapedAt: new Date(),
      isActive: true
    };
    
    try {
      // Extract name
      const nameElement = await element.$(storeConfig.selectors.name);
      if (nameElement) {
        product.name = await nameElement.evaluate(el => el.textContent?.trim() || '');
      }
      
      // Extract price
      const priceElement = await element.$(storeConfig.selectors.price);
      if (priceElement) {
        const priceText = await priceElement.evaluate(el => el.textContent?.trim() || '');
        const priceData = this.extractPrice(priceText, storeConfig.priceExtraction);
        product.price = priceData.price;
        product.originalPrice = priceData.originalPrice;
        product.isOnOffer = priceData.isOnOffer;
        product.offerText = priceData.offerText;
      }
      
      // Extract image
      const imageElement = await element.$(storeConfig.selectors.image);
      if (imageElement) {
        product.imageUrl = await imageElement.evaluate(el => el.src || el.getAttribute('data-src') || '');
      }
      
      // Extract availability
      const availabilityElement = await element.$(storeConfig.selectors.availability);
      if (availabilityElement) {
        const availabilityText = await availabilityElement.evaluate(el => el.textContent?.trim() || '');
        product.availability = this.determineAvailability(availabilityText);
      }
      
      // Extract URL
      const linkElement = await element.$('a');
      if (linkElement) {
        product.url = await linkElement.evaluate(el => el.href || '');
      }
      
      // Extract brand from name
      product.brand = this.extractBrand(product.name);
      
      // Categorize product
      const categorization = this.categorizeProduct(product.name, searchTerm);
      product.category = categorization.category;
      product.subcategory = categorization.subcategory;
      
    } catch (error) {
      console.error(`    ❌ Error extracting product data:`, error.message);
      throw error;
    }
    
    return product;
  }

  extractPrice(priceText, extractionMethod) {
    if (!priceText || priceText.toLowerCase().includes('n/a')) {
      return { price: 0, originalPrice: null, isOnOffer: false, offerText: '' };
    }
    
    let price = 0;
    let originalPrice = null;
    let isOnOffer = false;
    let offerText = '';
    
    if (extractionMethod === 'regex') {
      // Use regex to extract price
      const priceMatch = priceText.match(/£?(\d+\.?\d*)/);
      if (priceMatch) {
        price = parseFloat(priceMatch[1]);
      }
      
      // Check for offers
      if (priceText.toLowerCase().includes('was') || priceText.includes('save')) {
        isOnOffer = true;
        offerText = priceText;
        
        // Try to extract original price
        const originalMatch = priceText.match(/was\s*£?(\d+\.?\d*)/i);
        if (originalMatch) {
          originalPrice = parseFloat(originalMatch[1]);
        }
      }
    } else {
      // Use text parsing
      const cleanText = priceText.replace(/[^\d.,£]/g, '');
      const priceMatch = cleanText.match(/(\d+\.?\d*)/);
      if (priceMatch) {
        price = parseFloat(priceMatch[1]);
      }
    }
    
    return { price, originalPrice, isOnOffer, offerText };
  }

  extractBrand(productName) {
    if (!productName) return 'Generic';
    
    const words = productName.split(' ');
    if (words.length > 1) {
      // Return first word as brand
      return words[0];
    }
    return 'Generic';
  }

  categorizeProduct(productName, searchTerm) {
    const name = (productName || '').toLowerCase();
    const term = (searchTerm || '').toLowerCase();
    
    // Enhanced categorization logic
    const categories = {
      'Fruits': ['apple', 'banana', 'orange', 'grape', 'strawberry', 'fruit', 'berry', 'citrus'],
      'Vegetables': ['carrot', 'onion', 'tomato', 'potato', 'vegetable', 'lettuce', 'cucumber', 'pepper'],
      'Dairy/Protein': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'dairy', 'chicken', 'beef', 'pork', 'fish'],
      'Staples': ['bread', 'pasta', 'rice', 'flour', 'cereal', 'grain', 'wheat'],
      'Cooking Essentials': ['oil', 'salt', 'pepper', 'spice', 'sauce', 'vinegar', 'herb'],
      'Household Essentials': ['toilet', 'tissue', 'paper', 'cleaner', 'detergent'],
      'Sanitary & Personal Care': ['soap', 'shampoo', 'conditioner', 'toothpaste', 'deodorant'],
      'Snacks': ['crisp', 'biscuit', 'chocolate', 'snack', 'sweet', 'cookie', 'candy'],
      'Beverages': ['juice', 'coffee', 'tea', 'water', 'soda', 'drink', 'beverage']
    };
    
    for (const [category, keywords] of Object.entries(categories)) {
      for (const keyword of keywords) {
        if (name.includes(keyword) || term.includes(keyword)) {
          return { category, subcategory: 'General' };
        }
      }
    }
    
    return { category: 'Uncategorized', subcategory: 'General' };
  }

  determineAvailability(availabilityText) {
    if (!availabilityText) return 'unknown';
    
    const text = availabilityText.toLowerCase();
    
    if (text.includes('in stock') || text.includes('available')) {
      return 'in_stock';
    } else if (text.includes('low stock') || text.includes('limited')) {
      return 'low_stock';
    } else if (text.includes('out of stock') || text.includes('unavailable')) {
      return 'out_of_stock';
    }
    
    return 'unknown';
  }

  validateProduct(product) {
    // Basic validation
    if (!product.name || product.name.trim().length < 2) {
      return false;
    }
    
    if (product.price <= 0) {
      this.stats.productsWithoutPrices++;
      return false; // Only include products with valid prices
    }
    
    if (!product.storeName || product.storeName === 'undefined') {
      return false;
    }
    
    this.stats.productsWithPrices++;
    return true;
  }

  async processAndSaveProducts(products) {
    console.log('\n💾 Processing and saving products...');
    
    // Group products by store
    const productsByStore = {};
    products.forEach(product => {
      if (!productsByStore[product.storeName]) {
        productsByStore[product.storeName] = [];
      }
      productsByStore[product.storeName].push(product);
    });
    
    // Save products to Firebase
    for (const [storeName, storeProducts] of Object.entries(productsByStore)) {
      try {
        console.log(`  💾 Saving ${storeProducts.length} products from ${storeName}...`);
        await this.saveProductsToFirebase(storeProducts, storeName);
        console.log(`  ✅ ${storeName} products saved successfully`);
      } catch (error) {
        console.error(`  ❌ Error saving ${storeName} products:`, error.message);
        this.stats.errors.push(`Save error for ${storeName}: ${error.message}`);
      }
    }
  }

  async saveProductsToFirebase(products, storeName) {
    const batch = db.batch();
    const productIds = [];
    
    // First, save main products
    for (const product of products) {
      const productRef = db.collection('products').doc();
      const productData = {
        name: product.name,
        brand: product.brand,
        category: product.category,
        subcategory: product.subcategory,
        imageUrl: product.imageUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      batch.set(productRef, productData);
      productIds.push({ id: productRef.id, storeProduct: product });
    }
    
    // Commit products
    await batch.commit();
    
    // Then, save store products
    const storeBatch = db.batch();
    
    for (const { id: productId, storeProduct } of productIds) {
      const storeProductRef = db.collection('store_products').doc();
      const storeProductData = {
        productId: productId,
        storeId: this.getStoreId(storeName),
        storeName: storeProduct.storeName,
        storeBrand: storeProduct.storeBrand,
        price: storeProduct.price,
        originalPrice: storeProduct.originalPrice,
        isOnOffer: storeProduct.isOnOffer,
        offerText: storeProduct.offerText,
        availability: storeProduct.availability,
        url: storeProduct.url,
        scrapedAt: storeProduct.scrapedAt,
        isActive: storeProduct.isActive
      };
      
      storeBatch.set(storeProductRef, storeProductData);
    }
    
    await storeBatch.commit();
  }

  getStoreId(storeName) {
    // Simple store ID generation - in production, you'd want to look up actual store IDs
    return storeName.toLowerCase().replace(/\s+/g, '_');
  }

  async generateScrapingReport() {
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      summary: {
        totalProducts: this.stats.totalProducts,
        successfulScrapes: this.stats.successfulScrapes,
        failedScrapes: this.stats.failedScrapes,
        productsWithPrices: this.stats.productsWithPrices,
        productsWithoutPrices: this.stats.productsWithoutPrices,
        storesProcessed: this.stats.storesProcessed,
        errorCount: this.stats.errors.length
      },
      recommendations: [
        {
          action: 'Monitor price accuracy',
          reason: 'Ensure scraped prices are current and accurate',
          priority: 'High'
        },
        {
          action: 'Implement real-time updates',
          reason: 'Keep product data fresh and current',
          priority: 'Medium'
        },
        {
          action: 'Add more search terms',
          reason: 'Expand product coverage',
          priority: 'Low'
        }
      ]
    };

    const reportPath = path.join(__dirname, '../data/scraping-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📊 Scraping report saved to: ${reportPath}`);
  }

  printStats() {
    console.log('\n📊 SCRAPING STATISTICS');
    console.log('=' .repeat(40));
    console.log(`Total products: ${this.stats.totalProducts}`);
    console.log(`Successful scrapes: ${this.stats.successfulScrapes}`);
    console.log(`Failed scrapes: ${this.stats.failedScrapes}`);
    console.log(`Products with prices: ${this.stats.productsWithPrices}`);
    console.log(`Products without prices: ${this.stats.productsWithoutPrices}`);
    console.log(`Stores processed: ${this.stats.storesProcessed}`);
    console.log(`Errors: ${this.stats.errors.length}`);
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Run the scraping strategy
async function main() {
  const scraper = new UnifiedScrapingStrategy();
  
  try {
    await scraper.initialize();
    await scraper.scrapeAllStores();
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = UnifiedScrapingStrategy;







