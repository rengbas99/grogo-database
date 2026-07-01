/**
 * Generate Products by Category Script
 * Processes one category at a time with generic image search and mock images
 */

const ComprehensiveProductService = require('../src/services/ComprehensiveProductService');
const logger = require('../src/utils/logger');
const fs = require('fs').promises;
const path = require('path');

class CategoryProductGenerator {
  constructor() {
    this.service = new ComprehensiveProductService();
    this.stores = ['Tesco', 'Sainsbury\'s', 'Aldi', 'Lidl', 'Iceland'];
    this.categories = [
      'Vegetables & Fruit',
      'Dairy', 
      'Meat & Poultry',
      'Bakery Items',
      'Breakfast Items',
      'Spices & World Foods',
      'Salad & Sandwiches',
      'Frozen Food Products',
      'Essentials',
      'Snacks & Beverages'
    ];
    this.mockImages = this.initializeMockImages();
  }

  /**
   * Initialize mock product images
   */
  initializeMockImages() {
    return {
      'Vegetables & Fruit': [
        'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400',
        'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?w=400',
        'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400'
      ],
      'Dairy': [
        'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400',
        'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400'
      ],
      'Meat & Poultry': [
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400',
        'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400',
        'https://images.unsplash.com/photo-1544025162-d76694265947?w=400'
      ],
      'Bakery Items': [
        'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400',
        'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400',
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400'
      ],
      'Breakfast Items': [
        'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400',
        'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400',
        'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400'
      ],
      'Spices & World Foods': [
        'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400',
        'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400'
      ],
      'Salad & Sandwiches': [
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
        'https://images.unsplash.com/photo-1539252554453-80ab65ce3586?w=400',
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400'
      ],
      'Frozen Food Products': [
        'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400',
        'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=400',
        'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400'
      ],
      'Essentials': [
        'https://images.unsplash.com/photo-1581578731548-c6a0c3f2fcc0?w=400',
        'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=400',
        'https://images.unsplash.com/photo-1581578731548-c6a0c3f2fcc0?w=400'
      ],
      'Snacks & Beverages': [
        'https://images.unsplash.com/photo-1546554137-f86b9593a222?w=400',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
        'https://images.unsplash.com/photo-1546554137-f86b9593a222?w=400'
      ]
    };
  }

  /**
   * Generate products for a specific category
   */
  async generateCategoryProducts(category, options = {}) {
    const {
      productsPerStore = 3,
      includeImages = true,
      includeExpiry = true,
      saveToFile = true
    } = options;

    logger.info(`Starting ${category} product generation...`);

    const categoryData = {
      category: category,
      generatedAt: new Date().toISOString(),
      stores: {}
    };

    // Process each store for this category
    for (const store of this.stores) {
      logger.info(`  Processing ${store} for ${category}...`);
      
      try {
        const storeProducts = await this.generateStoreCategoryProducts(store, category, {
          productsPerStore,
          includeImages,
          includeExpiry
        });

        categoryData.stores[store] = {
          storeName: store,
          productCount: storeProducts.length,
          products: storeProducts
        };

        logger.info(`    Generated ${storeProducts.length} products for ${store}`);

        // Add delay between stores (respecting 10 req/min limit)
        await this.delay(8000);

      } catch (error) {
        logger.error(`    Failed to generate products for ${store}: ${error.message}`);
        categoryData.stores[store] = {
          storeName: store,
          productCount: 0,
          products: [],
          error: error.message
        };
      }
    }

    // Generate summary
    categoryData.summary = this.generateCategorySummary(categoryData);

    // Save to file if requested
    if (saveToFile) {
      await this.saveCategoryToFile(categoryData);
    }

    return categoryData;
  }

