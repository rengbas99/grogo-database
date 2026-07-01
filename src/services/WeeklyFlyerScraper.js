/**
 * Weekly Flyer Scraper
 * Scrapes store-specific offers and promotions from supermarket websites
 * Real data from actual store flyers - much more reliable than mock data
 */

const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const firebaseService = require('./FirebaseService');

class WeeklyFlyerScraper {
  constructor() {
    this.firebaseService = firebaseService;
    this.stores = [
      {
        id: 'tesco-uxbridge',
        name: 'Tesco Uxbridge',
        offersUrl: 'https://www.tesco.com/groceries/en-GB/promotions/all',
        flyerUrl: 'https://www.tesco.com/groceries/en-GB/promotions/tesco-weekly-offers'
      },
      {
        id: 'sainsburys-uxbridge',
        name: 'Sainsbury\'s Uxbridge',
        offersUrl: 'https://www.sainsburys.co.uk/shop/gb/groceries/offers',
        flyerUrl: 'https://www.sainsburys.co.uk/shop/gb/groceries/offers/this-weeks-offers'
      },
      {
        id: 'aldi-uxbridge',
        name: 'Aldi Uxbridge',
        offersUrl: 'https://www.aldi.co.uk/specialbuys',
        flyerUrl: 'https://www.aldi.co.uk/specialbuys/this-week'
      },
      {
        id: 'lidl-uxbridge',
        name: 'Lidl Uxbridge',
        offersUrl: 'https://www.lidl.co.uk/c/weekly-offers',
        flyerUrl: 'https://www.lidl.co.uk/c/weekly-offers'
      },
      {
        id: 'iceland-uxbridge',
        name: 'Iceland Uxbridge',
        offersUrl: 'https://www.iceland.co.uk/offers',
        flyerUrl: 'https://www.iceland.co.uk/offers/this-weeks-offers'
      }
    ];
  }

  async init() {
    await this.firebaseService.initialize();
    logger.info('Weekly Flyer Scraper initialized');
  }

  /**
   * Scrape all store offers
   */
  async scrapeAllStoreOffers() {
    try {
      logger.info('🛒 Starting weekly flyer scraping for all stores...');
      
      const allOffers = [];
      
      for (const store of this.stores) {
        try {
          logger.info(`📰 Scraping offers for ${store.name}...`);
          const offers = await this.scrapeStoreOffers(store);
          allOffers.push(...offers);
          
          // Rate limiting - be respectful
          await this.delay(2000);
        } catch (error) {
          logger.error(`Failed to scrape ${store.name}:`, error);
        }
      }
      
      logger.info(`✅ Scraped ${allOffers.length} total offers from all stores`);
      return allOffers;
    } catch (error) {
      logger.error('Failed to scrape all store offers:', error);
      return [];
    }
  }

  /**
   * Scrape offers for a specific store
   */
  async scrapeStoreOffers(store) {
    try {
      const offers = [];
      
      // Try web scraping first
      const webOffers = await this.scrapeWebOffers(store);
      offers.push(...webOffers);
      
      // Try PDF scraping if available
      const pdfOffers = await this.scrapePDFOffers(store);
      offers.push(...pdfOffers);
      
      logger.info(`✅ Found ${offers.length} offers for ${store.name}`);
      return offers;
    } catch (error) {
      logger.error(`Failed to scrape offers for ${store.name}:`, error);
      return [];
    }
  }

