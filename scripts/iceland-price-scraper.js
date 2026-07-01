/**
 * Iceland Price Scraper
 * Scrapes prices for Iceland products from complete-essentials dataset using existing approach
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

class IcelandPriceScraper {
  constructor() {
    this.browser = null;
    this.page = null;
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
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    // Set user agent
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set viewport
    await this.page.setViewport({ width: 1366, height: 768 });
  }

  // Close browser
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Browser closed');
    }
  }

  // Scrape price for a single product
  async scrapeProductPrice(product) {
    try {
      // Build product URL from productId
      const productUrl = `${this.baseUrl}/${product.productId}`;
      console.log(`🔍 Scraping: ${product.name} - ${productUrl}`);

      // Navigate to product page
      await this.page.goto(productUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Handle cookie consent if present
      try {
        await this.page.click('button[id*="cookie"], button[class*="cookie"], .cookie-accept, #onetrust-accept-btn-handler', { timeout: 3000 });
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        // Cookie consent not found or already accepted
      }

      // Extract product details
      const productData = await this.page.evaluate(() => {
        const data = {};

        // Price extraction
        const priceSelectors = [
          '.price-current',
          '.price',
          '.product-price',
          '.current-price',
          '[data-test="price"]',
          '.price-value',
          '.product-price-current'
        ];

        for (const selector of priceSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            data.price = element.textContent.trim();
            break;
          }
        }

        // Price per unit
        const pricePerUnitSelectors = [
          '.price-per-unit',
          '.unit-price',
          '.price-per-kg',
          '.price-per-100g'
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
          '[data-test="offer"]'
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
          '[data-test="availability"]'
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
          '[data-test="description"]'
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
        ...product,
        price: productData.price || '',
        pricePerUnit: productData.pricePerUnit || '',
        offer: productData.offer || '',
        availability: productData.availability || 'Available',
        description: productData.description || product.description || '',
        priceScrapedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Error scraping ${product.name}:`, error.message);
      return {
        ...product,
        price: '',
        pricePerUnit: '',
        offer: '',
        availability: 'Error',
        description: product.description || '',
        priceScrapedAt: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // Scrape all Iceland products
  async scrapeAllProducts(icelandProducts) {
    console.log(`🚀 Starting to scrape ${icelandProducts.length} Iceland products...`);
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < icelandProducts.length; i++) {
      const product = icelandProducts[i];
      console.log(`\n📦 [${i + 1}/${icelandProducts.length}] Scraping: ${product.name}`);

      try {
        const updatedProduct = await this.scrapeProductPrice(product);
        results.push(updatedProduct);

        if (updatedProduct.price && updatedProduct.price !== '') {
          successCount++;
          console.log(`✅ Price found: ${updatedProduct.price}`);
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
    console.log('🚀 Starting Iceland Price Scraping...');
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

      // Initialize browser
      await this.initBrowser();

      // Scrape all products
      const updatedProducts = await this.scrapeAllProducts(icelandProducts);

      // Save results
      const results = await this.saveResults(updatedProducts);

      // Generate summary
      this.generateSummary(results);

      console.log('\n✅ Iceland price scraping completed successfully!');

    } catch (error) {
      console.error('❌ Error during scraping:', error.message);
    } finally {
      await this.closeBrowser();
    }
  }
}

// Main execution
async function main() {
  const scraper = new IcelandPriceScraper();
  await scraper.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = IcelandPriceScraper;






