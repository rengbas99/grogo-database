/**
 * Integrated Store Scraper with OpenFoodFacts Enrichment
 * Gets product names from stores, enriches with OpenFoodFacts API
 */

const puppeteer = require('puppeteer');
const cron = require('node-cron');
const OpenFoodFactsService = require('../src/services/OpenFoodFactsService');

class IntegratedStoreScraper {
  constructor() {
    this.openFoodFacts = new OpenFoodFactsService();
    this.stores = {
      'Tesco': {
        baseUrl: 'https://www.tesco.com/groceries/en-GB/search',
        postcode: 'UB8 1ND',
        selectors: {
          productContainer: 'li[data-auto-id="product-list-item"]',
          productName: 'a[data-test="product-title"]',
          productPrice: 'span[data-test="price"]',
          productImage: 'img[data-test="product-image"]',
          productLink: 'a[data-test="product-title"]'
        }
      },
      'Sainsburys': {
        baseUrl: 'https://www.sainsburys.co.uk/gol-ui/groceries/search',
        postcode: 'UB8 1QW',
        selectors: {
          productContainer: 'div.sainsbury-product, .product-tile, [class*="product"]',
          productName: 'a[data-testid*="product"], .product-name, h3, h4',
          productPrice: '[class*="price"], .price, span[class*="cost"]',
          productImage: 'img[class*="product"], .product-image img',
          productLink: 'a[data-testid*="product"], .product-link'
        }
      },
      'Lidl': {
        baseUrl: 'https://www.lidl.co.uk/search',
        postcode: 'UB8 1LA',
        selectors: {
          productContainer: 'div.SearchResultTile, .product-tile, [class*="product"]',
          productName: '.product-name, h3, h4, [class*="title"]',
          productPrice: '.price, [class*="price"], .cost',
          productImage: 'img[class*="product"], .product-image img',
          productLink: 'a[class*="product"], .product-link'
        }
      },
      'Aldi': {
        baseUrl: 'https://www.aldi.co.uk/search',
        postcode: 'UB8 1LB',
        selectors: {
          productContainer: '.product-tile, .product-item, [class*="product"]',
          productName: '.product-name, h3, h4, [class*="title"]',
          productPrice: '.price, [class*="price"], .cost',
          productImage: 'img[class*="product"], .product-image img',
          productLink: 'a[class*="product"], .product-link'
        }
      },
      'Iceland': {
        baseUrl: 'https://www.iceland.co.uk/search',
        postcode: 'UB8 1LH',
        selectors: {
          productContainer: 'div.product-tile, .product-item, [class*="product"]',
          productName: '.product-name, h3, h4, [class*="title"]',
          productPrice: '.price, [class*="price"], .cost',
          productImage: 'img[class*="product"], .product-image img',
          productLink: 'a[class*="product"], .product-link'
        }
      }
    };
  }

