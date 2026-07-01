/**
 * Mock Product Service
 * Provides realistic product data for MVP testing
 * No privacy risks, no phone setup required
 * Perfect for morning/evening data updates
 */

const logger = require('../utils/logger');
const firebaseService = require('./FirebaseService');

class MockProductService {
  constructor() {
    this.firebaseService = firebaseService;
    this.stores = [
      { id: 'tesco-uxbridge', name: 'Tesco Uxbridge', brand: 'Tesco' },
      { id: 'sainsburys-uxbridge', name: 'Sainsbury\'s Uxbridge', brand: 'Sainsbury\'s' },
      { id: 'aldi-uxbridge', name: 'Aldi Uxbridge', brand: 'Aldi' },
      { id: 'lidl-uxbridge', name: 'Lidl Uxbridge', brand: 'Lidl' },
      { id: 'iceland-uxbridge', name: 'Iceland Uxbridge', brand: 'Iceland' }
    ];
  }

  async init() {
    await this.firebaseService.initialize();
    logger.info('Mock Product Service initialized');
  }

  /**
   * Generate realistic product data for MVP
   */
  generateProductData() {
    const baseProducts = [
      // Dairy
      { name: 'Whole Milk 4 Pints', category: 'Dairy', subcategory: 'Milk', basePrice: 1.15, unit: 'each' },
      { name: 'Semi-Skimmed Milk 4 Pints', category: 'Dairy', subcategory: 'Milk', basePrice: 1.15, unit: 'each' },
      { name: 'Cheddar Cheese 400g', category: 'Dairy', subcategory: 'Cheese', basePrice: 2.50, unit: 'each' },
      { name: 'Natural Yogurt 500g', category: 'Dairy', subcategory: 'Yogurt', basePrice: 1.80, unit: 'each' },
      { name: 'Butter 250g', category: 'Dairy', subcategory: 'Butter', basePrice: 1.60, unit: 'each' },
      
      // Bakery
      { name: 'White Sliced Bread 800g', category: 'Bakery', subcategory: 'Bread', basePrice: 0.85, unit: 'each' },
      { name: 'Wholemeal Bread 800g', category: 'Bakery', subcategory: 'Bread', basePrice: 0.95, unit: 'each' },
      { name: 'Croissants 6 Pack', category: 'Bakery', subcategory: 'Pastries', basePrice: 1.20, unit: 'pack' },
      
      // Meat
      { name: 'Chicken Breast 1kg', category: 'Meat', subcategory: 'Chicken', basePrice: 4.50, unit: 'kg' },
      { name: 'Minced Beef 500g', category: 'Meat', subcategory: 'Beef', basePrice: 3.20, unit: 'pack' },
      { name: 'Salmon Fillet 400g', category: 'Seafood', subcategory: 'Fish', basePrice: 5.50, unit: 'pack' },
      
      // Fruits
      { name: 'Bananas 1kg', category: 'Fruits', subcategory: 'Bananas', basePrice: 1.20, unit: 'kg' },
      { name: 'Apples 1kg', category: 'Fruits', subcategory: 'Apples', basePrice: 2.00, unit: 'kg' },
      { name: 'Oranges 1kg', category: 'Fruits', subcategory: 'Citrus', basePrice: 1.80, unit: 'kg' },
      
      // Vegetables
      { name: 'Potatoes 2.5kg', category: 'Vegetables', subcategory: 'Potatoes', basePrice: 1.50, unit: 'bag' },
      { name: 'Onions 1kg', category: 'Vegetables', subcategory: 'Onions', basePrice: 0.80, unit: 'kg' },
      { name: 'Tomatoes 500g', category: 'Vegetables', subcategory: 'Tomatoes', basePrice: 1.40, unit: 'pack' },
      { name: 'Carrots 1kg', category: 'Vegetables', subcategory: 'Carrots', basePrice: 0.60, unit: 'kg' },
      
      // Pantry
      { name: 'Basmati Rice 1kg', category: 'Pantry', subcategory: 'Rice', basePrice: 1.80, unit: 'kg' },
      { name: 'Pasta 500g', category: 'Pantry', subcategory: 'Pasta', basePrice: 0.90, unit: 'pack' },
      { name: 'Cereal 500g', category: 'Pantry', subcategory: 'Cereal', basePrice: 2.20, unit: 'box' },
      { name: 'Coffee 200g', category: 'Pantry', subcategory: 'Coffee', basePrice: 3.50, unit: 'jar' },
      { name: 'Tea Bags 80 Pack', category: 'Pantry', subcategory: 'Tea', basePrice: 2.80, unit: 'box' },
      
      // Beverages
      { name: 'Orange Juice 1L', category: 'Beverages', subcategory: 'Juice', basePrice: 1.60, unit: 'bottle' },
      { name: 'Coca Cola 2L', category: 'Beverages', subcategory: 'Soft Drinks', basePrice: 1.80, unit: 'bottle' },
      { name: 'Water 2L', category: 'Beverages', subcategory: 'Water', basePrice: 0.50, unit: 'bottle' }
    ];

    const products = [];
    
    baseProducts.forEach(baseProduct => {
      this.stores.forEach(store => {
        const product = this.createStoreProduct(baseProduct, store);
        products.push(product);
      });
    });

    return products;
  }

