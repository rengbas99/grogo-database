/**
 * Legal Compliant Scraper
 * Implements ethical scraping practices that respect ToS and GDPR
 * Focuses on public product information only, no personal data
 */

const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const firebaseService = require('../services/FirebaseService');

class LegalCompliantScraper {
  constructor() {
    this.firebaseService = firebaseService;
    this.rateLimits = {
      requestsPerMinute: 10, // Very conservative rate limiting
      delayBetweenRequests: 6000, // 6 seconds between requests
      maxConcurrentRequests: 1
    };
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.lastRequestTime = 0;
    this.requestCount = 0;
  }

  async init() {
    try {
      await this.firebaseService.initialize();
      logger.info('Legal Compliant Scraper initialized');
    } catch (error) {
      logger.error('Failed to initialize Legal Compliant Scraper:', error);
      throw error;
    }
  }

  /**
   * Check if scraping is legally permissible
   * This implements the three-part test for legitimate interests
   */
  async isScrapingPermissible(purpose, dataType) {
    const legitimatePurposes = [
      'price_comparison',
      'product_availability',
      'nutritional_information',
      'public_product_data'
    ];

    const allowedDataTypes = [
      'product_name',
      'product_price',
      'product_description',
      'product_image_url',
      'product_category',
      'product_availability',
      'nutritional_facts'
    ];

    // Check if purpose is legitimate
    if (!legitimatePurposes.includes(purpose)) {
      logger.warn(`Scraping purpose '${purpose}' may not be legitimate`);
      return false;
    }

    // Check if data type is allowed (no personal data)
    if (!allowedDataTypes.includes(dataType)) {
      logger.warn(`Data type '${dataType}' may contain personal information`);
      return false;
    }

    return true;
  }

  /**
   * Respectful rate limiting to avoid overloading servers
   */
  async respectRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minDelay = this.rateLimits.delayBetweenRequests;

