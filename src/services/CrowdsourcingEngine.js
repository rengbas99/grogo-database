/**
 * Crowdsourcing Engine
 * Leverage OCR receipt scanning to build real product database
 */

const firebaseService = require('./FirebaseService');
const logger = require('../utils/logger');

class CrowdsourcingEngine {
  constructor() {
    this.firebaseService = firebaseService;
  }

  async init() {
    await this.firebaseService.initialize();
    logger.info('Crowdsourcing Engine initialized');
  }

  /**
   * Process receipt scan and extract price observations
   */
  async processReceiptScan(receiptData, userId, storeId, location) {
    try {
      console.log('📱 PROCESSING RECEIPT SCAN FOR CROWDSOURCING');
      console.log('='.repeat(60));
      
      const priceObservations = [];
      
      // Extract products from receipt
      const products = receiptData.products || [];
      
      for (const product of products) {
        const observation = {
          userId: userId,
          storeId: storeId,
          storeName: this.getStoreName(storeId),
          location: location,
          productName: product.name,
          productBrand: product.brand,
          price: product.price,
          quantity: product.quantity || 1,
          category: product.category,
          timestamp: new Date(),
          source: 'receipt_scan',
          confidence: product.confidence || 0.8,
          isVerified: true // Receipt data is verified
        };
        
        priceObservations.push(observation);
        
        console.log(`   📦 ${product.name} - £${product.price} at ${this.getStoreName(storeId)}`);
      }
      
      // Save price observations
      await this.savePriceObservations(priceObservations);
      
      // Update product database
      await this.updateProductDatabase(priceObservations);
      
      console.log(`\n✅ Processed ${priceObservations.length} price observations`);
      console.log(`🏪 Store: ${this.getStoreName(storeId)}`);
      console.log(`📍 Location: ${location}`);
      console.log(`⏰ Timestamp: ${new Date().toLocaleString()}`);
      
      return priceObservations;
      
    } catch (error) {
      logger.error('Failed to process receipt scan:', error);
      throw error;
    }
  }

