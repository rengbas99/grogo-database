/**
 * Generate Product JSON Output
 * Creates a comprehensive JSON file with products organized by store and categories
 */

const ComprehensiveProductService = require('../src/services/ComprehensiveProductService');
const logger = require('../src/utils/logger');

class ProductJSONGenerator {
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
  }

  /**
   * Generate comprehensive product data
   */
  async generateProductData(options = {}) {
    const {
      productsPerCategory = 5,
      includeImages = true,
      includeExpiry = true,
      saveToFile = true
    } = options;

    logger.info('Starting product data generation...');

    const productData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalStores: this.stores.length,
        totalCategories: this.categories.length,
        productsPerCategory,
        includeImages,
        includeExpiry
      },
      stores: {}
    };

    // Generate products for each store
    for (const store of this.stores) {
      logger.info(`Generating products for ${store}...`);
      
      productData.stores[store] = {
        storeName: store,
        categories: {}
      };

      // Generate products for each category
      for (const category of this.categories) {
        logger.info(`  Generating ${category} products for ${store}...`);
        
        const searchQueries = this.getSearchQueriesForCategory(category, store);
        const categoryProducts = [];

        for (const query of searchQueries.slice(0, 2)) { // Limit to 2 queries per category
          try {
            const result = await this.service.searchAndProcessProducts(query, {
              page: 1,
              pageSize: Math.ceil(productsPerCategory / 2),
              storeName: store,
              includeImages,
              includeExpiry,
              saveToDatabase: false
            });

            if (result.products && result.products.length > 0) {
              // Filter products that match the category
              const filteredProducts = result.products.filter(product => 
                product.categorization?.category === category
              );
              
              categoryProducts.push(...filteredProducts);
            }

            // Add delay between requests
            await this.delay(2000);

          } catch (error) {
            logger.warn(`Failed to search ${query} for ${store}: ${error.message}`);
          }
        }

        // Limit to requested number of products
        const limitedProducts = categoryProducts.slice(0, productsPerCategory);
        
        productData.stores[store].categories[category] = {
          categoryName: category,
          productCount: limitedProducts.length,
          products: limitedProducts.map(product => this.formatProductForJSON(product))
        };

        logger.info(`    Generated ${limitedProducts.length} products for ${category}`);
      }
    }

    // Generate summary statistics
    productData.summary = this.generateSummary(productData);

    // Save to file if requested
    if (saveToFile) {
      await this.saveToFile(productData);
    }

    return productData;
  }

  /**
   * Get search queries for a specific category
   */
  getSearchQueriesForCategory(category, store) {
    const baseQueries = {
      'Vegetables & Fruit': [
        'apple', 'banana', 'carrot', 'potato', 'tomato', 'lettuce', 'onion',
        'broccoli', 'spinach', 'pepper', 'cucumber', 'orange', 'grapes'
      ],
      'Dairy': [
        'milk', 'cheese', 'yogurt', 'butter', 'cream', 'cheddar', 'mozzarella',
        'greek yogurt', 'natural yogurt', 'milk alternative'
      ],
      'Meat & Poultry': [
        'chicken', 'beef', 'pork', 'lamb', 'sausage', 'bacon', 'mince',
        'chicken breast', 'ground beef', 'pork chop'
      ],
      'Bakery Items': [
        'bread', 'croissant', 'muffin', 'cake', 'pastry', 'baguette',
        'sourdough', 'white bread', 'wholemeal bread'
      ],
      'Breakfast Items': [
        'cereal', 'porridge', 'granola', 'oats', 'breakfast bar',
        'muesli', 'breakfast drink'
      ],
      'Spices & World Foods': [
        'spice', 'herb', 'seasoning', 'sauce', 'condiment', 'curry',
        'garlic', 'ginger', 'paprika', 'oregano', 'asian food', 'indian food',
        'mexican food', 'mediterranean food', 'chinese food', 'italian food',
        'middle eastern food'
      ],
      'Salad & Sandwiches': [
        'salad', 'sandwich', 'wrap', 'panini', 'baguette', 'salad kit',
        'ready meal salad', 'chicken sandwich', 'tuna sandwich', 'veggie wrap'
      ],
      'Frozen Food Products': [
        'frozen pizza', 'ice cream', 'frozen vegetable', 'frozen meal',
        'frozen fish', 'frozen chicken', 'frozen dessert'
      ],
      'Essentials': [
        'cleaning', 'laundry', 'toilet paper', 'tissue', 'detergent',
        'soap', 'shampoo', 'toothpaste'
      ],
      'Snacks & Beverages': [
        'chocolate', 'biscuit', 'crisp', 'nut', 'candy', 'juice',
        'water', 'coffee', 'tea', 'soda', 'soft drink'
      ]
    };

    // Get store-specific private brand queries
    const storeBrandQueries = this.getStoreBrandQueries(store);
    
    // Combine base queries with store-specific brand queries
    const baseCategoryQueries = baseQueries[category] || ['general food'];
    const storeBrandCategoryQueries = storeBrandQueries[category] || [];
    
    return [...baseCategoryQueries, ...storeBrandCategoryQueries];
  }

  /**
   * Get store-specific private brand search queries
   */
  getStoreBrandQueries(store) {
    const storeBrands = {
      'Tesco': {
        'Vegetables & Fruit': ['Tesco apple', 'Tesco Finest organic', 'Redmere Farms'],
        'Dairy': ['Tesco milk', 'Tesco Finest cheese', 'Creamfields'],
        'Meat & Poultry': ['Tesco chicken', 'Boswell Farms beef', 'Willow Farms'],
        'Bakery Items': ['Tesco bread', 'H.W. Nevill\'s', 'Tesco Finest bakery'],
        'Breakfast Items': ['Tesco cereal', 'Tesco porridge'],
        'Spices & World Foods': ['Tesco spice', 'Tesco curry', 'Tesco sauce'],
        'Salad & Sandwiches': ['Tesco salad', 'Tesco sandwich', 'Tesco wrap'],
        'Frozen Food Products': ['Tesco frozen', 'Tesco pizza', 'Tesco ice cream'],
        'Essentials': ['Tesco cleaning', 'Tesco Value'],
        'Snacks & Beverages': ['Tesco chocolate', 'Tesco crisp', 'Tesco Value']
      },
      'Sainsbury\'s': {
        'Vegetables & Fruit': ['Sainsbury\'s apple', 'SO Organic', 'By Sainsbury\'s'],
        'Dairy': ['Sainsbury\'s milk', 'Taste the Difference cheese', 'By Sainsbury\'s'],
        'Meat & Poultry': ['Sainsbury\'s chicken', 'J James & Family', 'Taste the Difference'],
        'Bakery Items': ['Sainsbury\'s bread', 'Taste the Difference bakery'],
        'Breakfast Items': ['Sainsbury\'s cereal', 'By Sainsbury\'s'],
        'Spices & World Foods': ['Sainsbury\'s spice', 'Taste the Difference'],
        'Salad & Sandwiches': ['Sainsbury\'s salad', 'Sainsbury\'s sandwich'],
        'Frozen Food Products': ['Sainsbury\'s frozen', 'Taste the Difference'],
        'Essentials': ['Sainsbury\'s cleaning', 'By Sainsbury\'s'],
        'Snacks & Beverages': ['Sainsbury\'s chocolate', 'Lovett\'s Family Favourites', 'Just Snax']
      },
      'Aldi': {
        'Vegetables & Fruit': ['Aldi apple', 'Specially Selected'],
        'Dairy': ['Aldi milk', 'Cowbelle', 'Specially Selected'],
        'Meat & Poultry': ['Aldi chicken', 'Ashfields', 'Specially Selected'],
        'Bakery Items': ['Aldi bread', 'The Village Bakery', 'Specially Selected'],
        'Breakfast Items': ['Aldi cereal', 'Harvest Morn'],
        'Spices & World Foods': ['Aldi spice', 'Specially Selected'],
        'Salad & Sandwiches': ['Aldi salad', 'Aldi sandwich'],
        'Frozen Food Products': ['Aldi frozen', 'Specially Selected'],
        'Essentials': ['Aldi cleaning', 'Specially Selected'],
        'Snacks & Beverages': ['Aldi chocolate', 'Snackrite', 'Moser Roth']
      },
      'Lidl': {
        'Vegetables & Fruit': ['Lidl apple', 'Lidl organic'],
        'Dairy': ['Lidl milk', 'Milbona', 'Dulano'],
        'Meat & Poultry': ['Lidl chicken', 'Riverway'],
        'Bakery Items': ['Lidl bread', 'Lidl bakery'],
        'Breakfast Items': ['Lidl cereal', 'Lidl muesli'],
        'Spices & World Foods': ['Lidl spice', 'Bellarom', 'Eridanous', 'Baresa'],
        'Salad & Sandwiches': ['Lidl salad', 'Lidl sandwich'],
        'Frozen Food Products': ['Lidl frozen', 'Lidl ice cream'],
        'Essentials': ['Lidl cleaning', 'Cien', 'W5'],
        'Snacks & Beverages': ['Lidl chocolate', 'Lidl crisp']
      },
      'Iceland': {
        'Vegetables & Fruit': ['Iceland frozen fruit', 'Iceland frozen vegetable'],
        'Dairy': ['Iceland dairy', 'Iceland milk'],
        'Meat & Poultry': ['Iceland frozen meat', 'Iceland frozen chicken'],
        'Bakery Items': ['Iceland frozen bread', 'Greggs'],
        'Breakfast Items': ['Iceland frozen breakfast'],
        'Spices & World Foods': ['Iceland spice'],
        'Salad & Sandwiches': ['Iceland frozen salad'],
        'Frozen Food Products': ['Iceland frozen', 'Iceland pizza', 'TGI Friday\'s', 'Slimming World'],
        'Essentials': ['Iceland cleaning'],
        'Snacks & Beverages': ['Iceland chocolate', 'Iceland ice cream']
      }
    };

    return storeBrands[store] || {};
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
      imageSearch: product.imageSearch || null,
      source: product.source || 'openfoodfacts',
      processedAt: product.processedAt || new Date().toISOString()
    };
  }

  /**
   * Generate summary statistics
   */
  generateSummary(productData) {
    const summary = {
      totalProducts: 0,
      totalStores: Object.keys(productData.stores).length,
      totalCategories: this.categories.length,
      productsByStore: {},
      productsByCategory: {},
      ownBrands: 0,
      withImages: 0,
      expiringSoon: 0,
      storageTypes: {}
    };

    // Calculate statistics
    Object.values(productData.stores).forEach(store => {
      let storeProductCount = 0;
      let storeOwnBrands = 0;
      let storeWithImages = 0;
      let storeExpiringSoon = 0;

      Object.values(store.categories).forEach(category => {
        storeProductCount += category.productCount;
        
        category.products.forEach(product => {
          if (product.ownBrand?.isOwnBrand) storeOwnBrands++;
          if (product.imageUrl) storeWithImages++;
          if (product.expiry?.isExpiringSoon) storeExpiringSoon++;
          
          // Count by category
          summary.productsByCategory[product.category] = 
            (summary.productsByCategory[product.category] || 0) + 1;
          
          // Count storage types
          if (product.expiry?.storage) {
            summary.storageTypes[product.expiry.storage] = 
              (summary.storageTypes[product.expiry.storage] || 0) + 1;
          }
        });
      });

      summary.productsByStore[store.storeName] = storeProductCount;
      summary.totalProducts += storeProductCount;
      summary.ownBrands += storeOwnBrands;
      summary.withImages += storeWithImages;
      summary.expiringSoon += storeExpiringSoon;
    });

    return summary;
  }

  /**
   * Save data to JSON file
   */
  async saveToFile(productData) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const filename = `product-data-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(__dirname, '..', 'data', filename);
    
    // Ensure data directory exists
    const dataDir = path.dirname(filepath);
    await fs.mkdir(dataDir, { recursive: true });
    
    // Write file
    await fs.writeFile(filepath, JSON.stringify(productData, null, 2));
    
    logger.info(`Product data saved to: ${filepath}`);
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
  const generator = new ProductJSONGenerator();
  
  const args = process.argv.slice(2);
  const productsPerCategory = parseInt(args[0]) || 3;
  const includeImages = args[1] !== 'false';
  const includeExpiry = args[2] !== 'false';

  try {
    console.log('🚀 Starting product data generation...');
    console.log(`Products per category: ${productsPerCategory}`);
    console.log(`Include images: ${includeImages}`);
    console.log(`Include expiry: ${includeExpiry}\n`);

    const productData = await generator.generateProductData({
      productsPerCategory,
      includeImages,
      includeExpiry,
      saveToFile: true
    });

    console.log('\n✅ Product data generation completed!');
    console.log(`Total products: ${productData.summary.totalProducts}`);
    console.log(`Total stores: ${productData.summary.totalStores}`);
    console.log(`Total categories: ${productData.summary.totalCategories}`);
    console.log(`Own-brand products: ${productData.summary.ownBrands}`);
    console.log(`Products with images: ${productData.summary.withImages}`);
    console.log(`Products expiring soon: ${productData.summary.expiringSoon}`);

    console.log('\n📊 Products by store:');
    Object.entries(productData.summary.productsByStore).forEach(([store, count]) => {
      console.log(`  ${store}: ${count} products`);
    });

    console.log('\n📊 Products by category:');
    Object.entries(productData.summary.productsByCategory).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} products`);
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

module.exports = ProductJSONGenerator;
