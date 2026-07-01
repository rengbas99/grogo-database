/**
 * Alternative Data Sources for Real Product Information
 * Multiple approaches to get real product data when direct scraping fails
 */

const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const firebaseService = require('../services/FirebaseService');

class AlternativeDataSources {
  constructor() {
    this.firebaseService = firebaseService;
  }

  async init() {
    await this.firebaseService.initialize();
    logger.info('Alternative Data Sources initialized');
  }

  /**
   * Method 1: Use public APIs and data sources
   */
  async getDataFromPublicAPIs() {
    try {
      console.log('🌐 Method 1: Public APIs and Data Sources');
      
      const dataSources = [
        {
          name: 'OpenFoodFacts',
          url: 'https://world.openfoodfacts.org/cgi/search.pl',
          params: {
            search_terms: 'milk',
            search_simple: 1,
            action: 'process',
            json: 1,
            page_size: 20
          }
        },
        {
          name: 'Tesco API (if available)',
          url: 'https://dev.tescolabs.com/grocery/products/',
          headers: {
            'Ocp-Apim-Subscription-Key': process.env.TESCO_API_KEY || 'demo-key'
          }
        }
      ];

      const allProducts = [];

      for (const source of dataSources) {
        try {
          console.log(`   📡 Fetching from ${source.name}...`);
          
          const response = await axios.get(source.url, {
            params: source.params,
            headers: source.headers,
            timeout: 10000
          });

          if (source.name === 'OpenFoodFacts') {
            const products = this.parseOpenFoodFacts(response.data);
            allProducts.push(...products);
            console.log(`   ✅ Found ${products.length} products from ${source.name}`);
          }
        } catch (error) {
          console.log(`   ❌ Failed to fetch from ${source.name}: ${error.message}`);
        }
      }

      return allProducts;
    } catch (error) {
      logger.error('Failed to get data from public APIs:', error);
      return [];
    }
  }

  /**
   * Method 2: Use RSS feeds and sitemaps
   */
  async getDataFromRSSAndSitemaps() {
    try {
      console.log('📰 Method 2: RSS Feeds and Sitemaps');
      
      const feeds = [
        'https://www.tesco.com/sitemaps/en-GB/index.xml',
        'https://www.sainsburys.co.uk/sitemap.xml',
        'https://www.aldi.co.uk/sitemap.xml',
        'https://www.lidl.co.uk/static/sitemap.xml',
        'https://www.iceland.co.uk/sitemap.xml'
      ];

      const allProducts = [];

      for (const feedUrl of feeds) {
        try {
          console.log(`   📡 Fetching sitemap: ${feedUrl}`);
          
          const response = await axios.get(feedUrl, { timeout: 10000 });
          const products = this.parseSitemap(response.data, feedUrl);
          
          allProducts.push(...products);
          console.log(`   ✅ Found ${products.length} products from sitemap`);
        } catch (error) {
          console.log(`   ❌ Failed to fetch sitemap: ${error.message}`);
        }
      }

      return allProducts;
    } catch (error) {
      logger.error('Failed to get data from RSS/sitemaps:', error);
      return [];
    }
  }

