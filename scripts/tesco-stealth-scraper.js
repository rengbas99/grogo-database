/**
 * Tesco Stealth Scraper
 * Direct approach with enhanced stealth to avoid bot detection
 */

const puppeteer = require('puppeteer');

class TescoStealthScraper {
  constructor() {
    this.baseUrl = 'https://www.tesco.com/groceries/en-GB/search';
    this.postcode = 'UB8 1ND';
  }

  async scrapeProducts(searchTerm) {
    console.log(`\n🔍 Stealth Tesco scraping for: "${searchTerm}"`);
    
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
    
    // Enhanced stealth setup
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });
    
    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });

    // Remove webdriver property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    try {
      const url = `${this.baseUrl}?query=${encodeURIComponent(searchTerm)}`;
      console.log(`🌐 Navigating to: ${url}`);
      
      // Navigate with realistic timing
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Handle cookie consent
      try {
        await page.waitForSelector('button[name="accept"]', { timeout: 5000 });
        await page.click('button[name="accept"]');
        console.log('✅ Cookie consent accepted');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.log('ℹ️  No cookie consent popup found');
      }

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if we got blocked
      const pageContent = await page.evaluate(() => document.body.innerText);
      if (pageContent.includes('Access Denied') || pageContent.includes('Sorry')) {
        console.log('❌ Access Denied - Tesco is blocking our requests');
        await browser.close();
        return [];
      }

      // Extract products using text parsing (most reliable method)
      const products = await page.evaluate((searchTerm) => {
        const results = [];
        const pageText = document.body.innerText;
        const lines = pageText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        // Look for product patterns
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Skip navigation and UI elements
          if (line.includes('Filter') || line.includes('Sort') || line.includes('Skip to') || 
              line.includes('Tesco') || line.includes('Help') || line.includes('Sign in')) {
            continue;
          }

          // Look for price patterns
          const priceMatch = line.match(/£(\d+\.\d{2}|\d+)/);
          if (priceMatch && line.length > 5 && line.length < 100) {
            // Look backwards for product name
            for (let j = Math.max(0, i - 3); j < i; j++) {
              const prevLine = lines[j];
              if (prevLine && prevLine.length > 5 && prevLine.length < 200 && 
                  !prevLine.includes('£') && !prevLine.includes('Filter') && 
                  !prevLine.includes('Sort') && !prevLine.includes('Skip')) {
                
                results.push({
                  name: prevLine,
                  price: priceMatch[0],
                  availability: 'Available',
                  searchTerm,
                  store: 'Tesco',
                  postcode: 'UB8 1ND',
                  scrapedAt: new Date().toISOString()
                });
                break;
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

        return uniqueResults.slice(0, 10);
      }, searchTerm);

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error:`, error.message);
      await browser.close();
      return [];
    }
  }

  async testAllTerms() {
    console.log('🚀 Starting Stealth Tesco scraping...\n');
    
    const testTerms = ['apple', 'milk', 'bread'];
    const allResults = [];

    for (const term of testTerms) {
      try {
        const products = await this.scrapeProducts(term);
        
        allResults.push({
          searchTerm: term,
          productCount: products.length,
          products: products.slice(0, 3), // Keep first 3 for sample
          success: products.length > 0
        });

        console.log(`✅ "${term}": ${products.length} products found`);
        
        // Show sample products
        if (products.length > 0) {
          console.log('📦 Sample products:');
          products.slice(0, 3).forEach((product, i) => {
            console.log(`   ${i + 1}. ${product.name} - ${product.price}`);
          });
        }

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
    console.log(`📊 STEALTH TESCO SCRAPER SUMMARY`);
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
  const scraper = new TescoStealthScraper();
  
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

module.exports = TescoStealthScraper;
