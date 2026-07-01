/**
 * Two Basket Service
 * Segregates products into available vs unavailable baskets
 * Handles two separate confirm haul processes
 */

const firebaseService = require('./FirebaseService');
const logger = require('../utils/logger');
const { getStoresNearby } = require('../data/realStores');

class TwoBasketService {
  constructor() {
    this.firebaseService = firebaseService;
  }

  async init() {
    await this.firebaseService.initialize();
    logger.info('Two Basket Service initialized');
  }

  /**
   * Segregate shopping list into two baskets based on availability
   * Only creates two baskets if products are split across multiple stores
   */
  async segregateIntoTwoBaskets(shoppingList, userLatitude, userLongitude) {
    try {
      logger.info('Segregating shopping list into two baskets');
      
      // Get nearby stores
      const nearbyStores = getStoresNearby(userLatitude, userLongitude, 5000);
      const primaryStore = nearbyStores[0]; // Closest store
      
      const basket1 = []; // Available in primary store
      const basket2 = []; // Available in other stores
      const unavailable = []; // Not available anywhere
      
      for (const item of shoppingList.items) {
        if (item.completed) continue;
        
        // Check availability in primary store
        const primaryStoreProducts = await this.findItemInStore(item, primaryStore);
        
        if (primaryStoreProducts.length > 0) {
          // Available in primary store - Basket 1
          basket1.push({
            ...item,
            storeProducts: primaryStoreProducts,
            primaryStore: primaryStore,
            basket: 'primary'
          });
        } else {
          // Check other stores
          const otherStoreProducts = await this.findItemInOtherStores(item, nearbyStores.slice(1));
          
          if (otherStoreProducts.length > 0) {
            // Available in other stores - Basket 2
            basket2.push({
              ...item,
              storeProducts: otherStoreProducts,
              alternativeStores: otherStoreProducts.map(sp => sp.store),
              basket: 'secondary'
            });
          } else {
            // Not available anywhere - Manual entry
            unavailable.push({
              ...item,
              basket: 'manual',
              needsManualEntry: true
            });
          }
        }
      }
      
      // Calculate totals for each basket
      const basket1Total = this.calculateBasketTotal(basket1);
      const basket2Total = this.calculateBasketTotal(basket2);
      
      // Determine if we need two baskets or just one
      const needsTwoBaskets = basket1.length > 0 && basket2.length > 0;
      
      return {
        needsTwoBaskets: needsTwoBaskets,
        primaryStore: primaryStore,
        basket1: {
          items: basket1,
          total: basket1Total,
          store: primaryStore,
          count: basket1.length
        },
        basket2: {
          items: basket2,
          total: basket2Total,
          stores: [...new Set(basket2.map(item => item.alternativeStores).flat())],
          count: basket2.length
        },
        unavailable: {
          items: unavailable,
          count: unavailable.length
        },
        summary: {
          totalItems: shoppingList.items.filter(item => !item.completed).length,
          availableInPrimary: basket1.length,
          availableInSecondary: basket2.length,
          needsManualEntry: unavailable.length,
          canUseSingleStore: basket1.length === (shoppingList.items.filter(item => !item.completed).length - unavailable.length)
        }
      };
      
    } catch (error) {
      logger.error('Failed to segregate into two baskets:', error);
      throw error;
    }
  }

  /**
   * Find item in specific store
   */
  async findItemInStore(item, store) {
    try {
      const products = await this.firebaseService.searchProducts(item.name, 3);
      return products.filter(p => p.storeId === store.id);
    } catch (error) {
      logger.warn(`Failed to search products in store ${store.name}:`, error.message);
      return [];
    }
  }

  /**
   * Find item in other stores (excluding primary)
   */
  async findItemInOtherStores(item, otherStores) {
    const allProducts = [];
    
    for (const store of otherStores) {
      try {
        const products = await this.findItemInStore(item, store);
        allProducts.push(...products);
      } catch (error) {
        logger.warn(`Failed to search in store ${store.name}:`, error.message);
      }
    }
    
    return allProducts;
  }

  /**
   * Calculate total for a basket
   */
  calculateBasketTotal(basketItems) {
    return basketItems.reduce((total, item) => {
      if (item.storeProducts && item.storeProducts.length > 0) {
        const bestPrice = Math.min(...item.storeProducts.map(p => p.price || 0));
        return total + (bestPrice * (item.quantity || 1));
      }
      return total;
    }, 0);
  }

