/**
 * Iceland Price Scraper using Final Scraper Logic
 * Uses the same price extraction logic as the working price-focused scraper
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

class IcelandPriceScraperFinal {
  constructor() {
    this.completeEssentialsFile = 'data/essentials/complete-essentials-2025-09-19T16-55-28-560Z.json';
    this.outputFile = 'data/iceland-prices-2025-09-20.json';
    this.baseUrl = 'https://www.iceland.co.uk';
  }

  // Load complete essentials data
  loadCompleteEssentials() {
    try {
      const data = JSON.parse(fs.readFileSync(this.completeEssentialsFile, 'utf8'));
      console.log(`📦 Loaded complete essentials: ${data.products.length} products`);
      return data.products;
    } catch (error) {
      console.error('❌ Error loading complete essentials:', error.message);
      return [];
    }
  }

  // Extract Iceland products
  extractIcelandProducts(products) {
    const icelandProducts = products.filter(p => p.store === 'Iceland');
    console.log(`🇮🇸 Found ${icelandProducts.length} Iceland products`);
    return icelandProducts;
  }

  // Initialize browser
  async initBrowser() {
    console.log('🌐 Initializing browser...');
    const browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--force-device-scale-factor=0.5'
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Override the viewport meta tag to make content fill the full width
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // Override viewport meta tag to make content fill full width
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=1920, initial-scale=0.5, minimum-scale=0.5, maximum-scale=5.0, user-scalable=yes');
      }
      
      // Remove any margins or padding that might cause spacing issues
      document.documentElement.style.margin = '0';
      document.documentElement.style.padding = '0';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.width = '100%';
      document.body.style.maxWidth = 'none';
    });

    return { browser, page };
  }

  // Close browser
  async closeBrowser(browser) {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }

  // Get product details using the same logic as IcelandFinalScraper
  async getProductDetails(productId, productName, page) {
    console.log(`🔍 Getting Iceland details for: ${productName} (ID: ${productId})`);
    
    try {
      // Extract the numeric ID from the productId (e.g., "crisp-n-dry-rapeseed-oil-975ml/46393.html" -> "46393")
      const numericId = productId.split('/').pop().replace('.html', '');
      const productUrl = `${this.baseUrl}/p/${productName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}/${numericId}.html`;
      console.log(`🌐 Navigating to: ${productUrl}`);
      
      await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookie consent
      try {
        await page.waitForSelector('button[id="onetrust-accept-btn-handler"]', { timeout: 5000 });
        await page.click('button[id="onetrust-accept-btn-handler"]');
        console.log('✅ Cookie consent accepted');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.log('ℹ️  No cookie consent popup found');
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract product details using the same logic as IcelandFinalScraper
      const productData = await page.evaluate(() => {
        const data = {};

        // Price extraction - same logic as IcelandFinalScraper
        const priceSelectors = [
          '.price-current',
          '.current-price',
          '.price-now',
          '.price-value',
          '.product-price',
          '.price',
          '.price-main',
          '.main-price',
          '.product-price-main',
          '[data-test="main-price"]'
        ];
        
        for (const selector of priceSelectors) {
          const priceEl = document.querySelector(selector);
          if (priceEl) {
            const priceText = priceEl.textContent?.trim() || '';
            const priceMatch = priceText.match(/£(\d+\.?\d*)/);
            if (priceMatch) {
              data.price = priceMatch[0];
              break;
            }
          }
        }
        
        // FIXED: Better price extraction logic for Iceland
        if (!data.price) {
          // Method 1: Look for all elements with price-related classes
          const allPriceElements = document.querySelectorAll('[class*="price"], [class*="value"], [class*="cost"], [class*="amount"]');
          const prices = [];
          
          allPriceElements.forEach(el => {
            const text = el.textContent?.trim() || '';
            const priceMatches = text.match(/£(\d+\.?\d*)/g);
            if (priceMatches) {
              priceMatches.forEach(match => {
                const price = parseFloat(match.replace('£', ''));
                if (price > 0 && price < 50) { // Reasonable price range for groceries
                  prices.push({ price: match, value: price, element: el.className, text: text });
                }
              });
            }
          });
          
          // Method 2: If no elements found, search all text on the page
          if (prices.length === 0) {
            const pageText = document.body.innerText;
            const lines = pageText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            lines.forEach(line => {
              const priceMatches = line.match(/£(\d+\.?\d*)/g);
              if (priceMatches) {
                priceMatches.forEach(match => {
                  const price = parseFloat(match.replace('£', ''));
                  if (price > 0 && price < 50 && !line.includes('per ') && !line.includes('or Less')) {
                    prices.push({ price: match, value: price, element: 'text-search', text: line });
                  }
                });
              }
            });
          }
          
          // Select the best price
          if (prices.length > 0) {
            // Sort by price value and take the first reasonable one
            prices.sort((a, b) => a.value - b.value);
            data.price = prices[0].price;
            console.log(`Found price via ${prices[0].element}: ${prices[0].price} from "${prices[0].text}"`);
          }
        }

        // Price per unit
        const pricePerUnitSelectors = [
          '.price-per-unit',
          '.unit-price',
          '.price-per-kg',
          '.price-per-100g',
          '.price-per-100ml'
        ];

        for (const selector of pricePerUnitSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            data.pricePerUnit = element.textContent.trim();
            break;
          }
        }

        // Offer text
        const offerSelectors = [
          '.offer-text',
          '.promotion',
          '.deal',
          '.saving',
          '[data-test="offer"]',
          '.price-offer',
          '.discount-text'
        ];

        for (const selector of offerSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            data.offer = element.textContent.trim();
            break;
          }
        }

        // Availability
        const availabilitySelectors = [
          '.availability',
          '.stock-status',
          '.product-availability',
          '[data-test="availability"]',
          '.in-stock',
          '.out-of-stock'
        ];

        for (const selector of availabilitySelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            data.availability = element.textContent.trim();
            break;
          }
        }

        // Description
        const descriptionSelectors = [
          '.product-description',
          '.product-details',
          '.description',
          '[data-test="description"]',
          '.product-info',
          '.product-summary'
        ];

        for (const selector of descriptionSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            data.description = element.textContent.trim();
            break;
          }
        }

        return data;
      });

      return {
        price: productData.price || '',
        pricePerUnit: productData.pricePerUnit || '',
        offer: productData.offer || '',
        availability: productData.availability || 'Available',
        description: productData.description || '',
        priceScrapedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Error scraping ${productName}:`, error.message);
      return {
        price: '',
        pricePerUnit: '',
        offer: '',
        availability: 'Error',
        description: '',
        priceScrapedAt: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // Scrape all Iceland products
  async scrapeAllProducts(icelandProducts) {
    console.log(`🚀 Starting to scrape ${icelandProducts.length} Iceland products...`);
    
    const { browser, page } = await this.initBrowser();
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < icelandProducts.length; i++) {
        const product = icelandProducts[i];
        console.log(`\n📦 [${i + 1}/${icelandProducts.length}] Scraping: ${product.name}`);

        try {
          const priceData = await this.getProductDetails(product.productId, product.name, page);
          
          const updatedProduct = {
            ...product,
            price: priceData.price,
            pricePerUnit: priceData.pricePerUnit,
            offer: priceData.offer,
            availability: priceData.availability,
            description: priceData.description || product.description || '',
            priceScrapedAt: priceData.priceScrapedAt
          };

          results.push(updatedProduct);

          if (priceData.price && priceData.price !== '') {
            successCount++;
            console.log(`✅ Price found: ${priceData.price}`);
          } else {
            console.log(`⚠️  No price found`);
          }

          // Add delay between requests
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
          console.error(`❌ Failed to scrape ${product.name}:`, error.message);
          results.push({
            ...product,
            price: '',
            pricePerUnit: '',
            offer: '',
            availability: 'Error',
            description: product.description || '',
            priceScrapedAt: new Date().toISOString(),
            error: error.message
          });
          errorCount++;
        }
      }

      console.log(`\n📊 Scraping completed: ${successCount} successful, ${errorCount} errors`);
      return results;

    } finally {
      await this.closeBrowser(browser);
    }
  }

  // Save results
  async saveResults(updatedProducts) {
    const results = {
      timestamp: new Date().toISOString(),
      totalProducts: updatedProducts.length,
      productsWithPrices: updatedProducts.filter(p => p.price && p.price !== '').length,
      products: updatedProducts
    };

    await fs.promises.writeFile(this.outputFile, JSON.stringify(results, null, 2));
    console.log(`✅ Saved results to: ${this.outputFile}`);
    
    return results;
  }

  // Generate summary
  generateSummary(results) {
    console.log('\n📊 ICELAND PRICE SCRAPING SUMMARY');
    console.log('=' .repeat(60));
    console.log(`📦 Total Products: ${results.totalProducts}`);
    console.log(`💰 Products with Prices: ${results.productsWithPrices} (${Math.round(results.productsWithPrices/results.totalProducts*100)}%)`);
    
    // Show sample products with prices
    const withPrices = results.products.filter(p => p.price && p.price !== '');
    console.log('\n📋 SAMPLE PRODUCTS WITH PRICES:');
    withPrices.slice(0, 5).forEach((product, i) => {
      console.log(`   ${i+1}. ${product.name}: ${product.price}`);
    });
  }

  // Main execution
  async run() {
    console.log('🚀 Starting Iceland Price Scraping with Final Scraper Logic...');
    console.log('=' .repeat(60));

    try {
      // Load complete essentials data
      const allProducts = this.loadCompleteEssentials();
      if (allProducts.length === 0) {
        console.log('❌ No products found in source file');
        return;
      }

      // Extract Iceland products
      const icelandProducts = this.extractIcelandProducts(allProducts);
      if (icelandProducts.length === 0) {
        console.log('❌ No Iceland products found');
        return;
      }

      // Scrape all products
      const updatedProducts = await this.scrapeAllProducts(icelandProducts);

      // Save results
      const results = await this.saveResults(updatedProducts);

      // Generate summary
      this.generateSummary(results);

      console.log('\n✅ Iceland price scraping completed successfully!');

    } catch (error) {
      console.error('❌ Error during scraping:', error.message);
    }
  }
}

// Main execution
async function main() {
  const scraper = new IcelandPriceScraperFinal();
  await scraper.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = IcelandPriceScraperFinal;
