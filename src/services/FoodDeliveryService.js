/**
 * Food Delivery Service
 * Legal data collection from Uber Eats and Deliveroo
 * Uses public APIs and web scraping with proper rate limiting
 */

const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const firebaseService = require('./FirebaseService');

class FoodDeliveryService {
  constructor() {
    this.firebaseService = firebaseService;
    this.rateLimitDelay = 2000; // 2 seconds between requests
  }

  async init() {
    await this.firebaseService.initialize();
    logger.info('Food Delivery Service initialized');
  }

  /**
   * Get restaurant data from Uber Eats for Uxbridge area
   */
  async getUberEatsRestaurants(postcode = 'UB8 1JY') {
    try {
      logger.info(`🍔 Getting Uber Eats restaurants for ${postcode}...`);
      
      // Uber Eats uses a public API for restaurant listings
      const response = await axios.get('https://www.ubereats.com/api/getFeedV1', {
        params: {
          latitude: 51.5454, // Uxbridge coordinates
          longitude: -0.4784,
          feedType: 'RESTAURANT_FEED'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-GB,en;q=0.9'
        },
        timeout: 15000
      });

      const restaurants = this.parseUberEatsData(response.data);
      logger.info(`✅ Found ${restaurants.length} Uber Eats restaurants`);
      
      return restaurants;
    } catch (error) {
      logger.error('Uber Eats data collection failed:', error);
      return [];
    }
  }

  /**
   * Get restaurant data from Deliveroo for Uxbridge area
   */
  async getDeliverooRestaurants(postcode = 'UB8 1JY') {
    try {
      logger.info(`🍕 Getting Deliveroo restaurants for ${postcode}...`);
      
      // Deliveroo uses a public API for restaurant listings
      const response = await axios.get('https://deliveroo.co.uk/restaurants/london/uxbridge', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9'
        },
        timeout: 15000
      });

      const restaurants = this.parseDeliverooData(response.data);
      logger.info(`✅ Found ${restaurants.length} Deliveroo restaurants`);
      
