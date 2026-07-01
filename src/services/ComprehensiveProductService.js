/**
 * Comprehensive Product Service
 * Integrates OpenFoodFacts, categorization, image search, and expiry data
 */

const OpenFoodFactsService = require('./OpenFoodFactsService');
const ProductCategorizationService = require('./ProductCategorizationService');
const ImageSearchService = require('./ImageSearchService');
const ExpiryDataService = require('./ExpiryDataService');
const FirebaseService = require('./FirebaseService');
const logger = require('../utils/logger');

class ComprehensiveProductService {
  constructor() {
    this.openFoodFacts = new OpenFoodFactsService();
    this.categorization = new ProductCategorizationService();
    this.imageSearch = new ImageSearchService();
    this.expiryData = new ExpiryDataService();
    this.firebase = FirebaseService;
  }

  /**
   * Search and process products from OpenFoodFacts
   */
  async searchAndProcessProducts(query, options = {}) {
    try {
      const {
        page = 1,
        pageSize = 20,
        storeName = null,
        includeImages = true,
        includeExpiry = true,
        saveToDatabase = false
      } = options;

      logger.info(`Searching products: ${query} for store: ${storeName || 'all'}`);

      // Step 1: Search OpenFoodFacts
      const searchResults = await this.openFoodFacts.searchProductsWithImages(
        query, 
        page, 
        pageSize
      );

      if (!searchResults.products || searchResults.products.length === 0) {
        logger.warn(`No products found for query: ${query}`);
        return {
          products: [],
          total: 0,
          processed: 0,
          errors: []
        };
      }

      logger.info(`Found ${searchResults.products.length} products from OpenFoodFacts`);

      // Step 2: Categorize products
      const categorizedProducts = this.categorization.processProducts(
        searchResults.products, 
        storeName
      );

      logger.info(`Categorized ${categorizedProducts.length} products`);

      // Step 3: Add expiry data
      let processedProducts = categorizedProducts;
      if (includeExpiry) {
        processedProducts = this.expiryData.processProductsWithExpiry(categorizedProducts);
        logger.info(`Added expiry data to ${processedProducts.length} products`);
      }

      // Step 4: Search for images if needed
      if (includeImages) {
        const productsNeedingImages = processedProducts.filter(p => !p.imageUrl);
        if (productsNeedingImages.length > 0) {
          logger.info(`Searching for images for ${productsNeedingImages.length} products`);
          const productsWithImages = await this.imageSearch.processProductsWithImages(
            productsNeedingImages
          );
          
          // Merge image search results back
          processedProducts = processedProducts.map(product => {
            if (!product.imageUrl) {
              const imageResult = productsWithImages.find(p => p.name === product.name);
              if (imageResult) {
                return {
                  ...product,
                  imageUrl: imageResult.imageUrl,
                  imageSearch: imageResult.imageSearch
                };
              }
            }
            return product;
          });
        }
      }

      // Step 5: Save to database if requested
      if (saveToDatabase) {
        await this.saveProductsToDatabase(processedProducts, storeName);
      }

      // Step 6: Generate statistics
      const stats = this.generateStatistics(processedProducts);

      return {
        products: processedProducts,
        total: searchResults.total,
        processed: processedProducts.length,
        statistics: stats,
        errors: []
      };

    } catch (error) {
      logger.error('Product search and processing failed:', error);
      return {
        products: [],
        total: 0,
        processed: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Search products by category
   */
  async searchProductsByCategory(category, options = {}) {
    try {
      const {
        page = 1,
        pageSize = 20,
        storeName = null,
        includeImages = true,
        includeExpiry = true,
        saveToDatabase = false
      } = options;

      logger.info(`Searching products by category: ${category}`);

      // Search OpenFoodFacts by category
      const searchResults = await this.openFoodFacts.searchByCategory(
        category, 
        page, 
        pageSize
      );

      if (!searchResults.products || searchResults.products.length === 0) {
        return {
          products: [],
          total: 0,
          processed: 0,
          errors: []
        };
      }

      // Process the products
      const processedProducts = searchResults.products.map(product => 
        this.openFoodFacts.processProductData({ product })
      );

      return await this.processProducts(processedProducts, {
        storeName,
        includeImages,
        includeExpiry,
        saveToDatabase
      });

    } catch (error) {
      logger.error('Category search failed:', error);
      return {
        products: [],
        total: 0,
        processed: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Process products with all services
   */
  async processProducts(products, options = {}) {
    const {
      storeName = null,
      includeImages = true,
      includeExpiry = true,
      saveToDatabase = false
    } = options;

    try {
      // Categorize products
      const categorizedProducts = this.categorization.processProducts(products, storeName);

      // Add expiry data
      let processedProducts = categorizedProducts;
      if (includeExpiry) {
        processedProducts = this.expiryData.processProductsWithExpiry(categorizedProducts);
      }

      // Search for images if needed
      if (includeImages) {
        const productsNeedingImages = processedProducts.filter(p => !p.imageUrl);
        if (productsNeedingImages.length > 0) {
          const productsWithImages = await this.imageSearch.processProductsWithImages(
            productsNeedingImages
          );
          
          // Merge image search results
          processedProducts = processedProducts.map(product => {
            if (!product.imageUrl) {
              const imageResult = productsWithImages.find(p => p.name === product.name);
              if (imageResult) {
                return {
                  ...product,
                  imageUrl: imageResult.imageUrl,
                  imageSearch: imageResult.imageSearch
                };
              }
            }
            return product;
          });
        }
      }

      // Save to database if requested
      if (saveToDatabase) {
        await this.saveProductsToDatabase(processedProducts, storeName);
      }

      return {
        products: processedProducts,
        total: processedProducts.length,
        processed: processedProducts.length,
        statistics: this.generateStatistics(processedProducts),
        errors: []
      };

    } catch (error) {
      logger.error('Product processing failed:', error);
      return {
        products: [],
        total: 0,
        processed: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Save products to database
   */
  async saveProductsToDatabase(products, storeName = null) {
    try {
      await this.firebase.initialize();

      const batch = [];
      const productIds = [];

      for (const product of products) {
        // Save main product
        const productRef = this.firebase.db.collection('products').doc();
        const productData = {
          name: product.name,
          brand: product.brand,
          barcode: product.barcode,
          category: product.categorization?.category || 'Uncategorized',
          subcategory: product.categorization?.subcategory || 'General',
          genericType: product.genericType,
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
          expiry: product.expiry || {},
          ownBrand: product.ownBrand || {},
          imageSearch: product.imageSearch || {},
          source: product.source || 'comprehensive_service',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        batch.push({
          ref: productRef,
          data: productData
        });
        productIds.push(productRef.id);

        // Save store-specific product if store name provided
        if (storeName) {
          const storeProductRef = this.firebase.db.collection('store_products').doc();
          const storeProductData = {
            productId: productRef.id,
            storeName: storeName,
            storeId: this.getStoreId(storeName),
            price: 0, // Will be updated by scraping
            availability: 'unknown',
            isActive: true,
            source: 'comprehensive_service',
            createdAt: new Date(),
            updatedAt: new Date()
          };

          batch.push({
            ref: storeProductRef,
            data: storeProductData
          });
        }
      }

      // Commit batch
      const firestore = this.firebase.db;
      const batchWrite = firestore.batch();

      for (const item of batch) {
        batchWrite.set(item.ref, item.data);
      }

      await batchWrite.commit();
      logger.info(`Saved ${products.length} products to database`);

      return productIds;

    } catch (error) {
      logger.error('Failed to save products to database:', error);
      throw error;
    }
  }

  /**
   * Get store ID from store name
   */
  getStoreId(storeName) {
    const storeIds = {
      'Tesco': 'tesco-uxbridge',
      'Sainsbury\'s': 'sainsburys-uxbridge',
      'Aldi': 'aldi-uxbridge',
      'Lidl': 'lidl-uxbridge',
      'Iceland': 'iceland-uxbridge'
    };
    return storeIds[storeName] || storeName.toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * Generate statistics for processed products
   */
  generateStatistics(products) {
    const stats = {
      total: products.length,
      withImages: products.filter(p => p.imageUrl).length,
      withExpiryData: products.filter(p => p.expiry).length,
      ownBrands: products.filter(p => p.ownBrand?.isOwnBrand).length,
      byCategory: {},
      byStorage: {},
      expiringSoon: 0
    };

    // Category statistics
    products.forEach(product => {
      const category = product.categorization?.category || 'Uncategorized';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    });

    // Storage statistics
    products.forEach(product => {
      if (product.expiry?.expiryInfo?.storage) {
        const storage = product.expiry.expiryInfo.storage;
        stats.byStorage[storage] = (stats.byStorage[storage] || 0) + 1;
      }
    });

    // Expiring soon count
    stats.expiringSoon = products.filter(p => p.expiry?.isExpiringSoon).length;

    return stats;
  }

  /**
   * Get own-brand products
   */
  getOwnBrandProducts(products, storeName = null) {
    return this.categorization.getOwnBrandProducts(products, storeName);
  }

  /**
   * Get products by category
   */
  getProductsByCategory(products, category) {
    return this.categorization.getProductsByCategory(products, category);
  }

  /**
   * Get products expiring soon
   */
  getExpiringSoonProducts(products, daysThreshold = 3) {
    return this.expiryData.getExpiringSoonProducts(products, daysThreshold);
  }

  /**
   * Search for specific product types (generic, no brand)
   */
  searchGenericProducts(products, productType) {
    return products.filter(product => 
      product.genericType && 
      product.genericType.toLowerCase().includes(productType.toLowerCase())
    );
  }

  /**
   * Get comprehensive product report
   */
  async getProductReport(products) {
    const stats = this.generateStatistics(products);
    const ownBrands = this.getOwnBrandProducts(products);
    const expiringSoon = this.getExpiringSoonProducts(products);
    
    return {
      summary: stats,
      ownBrands: {
        count: ownBrands.length,
        products: ownBrands.map(p => ({
          name: p.name,
          brand: p.ownBrand.brand,
          category: p.ownBrand.category,
          store: p.ownBrand.store
        }))
      },
      expiringSoon: {
        count: expiringSoon.length,
        products: expiringSoon.map(p => ({
          name: p.name,
          expiryDate: p.expiry?.expiryDate,
          daysUntilExpiry: p.expiry?.daysUntilExpiry
        }))
      },
      categories: Object.entries(stats.byCategory).map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / stats.total) * 100)
      }))
    };
  }
}

module.exports = ComprehensiveProductService;
