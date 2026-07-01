const axios = require('axios');
const cheerio = require('cheerio');

class GoogleProductSearchService {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.rateLimitDelay = 2000; // 2 seconds between requests
    this.products = [];
  }

  async searchAllStores() {
    console.log('🚀 Starting Google-based product search...\n');
    
    const searchQueries = [
      // Tesco products
      'site:tesco.com "fresh produce" "milk" "bread" "cheese" "chicken" "eggs"',
      'site:tesco.com "Tesco Finest" "Tesco Value" "Tesco Organic"',
      'site:tesco.com "ready meals" "frozen food" "household" "snacks"',
      
      // Sainsbury's products
      'site:sainsburys.co.uk "fresh food" "dairy" "meat" "bakery"',
      'site:sainsburys.co.uk "Taste the Difference" "Sainsbury\'s Basics"',
      'site:sainsburys.co.uk "frozen" "household" "snacks"',
      
      // Lidl products
      'site:lidl.co.uk "fresh produce" "dairy" "meat" "bakery"',
      'site:lidl.co.uk "Lidl Deluxe" "Just Free" "bakery"',
      
      // Aldi products
      'site:aldi.co.uk "fresh produce" "dairy" "meat" "bakery"',
      'site:aldi.co.uk "Specially Selected" "Everyday Essentials"',
      
      // Iceland products
      'site:iceland.co.uk "frozen food" "fresh food" "household"',
      
      // General UK grocery brands
      'site:tesco.com OR site:sainsburys.co.uk "Warburtons" "Hovis" "Kingsmill"',
      'site:tesco.com OR site:sainsburys.co.uk "Heinz" "Birds Eye" "McCain"',
      'site:tesco.com OR site:sainsburys.co.uk "Young\'s" "Findus" "Cathedral City"'
    ];

    for (const query of searchQueries) {
      console.log(`\n🔍 Searching: ${query}`);
      try {
        const searchResults = await this.searchGoogle(query);
        const products = await this.extractProductsFromSearch(searchResults);
        this.products.push(...products);
        console.log(`  ✅ Found ${products.length} products`);
      } catch (error) {
        console.log(`  ❌ Error searching: ${error.message}`);
      }
      
      await this.delay(this.rateLimitDelay);
    }

    // Remove duplicates
    this.products = this.removeDuplicates(this.products);
    
    return this.products;
  }

  async searchGoogle(query) {
    try {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20`;
      
      const response = await axios.get(searchUrl, {
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

      return response.data;
    } catch (error) {
      console.log(`    ⚠️ Google search failed: ${error.message}`);
      return null;
    }
  }

  async extractProductsFromSearch(html) {
    if (!html) return [];
    
    const $ = cheerio.load(html);
    const products = [];
    
    // Look for search result links
    const searchResults = $('h3').parent('a');
    
    searchResults.each((index, element) => {
      try {
        const link = $(element).attr('href');
        const title = $(element).find('h3').text().trim();
        
        if (link && title && this.isProductLink(link)) {
          const product = this.parseProductFromTitle(title, link);
          if (product) {
            products.push(product);
          }
        }
      } catch (error) {
        // Skip invalid results
      }
    });
    
    return products;
  }

  isProductLink(url) {
    const productPatterns = [
      /tesco\.com.*product/i,
      /sainsburys\.co\.uk.*product/i,
      /lidl\.co\.uk.*product/i,
      /aldi\.co\.uk.*product/i,
      /iceland\.co\.uk.*product/i
    ];
    
    return productPatterns.some(pattern => pattern.test(url));
  }

  parseProductFromTitle(title, url) {
    // Extract store name from URL
    let store = 'Unknown';
    if (url.includes('tesco.com')) store = 'Tesco';
    else if (url.includes('sainsburys.co.uk')) store = 'Sainsbury\'s';
    else if (url.includes('lidl.co.uk')) store = 'Lidl';
    else if (url.includes('aldi.co.uk')) store = 'Aldi';
    else if (url.includes('iceland.co.uk')) store = 'Iceland';
    
    // Extract brand from title
    const brand = this.extractBrandFromTitle(title);
    
    // Extract category from title
    const category = this.extractCategoryFromTitle(title);
    
    // Extract quantity from title
    const quantity = this.extractQuantityFromTitle(title);
    
    return {
      id: `google_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: title,
      brand: brand || store,
      store: store,
      category: category,
      quantity: quantity,
      price: { current: 0, original: 0, currency: 'GBP', unit: 'each' }, // Will be filled later
      image: null,
      barcode: null,
      nutrition: this.generateNutritionForCategory(category),
      ingredients: this.generateIngredientsForCategory(category),
      allergens: this.generateAllergensForCategory(category),
      nutritionGrade: this.generateNutritionGradeForCategory(category),
      packaging: this.generatePackagingForCategory(category),
      expiry: this.generateExpiryForCategory(category),
      storage: this.generateStorageForCategory(category),
      availability: 'in_stock',
      lastUpdated: new Date().toISOString()
    };
  }

  extractBrandFromTitle(title) {
    const brands = [
      'Tesco', 'Sainsbury\'s', 'Lidl', 'Aldi', 'Iceland',
      'Warburtons', 'Hovis', 'Kingsmill', 'Heinz', 'Birds Eye',
      'McCain', 'Findus', 'Young\'s', 'Cathedral City',
      'Tesco Finest', 'Tesco Value', 'Tesco Organic',
      'Sainsbury\'s Taste the Difference', 'Sainsbury\'s Basics',
      'Lidl Deluxe', 'Just Free',
      'Aldi Specially Selected', 'Aldi Everyday Essentials',
      'Iceland Luxury', 'Iceland Value'
    ];
    
    for (const brand of brands) {
      if (title.toLowerCase().includes(brand.toLowerCase())) {
        return brand;
      }
    }
    
    return null;
  }

  extractCategoryFromTitle(title) {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('milk') || titleLower.includes('cheese') || titleLower.includes('yogurt') || titleLower.includes('butter')) {
      return 'dairy';
    }
    if (titleLower.includes('bread') || titleLower.includes('rolls') || titleLower.includes('baguette')) {
      return 'bread';
    }
    if (titleLower.includes('chicken') || titleLower.includes('beef') || titleLower.includes('pork') || titleLower.includes('lamb') || titleLower.includes('fish')) {
      return 'meat';
    }
    if (titleLower.includes('apple') || titleLower.includes('banana') || titleLower.includes('orange') || titleLower.includes('tomato') || titleLower.includes('onion')) {
      return 'fresh_produce';
    }
    if (titleLower.includes('frozen') || titleLower.includes('ice cream')) {
      return 'frozen';
    }
    if (titleLower.includes('ready meal') || titleLower.includes('pizza') || titleLower.includes('curry')) {
      return 'convenience';
    }
    if (titleLower.includes('crisps') || titleLower.includes('chocolate') || titleLower.includes('biscuits')) {
      return 'snacks';
    }
    if (titleLower.includes('toilet') || titleLower.includes('detergent') || titleLower.includes('cleaning')) {
      return 'household';
    }
    
    return 'fresh_produce';
  }

  extractQuantityFromTitle(title) {
    const quantityMatch = title.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pints?|pack|packet|each)/i);
    if (quantityMatch) {
      return `${quantityMatch[1]} ${quantityMatch[2]}`;
    }
    return '1 each';
  }

  removeDuplicates(products) {
    const seen = new Set();
    return products.filter(product => {
      const key = `${product.name}-${product.store}`.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Helper methods for generating product data
  generateNutritionForCategory(category) {
    const nutritionMap = {
      'fresh_produce': { calories: 50, protein: 2.0, fat: 0.5, carbs: 12.0, sugar: 8.0, salt: 0, fiber: 3.0 },
      'dairy': { calories: 64, protein: 3.4, fat: 3.6, carbs: 4.8, sugar: 4.8, salt: 0.1, fiber: 0 },
      'meat': { calories: 165, protein: 31.0, fat: 3.6, carbs: 0, sugar: 0, salt: 0.1, fiber: 0 },
      'bread': { calories: 265, protein: 9.0, fat: 3.2, carbs: 49.0, sugar: 5.0, salt: 1.0, fiber: 2.7 },
      'frozen': { calories: 100, protein: 5.0, fat: 2.0, carbs: 15.0, sugar: 3.0, salt: 0.5, fiber: 2.0 },
      'convenience': { calories: 200, protein: 8.0, fat: 6.0, carbs: 30.0, sugar: 5.0, salt: 1.5, fiber: 2.0 },
      'snacks': { calories: 500, protein: 5.0, fat: 25.0, carbs: 60.0, sugar: 30.0, salt: 1.0, fiber: 3.0 },
      'household': { calories: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, salt: 0, fiber: 0 }
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
      'convenience': 'Various ingredients, preservatives, flavourings',
      'snacks': 'Potatoes, vegetable oil, salt, flavourings',
      'household': 'Non-food item'
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
      'convenience': ['gluten', 'milk', 'eggs'],
      'snacks': [],
      'household': []
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
      'convenience': 'D',
      'snacks': 'D',
      'household': 'N/A'
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
      'convenience': 'Plastic tray or box',
      'snacks': 'Plastic bag or box',
      'household': 'Various packaging'
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
      'convenience': { days: 3, type: 'use by' },
      'snacks': { days: 90, type: 'best before' },
      'household': { days: 365, type: 'best before' }
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
      'convenience': 'Refrigerate at 2-4°C',
      'snacks': 'Store in cool, dry place',
      'household': 'Store in cool, dry place'
    };
    
    return storageMap[category] || 'Store in cool, dry place';
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async saveProductsToFirebase(products) {
    try {
      const firebaseService = require('./FirebaseService');
      
      console.log(`💾 Saving ${products.length} Google-found products to Firebase...`);
      
      for (const product of products) {
        await firebaseService.saveProduct(product);
      }
      
      console.log(`✅ Successfully saved ${products.length} Google-found products to Firebase`);
      return true;
    } catch (error) {
      console.error('❌ Error saving Google-found products to Firebase:', error);
      return false;
    }
  }
}

module.exports = GoogleProductSearchService;