  /**
   * Method 3: Use web scraping with different techniques
   */
  async getDataWithAdvancedScraping() {
    try {
      console.log('🕷️ Method 3: Advanced Scraping Techniques');
      
      const techniques = [
        {
          name: 'Mobile User Agent',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
        },
        {
          name: 'Different Browser',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        {
          name: 'Curl-like Request',
          userAgent: 'curl/7.68.0'
        }
      ];

      const allProducts = [];

      for (const technique of techniques) {
        try {
          console.log(`   🔧 Trying ${technique.name}...`);
          
          const response = await axios.get('https://www.aldi.co.uk/groceries', {
            headers: {
              'User-Agent': technique.userAgent,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-GB,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1'
            },
            timeout: 15000
          });

          const products = this.parseHTML(response.data, 'Aldi');
          if (products.length > 0) {
            allProducts.push(...products);
            console.log(`   ✅ Found ${products.length} products with ${technique.name}`);
            break; // Stop if we found products
          }
        } catch (error) {
          console.log(`   ❌ ${technique.name} failed: ${error.message}`);
        }
      }

      return allProducts;
    } catch (error) {
      logger.error('Failed to get data with advanced scraping:', error);
      return [];
    }
  }

  /**
   * Method 4: Use proxy services
   */
  async getDataWithProxies() {
    try {
      console.log('🌐 Method 4: Proxy Services');
      
      const proxyServices = [
        'https://api.scraperapi.com',
        'https://api.brightdata.com',
        'https://api.proxyscrape.com'
      ];

      const allProducts = [];

      for (const proxyService of proxyServices) {
        try {
          console.log(`   🔄 Trying proxy service: ${proxyService}`);
          
          // This would require API keys and proper setup
          console.log(`   ⚠️  Proxy service requires API key setup`);
        } catch (error) {
          console.log(`   ❌ Proxy service failed: ${error.message}`);
        }
      }

      return allProducts;
    } catch (error) {
      logger.error('Failed to get data with proxies:', error);
      return [];
    }
  }

  /**
   * Method 5: Manual data entry with validation
   */
  async getDataFromManualEntry() {
    try {
      console.log('✍️ Method 5: Manual Data Entry');
      
      // This would be a web interface for manual data entry
      console.log('   📝 Manual data entry interface would be here');
      console.log('   🔍 Users could add products manually with validation');
      
      return [];
    } catch (error) {
      logger.error('Failed to get data from manual entry:', error);
      return [];
    }
  }

  /**
   * Parse OpenFoodFacts data
   */
  parseOpenFoodFacts(data) {
    const products = [];
    
    if (data.products) {
      data.products.forEach(item => {
        if (item.product_name && item.brands) {
          products.push({
            name: item.product_name,
            brand: item.brands.split(',')[0].trim(),
            category: item.categories_tags ? item.categories_tags[0] : 'general',
            image: item.image_url,
            barcode: item.code,
            nutrition: item.nutrition_grades,
            ingredients: item.ingredients_text,
            source: 'OpenFoodFacts',
            isActive: true
          });
        }
      });
    }
    
    return products;
  }

  /**
   * Parse sitemap data
   */
  parseSitemap(xmlData, sourceUrl) {
    const products = [];
    
    try {
      const $ = cheerio.load(xmlData, { xmlMode: true });
      
      $('url').each((i, element) => {
        const loc = $(element).find('loc').text();
        const lastmod = $(element).find('lastmod').text();
        
        if (loc && loc.includes('/products/')) {
          const storeName = this.extractStoreName(sourceUrl);
          products.push({
            name: this.extractProductNameFromUrl(loc),
            url: loc,
            lastModified: lastmod,
            store: storeName,
            source: 'sitemap',
            isActive: true
          });
        }
      });
    } catch (error) {
      logger.warn('Failed to parse sitemap:', error.message);
    }
    
    return products;
  }

  /**
   * Parse HTML content
   */
  parseHTML(html, storeName) {
    const products = [];
    
    try {
      const $ = cheerio.load(html);
      
      // Try different selectors
      const selectors = [
        '.product-tile',
        '.product',
        '.product-item',
        '[data-testid="product-tile"]',
        '.product-card'
      ];
      
      for (const selector of selectors) {
        $(selector).each((i, element) => {
          const name = $(element).find('.product-title, .product-name, [data-testid="product-title"]').text().trim();
          const price = $(element).find('.price, .pricePerUnit, [data-testid="price"]').text().trim();
          const image = $(element).find('img').attr('src');
          
          if (name) {
            products.push({
              name: name,
              price: this.extractPrice(price),
              image: image,
              store: storeName,
              source: 'html_parsing',
              isActive: true
            });
          }
        });
        
        if (products.length > 0) break; // Stop if we found products
      }
    } catch (error) {
      logger.warn('Failed to parse HTML:', error.message);
    }
    
    return products;
  }

  /**
   * Extract store name from URL
   */
  extractStoreName(url) {
    if (url.includes('tesco.com')) return 'Tesco';
    if (url.includes('sainsburys.co.uk')) return 'Sainsburys';
    if (url.includes('aldi.co.uk')) return 'Aldi';
    if (url.includes('lidl.co.uk')) return 'Lidl';
    if (url.includes('iceland.co.uk')) return 'Iceland';
    return 'Unknown';
  }

  /**
   * Extract product name from URL
   */
  extractProductNameFromUrl(url) {
    const pathParts = url.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    return lastPart.replace(/[-_]/g, ' ').replace(/\d+/g, '').trim();
  }

  /**
   * Extract price from text
   */
  extractPrice(priceText) {
    if (!priceText) return null;
    const match = priceText.match(/£?(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : null;
  }

  /**
   * Save products to database
   */
  async saveProducts(products) {
    try {
      if (products.length === 0) return;
      
      const batch = [];
      
      for (const product of products) {
        // Save product
        const productRef = this.firebaseService.db.collection('products').doc();
        batch.push({
          ref: productRef,
          data: {
            name: product.name,
            brand: product.brand || 'Unknown',
            category: product.category || 'general',
            image: product.image,
            barcode: product.barcode,
            nutrition: product.nutrition,
            ingredients: product.ingredients,
            source: product.source,
            isActive: product.isActive,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        
        // Save store product if we have store info
        if (product.store) {
          const storeProductRef = this.firebaseService.db.collection('store_products').doc();
          batch.push({
            ref: storeProductRef,
            data: {
              productId: productRef.id,
              storeId: this.getStoreId(product.store),
              storeName: product.store,
              price: product.price,
              url: product.url,
              stockLevel: 'unknown',
              isActive: product.isActive,
              source: product.source,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
        }
      }
      
      // Commit batch
      const firestore = this.firebaseService.db;
      const batchWrite = firestore.batch();
      
      for (const item of batch) {
        batchWrite.set(item.ref, item.data);
      }
      
      await batchWrite.commit();
      logger.info(`Saved ${products.length} products to database`);
      
    } catch (error) {
      logger.error('Failed to save products:', error);
      throw error;
    }
  }

  /**
   * Get store ID
   */
  getStoreId(storeName) {
    const storeIds = {
      'Tesco': 'tesco-uxbridge',
      'Sainsburys': 'sainsburys-uxbridge',
      'Aldi': 'aldi-uxbridge',
      'Lidl': 'lidl-uxbridge',
      'Iceland': 'iceland-uxbridge'
    };
    
    return storeIds[storeName] || 'unknown-store';
  }
}

module.exports = AlternativeDataSources;

