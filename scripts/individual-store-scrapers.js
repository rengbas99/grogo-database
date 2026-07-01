/**
 * Individual Store Scrapers
 * Separate scrapers for each store with proper filtering
 */

const puppeteer = require('puppeteer');
const OpenFoodFactsService = require('../src/services/OpenFoodFactsService');

class IndividualStoreScrapers {
  constructor() {
    this.openFoodFacts = new OpenFoodFactsService();
  }

  async scrapeTesco(searchTerm) {
    console.log(`\n🏪 Scraping Tesco for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      const url = `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(searchTerm)}`;
      console.log(`🌐 Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookie consent
      try {
        await page.waitForSelector('button[name="accept"]', { timeout: 5000 });
        await page.click('button[name="accept"]');
        console.log('✅ Cookie consent accepted');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.log('ℹ️  No cookie consent popup found');
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Smart text parsing with better filtering
      const products = await page.evaluate((searchTerm) => {
        const pageContent = document.body.innerText;
        const lines = pageContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        const products = [];
        const excludePatterns = [
          'Rest of shelf',
          'Offer valid for delivery',
          'Clubcard Price',
          'Filter',
          'Sort by',
          'Results',
          'Showing',
          'Help Centre',
          'Skip to',
          'Log in',
          'Register',
          'Trolley',
          'Store Locator',
          'Quantity',
          'Add to',
          'View',
          'Details',
          'p Clubcard',
          'p per',
          'per kg',
          'per 100g',
          'per pack',
          'per item',
          'each',
          'was',
          'now',
          'save',
          'off',
          'reduced',
          'clearance',
          'new',
          'limited',
          'exclusive',
          'special',
          'offer',
          'deal',
          'promotion',
          'sale',
          'discount'
        ];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Check if line looks like a product name
          if (line.length > 10 && line.length < 100 && 
              !excludePatterns.some(pattern => line.includes(pattern)) &&
              !line.match(/^\d+[p£]/) && // Not starting with price
              !line.match(/^\d+\.\d+[p£]/) && // Not starting with decimal price
              !line.match(/^\d+%/) && // Not starting with percentage
              !line.match(/^\d+x\d+/) && // Not quantity patterns
              line.includes(searchTerm.toLowerCase())) { // Must contain search term
            
            const nextLine = lines[i + 1] || '';
            const priceMatch = nextLine.match(/£(\d+\.\d{2}|\d+)/);
            
            if (priceMatch) {
              products.push({ 
                name: line,
                price: priceMatch[0],
                availability: 'Available',
                searchTerm,
                store: 'Tesco',
                postcode: 'UB8 1ND',
                scrapedAt: new Date().toISOString()
              });
              i++; // Skip the price line
              if (products.length >= 10) break;
            }
          }
        }
        return products;
      }, searchTerm);

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error scraping Tesco:`, error.message);
      await browser.close();
      return [];
    }
  }

  async scrapeAldi(searchTerm) {
    console.log(`\n🏪 Scraping Aldi for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      const url = `https://www.aldi.co.uk/search?query=${encodeURIComponent(searchTerm)}`;
      console.log(`🌐 Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to find product containers
      const products = await page.evaluate((searchTerm) => {
        const products = [];
        
        // Try different selectors for Aldi
        const selectors = [
          '.product-tile',
          '.product-item',
          '[class*="product"]',
          'article',
          '.product-card',
          '.search-result',
          '.item'
        ];
        
        let productElements = [];
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            productElements = Array.from(elements);
            console.log(`Found ${elements.length} elements with selector: ${selector}`);
            break;
          }
        }
        
        // Extract from found elements
        productElements.forEach(element => {
          const nameEl = element.querySelector('.product-name, h3, h4, [class*="title"], .title, .name');
          const priceEl = element.querySelector('.price, [class*="price"], .cost, .amount, [class*="cost"]');
          
          if (nameEl && priceEl) {
            const name = nameEl.textContent?.trim() || '';
            const price = priceEl.textContent?.trim() || '';
            
            if (name && price && name.length > 3 && 
                !name.includes('Search') && !name.includes('Filter') &&
                name.includes(searchTerm.toLowerCase())) {
              products.push({
                name,
                price,
                availability: 'Available',
                searchTerm,
                store: 'Aldi',
                postcode: 'UB8 1LB',
                scrapedAt: new Date().toISOString()
              });
            }
          }
        });
        
        return products.slice(0, 10);
      }, searchTerm);

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error scraping Aldi:`, error.message);
      await browser.close();
      return [];
    }
  }

  async scrapeSainsburys(searchTerm) {
    console.log(`\n🏪 Scraping Sainsburys for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      // Use the specific category page URL for apples
      const url = 'https://www.sainsburys.co.uk/gol-ui/groceries/fruit-and-vegetables/fresh-fruit/apples/c:1034099';
      console.log(`🌐 Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookie consent
      try {
        await page.waitForSelector('[data-testid="consent-banner"], .cookie-banner, button[name="accept"]', { timeout: 5000 });
        const acceptButton = await page.$('button[name="accept"], [data-testid="accept-all"], button:contains("Accept")');
        if (acceptButton) {
          await acceptButton.click();
          console.log('✅ Cookie consent accepted');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (e) {
        console.log('ℹ️  No cookie consent popup found');
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract products from category page
      const products = await page.evaluate((searchTerm) => {
        const products = [];
        
        // Try multiple selectors for Sainsburys
        const selectors = [
          '.sainsbury-product',
          '.product-tile',
          '[class*="product"]',
          'article',
          '.product-item',
          '.product-card',
          '[data-testid*="product"]'
        ];
        
        let productElements = [];
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            productElements = Array.from(elements);
            console.log(`Found ${elements.length} elements with selector: ${selector}`);
            break;
          }
        }
        
        productElements.forEach(element => {
          const nameEl = element.querySelector('a[data-testid*="product"], .product-name, h3, h4, [class*="title"]');
          const priceEl = element.querySelector('[class*="price"], .price, span[class*="cost"]');
          
          if (nameEl && priceEl) {
            const name = nameEl.textContent?.trim() || '';
            const price = priceEl.textContent?.trim() || '';
            
            if (name && price && name.length > 3 && 
                !name.includes('Help Centre') && !name.includes('Skip to') &&
                !name.includes('Log in') && !name.includes('Register') &&
                name.includes(searchTerm.toLowerCase())) {
              products.push({
                name,
                price,
                availability: 'Available',
                searchTerm,
                store: 'Sainsburys',
                postcode: 'UB8 1QW',
                scrapedAt: new Date().toISOString()
              });
            }
          }
        });
        
        return products.slice(0, 10);
      }, searchTerm);

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error scraping Sainsburys:`, error.message);
      await browser.close();
      return [];
    }
  }

  async scrapeLidl(searchTerm) {
    console.log(`\n🏪 Scraping Lidl for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      const url = `https://www.lidl.co.uk/q/search?q=${encodeURIComponent(searchTerm)}`;
      console.log(`🌐 Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookie consent
      try {
        await page.waitForSelector('[data-testid="consent-banner"], .cookie-banner, button[name="accept"]', { timeout: 5000 });
        const acceptButton = await page.$('button[name="accept"], [data-testid="accept-all"], button:contains("Accept")');
        if (acceptButton) {
          await acceptButton.click();
          console.log('✅ Cookie consent accepted');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (e) {
        console.log('ℹ️  No cookie consent popup found');
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract products from search page
      const products = await page.evaluate((searchTerm) => {
        const products = [];
        
        // Try multiple selectors for Lidl
        const selectors = [
          '.SearchResultTile',
          '.product-tile',
          '[class*="product"]',
          'article',
          '.product-item',
          '.product-card',
          '.search-result'
        ];
        
        let productElements = [];
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            productElements = Array.from(elements);
            console.log(`Found ${elements.length} elements with selector: ${selector}`);
            break;
          }
        }
        
        productElements.forEach(element => {
          const nameEl = element.querySelector('.product-name, h3, h4, [class*="title"]');
          const priceEl = element.querySelector('.price, [class*="price"], .cost');
          
          if (nameEl && priceEl) {
            const name = nameEl.textContent?.trim() || '';
            const price = priceEl.textContent?.trim() || '';
            
            if (name && price && name.length > 3 && 
                !name.includes('Search') && !name.includes('Filter') &&
                name.includes(searchTerm.toLowerCase())) {
              products.push({
                name,
                price,
                availability: 'Available',
                searchTerm,
                store: 'Lidl',
                postcode: 'UB8 1LA',
                scrapedAt: new Date().toISOString()
              });
            }
          }
        });
        
        return products.slice(0, 10);
      }, searchTerm);

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error scraping Lidl:`, error.message);
      await browser.close();
      return [];
    }
  }

  async scrapeIceland(searchTerm) {
    console.log(`\n🏪 Scraping Iceland for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      const url = `https://www.iceland.co.uk/search?q=${encodeURIComponent(searchTerm)}`;
      console.log(`🌐 Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookie consent
      try {
        await page.waitForSelector('[data-testid="consent-banner"], .cookie-banner, button[name="accept"]', { timeout: 5000 });
        const acceptButton = await page.$('button[name="accept"], [data-testid="accept-all"], button:contains("Accept")');
        if (acceptButton) {
          await acceptButton.click();
          console.log('✅ Cookie consent accepted');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (e) {
        console.log('ℹ️  No cookie consent popup found');
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract products from search page
      const products = await page.evaluate((searchTerm) => {
        const products = [];
        
        // Try multiple selectors for Iceland
        const selectors = [
          '.product-tile',
          '.product-item',
          '[class*="product"]',
          'article',
          '.product-card',
          '.search-result'
        ];
        
        let productElements = [];
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            productElements = Array.from(elements);
            console.log(`Found ${elements.length} elements with selector: ${selector}`);
            break;
          }
        }
        
        productElements.forEach(element => {
          const nameEl = element.querySelector('.product-name, h3, h4, [class*="title"]');
          const priceEl = element.querySelector('.price, [class*="price"], .cost');
          
          if (nameEl && priceEl) {
            const name = nameEl.textContent?.trim() || '';
            const price = priceEl.textContent?.trim() || '';
            
            if (name && price && name.length > 3 && 
                !name.includes('Search') && !name.includes('Filter') &&
                name.includes(searchTerm.toLowerCase())) {
              products.push({
                name,
                price,
                availability: 'Available',
                searchTerm,
                store: 'Iceland',
                postcode: 'UB8 1LH',
                scrapedAt: new Date().toISOString()
              });
            }
          }
        });
        
        return products.slice(0, 10);
      }, searchTerm);

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error scraping Iceland:`, error.message);
      await browser.close();
      return [];
    }
  }

  async testAllStores(searchTerm = 'apple') {
    console.log(`\n🧪 Testing all stores with: "${searchTerm}"`);
    
    const results = {};
    
    const stores = [
      { name: 'Tesco', method: () => this.scrapeTesco(searchTerm) },
      { name: 'Aldi', method: () => this.scrapeAldi(searchTerm) },
      { name: 'Sainsburys', method: () => this.scrapeSainsburys(searchTerm) },
      { name: 'Lidl', method: () => this.scrapeLidl(searchTerm) },
      { name: 'Iceland', method: () => this.scrapeIceland(searchTerm) }
    ];

    for (const { name, method } of stores) {
      try {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`Testing ${name}`);
        console.log(`${'='.repeat(50)}`);
        
        const products = await method();
        results[name] = {
          success: true,
          productCount: products.length,
          products: products
        };
        
        console.log(`\n📦 ${name} Products Found:`);
        if (products.length > 0) {
          products.forEach((product, i) => {
            console.log(`  ${i + 1}. ${product.name}`);
            console.log(`     Price: ${product.price}`);
            console.log(`     Availability: ${product.availability}`);
          });
        } else {
          console.log(`  No products found`);
        }
        
        // Delay between stores
        console.log(`\n⏳ Waiting 3 seconds before next store...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        console.error(`❌ Error testing ${name}:`, error.message);
        results[name] = {
          success: false,
          productCount: 0,
          products: [],
          error: error.message
        };
      }
    }

    // Print summary
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 TEST SUMMARY`);
    console.log(`${'='.repeat(80)}`);
    
    let totalProducts = 0;
    let successfulStores = 0;
    
    Object.entries(results).forEach(([store, result]) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${store}: ${result.productCount} products`);
      totalProducts += result.productCount;
      if (result.success) successfulStores++;
    });
    
    console.log(`\n🎯 OVERALL RESULTS:`);
    console.log(`  📦 Total Products Found: ${totalProducts}`);
    console.log(`  ✅ Successful Stores: ${successfulStores}/${stores.length}`);
    console.log(`  📈 Success Rate: ${(successfulStores / stores.length * 100).toFixed(1)}%`);

    return results;
  }
}

// Main execution
async function main() {
  const scraper = new IndividualStoreScrapers();
  
  try {
    await scraper.testAllStores('apple');
  } catch (error) {
    console.error('❌ Main execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = IndividualStoreScrapers;
