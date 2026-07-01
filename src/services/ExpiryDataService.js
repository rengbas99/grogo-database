/**
 * Expiry Data Service
 * Integrates expiry timing data with fresh produce information
 */

const freshProduceData = require('../data/freshProduceData');
const logger = require('../utils/logger');

class ExpiryDataService {
  constructor() {
    this.freshProduceData = freshProduceData.freshProduceData;
    this.expiryRules = this.initializeExpiryRules();
  }

  /**
   * Initialize expiry rules for different product categories
   */
  initializeExpiryRules() {
    return {
      'Vegetables & Fruit': {
        'Fresh Vegetables': {
          'Leafy Greens': { min: 3, max: 7, default: 5, storage: 'refrigerator' },
          'Root Vegetables': { min: 14, max: 30, default: 21, storage: 'cool-dark-place' },
          'Cruciferous': { min: 7, max: 14, default: 10, storage: 'refrigerator' },
          'Nightshades': { min: 7, max: 14, default: 10, storage: 'room-temperature' },
          'Squash': { min: 7, max: 28, default: 14, storage: 'refrigerator' },
          'Mushrooms': { min: 3, max: 7, default: 5, storage: 'refrigerator' }
        },
        'Fresh Fruits': {
          'Citrus': { min: 7, max: 21, default: 14, storage: 'refrigerator' },
          'Stone Fruits': { min: 3, max: 7, default: 5, storage: 'refrigerator' },
          'Berries': { min: 3, max: 7, default: 5, storage: 'refrigerator' },
          'Tropical': { min: 3, max: 10, default: 7, storage: 'room-temperature' },
          'Apples & Pears': { min: 7, max: 21, default: 14, storage: 'refrigerator' }
        }
      },
      'Dairy': {
        'Milk & Cream': { min: 3, max: 7, default: 5, storage: 'refrigerator' },
        'Cheese': { min: 7, max: 30, default: 14, storage: 'refrigerator' },
        'Yogurt & Desserts': { min: 7, max: 14, default: 10, storage: 'refrigerator' },
        'Butter & Spreads': { min: 7, max: 30, default: 14, storage: 'refrigerator' }
      },
      'Meat & Poultry': {
        'Fresh Meat': { min: 1, max: 3, default: 2, storage: 'refrigerator' },
        'Poultry': { min: 1, max: 3, default: 2, storage: 'refrigerator' },
        'Processed Meats': { min: 3, max: 7, default: 5, storage: 'refrigerator' },
        'Frozen Meat': { min: 90, max: 365, default: 180, storage: 'freezer' }
      },
      'Bakery Items': {
        'Fresh Bread': { min: 2, max: 5, default: 3, storage: 'room-temperature' },
        'Pastries': { min: 1, max: 3, default: 2, storage: 'refrigerator' },
        'Frozen Bakery': { min: 30, max: 90, default: 60, storage: 'freezer' }
      },
      'Frozen Food Products': {
        'Frozen Meals': { min: 30, max: 90, default: 60, storage: 'freezer' },
        'Frozen Vegetables': { min: 90, max: 365, default: 180, storage: 'freezer' },
        'Ice Cream': { min: 30, max: 90, default: 60, storage: 'freezer' }
      }
    };
  }

  /**
   * Get expiry information for a product
   */
  getExpiryInfo(product) {
    const productName = (product.name || '').toLowerCase();
    const category = product.categorization?.category || 'Unknown';
    const subcategory = product.categorization?.subcategory || 'General';
    
    // Try to get specific produce data first
    const produceInfo = this.getFreshProduceInfo(productName);
    if (produceInfo) {
      return {
        ...produceInfo,
        source: 'fresh_produce_data',
        confidence: 'high'
      };
    }
    
    // Fall back to category-based rules
    const categoryInfo = this.getCategoryExpiryInfo(category, subcategory, productName);
    if (categoryInfo) {
      return {
        ...categoryInfo,
        source: 'category_rules',
        confidence: 'medium'
      };
    }
    
    // Default expiry for unknown products
    return this.getDefaultExpiryInfo(category);
  }

  /**
   * Get fresh produce specific information
   */
  getFreshProduceInfo(productName) {
    const produceInfo = freshProduceData.getExpiryInfo(productName);
    
    if (produceInfo && produceInfo.category !== 'unknown') {
      return {
        shelfLife: produceInfo.shelfLife,
        storage: produceInfo.storage,
        tips: produceInfo.tips,
        category: produceInfo.category,
        minShelfLife: produceInfo.shelfLife - 2,
        maxShelfLife: produceInfo.shelfLife + 2
      };
    }
    
    return null;
  }

  /**
   * Get category-based expiry information
   */
  getCategoryExpiryInfo(category, subcategory, productName) {
    if (!this.expiryRules[category]) {
      return null;
    }
    
    const categoryRules = this.expiryRules[category];
    
    // Try to find specific subcategory rules
    if (categoryRules[subcategory]) {
      return this.formatExpiryInfo(categoryRules[subcategory], subcategory);
    }
    
    // Try to match based on product name keywords
    for (const [ruleCategory, rules] of Object.entries(categoryRules)) {
      if (this.matchesProductCategory(productName, ruleCategory)) {
        return this.formatExpiryInfo(rules, ruleCategory);
      }
    }
    
    // Use first available rule for the category
    const firstRule = Object.values(categoryRules)[0];
    if (firstRule) {
      return this.formatExpiryInfo(firstRule, 'general');
    }
    
    return null;
  }