  /**
   * Confirm haul for primary basket
   */
  async confirmPrimaryHaul(basket1Items, userId, storeId) {
    try {
      logger.info(`Confirming primary haul: ${basket1Items.length} items`);
      
      const confirmedItems = [];
      
      for (const item of basket1Items) {
        if (item.checked) {
          // Add to pantry
          const pantryItem = {
            userId,
            productId: item.id,
            productName: item.name,
            brand: item.brand || 'Unknown',
            category: item.category || 'general',
            quantity: item.quantity || 1,
            expiryDate: this.calculateExpiryDate(item.category),
            addedDate: new Date(),
            source: 'shopping_list',
            storeId: storeId,
            storeName: item.primaryStore.name
          };
          
          const pantryId = await this.firebaseService.savePantryItem(pantryItem);
          confirmedItems.push({ ...pantryItem, id: pantryId });
        }
      }
      
      return {
        confirmedItems,
        count: confirmedItems.length,
        store: storeId
      };
      
    } catch (error) {
      logger.error('Failed to confirm primary haul:', error);
      throw error;
    }
  }

  /**
   * Confirm haul for secondary basket
   */
  async confirmSecondaryHaul(basket2Items, userId, selectedStoreId) {
    try {
      logger.info(`Confirming secondary haul: ${basket2Items.length} items`);
      
      const confirmedItems = [];
      
      for (const item of basket2Items) {
        if (item.checked) {
          // Find the selected store product
          const selectedStoreProduct = item.storeProducts.find(sp => sp.storeId === selectedStoreId);
          
          if (selectedStoreProduct) {
            const pantryItem = {
              userId,
              productId: item.id,
              productName: item.name,
              brand: item.brand || 'Unknown',
              category: item.category || 'general',
              quantity: item.quantity || 1,
              expiryDate: this.calculateExpiryDate(item.category),
              addedDate: new Date(),
              source: 'shopping_list',
              storeId: selectedStoreId,
              storeName: selectedStoreProduct.storeName
            };
            
            const pantryId = await this.firebaseService.savePantryItem(pantryItem);
            confirmedItems.push({ ...pantryItem, id: pantryId });
          }
        }
      }
      
      return {
        confirmedItems,
        count: confirmedItems.length,
        store: selectedStoreId
      };
      
    } catch (error) {
      logger.error('Failed to confirm secondary haul:', error);
      throw error;
    }
  }

  /**
   * Handle manual entry for unavailable products
   */
  async handleManualEntry(unavailableItems, userId, storeId, storeName) {
    try {
      logger.info(`Handling manual entry: ${unavailableItems.length} items`);
      
      const manualEntries = [];
      
      for (const item of unavailableItems) {
        if (item.checked && item.manualPrice && item.manualStore) {
          // Add to pantry with manual data
          const pantryItem = {
            userId,
            productId: item.id,
            productName: item.name,
            brand: item.brand || 'Unknown',
            category: item.category || 'general',
            quantity: item.quantity || 1,
            price: item.manualPrice,
            expiryDate: this.calculateExpiryDate(item.category),
            addedDate: new Date(),
            source: 'manual_entry',
            storeId: storeId,
            storeName: storeName,
            isManualEntry: true
          };
          
          const pantryId = await this.firebaseService.savePantryItem(pantryItem);
          manualEntries.push({ ...pantryItem, id: pantryId });
          
          // Update product database with new location
          await this.updateProductLocation(item.name, storeId, item.manualPrice);
        }
      }
      
      return {
        manualEntries,
        count: manualEntries.length,
        store: storeId
      };
      
    } catch (error) {
      logger.error('Failed to handle manual entry:', error);
      throw error;
    }
  }

  /**
   * Update product location in database
   */
  async updateProductLocation(productName, storeId, price) {
    try {
      const storeProduct = {
        storeId: storeId,
        productName: productName,
        price: price,
        availability: 'in_stock',
        lastChecked: new Date(),
        isActive: true,
        source: 'manual_entry'
      };
      
      await this.firebaseService.db.collection('store_products').add(storeProduct);
      logger.info(`Updated product location: ${productName} at store ${storeId}`);
      
    } catch (error) {
      logger.warn(`Failed to update product location: ${productName}`, error.message);
    }
  }

  /**
   * Calculate expiry date based on category
   */
  calculateExpiryDate(category) {
    const now = new Date();
    const expiryDate = new Date(now);
    
    switch (category) {
      case 'fresh-produce':
        expiryDate.setDate(now.getDate() + 7);
        break;
      case 'dairy':
        expiryDate.setDate(now.getDate() + 5);
        break;
      case 'bakery':
        expiryDate.setDate(now.getDate() + 3);
        break;
      case 'meat':
        expiryDate.setDate(now.getDate() + 2);
        break;
      default:
        expiryDate.setDate(now.getDate() + 14);
    }
    
    return expiryDate;
  }
}

module.exports = new TwoBasketService();
