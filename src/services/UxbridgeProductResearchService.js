/**
 * Uxbridge Product Research Service
 * Focuses on core weekly grocery items with expiry and storage information
 * Uses OpenFoodFacts for real product data - no live stock concerns
 */

const axios = require('axios');
const logger = require('../utils/logger');
const firebaseService = require('./FirebaseService');
const uxbridgePopularProducts = require('../data/uxbridgePopularProducts');

class UxbridgeProductResearchService {
  constructor() {
    this.firebaseService = firebaseService;
    this.openFoodFactsBaseUrl = 'https://world.openfoodfacts.org/api/v0';
    this.rateLimitDelay = 1000; // 1 second between requests
  }

  async init() {
    await this.firebaseService.initialize();
    logger.info('Uxbridge Product Research Service initialized');
  }

  /**
   * Get core weekly grocery products with expiry and storage info
   */
  async getCoreWeeklyProducts() {
    try {
      logger.info('🛒 Researching core weekly grocery products for Uxbridge...');
      
      const coreProducts = [];
      const categories = this.getCoreWeeklyCategories();
      
      for (const category of categories) {
        logger.info(`📦 Processing ${category.name} category...`);
        
        const categoryProducts = await this.getProductsForCategory(category);
        coreProducts.push(...categoryProducts);
        
        // Rate limiting
        await this.delay(this.rateLimitDelay);
      }
      
      logger.info(`✅ Found ${coreProducts.length} core weekly products`);
      return coreProducts;
    } catch (error) {
      logger.error('Failed to get core weekly products:', error);
      return [];
    }
  }

  /**
   * Get core weekly grocery categories with storage requirements
   */
  getCoreWeeklyCategories() {
    return [
      {
        name: 'Fresh Dairy',
        searchTerms: ['milk', 'yogurt', 'cheese', 'butter'],
        storage: 'refrigerated',
        expiryDays: 7,
        priority: 'high'
      },
      {
        name: 'Fresh Bakery',
        searchTerms: ['bread', 'croissants', 'rolls'],
        storage: 'room_temperature',
        expiryDays: 3,
        priority: 'high'
      },
      {
        name: 'Fresh Meat',
        searchTerms: ['chicken', 'beef', 'pork', 'lamb'],
        storage: 'refrigerated',
        expiryDays: 3,
        priority: 'high'
      },
      {
        name: 'Fresh Produce',
        searchTerms: ['bananas', 'apples', 'oranges', 'tomatoes', 'potatoes', 'onions', 'carrots'],
        storage: 'room_temperature',
        expiryDays: 7,
        priority: 'high'
      },
      {
        name: 'Pantry Staples',
        searchTerms: ['rice', 'pasta', 'cereal', 'coffee', 'tea'],
        storage: 'pantry',
        expiryDays: 365,
        priority: 'medium'
      },
      {
        name: 'Beverages',
        searchTerms: ['juice', 'water', 'soft drinks'],
        storage: 'room_temperature',
        expiryDays: 30,
        priority: 'medium'
      }
    ];
  }

  /**
   * Get products for a specific category
   */
  async getProductsForCategory(category) {
    try {
      const products = [];
      
      for (const searchTerm of category.searchTerms) {
        const searchResults = await this.searchOpenFoodFacts(searchTerm, 3);
        
        for (const result of searchResults) {
          const enrichedProduct = this.enrichProductWithStorageInfo(result, category);
          products.push(enrichedProduct);
        }
        
        // Rate limiting
        await this.delay(this.rateLimitDelay);
      }
      
      return products;
    } catch (error) {
      logger.error(`Failed to get products for category ${category.name}:`, error);
      return [];
    }
  }

  /**
   * Search OpenFoodFacts for products
   */
  async searchOpenFoodFacts(searchTerm, limit = 5) {
    try {
      const response = await axios.get(`${this.openFoodFactsBaseUrl}/cgi/search.pl`, {
        params: {
          search_terms: searchTerm,
          search_simple: 1,
          action: 'process',
          json: 1,
          page_size: limit,
          sort_by: 'popularity'
        },
        timeout: 10000
      });

      const products = [];
      
      if (response.data.products) {
        response.data.products.forEach(item => {
          if (item.product_name && item.brands) {
            products.push({
              name: item.product_name,
              brand: item.brands.split(',')[0].trim(),
              category: this.categorizeProduct(item),
              barcode: item.code,
              image: item.image_url || item.image_front_url,
              nutrition: this.extractNutrition(item),
              ingredients: item.ingredients_text || '',
              allergens: item.allergens_tags || [],
              additives: item.additives_tags || [],
              labels: item.labels_tags || [],
              packaging: item.packaging_tags || [],
              origin: item.countries_tags || [],
              source: 'OpenFoodFacts',
              isActive: true
            });
          }
        });
      }
      
      return products;
    } catch (error) {
      logger.error(`OpenFoodFacts search failed for ${searchTerm}:`, error);
      return [];
    }
  }

  /**
   * Enrich product with storage and expiry information
   */
  enrichProductWithStorageInfo(product, category) {
    return {
      ...product,
      storage: {
        type: category.storage,
        temperature: this.getStorageTemperature(category.storage),
        humidity: this.getStorageHumidity(category.storage),
        notes: this.getStorageNotes(category.storage)
      },
      expiry: {
        typicalDays: category.expiryDays,
        storageType: category.storage,
        tips: this.getExpiryTips(category.storage, category.expiryDays)
      },
      priority: category.priority,
      isCoreWeekly: true,
      uxbridgeRelevance: this.calculateUxbridgeRelevance(product, category)
    };
  }

