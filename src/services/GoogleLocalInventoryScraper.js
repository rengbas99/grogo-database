/**
 * Google Local Inventory Scraper
 * Scrapes Google's local inventory data for store-specific product availability
 * More reliable than direct store scraping - Google has already done the work
 */

const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const firebaseService = require('./FirebaseService');

class GoogleLocalInventoryScraper {
  constructor() {
    this.firebaseService = firebaseService;
    this.baseGoogleUrl = 'https://www.google.com/search';
    this.stores = [
      {
        id: 'tesco-uxbridge',
        name: 'Tesco Extra Uxbridge',
        address: 'High Street, Uxbridge UB8 1JY',
        searchTerms: ['Tesco Extra Uxbridge', 'Tesco Uxbridge']
      },
      {
        id: 'sainsburys-uxbridge',
        name: 'Sainsbury\'s Uxbridge',
        address: 'Chimes Centre, Uxbridge UB8 1QW',
        searchTerms: ['Sainsburys Uxbridge', 'Sainsbury\'s Uxbridge']
      },
      {
        id: 'aldi-uxbridge',
        name: 'Aldi Uxbridge',
        address: 'High Street, Uxbridge UB8 1JY',
        searchTerms: ['Aldi Uxbridge']
      },
      {
        id: 'lidl-uxbridge',
        name: 'Lidl Uxbridge',
        address: 'Rockingham Road, Uxbridge UB8 1LA',
        searchTerms: ['Lidl Uxbridge']
      },
      {
        id: 'iceland-uxbridge',
        name: 'Iceland Uxbridge',
        address: 'High Street, Uxbridge UB8 1LH',
        searchTerms: ['Iceland Uxbridge']
      }
    ];
    
    this.popularProducts = [
      'milk', 'bread', 'eggs', 'cheese', 'yogurt', 'butter',
      'chicken', 'beef', 'fish', 'apples', 'bananas', 'tomatoes',
      'onions', 'potatoes', 'rice', 'pasta', 'cereal', 'coffee',
      'tea', 'juice', 'water', 'coca cola', 'chocolate', 'cookies',
      'crisps', 'biscuits', 'soup', 'pasta sauce', 'olive oil',
      'salt', 'pepper', 'sugar', 'flour', 'baking powder'
    ];
  }

  async init() {
    await this.firebaseService.initialize();
    logger.info('Google Local Inventory Scraper initialized');
  }

  /**
   * Scrape local inventory for all stores
   */
  async scrapeAllLocalInventory() {
    try {
      logger.info('🔍 Starting Google local inventory scraping...');
      
      const allInventory = [];
      
      for (const store of this.stores) {
        try {
          logger.info(`🏪 Scraping local inventory for ${store.name}...`);
          const inventory = await this.scrapeStoreLocalInventory(store);
          allInventory.push(...inventory);
          
          // Rate limiting - be very respectful to Google
          await this.delay(5000); // 5 seconds between stores
        } catch (error) {
          logger.error(`Failed to scrape ${store.name}:`, error);
        }
      }
      
      logger.info(`✅ Scraped ${allInventory.length} total inventory items from all stores`);
      return allInventory;
    } catch (error) {
      logger.error('Failed to scrape all local inventory:', error);
      return [];
    }
  }

  /**
   * Scrape local inventory for a specific store
   */
  async scrapeStoreLocalInventory(store) {
    try {
      const inventory = [];
      
      // Search for popular products at this store
      for (const product of this.popularProducts.slice(0, 10)) { // Limit to first 10 for testing
        try {
          const productInventory = await this.searchProductAtStore(product, store);
          inventory.push(...productInventory);
          
          // Rate limiting - be very slow and respectful
          await this.delay(3000); // 3 seconds between products
        } catch (error) {
          logger.warn(`Failed to search for ${product} at ${store.name}:`, error.message);
        }
      }
      
      logger.info(`✅ Found ${inventory.length} inventory items for ${store.name}`);
      return inventory;
    } catch (error) {
      logger.error(`Failed to scrape local inventory for ${store.name}:`, error);
      return [];
    }
  }

