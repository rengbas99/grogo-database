/**
 * Smart Scraper for Remaining Stores
 * Fixes Sainsburys, Lidl, and Iceland using smart text parsing
 */

const puppeteer = require('puppeteer');

class SmartRemainingStores {
  constructor() {
    this.stores = {
      'Sainsburys': {
        baseUrl: 'https://www.sainsburys.co.uk/gol-ui/groceries/search',
        postcode: 'UB8 1QW'
      },
      'Lidl': {
        baseUrl: 'https://www.lidl.co.uk/search',
        postcode: 'UB8 1LA'
      },
      'Iceland': {
        baseUrl: 'https://www.iceland.co.uk/search',
        postcode: 'UB8 1LH'
      }
    };
  }

  async scrapeStore(storeName, storeConfig, searchTerm) {
    console.log(`\n🔍 Smart scraping ${storeName} for: "${searchTerm}"`);
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

    // Set realistic User-Agent and viewport
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

    try {
      const url = `${storeConfig.baseUrl}?query=${encodeURIComponent(searchTerm)}`;
      console.log(`🌐 Navigating to: ${url}`);
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookie consent for each store
      await this.handleCookieConsent(page, storeName);

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log(`🔍 Extracting products using smart text parsing...`);

      // Extract products using improved text parsing
      const products = await page.evaluate((searchTerm, storeName, postcode) => {
        const results = [];
        
        // First, try to find product containers using common selectors
        const productSelectors = [
          '[data-testid*="product"]',
          '[class*="product"]',
          '[class*="item"]',
          '[class*="card"]',
          'article',
          '.product',
          '.item',
          '.card',
          '.product-item',
          '.product-card'
        ];
        
        let productElements = [];
        for (const selector of productSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            productElements = Array.from(elements);
            console.log(`Found ${elements.length} elements with selector: ${selector}`);
            break;
          }
        }
        
        // If we found product containers, extract from them
        if (productElements.length > 0) {
          productElements.forEach((element, index) => {
            const text = element.textContent?.trim() || '';
            
            // Look for price in the element
            const priceMatch = text.match(/£(\d+\.?\d*)/);
            if (priceMatch) {
              // Extract product name (remove price and other metadata)
              let productName = text.replace(priceMatch[0], '').trim();
              
              // Clean up the product name
              productName = productName
                .replace(/\n.*/g, '') // Remove everything after first newline
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
              
              // Filter out navigation elements and invalid names
              if (productName.length > 5 && 
                  productName.length < 100 &&
                  !productName.includes('Help Centre') &&
                  !productName.includes('Skip to') &&
                  !productName.includes('Log in') &&
                  !productName.includes('Register') &&
                  !productName.includes('Trolley') &&
                  !productName.includes('Store Locator') &&
                  !productName.includes('Filter') &&
                  !productName.includes('Sort') &&
                  !productName.includes('Results') &&
                  !productName.includes('Showing') &&
                  !productName.includes('Quantity') &&
                  !productName.includes('Add to') &&
                  !productName.includes('View') &&
                  !productName.includes('Details') &&
                  productName !== searchTerm) {
                
                results.push({
                  name: productName,
                  price: priceMatch[0],
                  image: '',
                  link: '',
                  availability: 'Available',
                  searchTerm,
                  store: storeName,
                  postcode,
                  scrapedAt: new Date().toISOString()
                });
              }
            }
          });
        }
        
        // If no products found through selectors, try smart text parsing
        if (results.length === 0) {
          console.log('No product containers found, trying smart text parsing...');
          
          // Get all text content from the page
          const pageText = document.body.innerText;
          const lines = pageText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
          
          // Look for product patterns in the text
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Look for price patterns (£X.XX or £X)
            const priceMatch = line.match(/£(\d+\.?\d*)/);
            
            if (priceMatch) {
              // Look backwards for the product name (usually 1-5 lines before the price)
              for (let j = Math.max(0, i - 5); j < i; j++) {
                const prevLine = lines[j];
                
                // Check if this looks like a product name
                if (prevLine && 
                    prevLine.length > 10 && 
                    prevLine.length < 100 &&
                    !prevLine.includes('£') &&
                    !prevLine.includes('Help Centre') &&
                    !prevLine.includes('Skip to') &&
                    !prevLine.includes('Log in') &&
                    !prevLine.includes('Register') &&
                    !prevLine.includes('Trolley') &&
                    !prevLine.includes('Store Locator') &&
                    !prevLine.includes('Filter') &&
                    !prevLine.includes('Sort') &&
                    !prevLine.includes('Results') &&
                    !prevLine.includes('Showing') &&
                    !prevLine.includes('Quantity') &&
                    !prevLine.includes('Add to') &&
                    !prevLine.includes('View') &&
                    !prevLine.includes('Details') &&
                    (prevLine.includes(searchTerm.toLowerCase()) || 
                     prevLine.match(/[A-Z][a-z]+.*[A-Z][a-z]+/) || // Has proper case
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
        
        // Remove duplicates and filter out invalid products
        const uniqueProducts = [];
        const seenNames = new Set();
        
        results.forEach(product => {
          if (product.name && 
              product.name.length > 5 && 
              product.name.length < 200 && 
              !seenNames.has(product.name.toLowerCase()) &&
              !product.name.includes('Your privacy') &&
              !product.name.includes('Filter') &&
              !product.name.includes('Sort') &&
              !product.name.includes('Results') &&
              !product.name.includes('Showing') &&
              !product.name.includes('Rest of shelf') &&
              !product.name.includes('Offer valid') &&
              !product.name.includes('Help Centre') &&
              !product.name.includes('Skip to') &&
              !product.name.includes('Log in') &&
              !product.name.includes('Register') &&
              !product.name.includes('Trolley') &&
              !product.name.includes('Store Locator')) {
            
            seenNames.add(product.name.toLowerCase());
            uniqueProducts.push(product);
          }
        });
        
        return uniqueProducts.slice(0, 10); // Limit to 10 products
      }, searchTerm, storeName, storeConfig.postcode);

      console.log(`✅ Found ${products.length} products`);
      
      // Display products
      if (products.length > 0) {
        console.log(`\n📦 Products found:`);
        products.forEach((product, i) => {
          console.log(`  ${i + 1}. ${product.name}`);
          console.log(`     Price: ${product.price}`);
          console.log(`     Availability: ${product.availability}`);
        });
      }

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error scraping ${storeName}:`, error.message);
      await browser.close();
      return [];
    }
  }

  async handleCookieConsent(page, storeName) {
    try {
      // Wait for cookie consent popup to appear
      await page.waitForSelector('[data-testid="consent-banner"], .cookie-banner, [class*="cookie"], [class*="consent"], .cookie-notice', { timeout: 5000 });
      console.log(`✅ Cookie consent popup found for ${storeName}`);
      
      // Try to click "Accept All" button
      const acceptSelectors = [
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
          await page.click(selector);
          console.log(`✅ Clicked accept button with selector: ${selector}`);
          accepted = true;
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!accepted) {
        // Try to find and click any button that might accept cookies
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
        // Wait for popup to disappear and page to reload
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
    } catch (e) {
      console.log(`ℹ️  No cookie consent popup found for ${storeName}`);
    }
  }

  async testStore(storeName, storeConfig) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏪 TESTING ${storeName.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);

    const testTerms = ['apple', 'milk', 'bread'];
    const allResults = [];

    for (const term of testTerms) {
      try {
        const products = await this.scrapeStore(storeName, storeConfig, term);
        
        allResults.push({
          searchTerm: term,
          productCount: products.length,
          products: products.slice(0, 3), // Keep first 3 for sample
          success: products.length > 0
        });

        console.log(`✅ "${term}": ${products.length} products found`);

      } catch (error) {
        console.error(`❌ Error testing "${term}":`, error.message);
        allResults.push({
          searchTerm: term,
          productCount: 0,
          products: [],
          success: false,
          error: error.message
        });
      }

      // Delay between searches
      console.log(`⏳ Waiting 5 seconds before next search...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Print store summary
    const successfulSearches = allResults.filter(r => r.success).length;
    const totalProducts = allResults.reduce((sum, r) => sum + r.productCount, 0);
    
    console.log(`\n📊 ${storeName} Summary:`);
    console.log(`  📦 Total Products: ${totalProducts}`);
    console.log(`  ✅ Successful Searches: ${successfulSearches}/${testTerms.length}`);
    console.log(`  📈 Success Rate: ${(successfulSearches / testTerms.length * 100).toFixed(1)}%`);

    return {
      store: storeName,
      postcode: storeConfig.postcode,
      results: allResults,
      summary: {
        totalProducts,
        successfulSearches,
        successRate: (successfulSearches / testTerms.length * 100)
      }
    };
  }

  async testAllStores() {
    console.log('🚀 Starting smart scraping for remaining stores...\n');
    
    const allResults = [];

    for (const [storeName, storeConfig] of Object.entries(this.stores)) {
      try {
        const storeResult = await this.testStore(storeName, storeConfig);
        allResults.push(storeResult);
      } catch (error) {
        console.error(`❌ Error testing ${storeName}:`, error.message);
        allResults.push({
          store: storeName,
          postcode: storeConfig.postcode,
          results: [],
          summary: { totalProducts: 0, successfulSearches: 0, successRate: 0 },
          error: error.message
        });
      }
    }

    // Print final summary
    this.printFinalSummary(allResults);

    return allResults;
  }

  printFinalSummary(allResults) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 REMAINING STORES SCRAPER SUMMARY`);
    console.log(`${'='.repeat(80)}`);
    
    let totalProducts = 0;
    let totalSuccessfulSearches = 0;
    let totalSearches = 0;

    allResults.forEach(result => {
      const { store, postcode, summary } = result;
      totalProducts += summary.totalProducts;
      totalSuccessfulSearches += summary.successfulSearches;
      totalSearches += 3; // 3 search terms per store

      const status = summary.successRate > 0 ? '✅' : '❌';
      console.log(`\n${status} ${store}`);
      console.log(`  📍 Postcode: ${postcode}`);
      console.log(`  📦 Total Products: ${summary.totalProducts}`);
      console.log(`  ✅ Successful Searches: ${summary.successfulSearches}/3`);
      console.log(`  📈 Success Rate: ${summary.successRate.toFixed(1)}%`);
    });

    console.log(`\n🎯 OVERALL SUMMARY:`);
    console.log(`  📦 Total Products Found: ${totalProducts}`);
    console.log(`  ✅ Total Successful Searches: ${totalSuccessfulSearches}/${totalSearches}`);
    console.log(`  📈 Overall Success Rate: ${(totalSuccessfulSearches / totalSearches * 100).toFixed(1)}%`);

    console.log(`\n✅ Working Stores:`);
    allResults
      .filter(result => result.summary.successRate > 0)
      .forEach(result => {
        console.log(`  ✅ ${result.store}: ${result.summary.totalProducts} products`);
      });

    console.log(`\n❌ Non-Working Stores:`);
    allResults
      .filter(result => result.summary.successRate === 0)
      .forEach(result => {
        console.log(`  ❌ ${result.store}: 0 products`);
      });
  }
}

// Main execution
async function main() {
  const scraper = new SmartRemainingStores();
  
  try {
    await scraper.testAllStores();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = SmartRemainingStores;
