/**
 * Shopping List Service
 * Manages shopping lists and haul confirmation
 */

const firebaseService = require('./FirebaseService');
const logger = require('../utils/logger');

class ShoppingListService {
  constructor() {
    this.firebaseService = firebaseService;
  }

  async init() {
    try {
      await this.firebaseService.initialize();
      logger.info('Shopping List Service initialized');
    } catch (error) {
      logger.error('Failed to initialize Shopping List Service:', error);
      throw error;
    }
  }

  /**
   * Create a new shopping list
   */
  async createShoppingList(userId, listName, items = []) {
    try {
      const shoppingList = {
        userId,
        name: listName,
        items: items.map(item => ({
          ...item,
          id: this.generateId(),
          addedDate: new Date(),
          completed: false
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active' // active, completed, cancelled
      };

      const listId = await this.firebaseService.saveShoppingList(shoppingList);
      logger.info(`Created shopping list: ${listName} for user ${userId}`);
      
      return { ...shoppingList, id: listId };
    } catch (error) {
      logger.error('Failed to create shopping list:', error);
      throw error;
    }
  }

  /**
   * Get user's shopping lists
   */
  async getShoppingLists(userId, status = 'active') {
    try {
      const lists = await this.firebaseService.getShoppingLists(userId, status);
      return lists;
    } catch (error) {
      logger.error('Failed to get shopping lists:', error);
      throw error;
    }
  }

  /**
   * Add item to shopping list
   */
  async addItemToList(listId, item) {
    try {
      const list = await this.firebaseService.getShoppingList(listId);
      if (!list) {
        throw new Error('Shopping list not found');
      }

      const newItem = {
        ...item,
        id: this.generateId(),
        addedDate: new Date(),
        completed: false
      };

      list.items.push(newItem);
      list.updatedAt = new Date();

      await this.firebaseService.updateShoppingList(listId, list);
      logger.info(`Added item to shopping list: ${item.name}`);
      
      return newItem;
    } catch (error) {
      logger.error('Failed to add item to shopping list:', error);
      throw error;
    }
  }

  /**
   * Mark item as completed
   */
  async markItemCompleted(listId, itemId) {
    try {
      const list = await this.firebaseService.getShoppingList(listId);
      if (!list) {
        throw new Error('Shopping list not found');
      }

      const item = list.items.find(i => i.id === itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      item.completed = true;
      item.completedDate = new Date();
      list.updatedAt = new Date();

      await this.firebaseService.updateShoppingList(listId, list);
      logger.info(`Marked item as completed: ${item.name}`);
      
      return item;
    } catch (error) {
      logger.error('Failed to mark item as completed:', error);
      throw error;
    }
  }

  /**
   * Confirm haul - move completed items to pantry
   */
  async confirmHaul(listId, userId, storeId) {
    try {
      const list = await this.firebaseService.getShoppingList(listId);
      if (!list) {
        throw new Error('Shopping list not found');
      }

      const completedItems = list.items.filter(item => item.completed);
      if (completedItems.length === 0) {
        throw new Error('No completed items to confirm');
      }

      const pantryItems = [];
      
      for (const item of completedItems) {
        try {
          // Calculate expiry date based on category
          const expiryDate = this.calculateExpiryDate(item.category);
          
          const pantryItem = {
            userId,
            productId: item.productId || this.generateId(),
            productName: item.name,
            brand: item.brand || 'Unknown',
            category: item.category || 'general',
            quantity: item.quantity || 1,
            expiryDate: expiryDate,
            addedDate: new Date(),
            source: 'shopping_list',
            storeId: storeId,
            shoppingListId: listId
          };
          
          const pantryId = await this.firebaseService.savePantryItem(pantryItem);
          pantryItems.push({ ...pantryItem, id: pantryId });
          
        } catch (error) {
          logger.warn(`Failed to add item to pantry: ${item.name}`, error.message);
        }
      }

      // Update shopping list status
      list.status = 'completed';
      list.completedAt = new Date();
      list.updatedAt = new Date();

      await this.firebaseService.updateShoppingList(listId, list);
      
      logger.info(`Confirmed haul: ${pantryItems.length} items added to pantry`);
      
      return {
        shoppingList: list,
        pantryItems: pantryItems,
        confirmedCount: pantryItems.length
      };
      
    } catch (error) {
      logger.error('Failed to confirm haul:', error);
      throw error;
    }
  }

  /**
   * Get shopping list with store recommendations
   */
  async getShoppingListWithStores(listId, userLatitude, userLongitude) {
    try {
      const list = await this.firebaseService.getShoppingList(listId);
      if (!list) {
        throw new Error('Shopping list not found');
      }

      // Get nearby stores
      const { getStoresNearby } = require('../data/realStores');
      const nearbyStores = getStoresNearby(userLatitude, userLongitude, 5000);

      // Get store-specific products for each item
      const itemsWithStores = [];
      
      for (const item of list.items) {
        if (!item.completed) {
          const storeProducts = await this.findItemInStores(item, nearbyStores);
          itemsWithStores.push({
            ...item,
            availableInStores: storeProducts
          });
        } else {
          itemsWithStores.push(item);
        }
      }

      return {
        ...list,
        items: itemsWithStores,
        nearbyStores: nearbyStores
      };
      
    } catch (error) {
      logger.error('Failed to get shopping list with stores:', error);
      throw error;
    }
  }

  /**
   * Find item in nearby stores
   */
  async findItemInStores(item, stores) {
    const storeProducts = [];
    
    for (const store of stores) {
      try {
        // Search for similar products in this store
        const products = await this.firebaseService.searchProducts(item.name, 3);
        const storeProducts = products.filter(p => p.storeId === store.id);
        
        if (storeProducts.length > 0) {
          storeProducts.push({
            store: store,
            products: storeProducts,
            bestPrice: Math.min(...storeProducts.map(p => p.price || Infinity))
          });
        }
      } catch (error) {
        logger.warn(`Failed to search products in store ${store.name}:`, error.message);
      }
    }
    
    return storeProducts;
  }

  /**
   * Calculate expiry date based on product category
   */
  calculateExpiryDate(category) {
    const now = new Date();
    const expiryDate = new Date(now);
    
    switch (category) {
      case 'fresh-produce':
        expiryDate.setDate(now.getDate() + 7); // 7 days
        break;
      case 'dairy':
        expiryDate.setDate(now.getDate() + 5); // 5 days
        break;
      case 'bakery':
        expiryDate.setDate(now.getDate() + 3); // 3 days
        break;
      case 'meat':
        expiryDate.setDate(now.getDate() + 2); // 2 days
        break;
      default:
        expiryDate.setDate(now.getDate() + 14); // 14 days default
    }
    
    return expiryDate;
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

module.exports = ShoppingListService;