  /**
   * Save price observations to database
   */
  async savePriceObservations(observations) {
    try {
      const batch = [];
      
      for (const observation of observations) {
        const ref = this.firebaseService.db.collection('price_observations').doc();
        batch.push({
          ref: ref,
          data: {
            ...observation,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }
      
      // Commit batch
      const firestore = this.firebaseService.db;
      const batchWrite = firestore.batch();
      
      for (const item of batch) {
        batchWrite.set(item.ref, item.data);
      }
      
      await batchWrite.commit();
      logger.info(`Saved ${observations.length} price observations`);
      
    } catch (error) {
      logger.error('Failed to save price observations:', error);
      throw error;
    }
  }

  /**
   * Update product database with crowdsourced data
   */
  async updateProductDatabase(observations) {
    try {
      for (const observation of observations) {
        // Check if product exists
        const existingProduct = await this.findExistingProduct(observation.productName, observation.storeId);
        
        if (existingProduct) {
          // Update existing product with new price
          await this.updateProductPrice(existingProduct.id, observation);
        } else {
          // Create new product
          await this.createNewProduct(observation);
        }
      }
    } catch (error) {
      logger.error('Failed to update product database:', error);
      throw error;
    }
  }

  /**
   * Find existing product
   */
  async findExistingProduct(productName, storeId) {
    try {
      const snapshot = await this.firebaseService.db.collection('products')
        .where('name', '==', productName)
        .where('storeId', '==', storeId)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
      }
      
      return null;
    } catch (error) {
      logger.warn('Failed to find existing product:', error.message);
      return null;
    }
  }

  /**
   * Update product price
   */
  async updateProductPrice(productId, observation) {
    try {
      // Save price history
      await this.firebaseService.db.collection('price_history').add({
        productId: productId,
        storeId: observation.storeId,
        price: observation.price,
        timestamp: observation.timestamp,
        source: 'crowdsourced',
        userId: observation.userId,
        confidence: observation.confidence
      });
      
      // Update current price
      await this.firebaseService.db.collection('products').doc(productId).update({
        currentPrice: observation.price,
        lastUpdated: observation.timestamp,
        priceSource: 'crowdsourced',
        priceConfidence: observation.confidence
      });
      
      logger.info(`Updated price for product ${productId}: £${observation.price}`);
      
    } catch (error) {
      logger.error('Failed to update product price:', error);
    }
  }

  /**
   * Create new product
   */
  async createNewProduct(observation) {
    try {
      const productRef = this.firebaseService.db.collection('products').add({
        name: observation.productName,
        brand: observation.productBrand,
        category: observation.category,
        storeId: observation.storeId,
        storeName: observation.storeName,
        currentPrice: observation.price,
        priceSource: 'crowdsourced',
        priceConfidence: observation.confidence,
        lastUpdated: observation.timestamp,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      logger.info(`Created new product: ${observation.productName}`);
      
    } catch (error) {
      logger.error('Failed to create new product:', error);
    }
  }

  /**
   * Get price data for a product
   */
  async getProductPriceData(productName, storeId, limit = 10) {
    try {
      const snapshot = await this.firebaseService.db.collection('price_observations')
        .where('productName', '==', productName)
        .where('storeId', '==', storeId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
      
      const priceData = [];
      snapshot.forEach(doc => {
        priceData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return priceData;
      
    } catch (error) {
      logger.error('Failed to get product price data:', error);
      return [];
    }
  }

  /**
   * Get store price comparison
   */
  async getStorePriceComparison(productName, limit = 5) {
    try {
      const snapshot = await this.firebaseService.db.collection('price_observations')
        .where('productName', '==', productName)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();
      
      // Group by store and get latest price
      const storePrices = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        const storeId = data.storeId;
        
        if (!storePrices[storeId] || data.timestamp > storePrices[storeId].timestamp) {
          storePrices[storeId] = data;
        }
      });
      
      // Convert to array and sort by price
      const comparison = Object.values(storePrices)
        .sort((a, b) => a.price - b.price)
        .slice(0, limit);
      
      return comparison;
      
    } catch (error) {
      logger.error('Failed to get store price comparison:', error);
      return [];
    }
  }

  /**
   * Get crowdsourcing statistics
   */
  async getCrowdsourcingStats() {
    try {
      const stats = {
        totalObservations: 0,
        uniqueProducts: 0,
        stores: {},
        recentActivity: 0
      };
      
      // Get total observations
      const observationsSnapshot = await this.firebaseService.db.collection('price_observations').get();
      stats.totalObservations = observationsSnapshot.size;
      
      // Get unique products
      const productsSnapshot = await this.firebaseService.db.collection('products').get();
      stats.uniqueProducts = productsSnapshot.size;
      
      // Get store breakdown
      observationsSnapshot.forEach(doc => {
        const data = doc.data();
        const storeId = data.storeId;
        stats.stores[storeId] = (stats.stores[storeId] || 0) + 1;
      });
      
      // Get recent activity (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const recentSnapshot = await this.firebaseService.db.collection('price_observations')
        .where('timestamp', '>=', yesterday)
        .get();
      
      stats.recentActivity = recentSnapshot.size;
      
      return stats;
      
    } catch (error) {
      logger.error('Failed to get crowdsourcing stats:', error);
      return null;
    }
  }

  /**
   * Get store name from store ID
   */
  getStoreName(storeId) {
    const storeNames = {
      'tesco-uxbridge': 'Tesco Uxbridge',
      'sainsburys-uxbridge': 'Sainsbury\'s Uxbridge',
      'aldi-uxbridge': 'Aldi Uxbridge',
      'lidl-uxbridge': 'Lidl Uxbridge',
      'iceland-uxbridge': 'Iceland Uxbridge'
    };
    
    return storeNames[storeId] || 'Unknown Store';
  }
}

module.exports = CrowdsourcingEngine;