  /**
   * Check if product name matches a rule category
   */
  matchesProductCategory(productName, ruleCategory) {
    const categoryKeywords = {
      'Leafy Greens': ['lettuce', 'spinach', 'kale', 'arugula', 'cabbage'],
      'Root Vegetables': ['carrot', 'potato', 'onion', 'beet', 'turnip'],
      'Cruciferous': ['broccoli', 'cauliflower', 'brussels', 'cabbage'],
      'Nightshades': ['tomato', 'pepper', 'eggplant', 'potato'],
      'Squash': ['zucchini', 'cucumber', 'squash', 'pumpkin'],
      'Mushrooms': ['mushroom', 'shiitake', 'portobello'],
      'Citrus': ['orange', 'lemon', 'lime', 'grapefruit'],
      'Stone Fruits': ['peach', 'plum', 'cherry', 'apricot'],
      'Berries': ['strawberry', 'blueberry', 'raspberry', 'blackberry'],
      'Tropical': ['banana', 'mango', 'pineapple', 'papaya'],
      'Apples & Pears': ['apple', 'pear']
    };
    
    const keywords = categoryKeywords[ruleCategory] || [];
    return keywords.some(keyword => productName.includes(keyword));
  }

  /**
   * Format expiry information
   */
  formatExpiryInfo(rules, category) {
    return {
      shelfLife: rules.default,
      minShelfLife: rules.min,
      maxShelfLife: rules.max,
      storage: rules.storage,
      category: category,
      tips: this.getStorageTips(rules.storage)
    };
  }

  /**
   * Get storage tips based on storage type
   */
  getStorageTips(storage) {
    const tips = {
      'refrigerator': 'Store in refrigerator, keep in original packaging or airtight container',
      'cool-dark-place': 'Store in cool, dark, well-ventilated place away from direct sunlight',
      'room-temperature': 'Store at room temperature, away from direct sunlight and heat',
      'freezer': 'Store in freezer, ensure proper packaging to prevent freezer burn'
    };
    
    return tips[storage] || 'Store in cool, dry place';
  }

  /**
   * Get default expiry information for unknown products
   */
  getDefaultExpiryInfo(category) {
    const defaults = {
      'Vegetables & Fruit': { shelfLife: 7, storage: 'refrigerator' },
      'Dairy': { shelfLife: 7, storage: 'refrigerator' },
      'Meat & Poultry': { shelfLife: 3, storage: 'refrigerator' },
      'Bakery Items': { shelfLife: 3, storage: 'room-temperature' },
      'Frozen Food Products': { shelfLife: 90, storage: 'freezer' },
      'Snacks & Beverages': { shelfLife: 365, storage: 'room-temperature' },
      'Essentials': { shelfLife: 1095, storage: 'room-temperature' } // 3 years
    };
    
    const defaultInfo = defaults[category] || { shelfLife: 7, storage: 'refrigerator' };
    
    return {
      ...defaultInfo,
      minShelfLife: Math.max(1, defaultInfo.shelfLife - 2),
      maxShelfLife: defaultInfo.shelfLife + 7,
      category: 'unknown',
      tips: this.getStorageTips(defaultInfo.storage),
      confidence: 'low'
    };
  }

  /**
   * Calculate expiry date for a product
   */
  calculateExpiryDate(product, purchaseDate = new Date()) {
    const expiryInfo = this.getExpiryInfo(product);
    const expiryDate = new Date(purchaseDate);
    expiryDate.setDate(expiryDate.getDate() + expiryInfo.shelfLife);
    
    return {
      expiryDate: expiryDate,
      shelfLife: expiryInfo.shelfLife,
      daysUntilExpiry: Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24)),
      isExpiringSoon: this.isExpiringSoon(expiryDate),
      expiryInfo: expiryInfo
    };
  }

  /**
   * Check if product is expiring soon (within 3 days)
   */
  isExpiringSoon(expiryDate) {
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 3;
  }

  /**
   * Process products with expiry information
   */
  processProductsWithExpiry(products) {
    return products.map(product => {
      const expiryData = this.calculateExpiryDate(product);
      
      return {
        ...product,
        expiry: expiryData,
        processedAt: new Date()
      };
    });
  }

  /**
   * Get products expiring soon
   */
  getExpiringSoonProducts(products, daysThreshold = 3) {
    return products.filter(product => {
      if (!product.expiry) return false;
      return product.expiry.daysUntilExpiry <= daysThreshold;
    });
  }

  /**
   * Get products by storage type
   */
  getProductsByStorageType(products, storageType) {
    return products.filter(product => {
      if (!product.expiry) return false;
      return product.expiry.expiryInfo.storage === storageType;
    });
  }

  /**
   * Get expiry statistics
   */
  getExpiryStats(products) {
    const stats = {
      total: products.length,
      expiringSoon: 0,
      byStorage: {},
      byCategory: {},
      averageShelfLife: 0
    };
    
    let totalShelfLife = 0;
    
    products.forEach(product => {
      if (product.expiry) {
        // Count expiring soon
        if (product.expiry.isExpiringSoon) {
          stats.expiringSoon++;
        }
        
        // Count by storage type
        const storage = product.expiry.expiryInfo.storage;
        stats.byStorage[storage] = (stats.byStorage[storage] || 0) + 1;
        
        // Count by category
        const category = product.expiry.expiryInfo.category;
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
        
        // Add to average calculation
        totalShelfLife += product.expiry.shelfLife;
      }
    });
    
    stats.averageShelfLife = products.length > 0 ? Math.round(totalShelfLife / products.length) : 0;
    
    return stats;
  }
}

module.exports = ExpiryDataService;
