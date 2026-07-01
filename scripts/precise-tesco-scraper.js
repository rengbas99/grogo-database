#!/usr/bin/env node

/**
 * Precise Tesco Scraper
 * Based on exact screenshots and specific URLs provided
 * Handles quantity-based products and OpenFoodFacts fallback
 */

const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin
const serviceAccount = require('../config/firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

class PreciseTescoScraper {
  constructor() {
    this.baseUrl = 'https://www.tesco.com/groceries/en-GB';
    this.openFoodFactsUrl = 'https://world.openfoodfacts.net/api/v2';
    this.postcode = 'UB8 1ND';
    
    // Specific URLs as provided
    this.searchUrls = {
      'rice': 'https://www.tesco.com/groceries/en-GB/search?query=Rice+&inputType=free+text',
      'tampons': 'https://www.tesco.com/groceries/en-GB/search?query=Tampons&inputType=free+text',
      'household': 'https://www.tesco.com/groceries/en-GB/shop/household/all'
    };
    
    // Enhanced essentials with berries
    this.essentials = {
      'Cooking Essentials': [
        'oil', 'salt', 'pepper', 'garlic', 'onion', 'tomato', 'herbs', 'spices', 'rice'
      ],
      'Staples': [
        'bread', 'pasta', 'cereal', 'flour', 'sugar'
      ],
      'Dairy/Protein': [
        'milk', 'cheese', 'eggs', 'chicken', 'beef', 'pork', 'yogurt', 'butter'
      ],
      'Snacks': [
        'chocolate', 'biscuits', 'crisps', 'nuts'
      ],
      'Fruits': [
        'apple', 'banana', 'orange', 'grapes', 'strawberries'
      ],
      'Berries': [
        'strawberries', 'blueberries', 'raspberries', 'blackberries', 'cranberries', 'gooseberries'
      ],
      'Household Essentials': [
        'toilet paper', 'cleaning', 'laundry', 'soap', 'shampoo', 'toothpaste', 'room spray'
      ],
      'Sanitary & Personal Care': [
        'sanitary pads', 'tampons', 'deodorant', 'conditioner', 'medicines'
      ]
    };
    
    this.stats = {
      totalProducts: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      productsWithPrices: 0,
      productsWithoutPrices: 0,
      openFoodFactsFallbacks: 0
    };
  }

  async scrapeAllEssentials() {
    console.log('🏪 PRECISE TESCO SCRAPING STARTED');
    console.log('=' .repeat(60));
    
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const allProducts = [];
      
      // Scrape each category
      for (const [category, searchTerms] of Object.entries(this.essentials)) {
        console.log(`\n📂 Scraping category: ${category}`);
        
        for (const searchTerm of searchTerms) {
          try {
            console.log(`  🔍 Searching for: ${searchTerm}`);
            
            const products = await this.scrapeSearchTerm(browser, searchTerm, category);
            allProducts.push(...products);
            
            console.log(`  ✅ Found ${products.length} products for ${searchTerm}`);
            
            // Delay between searches
            await this.delay(2000);
            
          } catch (error) {
            console.error(`  ❌ Error scraping ${searchTerm}:`, error.message);
            this.stats.failedScrapes++;
          }
        }
      }
      
      // Save to local file
      await this.saveToLocalFile(allProducts);
      
      // Generate report
      this.generateReport();
      
      return allProducts;
      
    } finally {
      await browser.close();
    }
  }

  async scrapeSearchTerm(browser, searchTerm, category) {
    const page = await browser.newPage();
    const products = [];
    
    try {
      // Set up page
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Use specific URL if available, otherwise build search URL
      const url = this.searchUrls[searchTerm.toLowerCase()] || 
                  `${this.baseUrl}/search?query=${encodeURIComponent(searchTerm)}&inputType=free+text`;
      
      console.log(`    🌐 Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Handle cookie consent
      await this.handleCookieConsent(page);
      
      // Wait for products to load
      await this.delay(3000);
      
      // Extract product links from search results
      const productLinks = await this.extractProductLinks(page, searchTerm);
      console.log(`    🔗 Found ${productLinks.length} product links`);
      
      // Scrape each product page
      for (let i = 0; i < Math.min(productLinks.length, 10); i++) {
        try {
          const product = await this.scrapeProductPage(browser, productLinks[i], searchTerm, category);
          if (product) {
            products.push(product);
            this.stats.successfulScrapes++;
          }
        } catch (error) {
          console.error(`    ❌ Error scraping product ${i + 1}:`, error.message);
          this.stats.failedScrapes++;
        }
      }
      
    } finally {
      await page.close();
    }
    
    return products;
  }

  async extractProductLinks(page, searchTerm) {
    return await page.evaluate((searchTerm) => {
      const links = [];
      
      // Try multiple selectors for product links
      const linkSelectors = [
        'a[data-test="product-tile-title-link"]',
        'a[href*="/products/"]',
        '.product-tile a',
        '.product-item a'
      ];
      
      for (const selector of linkSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((link, index) => {
          if (index < 20) { // Limit to first 20 products
            const href = link.href;
            const name = link.textContent?.trim() || '';
            
            if (name && href && 
                name.length > 3 && 
                name.length < 200 && 
                href.includes('/products/') &&
                !name.includes('Skip to') &&
                !name.includes('Help') &&
                !name.includes('Sign in')) {
              
              const productId = href.match(/\/products\/(\d+)/)?.[1] || '';
              
              links.push({
                name: name,
                productId: productId,
                url: href,
                searchTerm: searchTerm
              });
            }
          }
        });
        
        if (links.length > 0) break; // If we found products with this selector, stop
      }
      
      return links;
    }, searchTerm);
  }

  async scrapeProductPage(browser, productLink, searchTerm, category) {
    const page = await browser.newPage();
    
    try {
      // Enhanced headers to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Set additional headers
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      });
      
      console.log(`      🔍 Scraping product: ${productLink.name}`);
      console.log(`      🌐 URL: ${productLink.url}`);
      
      // Navigate with retry logic
      let navigationSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await page.goto(productLink.url, { 
            waitUntil: 'domcontentloaded', 
            timeout: 30000 
          });
          
          // Check if we got blocked
          const pageContent = await page.content();
          if (pageContent.includes('Access Denied') || pageContent.includes('blocked') || pageContent.includes('403')) {
            console.log(`      ⚠️ Access denied on attempt ${attempt}, retrying...`);
            await this.delay(3000 * attempt);
            continue;
          }
          
          navigationSuccess = true;
          break;
        } catch (error) {
          console.log(`      ⚠️ Navigation failed on attempt ${attempt}: ${error.message}`);
          if (attempt < 3) {
            await this.delay(5000 * attempt);
          }
        }
      }
      
      if (!navigationSuccess) {
        console.log(`      ❌ Failed to access product page after 3 attempts`);
        return null;
      }
      
      // Handle cookie consent
      await this.handleCookieConsent(page);
      
      // Wait for page to fully load
      await this.delay(3000);
      
      // Check if we're on the right page
      const currentUrl = page.url();
      if (!currentUrl.includes('tesco.com/groceries/en-GB/products/')) {
        console.log(`      ⚠️ Redirected to: ${currentUrl}`);
        return null;
      }
      
      // Extract product data based on screenshot analysis
      const productData = await page.evaluate((productLink, searchTerm, category) => {
        const data = {
          productId: productLink.productId,
          name: '',
          brand: '',
          category: category,
          searchTerm: searchTerm,
          price: 0,
          originalPrice: null,
          pricePerUnit: '',
          isOnOffer: false,
          offerText: '',
          clubcardPrice: null,
          imageUrl: '',
          description: '',
          nutrition: {},
          ingredients: [],
          allergens: [],
          size: '',
          unit: '',
          availability: 'in_stock',
          rating: 0,
          reviewCount: 0,
          url: productLink.url,
          scrapedAt: new Date().toISOString()
        };
        
        // Extract product name (GREEN - from screenshot)
        const nameSelectors = [
          'h1[data-test="product-title"]',
          'h1.product-title',
          'h1',
          '.product-name',
          '[data-test="product-name"]',
          '.product-details-tile h1',
          '.product-details-tile .product-title',
          '.product-summary h1',
          '.product-summary .product-title'
        ];
        
        for (const selector of nameSelectors) {
          const nameEl = document.querySelector(selector);
          if (nameEl) {
            data.name = nameEl.textContent?.trim() || '';
            break;
          }
        }
        
        // If still no name, try to get it from the page title
        if (!data.name) {
          const titleEl = document.querySelector('title');
          if (titleEl) {
            data.name = titleEl.textContent?.replace(' - Tesco Groceries', '').trim() || '';
          }
        }
        
        // Extract brand from name or packaging
        if (data.name) {
          const words = data.name.split(' ');
          if (words.length > 1) {
            data.brand = words[0];
          }
        }
        
        // Extract regular price (BLACK - from screenshot)
        const priceSelectors = [
          '.price-per-sellable-unit .value',
          '.price-per-sellable-unit',
          '.price',
          '[data-test="product-price"]',
          '.current-price',
          '.product-price .value',
          '.product-price',
          '.price-display .value',
          '.price-display',
          '.product-details-tile .price',
          '.product-summary .price',
          '[data-testid="price"]',
          '.price-value'
        ];
        
        for (const selector of priceSelectors) {
          const priceEl = document.querySelector(selector);
          if (priceEl) {
            const priceText = priceEl.textContent?.trim() || '';
            const priceMatch = priceText.match(/£(\d+\.?\d*)/);
            if (priceMatch) {
              data.price = parseFloat(priceMatch[1]);
              break;
            }
          }
        }
        
        // If no price found, try to extract from any text containing £
        if (data.price === 0) {
          const allText = document.body.textContent || '';
          const priceMatches = allText.match(/£(\d+\.?\d*)/g);
          if (priceMatches && priceMatches.length > 0) {
            // Take the first price found
            const firstPrice = priceMatches[0].replace('£', '');
            data.price = parseFloat(firstPrice);
          }
        }
        
        // Extract price per unit (BLUE - from screenshot)
        const pricePerUnitSelectors = [
          '.price-per-unit',
          '.unit-price',
          '[data-test="price-per-unit"]'
        ];
        
        for (const selector of pricePerUnitSelectors) {
          const unitPriceEl = document.querySelector(selector);
          if (unitPriceEl) {
            data.pricePerUnit = unitPriceEl.textContent?.trim() || '';
            break;
          }
        }
        
        // Extract Clubcard price (YELLOW - from screenshot)
        const clubcardSelectors = [
          '.clubcard-price',
          '.clubcard',
          '[data-test="clubcard-price"]',
          '.loyalty-price'
        ];
        
        for (const selector of clubcardSelectors) {
          const clubcardEl = document.querySelector(selector);
          if (clubcardEl) {
            const clubcardText = clubcardEl.textContent?.trim() || '';
            const clubcardMatch = clubcardText.match(/£(\d+\.?\d*)/);
            if (clubcardMatch) {
              data.clubcardPrice = parseFloat(clubcardMatch[1]);
              data.isOnOffer = true;
              data.offerText = clubcardText;
              break;
            }
          }
        }
        
        // Extract product image (ORANGE - from screenshot)
        const imageSelectors = [
          'img[data-test="product-image"]',
          '.product-image img',
          '.product-photo img',
          'img[alt*="product"]',
          '.main-image img',
          '.product-details-tile img',
          '.product-summary img',
          '.product-gallery img',
          'img[src*="product"]',
          'img[data-src*="product"]'
        ];
        
        for (const selector of imageSelectors) {
          const imgEl = document.querySelector(selector);
          if (imgEl) {
            data.imageUrl = imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src') || '';
            if (data.imageUrl && !data.imageUrl.includes('placeholder')) break;
          }
        }
        
        // If no image found, try to get the first image on the page
        if (!data.imageUrl) {
          const firstImg = document.querySelector('img');
          if (firstImg) {
            data.imageUrl = firstImg.src || firstImg.getAttribute('data-src') || '';
          }
        }
        
        // Extract product description (PURPLE - from screenshot)
        const descSelectors = [
          '.product-description',
          '.description',
          '[data-test="description"]',
          '.product-details',
          '.about-this-product'
        ];
        
        for (const selector of descSelectors) {
          const descEl = document.querySelector(selector);
          if (descEl) {
            data.description = descEl.textContent?.trim() || '';
            break;
          }
        }
        
        // Extract nutrition information (RED - from screenshot)
        const nutritionTable = document.querySelector('.nutrition-table, .nutrition-facts, table');
        if (nutritionTable) {
          const rows = nutritionTable.querySelectorAll('tr');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 2) {
              const key = cells[0].textContent?.trim() || '';
              const value = cells[1].textContent?.trim() || '';
              if (key && value) {
                data.nutrition[key] = value;
              }
            }
          });
        }
        
        // Extract size/weight information
        if (data.name) {
          const sizeMatch = data.name.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|L|pack|Pack|each|loose)/i);
          if (sizeMatch) {
            data.size = sizeMatch[0];
            data.unit = sizeMatch[2];
          }
        }
        
        // Extract rating and reviews
        const ratingEl = document.querySelector('.rating, .stars, [data-test="rating"]');
        if (ratingEl) {
          const ratingText = ratingEl.textContent?.trim() || '';
          const ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)\s*stars?/i);
          if (ratingMatch) {
            data.rating = parseFloat(ratingMatch[1]);
          }
          
          const reviewMatch = ratingText.match(/\((\d+)\s*reviews?\)/i);
          if (reviewMatch) {
            data.reviewCount = parseInt(reviewMatch[1]);
          }
        }
        
        return data;
      }, productLink, searchTerm, category);
      
      // Debug: Log what we extracted
      console.log(`      📊 Extracted data:`, {
        name: productData.name,
        price: productData.price,
        imageUrl: productData.imageUrl ? 'Found' : 'Missing',
        description: productData.description ? 'Found' : 'Missing'
      });
      
      // If we don't have enough data, try OpenFoodFacts fallback
      if (!productData.description || !productData.nutrition || Object.keys(productData.nutrition).length === 0) {
        console.log(`      🔄 Trying OpenFoodFacts fallback for: ${productData.name}`);
        const enrichedData = await this.enrichWithOpenFoodFacts(productData);
        if (enrichedData) {
          this.stats.openFoodFactsFallbacks++;
          return enrichedData;
        }
      }
      
      this.stats.totalProducts++;
      if (productData.price > 0) {
        this.stats.productsWithPrices++;
      } else {
        this.stats.productsWithoutPrices++;
      }
      
      return productData;
      
    } finally {
      await page.close();
    }
  }

  async enrichWithOpenFoodFacts(productData) {
    try {
      // Try to find barcode or use product name for search
      const searchTerm = productData.barcode || productData.name;
      const response = await axios.get(`${this.openFoodFactsUrl}/cgi/search.pl`, {
        params: {
          search_terms: searchTerm,
          search_simple: 1,
          action: 'process',
          json: 1
        }
      });
      
      if (response.data && response.data.products && response.data.products.length > 0) {
        const product = response.data.products[0];
        
        // Enrich with OpenFoodFacts data
        if (product.product_name && !productData.description) {
          productData.description = product.product_name;
        }
        
        if (product.nutrition_grades && !productData.nutrition.grade) {
          productData.nutrition.grade = product.nutrition_grades;
        }
        
        if (product.ingredients_text && !productData.ingredients.length) {
          productData.ingredients = product.ingredients_text.split(',').map(i => i.trim());
        }
        
        if (product.allergens_tags && !productData.allergens.length) {
          productData.allergens = product.allergens_tags;
        }
        
        if (product.image_url && !productData.imageUrl) {
          productData.imageUrl = product.image_url;
        }
        
        return productData;
      }
    } catch (error) {
      console.log(`      ⚠️ OpenFoodFacts fallback failed: ${error.message}`);
    }
    
    return productData;
  }

  async handleCookieConsent(page) {
    try {
      await page.waitForSelector('button[name="accept"]', { timeout: 5000 });
      await page.click('button[name="accept"]');
      console.log('      ✅ Cookie consent accepted');
      await this.delay(2000);
    } catch (e) {
      // No cookie popup found
    }
  }

  async saveToLocalFile(products) {
    console.log('\n💾 Saving products to local file...');
    
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Create data directory if it doesn't exist
      const dataDir = path.join(__dirname, '..', 'data', 'scraped-products');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `precise-tesco-scraper-${timestamp}.json`;
      const filepath = path.join(dataDir, filename);
      
      // Prepare data for saving
      const saveData = {
        timestamp: new Date().toISOString(),
        store: 'Tesco',
        totalProducts: products.length,
        stats: this.stats,
        essentials: this.essentials,
        products: products.map(product => ({
          productId: product.productId,
          name: product.name,
          brand: product.brand,
          category: product.category,
          subcategory: 'General',
          price: product.price,
          originalPrice: product.originalPrice,
          pricePerUnit: product.pricePerUnit,
          isOnOffer: product.isOnOffer,
          offerText: product.offerText,
          clubcardPrice: product.clubcardPrice,
          imageUrl: product.imageUrl,
          description: product.description,
          nutrition: product.nutrition,
          ingredients: product.ingredients,
          allergens: product.allergens,
          size: product.size,
          unit: product.unit,
          availability: product.availability,
          rating: product.rating,
          reviewCount: product.reviewCount,
          url: product.url,
          storeName: 'Tesco',
          storeBrand: 'Tesco',
          searchTerm: product.searchTerm,
          scrapedAt: product.scrapedAt,
          isActive: true
        })),
        summary: {
          totalProducts: products.length,
          categories: Object.keys(this.essentials).length,
          searchTerms: Object.values(this.essentials).flat().length,
          productsWithPrices: this.stats.productsWithPrices,
          productsWithoutPrices: this.stats.productsWithoutPrices,
          openFoodFactsFallbacks: this.stats.openFoodFactsFallbacks
        }
      };
      
      // Group products by category for easier analysis
      const productsByCategory = {};
      saveData.products.forEach(product => {
        if (!productsByCategory[product.category]) {
          productsByCategory[product.category] = [];
        }
        productsByCategory[product.category].push(product);
      });
      saveData.productsByCategory = productsByCategory;
      
      // Save to file
      fs.writeFileSync(filepath, JSON.stringify(saveData, null, 2));
      console.log(`✅ Saved ${products.length} products to: ${filepath}`);
      
      // Also save a summary file
      const summaryFilepath = path.join(dataDir, `tesco-summary-${timestamp}.json`);
      const summaryData = {
        timestamp: saveData.timestamp,
        store: 'Tesco',
        totalProducts: products.length,
        stats: this.stats,
        categories: Object.keys(productsByCategory).map(category => ({
          name: category,
          count: productsByCategory[category].length,
          products: productsByCategory[category].map(p => ({
            name: p.name,
            price: p.price,
            clubcardPrice: p.clubcardPrice,
            size: p.size
          }))
        }))
      };
      
      fs.writeFileSync(summaryFilepath, JSON.stringify(summaryData, null, 2));
      console.log(`📊 Summary saved to: ${summaryFilepath}`);
      
      return filepath;
      
    } catch (error) {
      console.error('❌ Error saving to local file:', error.message);
      return null;
    }
  }

  generateReport() {
    console.log('\n📊 PRECISE TESCO SCRAPING REPORT');
    console.log('=' .repeat(50));
    console.log(`Total products: ${this.stats.totalProducts}`);
    console.log(`Successful scrapes: ${this.stats.successfulScrapes}`);
    console.log(`Failed scrapes: ${this.stats.failedScrapes}`);
    console.log(`Products with prices: ${this.stats.productsWithPrices}`);
    console.log(`Products without prices: ${this.stats.productsWithoutPrices}`);
    console.log(`OpenFoodFacts fallbacks: ${this.stats.openFoodFactsFallbacks}`);
  }

  async testSingleProduct() {
    console.log('🧪 TESTING SINGLE PRODUCT PAGE');
    console.log('============================================================');
    
    const browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const testUrl = 'https://www.tesco.com/groceries/en-GB/products/254918228';
      const productLink = {
        name: 'Test Product',
        url: testUrl,
        productId: '254918228'
      };
      
      console.log(`🔍 Testing URL: ${testUrl}`);
      const product = await this.scrapeProductPage(browser, productLink, 'test', 'Test Category');
      
      if (product) {
        console.log('✅ Successfully scraped product:', JSON.stringify(product, null, 2));
      } else {
        console.log('❌ Failed to scrape product');
      }
      
      return product;
      
    } finally {
      await browser.close();
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the scraper
async function main() {
  const scraper = new PreciseTescoScraper();
  
  try {
    // Check if we want to test a single product
    const args = process.argv.slice(2);
    if (args.includes('--test')) {
      await scraper.testSingleProduct();
    } else {
      await scraper.scrapeAllEssentials();
      console.log('\n🎉 Precise Tesco scraping completed!');
    }
  } catch (error) {
    console.error('❌ Scraping failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = PreciseTescoScraper;
