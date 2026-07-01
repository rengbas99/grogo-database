/**
 * Firebase service for storing scraped data
 */

const admin = require('firebase-admin');
const logger = require('../utils/logger');

class FirebaseService {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Initialize Firebase Admin SDK
      if (!admin.apps.length) {
        const serviceAccount = require('../../config/firebase-service-account.json');
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
      }

      this.db = admin.firestore();
      this.initialized = true;
      
      logger.info('Firebase service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Firebase service:', error);
      throw error;
    }
  }

  async saveProduct(productData) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const productRef = this.db.collection('products').doc();
      await productRef.set({
        ...productData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info(`Product saved: ${productData.name}`);
      return productRef.id;
    } catch (error) {
      logger.error('Failed to save product:', error);
      throw error;
    }
  }

  async saveStoreProduct(storeProductData) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const storeProductRef = this.db.collection('store_products').doc();
      await storeProductRef.set({
        ...storeProductData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info(`Store product saved: ${storeProductData.storeName} - ${storeProductData.productId}`);
      return storeProductRef.id;
    } catch (error) {
      logger.error('Failed to save store product:', error);
      throw error;
    }
  }

  async saveScrapedData(scrapedData) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const batch = this.db.batch();
      const productIds = [];

      for (const item of scrapedData) {
        // Save product
        const productRef = this.db.collection('products').doc();
        batch.set(productRef, {
          ...item.product,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        productIds.push(productRef.id);

        // Save store product with product ID
        const storeProductRef = this.db.collection('store_products').doc();
        batch.set(storeProductRef, {
          ...item.storeProduct,
          productId: productRef.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      await batch.commit();
      logger.info(`Saved ${scrapedData.length} products and store products`);
      return productIds;
    } catch (error) {
      logger.error('Failed to save scraped data:', error);
      throw error;
    }
  }

  async updateProductPrice(productId, newPrice, storeId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Update store product price
      const storeProductQuery = this.db.collection('store_products')
        .where('productId', '==', productId)
        .where('storeId', '==', storeId);

      const snapshot = await storeProductQuery.get();
      
      if (snapshot.empty) {
        logger.warn(`No store product found for product ${productId} in store ${storeId}`);
        return false;
      }

      const batch = this.db.batch();
      
      snapshot.forEach(doc => {
        const storeProductRef = this.db.collection('store_products').doc(doc.id);
        batch.update(storeProductRef, {
          price: newPrice,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      logger.info(`Updated price for product ${productId} in store ${storeId}: £${newPrice}`);
      return true;
    } catch (error) {
      logger.error('Failed to update product price:', error);
      throw error;
    }
  }

  async getProductsByCategory(category, limit = 50) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const snapshot = await this.db.collection('products')
        .where('category', '==', category)
        .limit(limit)
        .get();

      const products = [];
      snapshot.forEach(doc => {
        products.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return products;
    } catch (error) {
      logger.error('Failed to get products by category:', error);
      throw error;
    }
  }

  async getStoreProducts(storeId, limit = 100) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const snapshot = await this.db.collection('store_products')
        .where('storeId', '==', storeId)
        .where('isActive', '==', true)
        .limit(limit)
        .get();

      const storeProducts = [];
      snapshot.forEach(doc => {
        storeProducts.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return storeProducts;
    } catch (error) {
      logger.error('Failed to get store products:', error);
      throw error;
    }
  }

  async searchProducts(searchTerm, limit = 20) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Simple text search - in production, you'd want to use Algolia or similar
      const snapshot = await this.db.collection('products')
        .limit(limit)
        .get();

      const products = [];
      const searchLower = searchTerm.toLowerCase();

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.name && data.brand) {
          if (data.name.toLowerCase().includes(searchLower) || 
              data.brand.toLowerCase().includes(searchLower)) {
            products.push({
              id: doc.id,
              ...data
            });
          }
        }
      });

      return products;
    } catch (error) {
      logger.error('Failed to search products:', error);
      throw error;
    }
  }

  async getPriceHistory(productId, storeId, days = 30) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const snapshot = await this.db.collection('price_history')
        .where('productId', '==', productId)
        .where('storeId', '==', storeId)
        .where('date', '>=', startDate)
        .orderBy('date', 'desc')
        .get();

      const priceHistory = [];
      snapshot.forEach(doc => {
        priceHistory.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return priceHistory;
    } catch (error) {
      logger.error('Failed to get price history:', error);
      throw error;
    }
  }

  async savePriceHistory(productId, storeId, price) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const priceHistoryRef = this.db.collection('price_history').doc();
      await priceHistoryRef.set({
        productId,
        storeId,
        price,
        date: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info(`Price history saved: ${productId} - ${storeId} - £${price}`);
    } catch (error) {
      logger.error('Failed to save price history:', error);
      throw error;
    }
  }

  // Pantry methods
  async savePantryItem(pantryItem) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const pantryRef = this.db.collection('pantry_items').doc();
      await pantryRef.set({
        ...pantryItem,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info(`Pantry item saved: ${pantryItem.productName}`);
      return pantryRef.id;
    } catch (error) {
      logger.error('Failed to save pantry item:', error);
      throw error;
    }
  }

  async getPantryItems(userId, limit = 50) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const snapshot = await this.db.collection('pantry_items')
        .where('userId', '==', userId)
        .limit(limit)
        .get();

      const pantryItems = [];
      snapshot.forEach(doc => {
        pantryItems.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return pantryItems;
    } catch (error) {
      logger.error('Failed to get pantry items:', error);
      throw error;
    }
  }

  // Shopping list methods
  async saveShoppingList(shoppingList) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const listRef = this.db.collection('shopping_lists').doc();
      await listRef.set({
        ...shoppingList,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info(`Shopping list saved: ${shoppingList.name}`);
      return listRef.id;
    } catch (error) {
      logger.error('Failed to save shopping list:', error);
      throw error;
    }
  }

  async getShoppingLists(userId, status = 'active') {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const snapshot = await this.db.collection('shopping_lists')
        .where('userId', '==', userId)
        .where('status', '==', status)
        .orderBy('updatedAt', 'desc')
        .get();

      const shoppingLists = [];
      snapshot.forEach(doc => {
        shoppingLists.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return shoppingLists;
    } catch (error) {
      logger.error('Failed to get shopping lists:', error);
      throw error;
    }
  }

  async getShoppingList(listId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const doc = await this.db.collection('shopping_lists').doc(listId).get();
      
      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      logger.error('Failed to get shopping list:', error);
      throw error;
    }
  }

  async updateShoppingList(listId, shoppingList) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      await this.db.collection('shopping_lists').doc(listId).update({
        ...shoppingList,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info(`Shopping list updated: ${listId}`);
    } catch (error) {
      logger.error('Failed to update shopping list:', error);
      throw error;
    }
  }
}

module.exports = new FirebaseService();
