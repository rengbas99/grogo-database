const axios = require('axios');
const cheerio = require('cheerio');
const { chromium } = require('playwright');

class WestLondonStoreScraper {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.rateLimitDelay = 3000; // 3 seconds between requests
    this.products = [];
  }

  async scrapeAllStores() {
    console.log('🚀 Starting West London store scraping...\n');
    
    const stores = [
      {
        name: 'Tesco',
        baseUrl: 'https://www.tesco.com',
        searchUrl: 'https://www.tesco.com/groceries/en-GB/search',
        categories: [
          'fresh-produce',
          'dairy-eggs-chilled',
          'meat-fish',
          'bakery',
          'frozen',
          'household',
          'snacks-confectionery'
        ]
      },
      {
        name: 'Sainsburys',
        baseUrl: 'https://www.sainsburys.co.uk',
        searchUrl: 'https://www.sainsburys.co.uk/shop/gb/groceries',
        categories: [
          'fresh-food',
          'dairy-eggs-chilled',
          'meat-fish',
          'bakery',
          'frozen',
          'household',
          'snacks-confectionery'
        ]
      },
      {
        name: 'Lidl',
        baseUrl: 'https://www.lidl.co.uk',
        searchUrl: 'https://www.lidl.co.uk/c/groceries',
        categories: [
          'fresh-produce',
          'dairy-eggs',
          'meat-fish',
          'bakery',
          'frozen',
          'household'
        ]
      },
      {
        name: 'Iceland',
        baseUrl: 'https://www.iceland.co.uk',
        searchUrl: 'https://www.iceland.co.uk/c/food-cupboard',
        categories: [
          'frozen-food',
          'fresh-food',
          'household',
          'health-beauty'
        ]
      },
      {
        name: 'Aldi',
        baseUrl: 'https://www.aldi.co.uk',
        searchUrl: 'https://www.aldi.co.uk/c/groceries',
        categories: [
          'fresh-produce',
          'dairy-eggs',
          'meat-fish',
          'bakery',
          'frozen',
          'household'
        ]
      }
    ];

    for (const store of stores) {
      console.log(`\n🏪 Scraping ${store.name}...`);
      try {
        await this.scrapeStore(store);
        console.log(`✅ ${store.name} completed`);
      } catch (error) {
        console.error(`❌ Error scraping ${store.name}:`, error.message);
      }
      
      // Rate limiting
      await this.delay(this.rateLimitDelay);
    }

    return this.products;
  }

  async scrapeStore(store) {
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const context = await browser.newContext({
        userAgent: this.userAgent,
        viewport: { width: 1920, height: 1080 }
      });
      
      const page = await context.newPage();
      
      // Set extra headers
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });

      for (const category of store.categories) {
        console.log(`  📦 Scraping category: ${category}`);
        
        try {
          const categoryProducts = await this.scrapeCategory(page, store, category);
          this.products.push(...categoryProducts);
          console.log(`    ✅ Found ${categoryProducts.length} products in ${category}`);
        } catch (error) {
          console.log(`    ❌ Error scraping ${category}: ${error.message}`);
        }
        
        // Rate limiting between categories
        await this.delay(2000);
      }
      
    } finally {
      await browser.close();
    }
  }

  async scrapeCategory(page, store, category) {
    const products = [];
    
    try {
      // Navigate to category page
      const categoryUrl = `${store.searchUrl}/${category}`;
      await page.goto(categoryUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Wait for products to load
      await page.waitForSelector('[data-testid="product-tile"], .product-tile, .product-item, .product-card', { timeout: 10000 });
      
      // Extract product information
      const productElements = await page.$$('[data-testid="product-tile"], .product-tile, .product-item, .product-card');
      
      for (let i = 0; i < Math.min(productElements.length, 20); i++) { // Limit to 20 products per category
        try {
          const product = await this.extractProductInfo(page, productElements[i], store.name, category);
          if (product) {
            products.push(product);
          }
        } catch (error) {
          console.log(`    ⚠️ Error extracting product ${i}: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.log(`    ⚠️ Category ${category} not found or blocked: ${error.message}`);
    }
    
    return products;
  }

  async extractProductInfo(page, element, storeName, category) {
    try {
      // Extract product name
      const nameElement = await element.$('h3, h4, .product-name, .product-title, [data-testid="product-name"]');
      const name = nameElement ? await nameElement.textContent() : null;
      
      if (!name || name.trim().length === 0) {
        return null;
      }

      // Extract price
      const priceElement = await element.$('.price, .product-price, [data-testid="price"], .cost');
      const priceText = priceElement ? await priceElement.textContent() : null;
      const price = this.extractPrice(priceText);

      // Extract brand
      const brandElement = await element.$('.brand, .product-brand, [data-testid="brand"]');
      const brand = brandElement ? await brandElement.textContent() : this.extractBrandFromName(name);

      // Extract image
      const imageElement = await element.$('img');
      const imageUrl = imageElement ? await imageElement.getAttribute('src') : null;

      // Extract barcode (if available)
      const barcodeElement = await element.$('[data-testid="barcode"], .barcode');
      const barcode = barcodeElement ? await barcodeElement.textContent() : null;

      // Extract quantity
      const quantityElement = await element.$('.quantity, .size, .weight');
      const quantity = quantityElement ? await quantityElement.textContent() : this.extractQuantityFromName(name);

      return {
        id: `scraped_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
        brand: brand ? brand.trim() : storeName,
        store: storeName,
        category: this.mapCategory(category),
        price: price,
        quantity: quantity,
        image: imageUrl,
        barcode: barcode,
        nutrition: this.generateNutritionForCategory(this.mapCategory(category)),
        ingredients: this.generateIngredientsForCategory(this.mapCategory(category)),
        allergens: this.generateAllergensForCategory(this.mapCategory(category)),
        nutritionGrade: this.generateNutritionGradeForCategory(this.mapCategory(category)),
        packaging: this.generatePackagingForCategory(this.mapCategory(category)),
        expiry: this.generateExpiryForCategory(this.mapCategory(category)),
        storage: this.generateStorageForCategory(this.mapCategory(category)),
        availability: 'in_stock',
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      console.log(`    ⚠️ Error extracting product info: ${error.message}`);
      return null;
    }
  }

  extractPrice(priceText) {
    if (!priceText) return { current: 0, original: 0, currency: 'GBP', unit: 'each' };
    
    const priceMatch = priceText.match(/£?(\d+\.?\d*)/);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      return {
        current: price,
        original: price * 1.1,
        currency: 'GBP',
        unit: 'each'
      };
    }
    
    return { current: 0, original: 0, currency: 'GBP', unit: 'each' };
  }

  extractBrandFromName(name) {
    // Common UK brands to look for
    const brands = [
      'Tesco', 'Sainsbury\'s', 'Lidl', 'Aldi', 'Iceland',
      'Warburtons', 'Hovis', 'Kingsmill', 'Heinz', 'Birds Eye',
      'McCain', 'Findus', 'Young\'s', 'Tesco Finest', 'Sainsbury\'s Taste the Difference',
      'Lidl Deluxe', 'Aldi Specially Selected', 'Iceland Luxury'
    ];
    
    for (const brand of brands) {
      if (name.toLowerCase().includes(brand.toLowerCase())) {
        return brand;
      }
    }
    
    return null;
  }

  extractQuantityFromName(name) {
    const quantityMatch = name.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pints?|pack|packet|each)/i);
    if (quantityMatch) {
      return `${quantityMatch[1]} ${quantityMatch[2]}`;
    }
    return '1 each';
  }

  mapCategory(category) {
    const categoryMap = {
      'fresh-produce': 'fresh_produce',
      'fresh-food': 'fresh_produce',
      'dairy-eggs-chilled': 'dairy',
      'dairy-eggs': 'dairy',
      'meat-fish': 'meat',
      'bakery': 'bread',
      'frozen': 'frozen',
      'frozen-food': 'frozen',
      'household': 'household',
      'snacks-confectionery': 'snacks',
      'health-beauty': 'household'
    };
    
    return categoryMap[category] || 'fresh_produce';
  }

  generateNutritionForCategory(category) {
    const nutritionMap = {
      'fresh_produce': { calories: 50, protein: 2.0, fat: 0.5, carbs: 12.0, sugar: 8.0, salt: 0, fiber: 3.0 },
      'dairy': { calories: 64, protein: 3.4, fat: 3.6, carbs: 4.8, sugar: 4.8, salt: 0.1, fiber: 0 },
      'meat': { calories: 165, protein: 31.0, fat: 3.6, carbs: 0, sugar: 0, salt: 0.1, fiber: 0 },
      'bread': { calories: 265, protein: 9.0, fat: 3.2, carbs: 49.0, sugar: 5.0, salt: 1.0, fiber: 2.7 },
      'frozen': { calories: 100, protein: 5.0, fat: 2.0, carbs: 15.0, sugar: 3.0, salt: 0.5, fiber: 2.0 },
      'household': { calories: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, salt: 0, fiber: 0 },
      'snacks': { calories: 500, protein: 5.0, fat: 25.0, carbs: 60.0, sugar: 30.0, salt: 1.0, fiber: 3.0 }
    };
    
    return nutritionMap[category] || { calories: 100, protein: 5.0, fat: 5.0, carbs: 10.0, sugar: 5.0, salt: 0.5, fiber: 1.0 };
  }

  generateIngredientsForCategory(category) {
    const ingredientsMap = {
      'fresh_produce': 'Fresh produce, no additives',
      'dairy': 'Pasteurised milk, live cultures',
      'meat': 'Fresh meat, no additives',
      'bread': 'Wheat flour, water, yeast, salt, vegetable oil, preservatives',
      'frozen': 'Frozen ingredients, preservatives',
      'household': 'Non-food item',
      'snacks': 'Potatoes, vegetable oil, salt, flavourings'
    };
    
    return ingredientsMap[category] || 'Natural ingredients';
  }

  generateAllergensForCategory(category) {
    const allergenMap = {
      'fresh_produce': [],
      'dairy': ['milk'],
      'meat': [],
      'bread': ['gluten', 'wheat'],
      'frozen': ['gluten', 'milk'],
      'household': [],
      'snacks': []
    };
    
    return allergenMap[category] || [];
  }

  generateNutritionGradeForCategory(category) {
    const gradeMap = {
      'fresh_produce': 'A',
      'dairy': 'B',
      'meat': 'A',
      'bread': 'C',
      'frozen': 'B',
      'household': 'N/A',
      'snacks': 'D'
    };
    
    return gradeMap[category] || 'B';
  }

  generatePackagingForCategory(category) {
    const packagingMap = {
      'fresh_produce': 'Plastic bag or container',
      'dairy': 'Plastic bottle or container',
      'meat': 'Plastic tray and wrap',
      'bread': 'Plastic bag',
      'frozen': 'Plastic bag or box',
      'household': 'Various packaging',
      'snacks': 'Plastic bag or box'
    };
    
    return packagingMap[category] || 'Plastic packaging';
  }

  generateExpiryForCategory(category) {
    const expiryMap = {
      'fresh_produce': { days: 7, type: 'best before' },
      'dairy': { days: 7, type: 'use by' },
      'meat': { days: 2, type: 'use by' },
      'bread': { days: 5, type: 'best before' },
      'frozen': { days: 90, type: 'best before' },
      'household': { days: 365, type: 'best before' },
      'snacks': { days: 90, type: 'best before' }
    };
    
    const info = expiryMap[category] || { days: 7, type: 'best before' };
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + info.days);
    
    return {
      type: info.type,
      days: info.days,
      date: expiryDate.toISOString().split('T')[0],
      description: `${info.days} days from purchase`
    };
  }

  generateStorageForCategory(category) {
    const storageMap = {
      'fresh_produce': 'Store in cool, dry place or refrigerate',
      'dairy': 'Refrigerate at 2-4°C',
      'meat': 'Refrigerate at 2-4°C, use within 2 days',
      'bread': 'Store in cool, dry place',
      'frozen': 'Keep frozen at -18°C',
      'household': 'Store in cool, dry place',
      'snacks': 'Store in cool, dry place'
    };
    
    return storageMap[category] || 'Store in cool, dry place';
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async saveProductsToFirebase(products) {
    try {
      const firebaseService = require('./FirebaseService');
      
      console.log(`💾 Saving ${products.length} scraped products to Firebase...`);
      
      for (const product of products) {
        await firebaseService.saveProduct(product);
      }
      
      console.log(`✅ Successfully saved ${products.length} scraped products to Firebase`);
      return true;
    } catch (error) {
      console.error('❌ Error saving scraped products to Firebase:', error);
      return false;
    }
  }
}

module.exports = WestLondonStoreScraper;