  /**
   * Generate products for a specific store and category
   */
  async generateStoreCategoryProducts(store, category, options = {}) {
    const { productsPerStore, includeImages, includeExpiry } = options;
    
    // Use a single, more comprehensive search instead of multiple small ones
    const searchQuery = this.getBestSearchQueryForCategory(category, store);
    const allProducts = [];

    try {
      logger.info(`    Searching: ${searchQuery} for ${store}`);
      
      const result = await this.service.searchAndProcessProducts(searchQuery, {
        page: 1,
        pageSize: productsPerStore * 2, // Get more to filter from
        storeName: store,
        includeImages: false, // We'll add images manually
        includeExpiry,
        saveToDatabase: false
      });

      if (result.products && result.products.length > 0) {
        // Filter products that match the category or are close enough
        const filteredProducts = result.products.filter(product => {
          const productCategory = product.categorization?.category;
          return productCategory === category || 
                 this.isCategoryMatch(productCategory, category) ||
                 this.isProductNameMatch(product.name, category);
        });
        
        allProducts.push(...filteredProducts);
      }

    } catch (error) {
      logger.warn(`    Failed to search ${searchQuery}: ${error.message}`);
    }

    // Limit to requested number of products
    const limitedProducts = allProducts.slice(0, productsPerStore);
    
    // Add images to products
    if (includeImages) {
      return limitedProducts.map(product => this.addImageToProduct(product, category));
    }

    return limitedProducts.map(product => this.formatProductForJSON(product));
  }

  /**
   * Add image to product (generic search + mock images)
   */
  addImageToProduct(product, category) {
    const formattedProduct = this.formatProductForJSON(product);
    
    // If no image from OpenFoodFacts, add mock image
    if (!formattedProduct.imageUrl) {
      const mockImages = this.mockImages[category] || this.mockImages['Snacks & Beverages'];
      const randomImage = mockImages[Math.floor(Math.random() * mockImages.length)];
      
      formattedProduct.imageUrl = randomImage;
      formattedProduct.imageSource = 'mock_image';
    } else {
      formattedProduct.imageSource = 'openfoodfacts';
    }

    return formattedProduct;
  }

  /**
   * Get the best search query for a category and store
   */
  getBestSearchQueryForCategory(category, store) {
    const storeBrands = {
      'Tesco': 'Tesco',
      'Sainsbury\'s': 'Sainsbury\'s',
      'Aldi': 'Aldi',
      'Lidl': 'Lidl',
      'Iceland': 'Iceland'
    };

    const categoryKeywords = {
      'Vegetables & Fruit': 'fruit vegetable produce',
      'Dairy': 'milk cheese dairy',
      'Meat & Poultry': 'meat chicken beef pork',
      'Bakery Items': 'bread bakery pastry',
      'Breakfast Items': 'cereal breakfast oats',
      'Spices & World Foods': 'spice herb condiment',
      'Salad & Sandwiches': 'salad sandwich wrap',
      'Frozen Food Products': 'frozen ice cream',
      'Essentials': 'cleaning household',
      'Snacks & Beverages': 'snack beverage drink'
    };

    const brand = storeBrands[store] || '';
    const keywords = categoryKeywords[category] || 'food';
    
    return `${brand} ${keywords}`.trim();
  }

  /**
   * Get search queries for a specific category
   */
  getSearchQueriesForCategory(category, store) {
    const baseQueries = {
      'Vegetables & Fruit': ['apple', 'banana', 'carrot', 'potato', 'tomato', 'lettuce'],
      'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream'],
      'Meat & Poultry': ['chicken', 'beef', 'pork', 'lamb', 'sausage'],
      'Bakery Items': ['bread', 'croissant', 'muffin', 'cake', 'pastry'],
      'Breakfast Items': ['cereal', 'porridge', 'granola', 'oats'],
      'Spices & World Foods': ['spice', 'herb', 'curry', 'sauce', 'asian food'],
      'Salad & Sandwiches': ['salad', 'sandwich', 'wrap', 'panini'],
      'Frozen Food Products': ['frozen pizza', 'ice cream', 'frozen meal'],
      'Essentials': ['cleaning', 'laundry', 'toilet paper', 'detergent'],
      'Snacks & Beverages': ['chocolate', 'biscuit', 'crisp', 'juice', 'coffee']
    };

