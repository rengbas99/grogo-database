/**
 * Sitemap-based scraper for Tesco products
 * Uses sitemaps to get product URLs without triggering anti-bot measures
 */

const axios = require('axios');
const cheerio = require('cheerio');
const xml2js = require('xml2js');
const logger = require('../utils/logger');
const firebaseService = require('../services/FirebaseService');

class SitemapScraper {
  constructor() {
    this.firebaseService = firebaseService;
    this.baseUrls = {
      tesco: {
        main: 'https://www.tesco.com/sitemaps/en-GB/index.xml',
        groceries: 'https://www.tesco.com/sitemaps/en-GB/groceries/products-index.xml',
        fAndF: 'https://www.tesco.com/sitemaps/en-GB/F&F/products-index.xml',
        marketplace: 'https://www.tesco.com/sitemaps/en-GB/marketplace/products-index.xml'
      }
    };
    this.productUrls = [];
    this.processedCount = 0;
    this.batchSize = 50;
  }

  async init() {
    try {
      await this.firebaseService.initialize();
      logger.info('Sitemap scraper initialized');
    } catch (error) {
      logger.error('Failed to initialize sitemap scraper:', error);
      throw error;
    }
  }

  async getSitemapUrls(sitemapUrl) {
    try {
      logger.info(`Fetching sitemap: ${sitemapUrl}`);
      
      const response = await axios.get(sitemapUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/xml, text/xml, */*',
          'Accept-Language': 'en-GB,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br'
        },
        timeout: 30000
      });

      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(response.data);
      
      const urls = [];
      
      // Handle different sitemap structures
      if (result.sitemapindex && result.sitemapindex.sitemap) {
        // Main sitemap index
        for (const sitemap of result.sitemapindex.sitemap) {
          if (sitemap.loc && sitemap.loc[0]) {
            urls.push(sitemap.loc[0]);
          }
        }
      } else if (result.urlset && result.urlset.url) {
        // Product sitemap
        for (const url of result.urlset.url) {
          if (url.loc && url.loc[0]) {
            urls.push(url.loc[0]);
          }
        }
      }

      logger.info(`Found ${urls.length} URLs in sitemap`);
      return urls;
    } catch (error) {
      logger.error(`Failed to fetch sitemap ${sitemapUrl}:`, error);
      return [];
    }
  }

  async getAllProductUrls() {
    try {
      logger.info('Fetching all product URLs from sitemaps...');
      
      const allUrls = [];
      
      // Get main sitemap first
      const mainSitemapUrls = await this.getSitemapUrls(this.baseUrls.tesco.main);
      
      // Filter for product sitemaps
      const productSitemaps = mainSitemapUrls.filter(url => 
        url.includes('products-index.xml') || 
        url.includes('groceries') || 
        url.includes('F&F') || 
        url.includes('marketplace')
      );

      // Also add direct product sitemaps
      productSitemaps.push(
        this.baseUrls.tesco.groceries,
        this.baseUrls.tesco.fAndF,
        this.baseUrls.tesco.marketplace
      );

      // Get URLs from each product sitemap
      for (const sitemapUrl of productSitemaps) {
        try {
          const urls = await this.getSitemapUrls(sitemapUrl);
          allUrls.push(...urls);
          
          // Add delay between requests
          await this.delay(1000);
        } catch (error) {
          logger.warn(`Failed to process sitemap ${sitemapUrl}:`, error.message);
        }
      }

      // Filter for actual product URLs
      const productUrls = allUrls.filter(url => 
        url.includes('/groceries/') && 
        url.includes('/products/') &&
        !url.includes('?') &&
        !url.includes('promotions') &&
        !url.includes('index') &&
        url.match(/\/products\/\d+$/) // Must end with /products/ followed by digits
      );

      logger.info(`Found ${productUrls.length} product URLs total`);
      this.productUrls = productUrls;
      return productUrls;
    } catch (error) {
      logger.error('Failed to get product URLs:', error);
      return [];
    }
  }

  async scrapeProductFromUrl(productUrl) {
    try {
      const response = await axios.get(productUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      
      // Extract product information
      const product = this.extractProductFromPage($, productUrl);
      
      if (product) {
        await this.saveProductToFirebase(product);
        this.processedCount++;
      }

      return product;
    } catch (error) {
      logger.error(`Failed to scrape product ${productUrl}:`, error.message);
      return null;
    }
  }

  extractProductFromPage($, productUrl) {
    try {
      // Try multiple selectors for different page layouts
      const nameSelectors = [
        'h1[data-testid="product-title"]',
        'h1.product-title',
        'h1[class*="title"]',
        '.product-details h1',
        'h1'
      ];

      const priceSelectors = [
        '[data-testid="price"]',
        '.price',
        '[class*="price"]',
        '.product-price',
        '.current-price'
      ];

      const imageSelectors = [
        '[data-testid="product-image"] img',
        '.product-image img',
        '.product-details img',
        'img[alt*="product"]'
      ];

      const descriptionSelectors = [
        '[data-testid="product-description"]',
        '.product-description',
        '.product-details p',
        '.description'
      ];

      let name = '';
      let price = 0;
      let imageUrl = '';
      let description = '';

      // Extract name
      for (const selector of nameSelectors) {
        const element = $(selector).first();
        if (element.length && element.text().trim()) {
          name = element.text().trim();
          break;
        }
      }

      // Extract price
      for (const selector of priceSelectors) {
        const element = $(selector).first();
        if (element.length) {
          const priceText = element.text().trim();
          const extractedPrice = this.extractPrice(priceText);
          if (extractedPrice > 0) {
            price = extractedPrice;
            break;
          }
        }
      }

      // Extract image
      for (const selector of imageSelectors) {
        const element = $(selector).first();
        if (element.length) {
          const src = element.attr('src') || element.attr('data-src');
          if (src) {
            imageUrl = src.startsWith('http') ? src : `https://www.tesco.com${src}`;
            break;
          }
        }
      }

      // Extract description
      for (const selector of descriptionSelectors) {
        const element = $(selector).first();
        if (element.length && element.text().trim()) {
          description = element.text().trim();
          break;
        }
      }

      if (!name || price === 0) {
        return null;
      }

      return {
        product: {
          name: name,
          brand: this.extractBrand(name),
          category: this.extractCategory(name, description),
          imageUrl: imageUrl,
          unit: this.extractUnit(name),
          size: this.extractSize(name),
          description: description
        },
        storeProduct: {
          storeId: 'tesco-uxbridge',
          storeName: 'Tesco Uxbridge',
          storeBrand: 'tesco',
          price: price,
          isOnOffer: this.isOnOffer($),
          offerText: this.extractOfferText($),
          availability: 'in_stock',
          url: productUrl,
          scrapedAt: new Date()
        }
      };
    } catch (error) {
      logger.error('Failed to extract product from page:', error);
      return null;
    }
  }

  extractPrice(priceText) {
    if (!priceText) return 0;
    const price = priceText.replace(/[£$€,]/g, '').trim();
    const match = price.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 0;
  }

  extractBrand(name) {
    const brandPatterns = [
      /^Tesco\s+/i,
      /^Sainsbury's\s+/i,
      /^Aldi\s+/i,
      /^Lidl\s+/i,
      /^Iceland\s+/i
    ];

    for (const pattern of brandPatterns) {
      if (pattern.test(name)) {
        return name.match(pattern)[0].trim();
      }
    }

    return 'Tesco';
  }

  extractCategory(name, description = '') {
    const text = `${name} ${description}`.toLowerCase();
    
    if (text.includes('milk') || text.includes('cheese') || text.includes('yogurt') || text.includes('butter')) {
      return 'dairy-eggs';
    } else if (text.includes('bread') || text.includes('croissant') || text.includes('bagel')) {
      return 'bakery';
    } else if (text.includes('chicken') || text.includes('beef') || text.includes('salmon') || text.includes('bacon')) {
      return 'meat-fish';
    } else if (text.includes('banana') || text.includes('apple') || text.includes('orange') || text.includes('carrot')) {
      return 'fresh-food';
    } else if (text.includes('frozen') || text.includes('ice cream')) {
      return 'frozen-food';
    } else if (text.includes('rice') || text.includes('pasta') || text.includes('cereal')) {
      return 'food-cupboard';
    } else if (text.includes('juice') || text.includes('water') || text.includes('coffee') || text.includes('tea')) {
      return 'drinks';
    }
    
    return 'food-cupboard';
  }

  extractUnit(name) {
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('kg') || nameLower.includes('kilogram')) {
      return 'kg';
    } else if (nameLower.includes('g') || nameLower.includes('gram')) {
      return 'g';
    } else if (nameLower.includes('l') || nameLower.includes('litre')) {
      return 'l';
    } else if (nameLower.includes('ml') || nameLower.includes('millilitre')) {
      return 'ml';
    } else if (nameLower.includes('pack') || nameLower.includes('packs')) {
      return 'pack';
    }
    
    return 'item';
  }

  extractSize(name) {
    const sizeMatch = name.match(/(\d+(?:\.\d+)?)\s*(kg|g|l|ml|pack|packs)/i);
    return sizeMatch ? `${sizeMatch[1]}${sizeMatch[2]}` : '';
  }

  isOnOffer($) {
    const offerSelectors = [
      '[data-testid="offer"]',
      '.offer',
      '.promotion',
      '.discount',
      '[class*="offer"]'
    ];

    for (const selector of offerSelectors) {
      if ($(selector).length > 0) {
        return true;
      }
    }
    return false;
  }

  extractOfferText($) {
    const offerSelectors = [
      '[data-testid="offer"]',
      '.offer',
      '.promotion',
      '.discount'
    ];

    for (const selector of offerSelectors) {
      const element = $(selector).first();
      if (element.length) {
        return element.text().trim();
      }
    }
    return '';
  }

  async saveProductToFirebase(product) {
    try {
      // Save product to products collection
      const productRef = await this.firebaseService.db.collection('products').add({
        ...product.product,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Save store product to store_products collection
      await this.firebaseService.db.collection('store_products').add({
        ...product.storeProduct,
        productId: productRef.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      logger.info(`Saved product: ${product.product.name}`);
    } catch (error) {
      logger.error('Failed to save product to Firebase:', error);
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async scrapeAllProducts(maxProducts = 1000) {
    try {
      logger.info(`Starting to scrape up to ${maxProducts} products...`);
      
      if (this.productUrls.length === 0) {
        await this.getAllProductUrls();
      }

      const urlsToProcess = this.productUrls.slice(0, maxProducts);
      logger.info(`Processing ${urlsToProcess.length} product URLs...`);

      for (let i = 0; i < urlsToProcess.length; i += this.batchSize) {
        const batch = urlsToProcess.slice(i, i + this.batchSize);
        
        logger.info(`Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(urlsToProcess.length / this.batchSize)}`);
        
        // Process batch in parallel
        const promises = batch.map(url => this.scrapeProductFromUrl(url));
        await Promise.allSettled(promises);
        
        // Add delay between batches
        await this.delay(2000);
      }

      logger.info(`Scraping completed. Processed ${this.processedCount} products.`);
      return this.processedCount;
    } catch (error) {
      logger.error('Failed to scrape all products:', error);
      return 0;
    }
  }
}

module.exports = SitemapScraper;
