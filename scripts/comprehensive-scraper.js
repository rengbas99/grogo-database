/**
 * Comprehensive Store Scraper
 * Scrapes all target stores using updated 2025 selectors
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class ComprehensiveScraper {
  constructor() {
    this.stores = {
      'Tesco': {
        baseUrl: 'https://www.tesco.com/groceries/en-GB/search',
        postcode: 'UB8 1ND',
        selectors: {
          productContainer: 'section[data-test="product"]',
          productName: 'a[data-test="product-title"]',
          productPrice: 'span[data-test="price"]',
          productImage: 'img[data-test="product-image"]',
          productLink: 'a[data-test="product-title"]',
          addButton: 'button[data-test="add-button"]'
        }
      },
      'Sainsburys': {
        baseUrl: 'https://www.sainsburys.co.uk/gol-ui/groceries/search',
        postcode: 'UB8 1QW',
        selectors: {
          productContainer: 'div.sainsbury-product',
          productName: 'a.sainsbury-product__title',
          productPrice: 'p.sainsbury-product__price',
          productImage: 'img.sainsbury-product__image',
          productLink: 'a.sainsbury-product__title'
        }
      },
      'Aldi': {
        baseUrl: 'https://groceries.aldi.co.uk/en-GB/Search',
        postcode: 'UB7 7QN',
        selectors: {
          productContainer: '.product-tile',
          productName: '.product-tile__name',
          productPrice: '.product-tile__price',
          productImage: '.product-tile__image img',
          productLink: '.product-tile__link'
        }
      },
      'Lidl': {
        baseUrl: 'https://www.lidl.co.uk/search',
        postcode: 'UB8 1LA',
        selectors: {
          productContainer: 'div.product-info',
          productName: 'a.product-title',
          productPrice: 'span.product-price',
          productImage: 'img.product-image',
          productLink: 'a.product-title'
        }
      },
      'Iceland': {
        baseUrl: 'https://www.iceland.co.uk/search',
        postcode: 'UB8 1LH',
        selectors: {
          productContainer: 'div.product-tile',
          productName: 'a.product-tile__title',
          productPrice: 'span.price__value',
          productImage: 'img.product-tile__image',
          productLink: 'a.product-tile__title'
        }
      }
    };

    this.categories = {
      'Vegetables & Fruit': ['apple', 'banana', 'carrot', 'potato', 'tomato', 'lettuce'],
      'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream'],
      'Meat & Poultry': ['chicken', 'beef', 'pork', 'lamb', 'sausage'],
      'Bakery Items': ['bread', 'croissant', 'muffin', 'cake', 'pastry'],
      'Breakfast Items': ['cereal', 'porridge', 'granola', 'oats'],
      'Snacks & Beverages': ['chocolate', 'biscuit', 'juice', 'coffee', 'tea']
    };
  }

  async scrapeStore(storeName, storeConfig, category, searchTerms, maxProducts = 10) {
    console.log(`\n🏪 Scraping ${storeName} - ${category}...`);
    console.log(`📍 Postcode: ${storeConfig.postcode}`);
    
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
    
    // Set realistic headers and viewport
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set extra headers to avoid bot detection
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });

    const allProducts = [];
    let successfulSearches = 0;

    try {
      for (const term of searchTerms.slice(0, 3)) { // Limit to 3 terms per category
        console.log(`  🔍 Searching for: ${term}`);
        
        const searchUrl = `${storeConfig.baseUrl}?query=${encodeURIComponent(term)}`;
        console.log(`    🌐 URL: ${searchUrl}`);
        
        await page.goto(searchUrl, { 
          waitUntil: 'networkidle2', 
          timeout: 30000 
        });
        
        // Check for Access Denied or bot detection
        const pageTitle = await page.title();
        if (pageTitle.includes('Access Denied') || pageTitle.includes('Blocked') || pageTitle.includes('Forbidden')) {
          console.log(`    🚫 Blocked by ${storeName} for term: "${term}"`);
          console.log(`    🔍 Page title: ${pageTitle}`);
          continue;
        }

        // Wait for dynamic content to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Try to wait for product containers with timeout
        let productCount = 0;
        try {
          await page.waitForSelector(storeConfig.selectors.productContainer, { timeout: 10000 });
          productCount = await page.$$eval(storeConfig.selectors.productContainer, items => items.length);
        } catch (error) {
          console.log(`    ⚠️  No product containers found for "${term}" (${error.message})`);
          
          // Try alternative selectors for dynamic content
          const alternativeSelectors = [
            'div[data-test="product"]',
            '.product-tile',
            '.product-item',
            '[data-testid*="product"]',
            '.product-card'
          ];
          
          for (const altSelector of alternativeSelectors) {
            try {
              const altCount = await page.$$eval(altSelector, items => items.length);
              if (altCount > 0) {
                console.log(`    🔄 Found ${altCount} products with alternative selector: ${altSelector}`);
                productCount = altCount;
                // Update the selector for this scrape
                storeConfig.selectors.productContainer = altSelector;
                break;
              }
            } catch (e) {
              // Continue to next selector
            }
          }
        }

        console.log(`    📊 Found ${productCount} product containers`);

        if (productCount > 0) {
          // Scrape products
          const products = await this.scrapeProducts(page, storeConfig.selectors, term, category, storeName, storeConfig.postcode);
          console.log(`    ✅ Successfully scraped ${products.length} products`);
          
          allProducts.push(...products);
          successfulSearches++;
        } else {
          console.log(`    ⚠️  No products found for "${term}"`);
          console.log(`    🔍 Page title: ${pageTitle}`);
          console.log(`    🔍 Current URL: ${page.url()}`);
        }

        // Delay between searches
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error) {
      console.error(`❌ Error scraping ${storeName}:`, error.message);
    } finally {
      await browser.close();
    }

    // Limit to max products
    const limitedProducts = allProducts.slice(0, maxProducts);
    
    console.log(`📊 ${storeName} Results: ${limitedProducts.length} products, ${successfulSearches}/${searchTerms.length} successful searches`);
    
    return {
      store: storeName,
      category,
      products: limitedProducts,
      totalFound: allProducts.length,
      successfulSearches,
      totalSearches: searchTerms.length,
      successRate: (successfulSearches / searchTerms.length) * 100
    };
  }

  async scrapeProducts(page, selectors, searchTerm, category, storeName, postcode) {
    try {
      const products = await page.$$eval(selectors.productContainer, (items, selectors, searchTerm, category, storeName, postcode) => {
        return items.slice(0, 5).map(item => {
          // Extract product name
          const nameElement = item.querySelector(selectors.productName);
          const name = nameElement?.textContent?.trim() || '';

          // Extract price
          const priceElement = item.querySelector(selectors.productPrice);
          const price = priceElement?.textContent?.trim() || '';

          // Extract image
          const imageElement = item.querySelector(selectors.productImage);
          const image = imageElement?.src || imageElement?.getAttribute('data-src') || '';

          // Extract link
          const linkElement = item.querySelector(selectors.productLink);
          let link = linkElement?.href || '';
          
          // Make sure link is absolute
          if (link && !link.startsWith('http')) {
            const baseUrl = storeName === 'Tesco' ? 'https://www.tesco.com' :
                          storeName === 'Sainsburys' ? 'https://www.sainsburys.co.uk' :
                          storeName === 'Aldi' ? 'https://groceries.aldi.co.uk' :
                          storeName === 'Lidl' ? 'https://www.lidl.co.uk' :
                          'https://www.iceland.co.uk';
            link = baseUrl + link;
          }

          // Determine availability
          const addButton = item.querySelector(selectors.addButton);
          const isAvailable = price && price !== 'Unavailable' && 
                            (!addButton || addButton.textContent?.toLowerCase().includes('add'));

          return {
            name,
            price,
            image,
            link,
            availability: isAvailable ? 'Available' : 'Unavailable',
            searchTerm,
            category,
            store: storeName,
            postcode,
            scrapedAt: new Date().toISOString()
          };
        }).filter(p => p.name && p.name.length > 0);
      }, selectors, searchTerm, category, storeName, postcode);

      return products;
    } catch (error) {
      console.log(`    ⚠️  Scraping error: ${error.message}`);
      return [];
    }
  }

  async scrapeAllStores() {
    console.log('🚀 Starting comprehensive store scraping...\n');
    
    const allResults = {
      scrapedAt: new Date().toISOString(),
      stores: {},
      summary: {
        totalProducts: 0,
        totalStores: 0,
        successfulStores: 0,
        averageSuccessRate: 0
      }
    };

    let totalProducts = 0;
    let successfulStores = 0;
    let totalSuccessRate = 0;

    for (const [storeName, storeConfig] of Object.entries(this.stores)) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏪 PROCESSING ${storeName.toUpperCase()}`);
      console.log(`${'='.repeat(60)}`);

      const storeResults = {
        store: storeName,
        postcode: storeConfig.postcode,
        baseUrl: storeConfig.baseUrl,
        categories: {},
        summary: {
          totalProducts: 0,
          categoriesScraped: 0,
          averageSuccessRate: 0
        }
      };

      let storeTotalProducts = 0;
      let storeSuccessfulCategories = 0;
      let storeTotalSuccessRate = 0;

      for (const [category, searchTerms] of Object.entries(this.categories)) {
        try {
          const categoryResult = await this.scrapeStore(storeName, storeConfig, category, searchTerms, 6);
          
          storeResults.categories[category] = categoryResult;
          storeTotalProducts += categoryResult.products.length;
          
          if (categoryResult.products.length > 0) {
            storeSuccessfulCategories++;
          }
          
          storeTotalSuccessRate += categoryResult.successRate;

          console.log(`✅ ${category}: ${categoryResult.products.length} products (${categoryResult.successRate.toFixed(1)}% success)`);

        } catch (error) {
          console.error(`❌ Failed to scrape ${category} from ${storeName}:`, error.message);
          storeResults.categories[category] = {
            store: storeName,
            category,
            products: [],
            error: error.message
          };
        }

        // Delay between categories
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Update store summary
      storeResults.summary.totalProducts = storeTotalProducts;
      storeResults.summary.categoriesScraped = storeSuccessfulCategories;
      storeResults.summary.averageSuccessRate = storeTotalSuccessRate / Object.keys(this.categories).length;

      allResults.stores[storeName] = storeResults;
      totalProducts += storeTotalProducts;
      allResults.summary.totalStores++;

      if (storeTotalProducts > 0) {
        successfulStores++;
      }

      totalSuccessRate += storeResults.summary.averageSuccessRate;

      console.log(`\n📊 ${storeName} Summary:`);
      console.log(`  📦 Total Products: ${storeTotalProducts}`);
      console.log(`  ✅ Categories Scraped: ${storeSuccessfulCategories}/${Object.keys(this.categories).length}`);
      console.log(`  📈 Average Success Rate: ${storeResults.summary.averageSuccessRate.toFixed(1)}%`);
    }

    // Update overall summary
    allResults.summary.totalProducts = totalProducts;
    allResults.summary.successfulStores = successfulStores;
    allResults.summary.averageSuccessRate = totalSuccessRate / Object.keys(this.stores).length;

    // Save results
    await this.saveResults(allResults);
    
    // Print final summary
    this.printFinalSummary(allResults);

    return allResults;
  }

  async saveResults(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `comprehensive-scraping-results-${timestamp}.json`;
    const filepath = path.join(__dirname, '..', 'data', 'scraped-products', filename);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${filepath}`);
  }

  printFinalSummary(results) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE SCRAPING SUMMARY');
    console.log('='.repeat(80));
    console.log(`📦 Total Products Found: ${results.summary.totalProducts}`);
    console.log(`🏪 Stores Processed: ${results.summary.totalStores}`);
    console.log(`✅ Successful Stores: ${results.summary.successfulStores}`);
    console.log(`📈 Average Success Rate: ${results.summary.averageSuccessRate.toFixed(1)}%`);
    
    console.log('\n📋 Store Breakdown:');
    Object.entries(results.stores).forEach(([storeName, storeData]) => {
      const status = storeData.summary.totalProducts > 0 ? '✅' : '❌';
      console.log(`  ${status} ${storeName}: ${storeData.summary.totalProducts} products (${storeData.summary.averageSuccessRate.toFixed(1)}% success)`);
    });

    console.log('\n🎯 Working Stores:');
    Object.entries(results.stores)
      .filter(([_, data]) => data.summary.totalProducts > 0)
      .forEach(([storeName, data]) => {
        console.log(`  ✅ ${storeName}: ${data.summary.totalProducts} products`);
      });

    console.log('\n❌ Non-Working Stores:');
    Object.entries(results.stores)
      .filter(([_, data]) => data.summary.totalProducts === 0)
      .forEach(([storeName, data]) => {
        console.log(`  ❌ ${storeName}: 0 products`);
      });
  }
}

// Main execution
async function main() {
  const scraper = new ComprehensiveScraper();
  
  try {
    await scraper.scrapeAllStores();
  } catch (error) {
    console.error('❌ Comprehensive scraping failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ComprehensiveScraper;
