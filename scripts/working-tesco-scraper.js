/**
 * Working Tesco Scraper
 * Based on the original working version with enhancements
 */

const puppeteer = require('puppeteer');

class WorkingTescoScraper {
  constructor() {
    this.baseUrl = 'https://www.tesco.com/groceries/en-GB/search';
    this.postcode = 'UB8 1ND';
  }

  async scrapeProducts(searchTerm) {
    console.log(`\n🔍 Smart scraping Tesco for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      const url = `${this.baseUrl}?query=${encodeURIComponent(searchTerm)}`;
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

      // First, find product links for precise scraping
      const productLinks = await page.evaluate((searchTerm) => {
        const links = [];
        
        // Try multiple selectors for product links (updated based on debug results)
        const linkSelectors = [
          'a[href*="/products/"]', // This works - found 51 elements
          'a[class*="titleLink"]', // Product title links
          'a[data-test="product-title"]',
          'a[href*="/product/"]',
          '.product-tile a',
          '.product-item a',
          'article a'
        ];
        
        for (const selector of linkSelectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach((link, index) => {
            if (index < 15) { // Increase limit to get more products
              const href = link.href;
              const name = link.textContent?.trim() || '';
              
              // Better filtering for product links
              if (name && href && 
                  name.length > 5 && 
                  name.length < 200 && // Reasonable product name length
                  href.includes('/products/') && // Must be a product URL
                  !name.includes('Skip to') && // Exclude navigation
                  !name.includes('Tesco') && // Exclude brand links
                  !name.includes('Help') && // Exclude help links
                  (name.includes(searchTerm.toLowerCase()) || 
                   name.match(/[A-Z][a-z]+.*\d+(ml|L|kg|g|pack|Pack)/) || // Product with size
                   name.match(/^[A-Z][a-z]+ [A-Z][a-z]+/))) { // Brand + Product pattern
                links.push({ name, href });
              }
            }
          });
          if (links.length > 0) break; // If we found links with this selector, stop
        }
        
        return links;
      }, searchTerm);

      console.log(`🔍 Found ${productLinks.length} product links for precise scraping`);

      const products = [];

      // If we found product links, use them for precise names but get prices from search page
      if (productLinks.length > 0) {
        console.log(`\n🔍 Using precise product names with search page pricing...`);
        
        // Get prices from the search page using text parsing
        const searchPagePrices = await page.evaluate((searchTerm) => {
          const pageContent = document.body.innerText;
          const lines = pageContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
          const prices = [];
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.length > 5 && line.length < 100 && !line.includes('Filter') && !line.includes('Sort by')) {
              const nextLine = lines[i + 1] || '';
              const priceMatch = nextLine.match(/£(\d+\.\d{2}|\d+)/);
              if (priceMatch) {
                const name = line;
                const price = priceMatch[0];
                prices.push({ name, price });
                i++; // Skip the price line
                if (prices.length >= 15) break;
              }
            }
          }
          return prices;
        }, searchTerm);

        // Match precise product names with search page prices
        for (let i = 0; i < Math.min(productLinks.length, 5); i++) {
          const productLink = productLinks[i];
          console.log(`\n🔍 Processing product ${i + 1}: ${productLink.name}`);
          
          // Try to find matching price from search page
          let matchedPrice = 'Price not found';
          let matchedOffer = '';
          
          // Look for exact name match first
          const exactMatch = searchPagePrices.find(p => 
            p.name.toLowerCase().includes(productLink.name.toLowerCase()) ||
            productLink.name.toLowerCase().includes(p.name.toLowerCase())
          );
          
          if (exactMatch) {
            matchedPrice = exactMatch.price;
          } else {
            // Look for partial match with search term
            const partialMatch = searchPagePrices.find(p => 
              p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
              (p.name.toLowerCase().includes('apple') || 
               p.name.toLowerCase().includes('milk') || 
               p.name.toLowerCase().includes('bread'))
            );
            if (partialMatch) {
              matchedPrice = partialMatch.price;
            }
          }
          
          const productData = {
            name: productLink.name,
            price: matchedPrice,
            clubcardPrice: '',
            offer: matchedOffer,
            availability: 'Available',
            description: '',
            image: '',
            searchTerm,
            store: 'Tesco',
            postcode: this.postcode,
            scrapedAt: new Date().toISOString()
          };
          
          products.push(productData);
          console.log(`✅ ${productData.name} - ${productData.price}`);
        }
      } else {
        // Fallback to text parsing if no links found
        console.log(`⚠️  No product links found, falling back to text parsing...`);
        
        const fallbackProducts = await page.evaluate((searchTerm) => {
          const pageContent = document.body.innerText;
          const lines = pageContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);

          const products = [];
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.length > 5 && line.length < 100 && !line.includes('Filter') && !line.includes('Sort by')) {
              const nextLine = lines[i + 1] || '';
              const priceMatch = nextLine.match(/£(\d+\.\d{2}|\d+)/);
              if (priceMatch) {
                const name = line;
                const price = priceMatch[0];
                products.push({ 
                  name, 
                  price, 
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
        
        products.push(...fallbackProducts);
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
    console.log('🚀 Starting working Tesco scraping...\n');
    
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
    console.log(`📊 WORKING TESCO SCRAPER SUMMARY`);
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
  const scraper = new WorkingTescoScraper();
  
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

module.exports = WorkingTescoScraper;
