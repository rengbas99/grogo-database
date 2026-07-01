/**
 * Populate Products Database Script
 * Fetches products from OpenFoodFacts and populates the database
 */

const ComprehensiveProductService = require('../src/services/ComprehensiveProductService');
const logger = require('../src/utils/logger');

class ProductPopulator {
  constructor() {
    this.service = new ComprehensiveProductService();
    this.searchQueries = [
      // Dairy Products
      'milk', 'cheese', 'yogurt', 'butter', 'cream',
      
      // Fresh Produce
      'apple', 'banana', 'orange', 'carrot', 'potato', 'onion', 'tomato',
      'lettuce', 'spinach', 'broccoli', 'cauliflower', 'pepper',
      
      // Meat & Poultry
      'chicken', 'beef', 'pork', 'lamb', 'sausage', 'bacon',
      
      // Bakery
      'bread', 'croissant', 'muffin', 'cake', 'pastry',
      
      // Breakfast
      'cereal', 'porridge', 'granola', 'oats',
      
      // Pantry
      'rice', 'pasta', 'flour', 'sugar', 'salt', 'oil',
      
      // Beverages
      'juice', 'water', 'coffee', 'tea', 'soda',
      
      // Snacks
      'chocolate', 'biscuit', 'crisp', 'nut', 'candy',
      
      // Frozen
      'frozen pizza', 'ice cream', 'frozen vegetable', 'frozen meal',
      
      // Spices
      'spice', 'herb', 'seasoning', 'sauce', 'condiment'
    ];
    
    this.stores = ['Tesco', 'Sainsbury\'s', 'Aldi', 'Lidl', 'Iceland'];
  }

  /**
   * Populate database with products
   */
  async populateDatabase(options = {}) {
    const {
      maxProductsPerQuery = 10,
      maxQueries = 5,
      includeImages = true,
      includeExpiry = true,
      saveToDatabase = true
    } = options;

    logger.info('Starting database population...');
    
    const allProducts = [];
    const errors = [];
    let totalProcessed = 0;

    try {
      // Process each search query
      for (let i = 0; i < Math.min(this.searchQueries.length, maxQueries); i++) {
        const query = this.searchQueries[i];
        logger.info(`Processing query ${i + 1}/${maxQueries}: ${query}`);

        try {
          const result = await this.service.searchAndProcessProducts(query, {
            page: 1,
            pageSize: maxProductsPerQuery,
            includeImages,
            includeExpiry,
            saveToDatabase
          });

          allProducts.push(...result.products);
          totalProcessed += result.processed;
          errors.push(...result.errors);

          logger.info(`Processed ${result.processed} products for query: ${query}`);

          // Add delay between queries to respect rate limits
          await this.delay(2000);

        } catch (error) {
          logger.error(`Failed to process query: ${query}`, error);
          errors.push(`Query ${query}: ${error.message}`);
        }
      }

      // Generate final report
      const report = await this.generateReport(allProducts, errors);

      logger.info('Database population completed');
      logger.info(`Total products processed: ${totalProcessed}`);
      logger.info(`Total errors: ${errors.length}`);

      return {
        success: true,
        totalProducts: allProducts.length,
        totalProcessed,
        errors,
        report
      };

    } catch (error) {
      logger.error('Database population failed:', error);
      return {
        success: false,
        totalProducts: 0,
        totalProcessed: 0,
        errors: [error.message],
        report: null
      };
    }
  }

