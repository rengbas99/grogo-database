/**
 * Tesco Scraper with Cookie Consent Handling
 * Handles cookie consent popup before scraping products
 */

const puppeteer = require('puppeteer');

class TescoCookieHandler {
  constructor() {
    this.baseUrl = 'https://www.tesco.com/groceries/en-GB/search';
    this.postcode = 'UB8 1ND';
  }

  async scrapeWithCookieHandling(searchTerm) {
    console.log(`\n🔍 Scraping Tesco with cookie handling for: "${searchTerm}"`);
    
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
      const url = `${this.baseUrl}?query=${encodeURIComponent(searchTerm)}`;
      console.log(`🌐 Navigating to: ${url}`);
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Check for cookie consent popup and handle it
      console.log(`🍪 Checking for cookie consent popup...`);
      
      try {
        // Wait for cookie consent popup to appear
        await page.waitForSelector('[data-testid="consent-banner"], .cookie-banner, [class*="cookie"], [class*="consent"]', { timeout: 5000 });
        console.log(`✅ Cookie consent popup found`);
        
        // Try to click "Accept All" button
        const acceptSelectors = [
          'button[data-testid="accept-all"]',
          'button:contains("Accept all")',
          'button:contains("Accept All")',
          'button:contains("Accept")',
          '[data-testid="accept-all"]',
          '.cookie-accept',
          '.consent-accept'
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
            if (text.includes('accept') || text.includes('allow') || text.includes('ok')) {
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
        console.log(`ℹ️  No cookie consent popup found or already handled`);
      }

      // Wait for page to fully load after cookie handling
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check page title and URL
      const pageTitle = await page.title();
      const currentUrl = page.url();
      console.log(`📄 Page title: ${pageTitle}`);
      console.log(`🔗 Current URL: ${currentUrl}`);

      // Check for Access Denied
      if (pageTitle.includes('Access Denied') || pageTitle.includes('Blocked')) {
        console.log(`🚫 Page blocked`);
        await browser.close();
        return [];
      }

      // Now try to find products with various selectors
      console.log(`🔍 Looking for products...`);
      
      const productSelectors = [
        'section[data-test="product"]',
        'div[data-test="product"]',
        '[data-testid*="product"]',
        '.product-tile',
        '.product-item',
        '.product-card',
        '[class*="product"]',
        'article',
        'li[class*="product"]'
      ];

      let productCount = 0;
      let workingSelector = null;

      for (const selector of productSelectors) {
        try {
          const count = await page.$$eval(selector, items => items.length);
          if (count > 0) {
            console.log(`✅ Found ${count} products with selector: ${selector}`);
            productCount = count;
            workingSelector = selector;
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }

      if (productCount === 0) {
        console.log(`❌ No products found for "${searchTerm}"`);
        
        // Take a screenshot for debugging
        await page.screenshot({ path: `tesco-cookie-handled-${searchTerm}.png` });
        console.log(`📸 Debug screenshot saved as tesco-cookie-handled-${searchTerm}.png`);
        
        // Try to get more info about what's on the page
        const pageText = await page.evaluate(() => document.body.innerText);
        console.log(`📝 Page contains "${searchTerm}": ${pageText.toLowerCase().includes(searchTerm.toLowerCase())}`);
        console.log(`📝 Page contains "£": ${pageText.includes('£')}`);
        console.log(`📝 Page contains "price": ${pageText.toLowerCase().includes('price')}`);
        
        await browser.close();
        return [];
      }

      // Scrape products
      console.log(`🔍 Scraping products with selector: ${workingSelector}`);
      
      const products = await page.$$eval(workingSelector, (items, searchTerm) => {
        return items.slice(0, 5).map(item => {
          // Try to find name, price, image, link
          const name = item.querySelector('h1, h2, h3, h4, .title, .name, a')?.textContent?.trim() || '';
          const price = item.querySelector('[class*="price"], [data-test*="price"], .cost, .amount')?.textContent?.trim() || '';
          const image = item.querySelector('img')?.src || '';
          const link = item.querySelector('a')?.href || '';

          return {
            name,
            price: price || 'Unavailable',
            image,
            link,
            availability: price && price !== 'Unavailable' ? 'Available' : 'Unavailable',
            searchTerm,
            store: 'Tesco',
            postcode: 'UB8 1ND',
            scrapedAt: new Date().toISOString()
          };
        }).filter(p => p.name && p.name.length > 0);
      }, searchTerm);

      console.log(`✅ Successfully scraped ${products.length} products`);
      
      // Log sample products
      if (products.length > 0) {
        console.log(`📦 Sample products:`);
        products.slice(0, 3).forEach((product, index) => {
          console.log(`  ${index + 1}. ${product.name} - ${product.price}`);
        });
      }

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error scraping Tesco:`, error.message);
      await browser.close();
      return [];
    }
  }

  async testAllTerms() {
    console.log('🚀 Starting Tesco scraper with cookie handling...\n');
    
    const testTerms = ['apple', 'milk', 'bread'];
    const allResults = [];

    for (const term of testTerms) {
      try {
        const products = await this.scrapeWithCookieHandling(term);
        
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

    // Print summary
    const successfulSearches = allResults.filter(r => r.success).length;
    const totalProducts = allResults.reduce((sum, r) => sum + r.productCount, 0);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 TESCO COOKIE HANDLER TEST SUMMARY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`🏪 Store: Tesco`);
    console.log(`📍 Postcode: ${this.postcode}`);
    console.log(`🔍 Search Terms Tested: ${testTerms.length}`);
    console.log(`✅ Successful Searches: ${successfulSearches}`);
    console.log(`📦 Total Products Found: ${totalProducts}`);
    console.log(`📈 Success Rate: ${(successfulSearches / testTerms.length * 100).toFixed(1)}%`);

    return allResults;
  }
}

// Main execution
async function main() {
  const scraper = new TescoCookieHandler();
  
  try {
    await scraper.testAllTerms();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = TescoCookieHandler;