  /**
   * Get storage temperature requirements
   */
  getStorageTemperature(storageType) {
    const temperatures = {
      'refrigerated': '2-4°C',
      'room_temperature': '18-22°C',
      'pantry': '15-25°C',
      'freezer': '-18°C'
    };
    return temperatures[storageType] || '18-22°C';
  }

  /**
   * Get storage humidity requirements
   */
  getStorageHumidity(storageType) {
    const humidity = {
      'refrigerated': '85-95%',
      'room_temperature': '50-70%',
      'pantry': '50-60%',
      'freezer': '0-10%'
    };
    return humidity[storageType] || '50-70%';
  }

  /**
   * Get storage notes
   */
  getStorageNotes(storageType) {
    const notes = {
      'refrigerated': 'Store in refrigerator, keep away from door',
      'room_temperature': 'Store in cool, dry place away from direct sunlight',
      'pantry': 'Store in airtight container in cool, dry place',
      'freezer': 'Store in freezer, use within recommended time'
    };
    return notes[storageType] || 'Store in cool, dry place';
  }

  /**
   * Get expiry tips
   */
  getExpiryTips(storageType, expiryDays) {
    const tips = {
      'refrigerated': [
        'Check daily for signs of spoilage',
        'Use within 3-5 days of opening',
        'Store in original packaging when possible'
      ],
      'room_temperature': [
        'Check for mold or soft spots',
        'Store away from ethylene-producing fruits',
        'Use within recommended timeframe'
      ],
      'pantry': [
        'Check for pests or damage',
        'Store in airtight containers',
        'Rotate stock regularly'
      ]
    };
    
    return tips[storageType] || ['Check regularly for quality'];
  }

  /**
   * Categorize product based on OpenFoodFacts data
   */
  categorizeProduct(item) {
    if (item.categories_tags) {
      for (const category of item.categories_tags) {
        if (category.includes('dairy')) return 'Dairy';
        if (category.includes('meat')) return 'Meat';
        if (category.includes('fish')) return 'Seafood';
        if (category.includes('fruits')) return 'Fruits';
        if (category.includes('vegetables')) return 'Vegetables';
        if (category.includes('bread')) return 'Bakery';
        if (category.includes('beverages')) return 'Beverages';
        if (category.includes('snacks')) return 'Snacks';
      }
    }
    return 'General';
  }

  /**
   * Extract nutrition information
   */
  extractNutrition(item) {
    const nutriments = item.nutriments || {};
    return {
      grade: item.nutrition_grades || 'unknown',
      score: item.nutrition_score_fr || 0,
      calories: nutriments.energy_kcal_100g || 0,
      protein: nutriments.proteins_100g || 0,
      fat: nutriments.fat_100g || 0,
      carbs: nutriments.carbohydrates_100g || 0,
      sugar: nutriments.sugars_100g || 0,
      salt: nutriments.sodium_100g || 0,
      fiber: nutriments.fiber_100g || 0
    };
  }

  /**
   * Calculate Uxbridge relevance score
   */
  calculateUxbridgeRelevance(product, category) {
    let score = 0;
    
    // Base score from category priority
    if (category.priority === 'high') score += 40;
    else if (category.priority === 'medium') score += 20;
    
    // Add score for common UK brands
    const ukBrands = ['Tesco', 'Sainsbury\'s', 'Asda', 'Morrisons', 'Waitrose', 'Aldi', 'Lidl', 'Iceland'];
    if (ukBrands.some(brand => product.brand.includes(brand))) {
      score += 30;
    }
    
    // Add score for nutrition grade
    if (product.nutrition.grade === 'A') score += 20;
    else if (product.nutrition.grade === 'B') score += 15;
    else if (product.nutrition.grade === 'C') score += 10;
    
    // Add score for completeness of data
    if (product.ingredients) score += 5;
    if (product.allergens && product.allergens.length > 0) score += 5;
    
    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Save products to Firebase
   */
  async saveProducts(products) {
    try {
      if (products.length === 0) return;
      
      logger.info(`💾 Saving ${products.length} core weekly products to Firebase...`);
      
      for (const product of products) {
        await this.firebaseService.saveToCollection('core_weekly_products', product);
      }
      
      logger.info(`✅ Successfully saved ${products.length} core weekly products to Firebase`);
    } catch (error) {
      logger.error('Failed to save products:', error);
      throw error;
    }
  }

  /**
   * Get products by storage type
   */
  async getProductsByStorageType(storageType) {
    try {
      const products = await this.firebaseService.queryCollection('core_weekly_products', [
        { field: 'storage.type', operator: '==', value: storageType }
      ]);
      
      return products;
    } catch (error) {
      logger.error('Failed to get products by storage type:', error);
      return [];
    }
  }

  /**
   * Get products by expiry priority
   */
  async getProductsByExpiryPriority() {
    try {
      const products = await this.firebaseService.queryCollection('core_weekly_products', [
        { field: 'isCoreWeekly', operator: '==', value: true }
      ]);
      
      // Sort by expiry days (shortest first)
      return products.sort((a, b) => a.expiry.typicalDays - b.expiry.typicalDays);
    } catch (error) {
      logger.error('Failed to get products by expiry priority:', error);
      return [];
    }
  }

  /**
   * Delay function for rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = UxbridgeProductResearchService;
