#!/usr/bin/env node

/**
 * Enhanced Iceland Scraper
 * Based on actual Iceland website structure from screenshots
 * Extracts real product images, descriptions, and detailed information
 */

const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class EnhancedIcelandScraper {
  constructor() {
    this.baseUrl = 'https://www.iceland.co.uk/search';
    this.productUrl = 'https://www.iceland.co.uk/p';
    this.postcode = 'UB8 1ND';
    this.openFoodFactsUrl = 'https://world.openfoodfacts.net/api/v2';
    
    // Enhanced essentials list
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
        'toilet paper', 'cleaning', 'laundry', 'soap', 'shampoo', 'toothpaste', 'room spray', 'shower gel'
      ],
      'Sanitary & Personal Care': [
        'sanitary pads', 'tampons', 'deodorant', 'conditioner', 'medicines'
      ]
    };
    
    this.stats = {
      totalProducts: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      productsWithImages: 0,
      productsWithoutImages: 0,
      openFoodFactsFallbacks: 0
    };
  }

  async scrapeSearchResults(browser, searchTerm, category) {
    console.log(`\n🔍 Scraping Iceland search results for: "${searchTerm}"`);
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 }); // Smaller viewport for better visibility
    
    try {
      const url = `${this.baseUrl}?q=${encodeURIComponent(searchTerm)}`;
      console.log(`🌐 Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookie consent
      try {
        await page.waitForSelector('button[id="onetrust-accept-btn-handler"]', { timeout: 5000 });
        await page.click('button[id="onetrust-accept-btn-handler"]');
        console.log('✅ Cookie consent accepted');
        await this.delay(2000);
      } catch (e) {
        console.log('ℹ️  No cookie consent popup found');
      }

      await this.delay(3000);

      // Extract products from search results (the "boxes")
      const searchResults = await page.evaluate((searchTerm, category) => {
        const products = [];
        
        // Look for product containers (the "boxes" from the screenshot)
        // Try multiple selectors to find product containers
        const productSelectors = [
          '.product-tile',
          '.product-item', 
          '.product-card',
          '[data-test="product-tile"]',
          '.product-listing-item',
          '.product-box',
          '.product-wrapper',
          'article',
          '.grid-item',
          '.search-result-item'
        ];
        
        let productElements = [];
        for (const selector of productSelectors) {
          productElements = document.querySelectorAll(selector);
          if (productElements.length > 0) {
            console.log(`Found ${productElements.length} products using selector: ${selector}`);
            break;
          }
        }
        
        // If no specific product containers found, try to find any clickable elements with product links
        if (productElements.length === 0) {
          const allLinks = document.querySelectorAll('a[href*="/p/"]');
          console.log(`Found ${allLinks.length} product links`);
          
          allLinks.forEach((link, index) => {
            if (index >= 10) return;
            
            // Create a virtual container for each link
            const virtualContainer = {
              querySelector: (sel) => {
                if (sel === 'a') return link;
                return link.querySelector(sel) || link.closest('div')?.querySelector(sel);
              }
            };
            
            productElements.push(virtualContainer);
          });
        }
        
        console.log(`Processing ${productElements.length} product elements`);
        
        productElements.forEach((element, index) => {
          if (index >= 10) return; // Limit to first 10 products
          
          const product = {
            name: '',
            price: '',
            pricePerUnit: '',
            imageUrl: '',
            productUrl: '',
            productId: '',
            rating: 0,
            reviewCount: 0,
            offer: '',
            category: category,
            searchTerm: searchTerm
          };
          
          // Extract product name - try multiple approaches
          const nameSelectors = [
            'h3', 'h4', '.product-name', '.product-title', 
            '[data-test="product-name"]', '.product-title a',
            'a[href*="/p/"]', '.title', '.name'
          ];
          
          for (const selector of nameSelectors) {
            const nameEl = element.querySelector(selector);
            if (nameEl) {
              const nameText = nameEl.textContent?.trim() || '';
              if (nameText && nameText.length > 3 && nameText.length < 200) {
                product.name = nameText;
                break;
              }
            }
          }
          
          // If still no name, try to get it from the link text
          if (!product.name) {
            const linkEl = element.querySelector('a');
            if (linkEl) {
              const linkText = linkEl.textContent?.trim() || '';
              if (linkText && linkText.length > 3 && linkText.length < 200) {
                product.name = linkText;
              }
            }
          }
          
          // Extract main price - try multiple approaches
          const priceSelectors = [
            '.price', '.product-price', '[data-test="price"]', 
            '.current-price', '.price-current', '.cost',
            '.amount', '[class*="price"]'
          ];
          
          for (const selector of priceSelectors) {
            const priceEl = element.querySelector(selector);
            if (priceEl) {
              const priceText = priceEl.textContent?.trim() || '';
              if (priceText && priceText.includes('£')) {
                product.price = priceText;
                break;
              }
            }
          }
          
          // If no price found, try to find any text with £ symbol
          if (!product.price) {
            const allText = element.textContent || '';
            const priceMatch = allText.match(/£\d+\.?\d*/);
            if (priceMatch) {
              product.price = priceMatch[0];
            }
          }
          
          // Extract price per unit
          const unitPriceSelectors = [
            '.price-per-unit', '.unit-price', '.price-per-kg',
            '.price-per-gram', '.price-per-litre', '.per-unit'
          ];
          
          for (const selector of unitPriceSelectors) {
            const unitPriceEl = element.querySelector(selector);
            if (unitPriceEl) {
              product.pricePerUnit = unitPriceEl.textContent?.trim() || '';
              break;
            }
          }
          
          // Extract product image - try multiple approaches
          const imgEl = element.querySelector('img');
          if (imgEl) {
            product.imageUrl = imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src') || '';
          }
          
          // Extract product URL and ID
          const linkEl = element.querySelector('a');
          if (linkEl) {
            product.productUrl = linkEl.href || '';
            // Extract product ID from URL - try multiple patterns
            const idPatterns = [
              /\/p\/(\d+)/,
              /\/p\/[^\/]+\/(\d+)/,
              /\/product\/(\d+)/,
              /id[=:](\d+)/
            ];
            
            for (const pattern of idPatterns) {
              const idMatch = product.productUrl.match(pattern);
              if (idMatch) {
                product.productId = idMatch[1];
                break;
              }
            }
            
            // If no ID found in URL, generate one from the URL
            if (!product.productId) {
              product.productId = product.productUrl.split('/').pop() || `iceland-${Date.now()}-${index}`;
            }
          }
          
          // Extract rating and reviews
          const ratingEl = element.querySelector('.rating, .stars, [data-test="rating"]');
          if (ratingEl) {
            const ratingText = ratingEl.textContent || '';
            const stars = ratingText.match(/(\d+(?:\.\d+)?)\s*stars?/i);
            if (stars) {
              product.rating = parseFloat(stars[1]);
            }
            
            const reviews = ratingText.match(/\((\d+)\s*reviews?\)/i);
            if (reviews) {
              product.reviewCount = parseInt(reviews[1]);
            }
          }
          
          // Extract offers
          const offerEl = element.querySelector('.offer, .deal, .promotion, .badge, .tag');
          if (offerEl) {
            product.offer = offerEl.textContent?.trim() || '';
          }
          
          // Only add products that have at least a name
          if (product.name) {
            products.push(product);
          }
        });
        
        return products;
      }, searchTerm, category);

      console.log(`✅ Found ${searchResults.length} products from search results`);
      
      // Now get detailed information for each product
      const detailedProducts = [];
      for (const product of searchResults) {
        if (product.productUrl) {
          console.log(`  🔍 Getting details for: ${product.name}`);
          const detailedProduct = await this.scrapeProductDetails(browser, product);
          if (detailedProduct) {
            detailedProducts.push(detailedProduct);
          }
          await this.delay(1000); // Delay between product details
        }
      }
      
      return detailedProducts;
      
    } finally {
      await page.close();
    }
  }

  async scrapeProductDetails(browser, product) {
    const page = await browser.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1366, height: 768 }); // Smaller viewport for better visibility
      
      console.log(`    🌐 Navigating to: ${product.productUrl}`);
      await page.goto(product.productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Handle cookie consent
      try {
        await page.waitForSelector('button[id="onetrust-accept-btn-handler"]', { timeout: 3000 });
        await page.click('button[id="onetrust-accept-btn-handler"]');
        await this.delay(1000);
      } catch (e) {
        // No cookie popup
      }
      
      await this.delay(2000);
      
      // Extract detailed product information
      const detailedData = await page.evaluate((product) => {
        const data = {
          ...product,
          description: '',
          nutrition: {},
          ingredients: '',
          allergens: '',
          storage: '',
          brand: '',
          size: '',
          weight: '',
          expiry: null
        };
        
        // Extract product description
        const descSelectors = [
          '.product-description',
          '.description',
          '.product-details',
          '.product-info',
          '.product-summary'
        ];
        for (const selector of descSelectors) {
          const descEl = document.querySelector(selector);
          if (descEl) {
            data.description = descEl.textContent?.trim() || '';
            break;
          }
        }
        
        // Extract brand
        const brandSelectors = [
          '.brand', '.product-brand', '[data-test="brand"]'
        ];
        for (const selector of brandSelectors) {
          const brandEl = document.querySelector(selector);
          if (brandEl) {
            data.brand = brandEl.textContent?.trim() || '';
            break;
          }
        }
        
        // Extract size/weight
        const sizeSelectors = [
          '.size', '.weight', '.product-size', '.product-weight'
        ];
        for (const selector of sizeSelectors) {
          const sizeEl = document.querySelector(selector);
          if (sizeEl) {
            data.size = sizeEl.textContent?.trim() || '';
            break;
          }
        }
        
        // Extract nutrition information
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
        
        // Extract ingredients
        const ingredientsEl = document.querySelector('.ingredients, .product-ingredients');
        if (ingredientsEl) {
          data.ingredients = ingredientsEl.textContent?.trim() || '';
        }
        
        // Extract allergens
        const allergensEl = document.querySelector('.allergens, .product-allergens');
        if (allergensEl) {
          data.allergens = allergensEl.textContent?.trim() || '';
        }
        
        // Extract storage instructions
        const storageEl = document.querySelector('.storage, .product-storage');
        if (storageEl) {
          data.storage = storageEl.textContent?.trim() || '';
        }
        
        return data;
      }, product);
      
      // Get expiry details from OpenFoodFacts (as requested)
      if (detailedData.name) {
        const expiryData = await this.getExpiryFromOpenFoodFacts(detailedData.name);
        if (expiryData) {
          detailedData.expiry = expiryData;
          this.stats.openFoodFactsFallbacks++;
        }
      }
      
      // Update stats
      this.stats.totalProducts++;
      this.stats.successfulScrapes++;
      if (detailedData.imageUrl) {
        this.stats.productsWithImages++;
      } else {
        this.stats.productsWithoutImages++;
      }
      
      console.log(`    ✅ Complete: ${detailedData.name} - ${detailedData.price}`);
      
      return detailedData;
      
    } catch (error) {
      console.log(`    ❌ Failed to get details for ${product.name}: ${error.message}`);
      this.stats.failedScrapes++;
      return null;
    } finally {
      await page.close();
    }
  }

  async getExpiryFromOpenFoodFacts(productName) {
    try {
      const response = await axios.get(`${this.openFoodFactsUrl}/cgi/search.pl`, {
        params: {
          search_terms: productName,
          search_simple: 1,
          action: 'process',
          json: 1,
          page_size: 1
        }
      });
      
      if (response.data && response.data.products && response.data.products.length > 0) {
        const product = response.data.products[0];
        return {
          type: 'general',
          days: 30, // Default expiry
          storage: 'Check packaging',
          notes: 'Check packaging for expiry date',
          openFoodFactsId: product.id || '',
          openFoodFactsUrl: product.url || ''
        };
      }
    } catch (error) {
      console.log(`    ⚠️ OpenFoodFacts fallback failed: ${error.message}`);
    }
    
    return null;
  }

  async saveToLocalFile(products) {
    console.log('\n💾 Saving products to local file...');
    
    try {
      // Create data directory if it doesn't exist
      const dataDir = path.join(__dirname, '..', 'data', 'scraped-products');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `enhanced-iceland-scraper-${timestamp}.json`;
      const filepath = path.join(dataDir, filename);
      
      // Prepare data for saving
      const saveData = {
        timestamp: new Date().toISOString(),
        store: 'Iceland',
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
          pricePerUnit: product.pricePerUnit,
          offer: product.offer,
          availability: 'Available',
          description: product.description,
          nutrition: product.nutrition,
          ingredients: product.ingredients,
          allergens: product.allergens,
          size: product.size,
          weight: product.weight,
          imageUrl: product.imageUrl,
          rating: product.rating,
          reviewCount: product.reviewCount,
          storage: product.storage,
          expiry: product.expiry,
          url: product.productUrl,
          storeName: 'Iceland',
          storeBrand: 'Iceland',
          searchTerm: product.searchTerm,
          scrapedAt: new Date().toISOString(),
          isActive: true
        })),
        summary: {
          totalProducts: products.length,
          categories: Object.keys(this.essentials).length,
          searchTerms: Object.values(this.essentials).flat().length,
          productsWithImages: this.stats.productsWithImages,
          productsWithoutImages: this.stats.productsWithoutImages,
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
      const summaryFilepath = path.join(dataDir, `iceland-summary-${timestamp}.json`);
      const summaryData = {
        timestamp: saveData.timestamp,
        store: 'Iceland',
        totalProducts: products.length,
        stats: this.stats,
        categories: Object.keys(productsByCategory).map(category => ({
          name: category,
          count: productsByCategory[category].length,
          products: productsByCategory[category].map(p => ({
            name: p.name,
            price: p.price,
            pricePerUnit: p.pricePerUnit,
            imageUrl: p.imageUrl ? 'Yes' : 'No',
            description: p.description ? 'Yes' : 'No'
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

  async scrapeAllEssentials() {
    console.log('🏪 ENHANCED ICELAND SCRAPING STARTED');
    console.log('=' .repeat(60));
    
    const browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--window-size=1366,768', // Set browser window size
        '--start-maximized=false' // Don't maximize window
      ]
    });
    
    try {
      const allProducts = [];
      
      // Scrape each category
      for (const [category, searchTerms] of Object.entries(this.essentials)) {
        console.log(`\n📂 Scraping category: ${category}`);
        
        for (const searchTerm of searchTerms) {
          try {
            console.log(`  🔍 Searching for: ${searchTerm}`);
            
            const products = await this.scrapeSearchResults(browser, searchTerm, category);
            allProducts.push(...products);
            
            console.log(`  ✅ Found ${products.length} products for ${searchTerm}`);
            
            // Delay between searches
            await this.delay(3000);
            
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

  generateReport() {
    console.log('\n📊 ENHANCED ICELAND SCRAPING REPORT');
    console.log('=' .repeat(50));
    console.log(`Total products: ${this.stats.totalProducts}`);
    console.log(`Successful scrapes: ${this.stats.successfulScrapes}`);
    console.log(`Failed scrapes: ${this.stats.failedScrapes}`);
    console.log(`Products with images: ${this.stats.productsWithImages}`);
    console.log(`Products without images: ${this.stats.productsWithoutImages}`);
    console.log(`OpenFoodFacts fallbacks: ${this.stats.openFoodFactsFallbacks}`);
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the scraper
async function main() {
  const scraper = new EnhancedIcelandScraper();
  
  try {
    await scraper.scrapeAllEssentials();
    console.log('\n🎉 Enhanced Iceland scraping completed!');
  } catch (error) {
    console.error('❌ Scraping failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = EnhancedIcelandScraper;