  async installMouseHelper(page) {
    await page.evaluate(() => {
      const box = document.createElement('div');
      box.id = 'mouse-helper';
      Object.assign(box.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '20px',
        height: '20px',
        backgroundColor: 'rgba(0,0,0,0.4)',
        border: '1px solid white',
        borderRadius: '10px',
        pointerEvents: 'none',
        transition: 'transform 0.1s ease-out',
        transform: 'translate(-50%, -50%)',
        zIndex: 10000,
      });
      document.body.appendChild(box);
      document.addEventListener('mousemove', e => {
        box.style.left = `${e.pageX}px`;
        box.style.top = `${e.pageY}px`;
      });
    });
  }

  async simulateHumanBehavior(page) {
    // Random mouse movements
    await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200);
    await page.waitForTimeout(500 + Math.random() * 1000);
    await page.mouse.move(300 + Math.random() * 200, 200 + Math.random() * 200);
    await page.waitForTimeout(500 + Math.random() * 1000);
  }

  async handleCookieConsent(page, storeName) {
    try {
      console.log(`🍪 Handling cookie consent for ${storeName}...`);
      
      // Wait for cookie consent popup
      await page.waitForSelector([
        '[data-testid="consent-banner"]',
        '.cookie-banner',
        '[class*="cookie"]',
        '[class*="consent"]',
        '.cookie-notice',
        'button[name="accept"]',
        'button[data-testid*="accept"]'
      ].join(','), { timeout: 5000 });

      // Try different accept button selectors
      const acceptSelectors = [
        'button[name="accept"]',
        'button[data-testid="accept-all"]',
        'button:contains("Accept all")',
        'button:contains("Accept All")',
        'button:contains("Accept")',
        'button:contains("Allow")',
        '[data-testid="accept-all"]',
        '.cookie-accept',
        '.consent-accept',
        '.accept-all',
        '.cookie-allow'
      ];

      let accepted = false;
      for (const selector of acceptSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            console.log(`✅ Clicked accept button: ${selector}`);
            accepted = true;
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (!accepted) {
        // Try to find any button with accept-related text
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await button.evaluate(el => el.textContent?.toLowerCase() || '');
          if (text.includes('accept') || text.includes('allow') || text.includes('ok') || text.includes('continue')) {
            await button.click();
            console.log(`✅ Clicked accept button with text: ${text}`);
            accepted = true;
            break;
          }
        }
      }

      if (accepted) {
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
      }

    } catch (e) {
      console.log(`ℹ️  No cookie consent popup found for ${storeName}`);
    }
  }

  async scrapeStoreProducts(storeName, searchTerm) {
    console.log(`\n🏪 Scraping ${storeName} for: "${searchTerm}"`);
    
    const storeConfig = this.stores[storeName];
    if (!storeConfig) {
      throw new Error(`Store ${storeName} not configured`);
    }

    const browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();

    try {
      // Stealth and user mimicking
      await this.installMouseHelper(page);
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1366, height: 768 });

      // Set extra headers
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      });

      const url = `${storeConfig.baseUrl}?query=${encodeURIComponent(searchTerm)}`;
      console.log(`🌐 Navigating to: ${url}`);
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookie consent
      await this.handleCookieConsent(page, storeName);

      // Simulate human behavior
      await this.simulateHumanBehavior(page);

      // Wait for products to load
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));

      console.log(`🔍 Extracting products...`);

      // Extract products using multiple methods
      const products = await page.evaluate((selectors, searchTerm, storeName, postcode) => {
        const results = [];
        
        // Method 1: Try specific selectors
        const containers = document.querySelectorAll(selectors.productContainer);
        console.log(`Found ${containers.length} product containers`);
        
        containers.forEach(container => {
          const nameEl = container.querySelector(selectors.productName);
          const priceEl = container.querySelector(selectors.productPrice);
          const imageEl = container.querySelector(selectors.productImage);
          const linkEl = container.querySelector(selectors.productLink);
          
          if (nameEl && priceEl) {
            const name = nameEl.textContent?.trim() || '';
            const price = priceEl.textContent?.trim() || '';
            const image = imageEl?.src || '';
            const link = linkEl?.href || '';
            
            if (name && price && name.length > 3 && name.length < 200) {
              results.push({
                name,
                price,
                image,
                link,
                availability: 'Available',
                searchTerm,
                store: storeName,
                postcode,
                scrapedAt: new Date().toISOString()
              });
            }
          }
        });

        // Method 2: Smart text parsing if no containers found
        if (results.length === 0) {
          console.log('No containers found, trying smart text parsing...');
          
          const pageText = document.body.innerText;
          const lines = pageText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const priceMatch = line.match(/£(\d+\.?\d*)/);
            
            if (priceMatch) {
              // Look backwards for product name
              for (let j = Math.max(0, i - 5); j < i; j++) {
                const prevLine = lines[j];
                
                if (prevLine && 
                    prevLine.length > 5 && 
                    prevLine.length < 100 &&
                    !prevLine.includes('£') &&
                    !prevLine.includes('Help Centre') &&
                    !prevLine.includes('Skip to') &&
                    !prevLine.includes('Log in') &&
                    !prevLine.includes('Register') &&
                    !prevLine.includes('Trolley') &&
                    !prevLine.includes('Filter') &&
                    !prevLine.includes('Sort') &&
                    !prevLine.includes('Results') &&
                    !prevLine.includes('Showing') &&
                    (prevLine.includes(searchTerm.toLowerCase()) || 
                     prevLine.match(/[A-Z][a-z]+.*[A-Z][a-z]+/) ||
                     prevLine.includes('ml') || prevLine.includes('L') || 
                     prevLine.includes('kg') || prevLine.includes('g') ||
                     prevLine.includes('pack') || prevLine.includes('Pack'))) {
                  
                  results.push({
                    name: prevLine,
                    price: priceMatch[0],
                    image: '',
                    link: '',
                    availability: 'Available',
                    searchTerm,
                    store: storeName,
                    postcode,
                    scrapedAt: new Date().toISOString()
                  });
                  break;
                }
              }
            }
          }
        }

        // Remove duplicates
        const uniqueResults = [];
        const seenNames = new Set();
        
        results.forEach(product => {
          if (!seenNames.has(product.name.toLowerCase())) {
            seenNames.add(product.name.toLowerCase());
            uniqueResults.push(product);
          }
        });

        return uniqueResults.slice(0, 10); // Limit to 10 products
      }, storeConfig.selectors, searchTerm, storeName, storeConfig.postcode);

      console.log(`✅ Found ${products.length} products from ${storeName}`);

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error scraping ${storeName}:`, error.message);
      await browser.close();
      return [];
    }
  }

  async enrichWithOpenFoodFacts(products) {
    console.log(`\n🔍 Enriching ${products.length} products with OpenFoodFacts data...`);
    
    const enrichedProducts = [];

    for (const product of products) {
      try {
        console.log(`🔍 Searching OpenFoodFacts for: "${product.name}"`);
        
        // Search OpenFoodFacts for this product
        const searchResult = await this.openFoodFacts.searchProducts(product.name, 1, 5);
        
        if (searchResult && searchResult.products && searchResult.products.length > 0) {
          // Find the best match
          const bestMatch = searchResult.products[0];
          
          // Enrich the product with OpenFoodFacts data
          const enrichedProduct = {
            ...product,
            // Store data
            storeName: product.name,
            storePrice: product.price,
            storeImage: product.image,
            storeLink: product.link,
            storeAvailability: product.availability,
            
            // OpenFoodFacts data
            productName: bestMatch.product_name || product.name,
            brands: bestMatch.brands || '',
            categories: bestMatch.categories || '',
            ingredients: bestMatch.ingredients_text || '',
            allergens: bestMatch.allergens_tags || [],
            additives: bestMatch.additives_tags || [],
            nutrition: bestMatch.nutriments || {},
            novaGroup: bestMatch.nova_group || null,
            ecoscoreGrade: bestMatch.ecoscore_grade || null,
            nutriscoreGrade: bestMatch.nutriscore_grade || null,
            imageUrl: bestMatch.image_url || bestMatch.image_front_url || product.image,
            barcode: bestMatch.code || null,
            lastModified: bestMatch.last_modified_t || null,
            dataQuality: bestMatch.data_quality_tags || [],
            
            // Combined data
            finalName: bestMatch.product_name || product.name,
            finalPrice: product.price,
            finalImage: bestMatch.image_url || bestMatch.image_front_url || product.image,
            finalAvailability: product.availability,
            
            // Metadata
            enrichedAt: new Date().toISOString(),
            enrichmentSource: 'OpenFoodFacts'
          };

          enrichedProducts.push(enrichedProduct);
          console.log(`✅ Enriched: ${enrichedProduct.finalName}`);
          
        } else {
          // No OpenFoodFacts data found, use store data as-is
          const fallbackProduct = {
            ...product,
            finalName: product.name,
            finalPrice: product.price,
            finalImage: product.image,
            finalAvailability: product.availability,
            enrichedAt: new Date().toISOString(),
            enrichmentSource: 'Store Only'
          };
          
          enrichedProducts.push(fallbackProduct);
          console.log(`⚠️  No OpenFoodFacts data for: ${product.name}`);
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Error enriching product "${product.name}":`, error.message);
        
        // Add fallback product
        enrichedProducts.push({
          ...product,
          finalName: product.name,
          finalPrice: product.price,
          finalImage: product.image,
          finalAvailability: product.availability,
          enrichedAt: new Date().toISOString(),
          enrichmentSource: 'Store Only (Error)'
        });
      }
    }

    return enrichedProducts;
  }

  async scrapeAndEnrich(searchTerm, storeNames = null) {
    console.log(`\n🚀 Starting integrated scraping for: "${searchTerm}"`);
    
    const storesToScrape = storeNames || Object.keys(this.stores);
    const allProducts = [];

    // Scrape from all stores
    for (const storeName of storesToScrape) {
      try {
        const products = await this.scrapeStoreProducts(storeName, searchTerm);
        allProducts.push(...products);
        
        // Delay between stores
        await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 3000));
        
      } catch (error) {
        console.error(`❌ Error scraping ${storeName}:`, error.message);
      }
    }

    console.log(`\n📊 Scraping Summary:`);
    console.log(`  Total products found: ${allProducts.length}`);
    console.log(`  Stores scraped: ${storesToScrape.length}`);

    // Enrich with OpenFoodFacts
    const enrichedProducts = await this.enrichWithOpenFoodFacts(allProducts);

    console.log(`\n🎯 Final Results:`);
    console.log(`  Enriched products: ${enrichedProducts.length}`);
    console.log(`  OpenFoodFacts enriched: ${enrichedProducts.filter(p => p.enrichmentSource === 'OpenFoodFacts').length}`);
    console.log(`  Store only: ${enrichedProducts.filter(p => p.enrichmentSource !== 'OpenFoodFacts').length}`);

    return enrichedProducts;
  }

  async testAllStores(searchTerm = 'apple') {
    console.log(`\n🧪 Testing all stores with: "${searchTerm}"`);
    
    const results = {};
    
    for (const storeName of Object.keys(this.stores)) {
      try {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`Testing ${storeName}`);
        console.log(`${'='.repeat(50)}`);
        
        const products = await this.scrapeStoreProducts(storeName, searchTerm);
        results[storeName] = {
          success: true,
          productCount: products.length,
          products: products.slice(0, 3) // Sample first 3
        };
        
        console.log(`✅ ${storeName}: ${products.length} products`);
        
        // Delay between stores
        await new Promise(resolve => setTimeout(resolve, 5000));
        
      } catch (error) {
        console.error(`❌ ${storeName}: ${error.message}`);
        results[storeName] = {
          success: false,
          productCount: 0,
          products: [],
          error: error.message
        };
      }
    }

    // Print summary
    console.log(`\n📊 TEST SUMMARY:`);
    Object.entries(results).forEach(([store, result]) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${store}: ${result.productCount} products`);
    });

    return results;
  }
}

// Main execution
async function main() {
  const scraper = new IntegratedStoreScraper();
  
  try {
    // Test all stores first
    await scraper.testAllStores('apple');
    
    // Then do a full scrape and enrich
    console.log(`\n${'='.repeat(80)}`);
    console.log(`FULL SCRAPE AND ENRICHMENT`);
    console.log(`${'='.repeat(80)}`);
    
    const enrichedProducts = await scraper.scrapeAndEnrich('apple', ['Tesco', 'Sainsburys']);
    
    console.log(`\n🎉 Scraping complete! Found ${enrichedProducts.length} enriched products.`);
    
  } catch (error) {
    console.error('❌ Main execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = IntegratedStoreScraper;