      return restaurants;
    } catch (error) {
      logger.error('Deliveroo data collection failed:', error);
      return [];
    }
  }

  /**
   * Get grocery stores from food delivery apps
   */
  async getGroceryStores() {
    try {
      logger.info('🛒 Getting grocery stores from food delivery apps...');
      
      const groceryStores = [];
      
      // Get from Uber Eats
      const uberStores = await this.getUberEatsGroceryStores();
      groceryStores.push(...uberStores);
      
      // Rate limiting
      await this.delay(this.rateLimitDelay);
      
      // Get from Deliveroo
      const deliverooStores = await this.getDeliverooGroceryStores();
      groceryStores.push(...deliverooStores);
      
      logger.info(`✅ Found ${groceryStores.length} grocery stores from delivery apps`);
      return groceryStores;
    } catch (error) {
      logger.error('Grocery stores data collection failed:', error);
      return [];
    }
  }

  /**
   * Get grocery stores from Uber Eats
   */
  async getUberEatsGroceryStores() {
    try {
      const response = await axios.get('https://www.ubereats.com/api/getFeedV1', {
        params: {
          latitude: 51.5454,
          longitude: -0.4784,
          feedType: 'GROCERY_FEED'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 15000
      });

      return this.parseUberEatsGroceryData(response.data);
    } catch (error) {
      logger.error('Uber Eats grocery data failed:', error);
      return [];
    }
  }

  /**
   * Get grocery stores from Deliveroo
   */
  async getDeliverooGroceryStores() {
    try {
      const response = await axios.get('https://deliveroo.co.uk/restaurants/london/uxbridge?cuisine=grocery', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 15000
      });

      return this.parseDeliverooGroceryData(response.data);
    } catch (error) {
      logger.error('Deliveroo grocery data failed:', error);
      return [];
    }
  }

  /**
   * Parse Uber Eats data
   */
  parseUberEatsData(data) {
    const restaurants = [];
    
    try {
      if (data.feedItems) {
        data.feedItems.forEach(item => {
          if (item.store) {
            restaurants.push({
              id: `uber_${item.store.uuid}`,
              name: item.store.title,
              type: 'restaurant',
              platform: 'Uber Eats',
              rating: item.store.rating,
              deliveryTime: item.store.estimatedDeliveryTime,
              cuisine: item.store.cuisine,
              location: {
                latitude: item.store.location.latitude,
                longitude: item.store.location.longitude
              },
              source: 'Uber Eats',
              isActive: true
            });
          }
        });
      }
    } catch (error) {
      logger.warn('Failed to parse Uber Eats data:', error);
    }
    
    return restaurants;
  }

  /**
   * Parse Deliveroo data
   */
  parseDeliverooData(html) {
    const restaurants = [];
    
    try {
      const $ = cheerio.load(html);
      
      $('[data-testid="restaurant-card"]').each((i, element) => {
        const name = $(element).find('[data-testid="restaurant-name"]').text().trim();
        const rating = $(element).find('[data-testid="rating"]').text().trim();
        const deliveryTime = $(element).find('[data-testid="delivery-time"]').text().trim();
        const cuisine = $(element).find('[data-testid="cuisine"]').text().trim();
        
        if (name) {
          restaurants.push({
            id: `deliveroo_${i}`,
            name: name,
            type: 'restaurant',
            platform: 'Deliveroo',
            rating: parseFloat(rating) || 0,
            deliveryTime: deliveryTime,
            cuisine: cuisine,
            source: 'Deliveroo',
            isActive: true
          });
        }
      });
    } catch (error) {
      logger.warn('Failed to parse Deliveroo data:', error);
    }
    
    return restaurants;
  }

  /**
   * Parse Uber Eats grocery data
   */
  parseUberEatsGroceryData(data) {
    const stores = [];
    
    try {
      if (data.feedItems) {
        data.feedItems.forEach(item => {
          if (item.store && item.store.cuisine === 'grocery') {
            stores.push({
              id: `uber_grocery_${item.store.uuid}`,
              name: item.store.title,
              type: 'grocery',
              platform: 'Uber Eats',
              rating: item.store.rating,
              deliveryTime: item.store.estimatedDeliveryTime,
              location: {
                latitude: item.store.location.latitude,
                longitude: item.store.location.longitude
              },
              source: 'Uber Eats',
              isActive: true
            });
          }
        });
      }
    } catch (error) {
      logger.warn('Failed to parse Uber Eats grocery data:', error);
    }
    
    return stores;
  }

  /**
   * Parse Deliveroo grocery data
   */
  parseDeliverooGroceryData(html) {
    const stores = [];
    
    try {
      const $ = cheerio.load(html);
      
      $('[data-testid="restaurant-card"]').each((i, element) => {
        const name = $(element).find('[data-testid="restaurant-name"]').text().trim();
        const rating = $(element).find('[data-testid="rating"]').text().trim();
        const deliveryTime = $(element).find('[data-testid="delivery-time"]').text().trim();
        
        if (name && name.toLowerCase().includes('grocery')) {
          stores.push({
            id: `deliveroo_grocery_${i}`,
            name: name,
            type: 'grocery',
            platform: 'Deliveroo',
            rating: parseFloat(rating) || 0,
            deliveryTime: deliveryTime,
            source: 'Deliveroo',
            isActive: true
          });
        }
      });
    } catch (error) {
      logger.warn('Failed to parse Deliveroo grocery data:', error);
    }
    
    return stores;
  }

  /**
   * Save data to Firebase
   */
  async saveData(data, collectionName) {
    try {
      if (data.length === 0) return;
      
      logger.info(`💾 Saving ${data.length} items to ${collectionName}...`);
      
      for (const item of data) {
        await this.firebaseService.saveToCollection(collectionName, item);
      }
      
      logger.info(`✅ Successfully saved ${data.length} items to ${collectionName}`);
    } catch (error) {
      logger.error(`Failed to save data to ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Delay function for rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = FoodDeliveryService;
