/**
 * Smart Sainsbury's Scraper
 * Extracts products from Sainsbury's using smart text parsing
 * Handles nectar prices and offers
 */

const puppeteer = require('puppeteer');

class SmartSainsburysScraper {
  constructor() {
    this.baseUrl = 'https://www.sainsburys.co.uk/gol-ui/SearchResults';
    this.postcode = 'UB8 1QW';
  }

  async scrapeProducts(searchTerm) {
    console.log(`\n🔍 Smart scraping Sainsbury's for: "${searchTerm}"`);
    
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
      const url = `${this.baseUrl}/${searchTerm}`;
      console.log(`🌐 Navigating to: ${url}`);
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookie consent
      try {
        await page.waitForSelector('[data-testid="consent-banner"], .cookie-banner, [class*="cookie"], [class*="consent"]', { timeout: 5000 });
        console.log(`✅ Cookie consent popup found`);
        
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await button.evaluate(el => el.textContent?.toLowerCase() || '');
          if (text.includes('accept') || text.includes('allow')) {
            await button.click();
            console.log(`✅ Clicked accept button`);
            break;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (e) {
        console.log(`ℹ️  No cookie consent popup found`);
      }

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log(`🔍 Extracting products using smart text parsing...`);

      // Extract products using enhanced text parsing
      const products = await page.evaluate((searchTerm) => {
        const results = [];
        
        // Get all text content from the page
        const pageText = document.body.innerText;
        
        // Split by common product separators and look for product patterns
        const lines = pageText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        // Offer patterns to capture
        const offerPatterns = [
          /Offer valid for delivery from \d{2}\/\d{2}\/\d{4} until \d{2}\/\d{2}\/\d{4}/,
          /\d+p Clubcard Price/,
          /Clubcard Price/,
          /Rest of shelf/,
          /Save \d+%?/,
          /Was £\d+\.?\d* now £\d+\.?\d*/,
          /Reduced/,
          /Clearance/,
          /Special offer/,
          /Limited time/,
          /Nectar price/,
          /Nectar points/
        ];
        
        // Nectar price patterns
        const nectarPatterns = [
          /Nectar price/,
          /Nectar points/,
          /Nectar/
        ];
        
        // First pass: Extract everything with prices - be more careful about matching
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Look for price patterns (£X.XX or £X) and nectar prices
          const priceMatch = line.match(/£(\d+\.?\d*)/);
          const nectarMatch = line.match(/(\d+)p/);
          
          if (priceMatch || nectarMatch) {
            // Look backwards for the product name (usually 1-3 lines before the price)
            for (let j = Math.max(0, i - 3); j < i; j++) {
              const prevLine = lines[j];
              
              // More careful filtering - look for actual product names
              if (prevLine && 
                  prevLine.length > 10 && 
                  prevLine.length < 200 &&
                  !prevLine.includes('Price -') &&
                  !prevLine.includes('Ratings -') &&
                  !prevLine.includes('ALDI PRICE MATCH') &&
                  !prevLine.includes('Featured') &&
                  !prevLine.includes('New') &&
                  !prevLine.includes('£') &&
                  !prevLine.includes('p /') &&
                  !prevLine.includes('kg') &&
                  !prevLine.includes('100g') &&
                  !prevLine.includes('Sort') &&
                  !prevLine.includes('Filter') &&
                  !prevLine.includes('Results') &&
                  !prevLine.includes('Showing') &&
                  !prevLine.includes('Help Centre') &&
                  !prevLine.includes('Skip to') &&
                  !prevLine.includes('Log in') &&
                  !prevLine.includes('Register') &&
                  !prevLine.includes('Trolley') &&
                  !prevLine.includes('Store Locator') &&
                  (prevLine.includes(searchTerm.toLowerCase()) || 
                   prevLine.includes('Sainsbury') ||
                   prevLine.includes('Apples') ||
                   prevLine.includes('Milk') ||
                   prevLine.includes('Bread'))) {
                
                // Check for offers in surrounding lines
                let offer = '';
                for (let k = Math.max(0, i - 3); k < Math.min(lines.length, i + 2); k++) {
                  const offerLine = lines[k];
                  if (offerLine && offerPatterns.some(pattern => pattern.test(offerLine))) {
                    offer = offerLine;
                    break;
                  }
                }
                
                // Convert nectar price to pounds if found
                let finalPrice = priceMatch ? priceMatch[0] : '';
                if (nectarMatch) {
                  const nectarPence = parseInt(nectarMatch[1]);
                  const pounds = (nectarPence / 100).toFixed(2);
                  finalPrice = `£${pounds}`;
                }
                
                // Only add if price seems reasonable (grocery prices)
                const priceValue = parseFloat(finalPrice.replace('£', ''));
                if (priceValue > 0 && priceValue < 50) { // Reasonable grocery price range
                  results.push({
                    name: prevLine,
                    price: finalPrice,
                    offer: offer,
                    availability: 'Available',
                    searchTerm,
                    store: 'Sainsburys',
                    postcode: 'UB8 1QW',
                    scrapedAt: new Date().toISOString()
                  });
                  break;
                }
              }
            }
          }
        }
        
        // Also try to extract from specific elements that might contain product data
        const productElements = document.querySelectorAll('*');
        productElements.forEach(el => {
          const text = el.textContent?.trim() || '';
          
          // Look for elements that contain both product name and price
          if ((text.includes('£') || text.includes('p ')) && text.length > 20 && text.length < 500) {
            const priceMatch = text.match(/£(\d+\.?\d*)/);
            const nectarMatch = text.match(/(\d+)p/);
            
            if (priceMatch || nectarMatch) {
              // Extract product name (text before the price)
              const priceIndex = text.indexOf(priceMatch ? priceMatch[0] : nectarMatch[0]);
              const beforePrice = text.substring(0, priceIndex).trim();
              
              // Find the last meaningful line before the price
              const lines = beforePrice.split('\n').map(line => line.trim()).filter(line => line.length > 0);
              const productName = lines[lines.length - 1] || beforePrice;
              
              // More careful filtering for element extraction
              if (productName.length > 10 && 
                  productName.length < 200 &&
                  !productName.includes('Price -') &&
                  !productName.includes('Ratings -') &&
                  !productName.includes('ALDI PRICE MATCH') &&
                  !productName.includes('Featured') &&
                  !productName.includes('New') &&
                  !productName.includes('£') &&
                  !productName.includes('p /') &&
                  !productName.includes('kg') &&
                  !productName.includes('100g') &&
                  !productName.includes('Sort') &&
                  !productName.includes('Filter') &&
                  !productName.includes('Results') &&
                  !productName.includes('Showing') &&
                  !productName.includes('Help Centre') &&
                  !productName.includes('Skip to') &&
                  !productName.includes('Log in') &&
                  !productName.includes('Register') &&
                  !productName.includes('Trolley') &&
                  !productName.includes('Store Locator') &&
                  (productName.includes(searchTerm.toLowerCase()) || 
                   productName.includes('Sainsbury') ||
                   productName.includes('Apples') ||
                   productName.includes('Milk') ||
                   productName.includes('Bread'))) {
                
                // Check for offers in the same element
                let offer = '';
                if (offerPatterns.some(pattern => pattern.test(text))) {
                  const offerMatch = text.match(offerPatterns.find(pattern => pattern.test(text)));
                  if (offerMatch) {
                    offer = offerMatch[0];
                  }
                }
                
                // Convert nectar price to pounds if found
                let finalPrice = priceMatch ? priceMatch[0] : '';
                if (nectarMatch) {
                  const nectarPence = parseInt(nectarMatch[1]);
                  const pounds = (nectarPence / 100).toFixed(2);
                  finalPrice = `£${pounds}`;
                }
                
                // Only add if price seems reasonable (grocery prices)
                const priceValue = parseFloat(finalPrice.replace('£', ''));
                if (priceValue > 0 && priceValue < 50) { // Reasonable grocery price range
                  results.push({
                    name: productName,
                    price: finalPrice,
                    offer: offer,
                    availability: 'Available',
                    searchTerm,
                    store: 'Sainsburys',
                    postcode: 'UB8 1QW',
                    scrapedAt: new Date().toISOString()
                  });
                }
              }
            }
          }
        });
        
        // Remove duplicates and filter out invalid products
        const uniqueProducts = [];
        const seenNames = new Set();
        
        // Define patterns to exclude (be more specific)
        const excludePatterns = [
          'Your privacy',
          'Filter',
          'Sort',
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
          'Details'
        ];
        
        // Define patterns that indicate real products
        const productIndicators = [
          searchTerm.toLowerCase(), // Contains search term
          'ml', 'L', 'kg', 'g', 'pack', 'Pack', // Has size indicators
          'Sainsbury', 'Brand', 'Organic', 'Free Range', // Has brand indicators
          'Apples', 'Milk', 'Bread', 'Juice', 'Drink' // Has product type indicators
        ];
        
        results.forEach(product => {
          if (product.name && 
              product.name.length > 5 && 
              product.name.length < 300 && 
              !seenNames.has(product.name.toLowerCase()) &&
              !excludePatterns.some(pattern => product.name.includes(pattern)) &&
              !product.name.match(/^\d+[p£]/) && // Not starting with price
              !product.name.match(/^\d+\.\d+[p£]/) && // Not starting with decimal price
              !product.name.match(/^\d+%/) && // Not starting with percentage
              !product.name.match(/^\d+x\d+/) && // Not quantity patterns
              (product.name.includes(searchTerm.toLowerCase()) || 
               productIndicators.some(indicator => product.name.includes(indicator)))) {
            
            seenNames.add(product.name.toLowerCase());
            uniqueProducts.push(product);
          }
        });
        
        return uniqueProducts.slice(0, 10); // Limit to 10 products
      }, searchTerm);

      console.log(`✅ Found ${products.length} products`);
      
      // Display products
      if (products.length > 0) {
        console.log(`\n📦 Products found:`);
        products.forEach((product, i) => {
          console.log(`  ${i + 1}. ${product.name}`);
          console.log(`     Price: ${product.price}`);
          console.log(`     Availability: ${product.availability}`);
          if (product.offer) {
            console.log(`     Offer: ${product.offer}`);
          }
        });
      }

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error:`, error.message);
      await browser.close();
      return [];
    }
  }

  async testAllTerms() {
    console.log('🚀 Starting smart Sainsbury\'s scraping...\n');
    
    const testTerms = ['apple', 'milk', 'bread'];
    const allResults = [];

    for (const term of testTerms) {
      try {
        const products = await this.scrapeProducts(term);
        
        allResults.push({
          searchTerm: term,
          productCount: products.length,
          products: products.slice(0, 5), // Keep first 5 for sample
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
    console.log(`📊 SMART SAINSBURY'S SCRAPER SUMMARY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`🏪 Store: Sainsbury's`);
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
  const scraper = new SmartSainsburysScraper();
  
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

module.exports = SmartSainsburysScraper;