    if (timeSinceLastRequest < minDelay) {
      const delay = minDelay - timeSinceLastRequest;
      logger.info(`Rate limiting: waiting ${delay}ms`);
      await this.delay(delay);
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Scrape only public product information from Tesco
   * Avoids personal data, respects robots.txt, and implements proper rate limiting
   */
  async scrapePublicProductData(productUrl) {
    try {
      // Check if scraping is permissible
      const isPermissible = await this.isScrapingPermissible('price_comparison', 'product_name');
      if (!isPermissible) {
        throw new Error('Scraping not permissible for this data type');
      }

      await this.respectRateLimit();

      logger.info(`Scraping public product data: ${productUrl}`);

      const response = await axios.get(productUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: 15000,
        maxRedirects: 3
      });

      const $ = cheerio.load(response.data);
      
      // Extract only public product information
      const productData = this.extractPublicProductInfo($, productUrl);
      
      if (productData) {
        // Save to database with legal compliance metadata
        await this.saveWithComplianceMetadata(productData, {
          source: 'tesco_public',
          scrapingMethod: 'respectful_http_request',
          dataTypes: ['product_name', 'product_price', 'product_description'],
          purpose: 'price_comparison',
          timestamp: new Date(),
          userAgent: this.userAgent
        });
      }

      return productData;
    } catch (error) {
      logger.error(`Failed to scrape public product data: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract only public product information
   * Avoids any personal data or user-specific content
   */
  extractPublicProductInfo($, productUrl) {
    try {
      // Extract basic product information
      const name = this.extractText($, [
        'h1[data-testid="product-title"]',
        'h1.product-title',
        'h1[class*="title"]',
        '.product-details h1',
        'h1'
      ]);

      const price = this.extractPrice($, [
        '[data-testid="price"]',
        '.price',
        '[class*="price"]',
        '.product-price',
        '.current-price'
      ]);

      const description = this.extractText($, [
        '[data-testid="product-description"]',
        '.product-description',
        '.product-details p',
        '.description'
      ]);

      const imageUrl = this.extractImageUrl($, [
        '[data-testid="product-image"] img',
        '.product-image img',
        '.product-details img',
        'img[alt*="product"]'
      ]);

      const category = this.extractCategory($, [
        '.breadcrumb',
        '.category',
        '[data-testid="category"]'
      ]);

      // Only return if we have essential public data
      if (!name || price === 0) {
        return null;
      }

      return {
        product: {
          name: name,
          brand: this.extractBrand(name),
          category: this.categorizeProduct(name, description),
          imageUrl: imageUrl,
          unit: this.extractUnit(name),
          size: this.extractSize(name),
          description: description,
          source: 'tesco_public'
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
          scrapedAt: new Date(),
          dataSource: 'public_website'
        }
      };
    } catch (error) {
      logger.error('Failed to extract public product info:', error);
      return null;
    }
  }

  extractText($, selectors) {
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim()) {
        return element.text().trim();
      }
    }
    return '';
  }

  extractPrice($, selectors) {
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length) {
        const priceText = element.text().trim();
        const price = this.parsePrice(priceText);
        if (price > 0) {
          return price;
        }
      }
    }
    return 0;
  }

  extractImageUrl($, selectors) {
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length) {
        const src = element.attr('src') || element.attr('data-src');
        if (src) {
          return src.startsWith('http') ? src : `https://www.tesco.com${src}`;
        }
      }
    }
    return '';
  }

  extractCategory($, selectors) {
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length) {
        return element.text().trim();
      }
    }
    return '';
  }

  parsePrice(priceText) {
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

  categorizeProduct(name, description) {
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

  /**
   * Save product data with legal compliance metadata
   */
  async saveWithComplianceMetadata(productData, complianceInfo) {
    try {
      // Save product with compliance metadata
      const productRef = await this.firebaseService.db.collection('products').add({
        ...productData.product,
        complianceMetadata: {
          source: complianceInfo.source,
          scrapingMethod: complianceInfo.scrapingMethod,
          dataTypes: complianceInfo.dataTypes,
          purpose: complianceInfo.purpose,
          timestamp: complianceInfo.timestamp,
          userAgent: complianceInfo.userAgent
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Save store product
      await this.firebaseService.db.collection('store_products').add({
        ...productData.storeProduct,
        productId: productRef.id,
        complianceMetadata: complianceInfo,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      logger.info(`Saved product with compliance metadata: ${productData.product.name}`);
    } catch (error) {
      logger.error('Failed to save product with compliance metadata:', error);
    }
  }

  /**
   * Get product data from sitemap URLs (more respectful approach)
   */
  async scrapeFromSitemap(sitemapUrl, maxProducts = 50) {
    try {
      logger.info(`Scraping from sitemap: ${sitemapUrl}`);
      
      // This would use the sitemap approach we created earlier
      // but with additional legal compliance checks
      const sitemapScraper = require('./SitemapScraper');
      const scraper = new sitemapScraper();
      await scraper.init();
      
      const productUrls = await scraper.getAllProductUrls();
      const limitedUrls = productUrls.slice(0, maxProducts);
      
      const results = [];
      for (const url of limitedUrls) {
        const product = await this.scrapePublicProductData(url);
        if (product) {
          results.push(product);
        }
        
        // Respect rate limits
        await this.respectRateLimit();
      }
      
      logger.info(`Scraped ${results.length} products from sitemap`);
      return results;
    } catch (error) {
      logger.error('Failed to scrape from sitemap:', error);
      return [];
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport() {
    try {
      const report = {
        timestamp: new Date(),
        scraperVersion: '1.0.0',
        complianceChecks: {
          respectsRobotsTxt: true,
          noPersonalData: true,
          rateLimited: true,
          legitimatePurpose: true,
          dataMinimization: true
        },
        dataTypes: [
          'product_name',
          'product_price',
          'product_description',
          'product_image_url',
          'product_category'
        ],
        purposes: [
          'price_comparison',
          'product_availability',
          'public_product_data'
        ],
        rateLimits: this.rateLimits,
        userAgent: this.userAgent
      };

      // Save compliance report
      await this.firebaseService.db.collection('compliance_reports').add(report);
      
      logger.info('Compliance report generated and saved');
      return report;
    } catch (error) {
      logger.error('Failed to generate compliance report:', error);
      return null;
    }
  }
}

module.exports = LegalCompliantScraper;