    const storeBrandQueries = this.getStoreBrandQueries(store, category);
    const baseCategoryQueries = baseQueries[category] || ['general food'];
    
    return [...baseCategoryQueries, ...storeBrandQueries];
  }

  /**
   * Get store-specific brand queries for a category
   */
  getStoreBrandQueries(store, category) {
    const storeBrands = {
      'Tesco': ['Tesco', 'Tesco Finest', 'Tesco Value'],
      'Sainsbury\'s': ['Sainsbury\'s', 'Taste the Difference', 'By Sainsbury\'s'],
      'Aldi': ['Aldi', 'Specially Selected', 'Harvest Morn'],
      'Lidl': ['Lidl', 'Milbona', 'Bellarom'],
      'Iceland': ['Iceland', 'Greggs', 'TGI Friday\'s']
    };

    const brands = storeBrands[store] || [];
    return brands.map(brand => `${brand} ${category.toLowerCase()}`);
  }

  /**
   * Check if product category matches target category
   */
  isCategoryMatch(productCategory, targetCategory) {
    if (!productCategory) return false;
    
    const categoryMappings = {
      'Vegetables & Fruit': ['Snacks & Beverages', 'Dairy'], // Sometimes fruits are miscategorized
      'Dairy': ['Snacks & Beverages'],
      'Meat & Poultry': ['Snacks & Beverages'],
      'Bakery Items': ['Snacks & Beverages'],
      'Breakfast Items': ['Snacks & Beverages'],
      'Spices & World Foods': ['Snacks & Beverages'],
      'Salad & Sandwiches': ['Snacks & Beverages'],
      'Frozen Food Products': ['Snacks & Beverages'],
      'Essentials': ['Snacks & Beverages'],
      'Snacks & Beverages': ['Dairy', 'Meat & Poultry', 'Bakery Items']
    };

    return categoryMappings[targetCategory]?.includes(productCategory) || false;
  }

  /**
   * Check if product name matches category keywords
   */
  isProductNameMatch(productName, category) {
    if (!productName) return false;
    
    const nameKeywords = {
      'Vegetables & Fruit': ['apple', 'banana', 'carrot', 'potato', 'tomato', 'lettuce', 'onion', 'broccoli', 'spinach', 'pepper', 'cucumber', 'orange', 'grape', 'fruit', 'vegetable', 'produce'],
      'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'dairy'],
      'Meat & Poultry': ['chicken', 'beef', 'pork', 'lamb', 'sausage', 'bacon', 'meat'],
      'Bakery Items': ['bread', 'croissant', 'muffin', 'cake', 'pastry', 'baguette'],
      'Breakfast Items': ['cereal', 'porridge', 'granola', 'oats', 'breakfast'],
      'Spices & World Foods': ['spice', 'herb', 'curry', 'sauce', 'condiment'],
      'Salad & Sandwiches': ['salad', 'sandwich', 'wrap', 'panini'],
      'Frozen Food Products': ['frozen', 'pizza', 'ice cream', 'frozen meal'],
      'Essentials': ['cleaning', 'laundry', 'toilet', 'detergent', 'soap'],
      'Snacks & Beverages': ['chocolate', 'biscuit', 'crisp', 'juice', 'coffee', 'tea', 'soda']
    };

    const keywords = nameKeywords[category] || [];
    const nameLower = productName.toLowerCase();
    
    return keywords.some(keyword => nameLower.includes(keyword));
  }

  /**
   * Format product for JSON output
   */
  formatProductForJSON(product) {
    return {
      id: product.id || null,
      name: product.name,
      brand: product.brand,
      genericType: product.genericType,
      barcode: product.barcode,
      category: product.categorization?.category || 'Uncategorized',
      subcategory: product.categorization?.subcategory || 'General',
      imageUrl: product.imageUrl,
      imageSource: product.imageSource || 'openfoodfacts',
      nutrition: product.nutrition || {},
      ingredients: product.ingredients || [],
      allergens: product.allergens || [],
      packaging: product.packaging || [],
      origin: product.origin || {},
      labels: product.labels || [],
      additives: product.additives || [],
      novaGroup: product.novaGroup,
      ecoscore: product.ecoscore,
      nutriscore: product.nutriscore,
      expiry: product.expiry ? {
        shelfLife: product.expiry.shelfLife,
        storage: product.expiry.expiryInfo?.storage,
        tips: product.expiry.expiryInfo?.tips,
        isExpiringSoon: product.expiry.isExpiringSoon
      } : null,
      ownBrand: product.ownBrand ? {
        isOwnBrand: product.ownBrand.isOwnBrand,
        brand: product.ownBrand.brand,
        category: product.ownBrand.category,
        store: product.ownBrand.store
      } : null,
      source: product.source || 'openfoodfacts',
      processedAt: product.processedAt || new Date().toISOString()
    };
  }

  /**
   * Generate category summary
   */
  generateCategorySummary(categoryData) {
    const summary = {
      totalProducts: 0,
      totalStores: Object.keys(categoryData.stores).length,
      productsByStore: {},
      ownBrands: 0,
      withImages: 0,
      expiringSoon: 0
    };

    Object.values(categoryData.stores).forEach(store => {
      summary.productsByStore[store.storeName] = store.productCount;
      summary.totalProducts += store.productCount;
      
      store.products.forEach(product => {
        if (product.ownBrand?.isOwnBrand) summary.ownBrands++;
        if (product.imageUrl) summary.withImages++;
        if (product.expiry?.isExpiringSoon) summary.expiringSoon++;
      });
    });

    return summary;
  }

  /**
   * Save category data to file
   */
  async saveCategoryToFile(categoryData) {
    const filename = `${categoryData.category.toLowerCase().replace(/\s+/g, '-')}-products.json`;
    const filepath = path.join(__dirname, '..', 'data', 'categories', filename);
    
    // Ensure directory exists
    const dataDir = path.dirname(filepath);
    await fs.mkdir(dataDir, { recursive: true });
    
    // Write file
    await fs.writeFile(filepath, JSON.stringify(categoryData, null, 2));
    
    logger.info(`Category data saved to: ${filepath}`);
    return filepath;
  }

  /**
   * Delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const generator = new CategoryProductGenerator();
  
  const args = process.argv.slice(2);
  const category = args[0];
  const productsPerStore = parseInt(args[1]) || 2;

  if (!category) {
    console.log('Usage: node generate-category-products.js <category> [productsPerStore]');
    console.log('Available categories:');
    generator.categories.forEach(cat => console.log(`  - ${cat}`));
    process.exit(1);
  }

  if (!generator.categories.includes(category)) {
    console.error(`Invalid category: ${category}`);
    console.log('Available categories:');
    generator.categories.forEach(cat => console.log(`  - ${cat}`));
    process.exit(1);
  }

  try {
    console.log(`🚀 Generating ${category} products...`);
    console.log(`Products per store: ${productsPerStore}\n`);

    const categoryData = await generator.generateCategoryProducts(category, {
      productsPerStore,
      includeImages: true,
      includeExpiry: true,
      saveToFile: true
    });

    console.log('\n✅ Category product generation completed!');
    console.log(`Total products: ${categoryData.summary.totalProducts}`);
    console.log(`Total stores: ${categoryData.summary.totalStores}`);
    console.log(`Own-brand products: ${categoryData.summary.ownBrands}`);
    console.log(`Products with images: ${categoryData.summary.withImages}`);
    console.log(`Products expiring soon: ${categoryData.summary.expiringSoon}`);

    console.log('\n📊 Products by store:');
    Object.entries(categoryData.summary.productsByStore).forEach(([store, count]) => {
      console.log(`  ${store}: ${count} products`);
    });

  } catch (error) {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = CategoryProductGenerator;