  /**
   * Scrape web-based offers
   */
  async scrapeWebOffers(store) {
    try {
      const response = await axios.get(store.offersUrl, {
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
      const offers = [];

      // Tesco-specific selectors
      if (store.id.includes('tesco')) {
        $('.product-tile, .offer-tile, .promotion-tile').each((i, element) => {
          const name = $(element).find('.product-title, .offer-title, .promotion-title').text().trim();
          const price = $(element).find('.price, .offer-price').text().trim();
          const originalPrice = $(element).find('.original-price, .was-price').text().trim();
          const image = $(element).find('img').attr('src');
          const validUntil = $(element).find('.valid-until, .offer-end').text().trim();

          if (name && price) {
            offers.push({
              name: name,
              price: this.extractPrice(price),
              originalPrice: this.extractPrice(originalPrice),
              image: image,
              validUntil: validUntil,
              storeId: store.id,
              storeName: store.name,
              source: 'web_scraping',
              scrapedAt: new Date()
            });
          }
        });
      }
      
      // Sainsbury's-specific selectors
      else if (store.id.includes('sainsburys')) {
        $('.product, .offer-item, .promotion-item').each((i, element) => {
          const name = $(element).find('.product-name, .offer-name').text().trim();
          const price = $(element).find('.price, .current-price').text().trim();
          const originalPrice = $(element).find('.was-price, .original-price').text().trim();
          const image = $(element).find('img').attr('src');

          if (name && price) {
            offers.push({
              name: name,
              price: this.extractPrice(price),
              originalPrice: this.extractPrice(originalPrice),
              image: image,
              storeId: store.id,
              storeName: store.name,
              source: 'web_scraping',
              scrapedAt: new Date()
            });
          }
        });
      }
      
      // Aldi-specific selectors
      else if (store.id.includes('aldi')) {
        $('.product, .specialbuy-item').each((i, element) => {
          const name = $(element).find('.product-title, .specialbuy-title').text().trim();
          const price = $(element).find('.price, .specialbuy-price').text().trim();
          const image = $(element).find('img').attr('src');

          if (name && price) {
            offers.push({
              name: name,
              price: this.extractPrice(price),
              image: image,
              storeId: store.id,
              storeName: store.name,
              source: 'web_scraping',
              scrapedAt: new Date()
            });
          }
        });
      }
      
      // Lidl-specific selectors
      else if (store.id.includes('lidl')) {
        $('.product, .offer-item').each((i, element) => {
          const name = $(element).find('.product-title, .offer-title').text().trim();
          const price = $(element).find('.price, .offer-price').text().trim();
          const image = $(element).find('img').attr('src');

          if (name && price) {
            offers.push({
              name: name,
              price: this.extractPrice(price),
              image: image,
              storeId: store.id,
              storeName: store.name,
              source: 'web_scraping',
              scrapedAt: new Date()
            });
          }
        });
      }
      
      // Iceland-specific selectors
      else if (store.id.includes('iceland')) {
        $('.product, .offer-item').each((i, element) => {
          const name = $(element).find('.product-name, .offer-name').text().trim();
          const price = $(element).find('.price, .offer-price').text().trim();
          const image = $(element).find('img').attr('src');

          if (name && price) {
            offers.push({
              name: name,
              price: this.extractPrice(price),
              image: image,
              storeId: store.id,
              storeName: store.name,
              source: 'web_scraping',
              scrapedAt: new Date()
            });
          }
        });
      }

      return offers;
    } catch (error) {
      logger.error(`Web scraping failed for ${store.name}:`, error);
      return [];
    }
  }

  /**
   * Scrape PDF-based offers (for stores that publish PDF flyers)
   */
  async scrapePDFOffers(store) {
    try {
      // This would require PDF parsing libraries
      // For now, return empty array
      logger.info(`PDF scraping not implemented yet for ${store.name}`);
      return [];
    } catch (error) {
      logger.error(`PDF scraping failed for ${store.name}:`, error);
      return [];
    }
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
   * Save offers to Firebase
   */
  async saveOffers(offers) {
    try {
      if (offers.length === 0) return;
      
      logger.info(`💾 Saving ${offers.length} offers to Firebase...`);
      
      for (const offer of offers) {
        await this.firebaseService.saveToCollection('store_offers', offer);
      }
      
      logger.info(`✅ Successfully saved ${offers.length} offers to Firebase`);
    } catch (error) {
      logger.error('Failed to save offers:', error);
      throw error;
    }
  }

  /**
   * Get current offers for a specific store
   */
  async getCurrentOffers(storeId) {
    try {
      const offers = await this.firebaseService.queryCollection('store_offers', [
        { field: 'storeId', operator: '==', value: storeId },
        { field: 'scrapedAt', operator: '>=', value: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      ]);
      
      return offers;
    } catch (error) {
      logger.error('Failed to get current offers:', error);
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

module.exports = WeeklyFlyerScraper;
