/**
 * Base scraper class for all grocery store scrapers
 */

const { chromium } = require('playwright');
const cheerio = require('cheerio');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const UserAgent = require('user-agents');
const logger = require('../utils/logger');

class BaseScraper {
  constructor(storeConfig) {
    this.config = storeConfig;
    this.browser = null;
    this.page = null;
    this.userAgent = new UserAgent();
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }

  async init() {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      this.page = await this.browser.newPage();
      
      // Set user agent and viewport
      const userAgent = this.getRandomUserAgent();
      await this.page.setViewportSize({ width: 1366, height: 768 });
      
      // Set extra headers
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-GB,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': userAgent
      });

      logger.info(`Initialized scraper for ${this.config.name}`);
    } catch (error) {
      logger.error(`Failed to initialize scraper for ${this.config.name}:`, error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      logger.info(`Closed scraper for ${this.config.name}`);
    }
  }

  getRandomUserAgent() {
    const userAgents = this.config.userAgents;
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minDelay = (60 * 1000) / this.config.rateLimit.requestsPerMinute;
    
    if (timeSinceLastRequest < minDelay) {
      const delay = minDelay - timeSinceLastRequest;
      await this.delay(delay);
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  async navigateToUrl(url, options = {}) {
    try {
      await this.rateLimit();
      
      logger.info(`Navigating to: ${url}`);
      await this.page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
        ...options
      });

      // Wait for content to load
      await this.delay(2000);
      
      return true;
    } catch (error) {
      logger.error(`Failed to navigate to ${url}:`, error);
      return false;
    }
  }

  async getPageContent() {
    try {
      const content = await this.page.content();
      return cheerio.load(content);
    } catch (error) {
      logger.error('Failed to get page content:', error);
      return null;
    }
  }

  async searchProducts(searchTerm, category = null) {
    throw new Error('searchProducts method must be implemented by subclass');
  }

  async scrapeProductDetails(productUrl) {
    throw new Error('scrapeProductDetails method must be implemented by subclass');
  }

  async scrapeCategory(category) {
    throw new Error('scrapeCategory method must be implemented by subclass');
  }

  async scrapeAllCategories() {
    const results = [];
    
    for (const category of this.config.categories) {
      try {
        logger.info(`Scraping category: ${category}`);
        const categoryResults = await this.scrapeCategory(category);
        results.push(...categoryResults);
        
        // Delay between categories
        await this.delay(5000);
      } catch (error) {
        logger.error(`Failed to scrape category ${category}:`, error);
      }
    }
    
    return results;
  }

  // Utility methods for data extraction
  extractPrice(priceText) {
    if (!priceText) return 0;
    
    // Remove currency symbols and extract number
    const price = priceText.replace(/[£$€,]/g, '').trim();
    const match = price.match(/(\d+\.?\d*)/);
    
    return match ? parseFloat(match[1]) : 0;
  }

  extractAvailability(availabilityText) {
    if (!availabilityText) return 'unknown';
    
    const text = availabilityText.toLowerCase();
    
    if (text.includes('in stock') || text.includes('available')) {
      return 'in_stock';
    } else if (text.includes('low stock') || text.includes('limited')) {
      return 'low_stock';
    } else if (text.includes('out of stock') || text.includes('unavailable')) {
      return 'out_of_stock';
    }
    
    return 'unknown';
  }

  cleanText(text) {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ');
  }

  generateProductId(name, brand) {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const cleanBrand = brand.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${cleanBrand}-${cleanName}-${uuidv4().substring(0, 8)}`;
  }

  // Error handling
  async handleError(error, context) {
    logger.error(`Error in ${context}:`, error);
    
    // Take screenshot for debugging
    if (this.page) {
      try {
        const screenshot = await this.page.screenshot({ encoding: 'base64' });
        logger.debug(`Screenshot taken for error in ${context}`);
      } catch (screenshotError) {
        logger.error('Failed to take screenshot:', screenshotError);
      }
    }
    
    throw error;
  }
}

module.exports = BaseScraper;
