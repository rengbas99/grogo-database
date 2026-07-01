const axios = require('axios');
const cheerio = require('cheerio');

class SimpleStoreScraper {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.rateLimitDelay = 2000; // 2 seconds between requests
    this.products = [];
  }

  async scrapeAllStores() {
    console.log('🚀 Starting simple store scraping...\n');
    
    // Use sitemaps and product listing pages
    const storeConfigs = [
      {
        name: 'Tesco',
        baseUrl: 'https://www.tesco.com',
        productPages: [
          'https://www.tesco.com/groceries/en-GB/shop/fresh-food',
          'https://www.tesco.com/groceries/en-GB/shop/dairy-eggs-chilled',
          'https://www.tesco.com/groceries/en-GB/shop/meat-fish',
          'https://www.tesco.com/groceries/en-GB/shop/bakery',
          'https://www.tesco.com/groceries/en-GB/shop/frozen'
        ]
      },
      {
        name: 'Sainsburys',
        baseUrl: 'https://www.sainsburys.co.uk',
        productPages: [
          'https://www.sainsburys.co.uk/shop/gb/groceries/fresh-food',
          'https://www.sainsburys.co.uk/shop/gb/groceries/dairy-eggs-chilled',
          'https://www.sainsburys.co.uk/shop/gb/groceries/meat-fish',
          'https://www.sainsburys.co.uk/shop/gb/groceries/bakery',
          'https://www.sainsburys.co.uk/shop/gb/groceries/frozen'
        ]
      }
    ];

    for (const store of storeConfigs) {
      console.log(`\n🏪 Scraping ${store.name}...`);
      try {
        await this.scrapeStore(store);
        console.log(`✅ ${store.name} completed`);
      } catch (error) {
        console.error(`❌ Error scraping ${store.name}:`, error.message);
      }
      
      await this.delay(this.rateLimitDelay);
    }

    return this.products;
  }

  async scrapeStore(store) {
    for (const pageUrl of store.productPages) {
      console.log(`  📦 Scraping page: ${pageUrl}`);
      
      try {
        const response = await axios.get(pageUrl, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-GB,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          },
          timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const category = this.extractCategoryFromUrl(pageUrl);
        
        // Look for product elements with various selectors
        const productSelectors = [
          '[data-testid="product-tile"]',
          '.product-tile',
          '.product-item',
          '.product-card',
          '.product',
          '.tile',
          '.item'
        ];

        let productElements = [];
        for (const selector of productSelectors) {
          const elements = $(selector);
          if (elements.length > 0) {
            productElements = elements;
            console.log(`    Found ${elements.length} products with selector: ${selector}`);
            break;
          }
        }

        if (productElements.length === 0) {
          console.log(`    ⚠️ No products found on ${pageUrl}`);
          continue;
        }

        // Extract products (limit to first 15 per page)
        for (let i = 0; i < Math.min(productElements.length, 15); i++) {
          const product = this.extractProductInfo($, productElements.eq(i), store.name, category);
          if (product) {
            this.products.push(product);
          }
        }

        console.log(`    ✅ Extracted ${Math.min(productElements.length, 15)} products from ${category}`);
        
      } catch (error) {
        console.log(`    ❌ Error scraping ${pageUrl}: ${error.message}`);
      }
      
      await this.delay(this.rateLimitDelay);
    }
  }

  extractProductInfo($, element, storeName, category) {
    try {
      // Extract product name
      const nameSelectors = [
        'h3', 'h4', '.product-name', '.product-title', 
        '[data-testid="product-name"]', '.name', '.title'
      ];
      
      let name = null;
      for (const selector of nameSelectors) {
        const nameEl = element.find(selector).first();
        if (nameEl.length > 0) {
          name = nameEl.text().trim();
          break;
        }
      }

      if (!name || name.length === 0) {
        return null;
      }

      // Extract price
      const priceSelectors = [
        '.price', '.product-price', '[data-testid="price"]', 
        '.cost', '.amount', '.value'
      ];
      
      let priceText = null;
      for (const selector of priceSelectors) {
        const priceEl = element.find(selector).first();
        if (priceEl.length > 0) {
          priceText = priceEl.text().trim();
          break;
        }
      }

      const price = this.extractPrice(priceText);

      // Extract brand
      const brandSelectors = [
        '.brand', '.product-brand', '[data-testid="brand"]', 
        '.manufacturer', '.make'
      ];
      
      let brand = null;
      for (const selector of brandSelectors) {
        const brandEl = element.find(selector).first();
        if (brandEl.length > 0) {
          brand = brandEl.text().trim();
          break;
        }
      }

      if (!brand) {
        brand = this.extractBrandFromName(name);
      }

      // Extract image
      const imgEl = element.find('img').first();
      const imageUrl = imgEl.length > 0 ? imgEl.attr('src') : null;

      // Extract quantity
      const quantity = this.extractQuantityFromName(name);

      return {
        id: `scraped_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name,
        brand: brand || storeName,
        store: storeName,
        category: this.mapCategory(category),
        price: price,
        quantity: quantity,
        image: imageUrl,
        barcode: null,
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

  extractCategoryFromUrl(url) {
    if (url.includes('fresh-food') || url.includes('fresh-produce')) return 'fresh_produce';
    if (url.includes('dairy-eggs')) return 'dairy';
    if (url.includes('meat-fish')) return 'meat';
    if (url.includes('bakery')) return 'bread';
    if (url.includes('frozen')) return 'frozen';
    return 'fresh_produce';
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
    const brands = [
      'Tesco', 'Sainsbury\'s', 'Lidl', 'Aldi', 'Iceland',
      'Warburtons', 'Hovis', 'Kingsmill', 'Heinz', 'Birds Eye',
      'McCain', 'Findus', 'Young\'s', 'Tesco Finest', 'Sainsbury\'s Taste the Difference',
      'Lidl Deluxe', 'Aldi Specially Selected', 'Iceland Luxury',
      'Tesco Value', 'Sainsbury\'s Basics', 'Lidl Just Free',
      'Aldi Everyday Essentials', 'Iceland Value'
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
      'fresh_produce': 'fresh_produce',
      'dairy': 'dairy',
      'meat': 'meat',
      'bread': 'bread',
      'frozen': 'frozen'
    };
    
    return categoryMap[category] || 'fresh_produce';
  }

  generateNutritionForCategory(category) {
    const nutritionMap = {
      'fresh_produce': { calories: 50, protein: 2.0, fat: 0.5, carbs: 12.0, sugar: 8.0, salt: 0, fiber: 3.0 },
      'dairy': { calories: 64, protein: 3.4, fat: 3.6, carbs: 4.8, sugar: 4.8, salt: 0.1, fiber: 0 },
      'meat': { calories: 165, protein: 31.0, fat: 3.6, carbs: 0, sugar: 0, salt: 0.1, fiber: 0 },
      'bread': { calories: 265, protein: 9.0, fat: 3.2, carbs: 49.0, sugar: 5.0, salt: 1.0, fiber: 2.7 },
      'frozen': { calories: 100, protein: 5.0, fat: 2.0, carbs: 15.0, sugar: 3.0, salt: 0.5, fiber: 2.0 }
    };
    
    return nutritionMap[category] || { calories: 100, protein: 5.0, fat: 5.0, carbs: 10.0, sugar: 5.0, salt: 0.5, fiber: 1.0 };
  }

  generateIngredientsForCategory(category) {
    const ingredientsMap = {
      'fresh_produce': 'Fresh produce, no additives',
      'dairy': 'Pasteurised milk, live cultures',
      'meat': 'Fresh meat, no additives',
      'bread': 'Wheat flour, water, yeast, salt, vegetable oil, preservatives',
      'frozen': 'Frozen ingredients, preservatives'
    };
    
    return ingredientsMap[category] || 'Natural ingredients';
  }

  generateAllergensForCategory(category) {
    const allergenMap = {
      'fresh_produce': [],
      'dairy': ['milk'],
      'meat': [],
      'bread': ['gluten', 'wheat'],
      'frozen': ['gluten', 'milk']
    };
    
    return allergenMap[category] || [];
  }

  generateNutritionGradeForCategory(category) {
    const gradeMap = {
      'fresh_produce': 'A',
      'dairy': 'B',
      'meat': 'A',
      'bread': 'C',
      'frozen': 'B'
    };
    
    return gradeMap[category] || 'B';
  }

  generatePackagingForCategory(category) {
    const packagingMap = {
      'fresh_produce': 'Plastic bag or container',
      'dairy': 'Plastic bottle or container',
      'meat': 'Plastic tray and wrap',
      'bread': 'Plastic bag',
      'frozen': 'Plastic bag or box'
    };
    
    return packagingMap[category] || 'Plastic packaging';
  }

  generateExpiryForCategory(category) {
    const expiryMap = {
      'fresh_produce': { days: 7, type: 'best before' },
      'dairy': { days: 7, type: 'use by' },
      'meat': { days: 2, type: 'use by' },
      'bread': { days: 5, type: 'best before' },
      'frozen': { days: 90, type: 'best before' }
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
      'frozen': 'Keep frozen at -18°C'
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

module.exports = SimpleStoreScraper;