  /**
   * Populate with store-specific products
   */
  async populateStoreProducts(storeName, options = {}) {
    const {
      maxProductsPerQuery = 5,
      maxQueries = 3,
      includeImages = true,
      includeExpiry = true,
      saveToDatabase = true
    } = options;

    logger.info(`Populating products for store: ${storeName}`);

    const allProducts = [];
    const errors = [];
    let totalProcessed = 0;

    try {
      // Use store-specific search terms
      const storeQueries = this.getStoreSpecificQueries(storeName);

      for (let i = 0; i < Math.min(storeQueries.length, maxQueries); i++) {
        const query = storeQueries[i];
        logger.info(`Processing store query ${i + 1}/${maxQueries}: ${query}`);

        try {
          const result = await this.service.searchAndProcessProducts(query, {
            page: 1,
            pageSize: maxProductsPerQuery,
            storeName,
            includeImages,
            includeExpiry,
            saveToDatabase
          });

          allProducts.push(...result.products);
          totalProcessed += result.processed;
          errors.push(...result.errors);

          logger.info(`Processed ${result.processed} products for ${storeName}: ${query}`);

          // Add delay between queries
          await this.delay(2000);

        } catch (error) {
          logger.error(`Failed to process store query: ${query}`, error);
          errors.push(`Store query ${query}: ${error.message}`);
        }
      }

      return {
        success: true,
        store: storeName,
        totalProducts: allProducts.length,
        totalProcessed,
        errors
      };

    } catch (error) {
      logger.error(`Store population failed for ${storeName}:`, error);
      return {
        success: false,
        store: storeName,
        totalProducts: 0,
        totalProcessed: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Get store-specific search queries
   */
  getStoreSpecificQueries(storeName) {
    const storeQueries = {
      'Tesco': [
        'Tesco milk', 'Tesco bread', 'Tesco cheese', 'Tesco Finest',
        'Tesco Value', 'Tesco organic', 'Tesco frozen'
      ],
      'Sainsbury\'s': [
        'Sainsbury\'s milk', 'Sainsbury\'s bread', 'Taste the Difference',
        'By Sainsbury\'s', 'SO Organic', 'Sainsbury\'s fresh'
      ],
      'Aldi': [
        'Aldi milk', 'Aldi bread', 'Specially Selected', 'Harvest Morn',
        'Ashfields', 'Aldi organic', 'Aldi frozen'
      ],
      'Lidl': [
        'Lidl milk', 'Lidl bread', 'Milbona', 'Bellarom', 'Lidl fresh',
        'Lidl organic', 'Lidl frozen'
      ],
      'Iceland': [
        'Iceland frozen', 'Iceland ready meal', 'Iceland pizza',
        'Iceland ice cream', 'Iceland frozen vegetable'
      ]
    };

    return storeQueries[storeName] || this.searchQueries.slice(0, 5);
  }

  /**
   * Generate comprehensive report
   */
  async generateReport(products, errors) {
    try {
      const report = await this.service.getProductReport(products);
      
      return {
        ...report,
        errors: {
          count: errors.length,
          details: errors
        },
        recommendations: this.generateRecommendations(report)
      };
    } catch (error) {
      logger.error('Failed to generate report:', error);
      return {
        summary: { total: products.length },
        errors: { count: errors.length, details: errors },
        recommendations: []
      };
    }
  }

  /**
   * Generate recommendations based on the data
   */
  generateRecommendations(report) {
    const recommendations = [];

    if (report.summary.withImages < report.summary.total * 0.5) {
      recommendations.push('Consider improving image search to get more product images');
    }

    if (report.summary.ownBrands < report.summary.total * 0.3) {
      recommendations.push('Consider adding more own-brand products to the search queries');
    }

    if (report.expiringSoon.count > 0) {
      recommendations.push(`Monitor ${report.expiringSoon.count} products that are expiring soon`);
    }

    const topCategory = report.categories[0];
    if (topCategory) {
      recommendations.push(`Focus on ${topCategory.category} category (${topCategory.percentage}% of products)`);
    }

    return recommendations;
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
  const populator = new ProductPopulator();
  
  const args = process.argv.slice(2);
  const command = args[0] || 'populate';
  const storeName = args[1];

  try {
    if (command === 'populate') {
      const result = await populator.populateDatabase({
        maxProductsPerQuery: 10,
        maxQueries: 8,
        includeImages: true,
        includeExpiry: true,
        saveToDatabase: true
      });

      console.log('\n=== POPULATION COMPLETE ===');
      console.log(`Success: ${result.success}`);
      console.log(`Total Products: ${result.totalProducts}`);
      console.log(`Total Processed: ${result.totalProcessed}`);
      console.log(`Errors: ${result.errors.length}`);
      
      if (result.report) {
        console.log('\n=== REPORT ===');
        console.log(`Categories: ${Object.keys(result.report.summary.byCategory).length}`);
        console.log(`With Images: ${result.report.summary.withImages}`);
        console.log(`Own Brands: ${result.report.summary.ownBrands}`);
        console.log(`Expiring Soon: ${result.report.summary.expiringSoon}`);
      }

    } else if (command === 'store' && storeName) {
      const result = await populator.populateStoreProducts(storeName, {
        maxProductsPerQuery: 5,
        maxQueries: 3,
        includeImages: true,
        includeExpiry: true,
        saveToDatabase: true
      });

      console.log(`\n=== STORE POPULATION COMPLETE: ${storeName} ===`);
      console.log(`Success: ${result.success}`);
      console.log(`Total Products: ${result.totalProducts}`);
      console.log(`Total Processed: ${result.totalProcessed}`);
      console.log(`Errors: ${result.errors.length}`);

    } else {
      console.log('Usage:');
      console.log('  node populate-products.js populate          # Populate all products');
      console.log('  node populate-products.js store <store>     # Populate store-specific products');
      console.log('  Available stores: Tesco, Sainsbury\'s, Aldi, Lidl, Iceland');
    }

  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ProductPopulator;