  /**
   * Create store-specific product
   */
  createStoreProduct(baseProduct, store) {
    // Add store-specific pricing variations
    const priceVariation = this.getPriceVariation(store.brand);
    const finalPrice = Math.round((baseProduct.basePrice * priceVariation) * 100) / 100;
    
    // Add stock availability
    const stockLevel = this.getStockLevel();
    
    return {
      id: `${store.id}_${baseProduct.name.toLowerCase().replace(/\s+/g, '_')}`,
      name: baseProduct.name,
      brand: store.brand,
      category: baseProduct.category,
      subcategory: baseProduct.subcategory,
      price: finalPrice,
      unit: baseProduct.unit,
      storeId: store.id,
      storeName: store.name,
      availability: {
        inStock: stockLevel !== 'out_of_stock',
        stockLevel: stockLevel,
        lastUpdated: new Date().toISOString()
      },
      nutrition: this.generateNutritionData(baseProduct),
      image: this.generateImageUrl(baseProduct.name),
      source: 'Mock Data',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Get price variation by store brand
   */
  getPriceVariation(brand) {
    const variations = {
      'Tesco': 1.0,      // Base price
      'Sainsbury\'s': 1.05,  // 5% more expensive
      'Aldi': 0.85,      // 15% cheaper
      'Lidl': 0.90,      // 10% cheaper
      'Iceland': 0.95    // 5% cheaper
    };
    return variations[brand] || 1.0;
  }

  /**
   * Get stock level
   */
  getStockLevel() {
    const levels = ['in_stock', 'in_stock', 'in_stock', 'low_stock', 'out_of_stock'];
    return levels[Math.floor(Math.random() * levels.length)];
  }

  /**
   * Generate nutrition data
   */
  generateNutritionData(baseProduct) {
    const nutritionMap = {
      'Dairy': { calories: 64, protein: 3.2, fat: 3.6, carbs: 4.7 },
      'Bakery': { calories: 247, protein: 8.0, fat: 2.1, carbs: 47.0 },
      'Meat': { calories: 165, protein: 31.0, fat: 3.6, carbs: 0 },
      'Fruits': { calories: 52, protein: 0.3, fat: 0.2, carbs: 14.0 },
      'Vegetables': { calories: 25, protein: 1.0, fat: 0.1, carbs: 6.0 },
      'Pantry': { calories: 130, protein: 4.0, fat: 1.0, carbs: 28.0 },
      'Beverages': { calories: 45, protein: 0.5, fat: 0.1, carbs: 11.0 }
    };

    const baseNutrition = nutritionMap[baseProduct.category] || { calories: 100, protein: 2.0, fat: 1.0, carbs: 20.0 };
    
    return {
      calories: baseNutrition.calories + Math.floor(Math.random() * 20) - 10,
      protein: Math.round((baseNutrition.protein + (Math.random() * 2 - 1)) * 10) / 10,
      fat: Math.round((baseNutrition.fat + (Math.random() * 1 - 0.5)) * 10) / 10,
      carbs: Math.round((baseNutrition.carbs + (Math.random() * 5 - 2.5)) * 10) / 10,
      sugar: Math.round((baseNutrition.carbs * 0.3 + Math.random() * 5) * 10) / 10,
      salt: Math.round((Math.random() * 2) * 100) / 100
    };
  }

  /**
   * Generate image URL
   */
  generateImageUrl(productName) {
    const encodedName = encodeURIComponent(productName);
    return `https://images.unsplash.com/photo-${Math.random().toString(36).substr(2, 9)}?w=300&h=300&fit=crop&crop=center`;
  }

  /**
   * Get products for specific store
   */
  async getProductsForStore(storeId, limit = 50) {
    try {
      logger.info(`🔍 Getting products for store: ${storeId}`);
      
      const allProducts = this.generateProductData();
      const storeProducts = allProducts.filter(product => product.storeId === storeId);
      
      logger.info(`✅ Found ${storeProducts.length} products for ${storeId}`);
      return storeProducts.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get products for store:', error);
      return [];
    }
  }

  /**
   * Search products across all stores
   */
  async searchProducts(query, limit = 20) {
    try {
      logger.info(`🔍 Searching products for: "${query}"`);
      
      const allProducts = this.generateProductData();
      const searchResults = allProducts.filter(product => 
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.category.toLowerCase().includes(query.toLowerCase()) ||
        product.subcategory.toLowerCase().includes(query.toLowerCase())
      );
      
      logger.info(`✅ Found ${searchResults.length} products matching "${query}"`);
      return searchResults.slice(0, limit);
    } catch (error) {
      logger.error('Product search failed:', error);
      return [];
    }
  }

  /**
   * Save products to Firebase
   */
  async saveProducts(products) {
    try {
      if (products.length === 0) return;
      
      logger.info(`💾 Saving ${products.length} products to Firebase...`);
      
      for (const product of products) {
        await this.firebaseService.saveProduct(product);
      }
      
      logger.info(`✅ Successfully saved ${products.length} products to Firebase`);
    } catch (error) {
      logger.error('Failed to save products:', error);
      throw error;
    }
  }

  /**
   * Update product availability (for morning/evening updates)
   */
  async updateProductAvailability() {
    try {
      logger.info('🔄 Updating product availability...');
      
      const allProducts = this.generateProductData();
      const updatedProducts = allProducts.map(product => ({
        ...product,
        availability: {
          ...product.availability,
          stockLevel: this.getStockLevel(),
          lastUpdated: new Date().toISOString()
        },
        updatedAt: new Date()
      }));
      
      await this.saveProducts(updatedProducts);
      logger.info('✅ Product availability updated successfully');
      
      return updatedProducts;
    } catch (error) {
      logger.error('Failed to update product availability:', error);
      throw error;
    }
  }

  /**
   * Get morning data update
   */
  async getMorningUpdate() {
    logger.info('🌅 Running morning data update...');
    return await this.updateProductAvailability();
  }

  /**
   * Get evening data update
   */
  async getEveningUpdate() {
    logger.info('🌙 Running evening data update...');
    return await this.updateProductAvailability();
  }
}

module.exports = MockProductService;