  /**
   * Search for a specific product at a specific store
   */
  async searchProductAtStore(product, store) {
    try {
      const searchQuery = `${product} ${store.searchTerms[0]} instore price`;
      const url = `${this.baseGoogleUrl}?q=${encodeURIComponent(searchQuery)}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const inventory = [];

      // Look for Google Shopping results
      $('.shopping-results, .g, .tF2Cxc').each((i, element) => {
        const title = $(element).find('h3, .LC20lb, .DKV0Md').text().trim();
        const price = $(element).find('.price, .a8Pemb, .fG8Fp').text().trim();
        const availability = $(element).find('.availability, .in-stock, .out-of-stock').text().trim();
        const storeName = $(element).find('.store-name, .VuuXrf').text().trim();

        if (title && price && this.isRelevantProduct(title, product)) {
          inventory.push({
            product: product,
            title: title,
            price: this.extractPrice(price),
            availability: availability || 'unknown',
            storeId: store.id,
            storeName: store.name,
            source: 'google_local_inventory',
            scrapedAt: new Date()
          });
        }
      });

      // Look for Google Knowledge Panel
      $('.knowledge-panel, .kno-rdesc, .Z0LcW').each((i, element) => {
        const content = $(element).text();
        if (content.includes(store.name) && content.includes(product)) {
          const priceMatch = content.match(/£?(\d+\.?\d*)/);
          if (priceMatch) {
            inventory.push({
              product: product,
              title: product,
              price: parseFloat(priceMatch[1]),
              availability: 'in_stock',
              storeId: store.id,
              storeName: store.name,
              source: 'google_knowledge_panel',
              scrapedAt: new Date()
            });
          }
        }
      });

      return inventory;
    } catch (error) {
      logger.error(`Failed to search ${product} at ${store.name}:`, error);
      return [];
    }
  }

  /**
   * Check if a product title is relevant to our search
   */
  isRelevantProduct(title, searchProduct) {
    const titleLower = title.toLowerCase();
    const productLower = searchProduct.toLowerCase();
    
    // Check if the title contains the product name
    return titleLower.includes(productLower) || 
           productLower.includes(titleLower) ||
           this.areSimilarProducts(titleLower, productLower);
  }

  /**
   * Check if two product names are similar
   */
  areSimilarProducts(name1, name2) {
    const commonWords = ['milk', 'bread', 'cheese', 'chicken', 'beef', 'fish', 'apple', 'banana'];
    const name1Words = name1.split(' ');
    const name2Words = name2.split(' ');
    
    return commonWords.some(word => 
      name1Words.includes(word) && name2Words.includes(word)
    );
  }

  /**
   * Extract price from text
   */
  extractPrice(priceText) {
    if (!priceText) return null;
    
    // Remove currency symbols and extract number
    const match = priceText.match(/£?(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : null;
  }

  /**
   * Save inventory to Firebase
   */
  async saveInventory(inventory) {
    try {
      if (inventory.length === 0) return;
      
      logger.info(`💾 Saving ${inventory.length} inventory items to Firebase...`);
      
      for (const item of inventory) {
        await this.firebaseService.saveToCollection('local_inventory', item);
      }
      
      logger.info(`✅ Successfully saved ${inventory.length} inventory items to Firebase`);
    } catch (error) {
      logger.error('Failed to save inventory:', error);
      throw error;
    }
  }

  /**
   * Get current inventory for a specific store
   */
  async getCurrentInventory(storeId) {
    try {
      const inventory = await this.firebaseService.queryCollection('local_inventory', [
        { field: 'storeId', operator: '==', value: storeId },
        { field: 'scrapedAt', operator: '>=', value: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      ]);
      
      return inventory;
    } catch (error) {
      logger.error('Failed to get current inventory:', error);
      return [];
    }
  }

  /**
   * Delay function for rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = GoogleLocalInventoryScraper;
