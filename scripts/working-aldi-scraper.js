/**
 * Working Aldi Scraper
 * Based on successful debug results
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class AldiScraper {
  constructor() {
    this.baseUrl = 'https://groceries.aldi.co.uk/en-GB/Search';
    this.postcode = 'UB7 7QN';
    this.categories = {
      'Vegetables & Fruit': ['apple', 'banana', 'carrot', 'potato', 'tomato', 'lettuce'],
      'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream'],
      'Meat & Poultry': ['chicken', 'beef', 'pork', 'lamb', 'sausage'],
      'Bakery Items': ['bread', 'croissant', 'muffin', 'cake', 'pastry'],
      'Breakfast Items': ['cereal', 'porridge', 'granola', 'oats'],
      'Snacks & Beverages': ['chocolate', 'biscuit', 'juice', 'coffee', 'tea']
    };
  }

  async scrapeCategory(category, searchTerms, maxProducts = 10) {
    console.log(`\n🥬 Scraping ${category} from Aldi...`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    const allProducts = [];

    try {
      for (const term of searchTerms) {
        console.log(`  🔍 Searching for: ${term}`);
        
        const searchUrl = `${this.baseUrl}?query=${encodeURIComponent(term)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait for products to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Scrape products using the working selectors
        const products = await page.$$eval('.product-tile', (items, term, category) => {
          return items.slice(0, 5).map(item => {
            // Extract product name
            const nameElement = item.querySelector('.product-tile__name');
            const name = nameElement?.textContent?.trim() || '';

            // Extract price
            const priceElement = item.querySelector('.product-tile__price');
            const price = priceElement?.textContent?.trim() || '';

            // Extract image
            const imageElement = item.querySelector('.product-tile__image img');
            const image = imageElement?.src || '';

            // Extract link
            const linkElement = item.querySelector('.product-tile__link');
            const link = linkElement?.href || '';

            // Extract availability info
            const availabilityText = item.textContent || '';
            const isAvailable = !availabilityText.includes('Out of Stock') && !availabilityText.includes('Unavailable');

            return {
              name,
              price,
              image,
              link: link.startsWith('http') ? link : `https://groceries.aldi.co.uk${link}`,
              availability: isAvailable ? 'Available' : 'Unavailable',
              searchTerm: term,
              category,
              store: 'Aldi',
              postcode: 'UB7 7QN',
              scrapedAt: new Date().toISOString()
            };
          }).filter(p => p.name && p.name.length > 0);
        }, term, category);

        console.log(`    ✅ Found ${products.length} products`);
        allProducts.push(...products);

        // Delay between searches
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`❌ Error scraping ${category}:`, error.message);
    } finally {
      await browser.close();
    }

    // Limit to max products
    const limitedProducts = allProducts.slice(0, maxProducts);
    
    console.log(`📊 Total products found for ${category}: ${limitedProducts.length}`);
    
    return limitedProducts;
  }

  async scrapeAllCategories() {
    console.log('🚀 Starting Aldi product scraping...\n');
    
    const allResults = {
      store: 'Aldi',
      postcode: this.postcode,
      scrapedAt: new Date().toISOString(),
      categories: {},
      summary: {
        totalProducts: 0,
        categoriesScraped: 0,
        successRate: 0
      }
    };

    let totalProducts = 0;
    let successfulCategories = 0;

    for (const [category, searchTerms] of Object.entries(this.categories)) {
      try {
        const products = await this.scrapeCategory(category, searchTerms, 8);
        
        allResults.categories[category] = {
          category,
          productCount: products.length,
          products,
          searchTerms: searchTerms.slice(0, 3) // Show which terms were used
        };

        totalProducts += products.length;
        if (products.length > 0) successfulCategories++;

        console.log(`✅ ${category}: ${products.length} products`);

      } catch (error) {
        console.error(`❌ Failed to scrape ${category}:`, error.message);
        allResults.categories[category] = {
          category,
          productCount: 0,
          products: [],
          error: error.message
        };
      }

      // Delay between categories
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Update summary
    allResults.summary.totalProducts = totalProducts;
    allResults.summary.categoriesScraped = successfulCategories;
    allResults.summary.successRate = (successfulCategories / Object.keys(this.categories).length) * 100;

    // Save results
    await this.saveResults(allResults);
    
    // Print summary
    this.printSummary(allResults);

    return allResults;
  }

  async saveResults(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `aldi-products-${timestamp}.json`;
    const filepath = path.join(__dirname, '..', 'data', 'scraped-products', filename);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${filepath}`);
  }

  printSummary(results) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ALDI SCRAPING SUMMARY');
    console.log('='.repeat(60));
    console.log(`🏪 Store: ${results.store}`);
    console.log(`📍 Postcode: ${results.postcode}`);
    console.log(`📦 Total Products: ${results.summary.totalProducts}`);
    console.log(`✅ Categories Scraped: ${results.summary.categoriesScraped}/${Object.keys(this.categories).length}`);
    console.log(`📈 Success Rate: ${results.summary.successRate.toFixed(1)}%`);
    
    console.log('\n📋 Products by Category:');
    Object.entries(results.categories).forEach(([category, data]) => {
      const status = data.products.length > 0 ? '✅' : '❌';
      console.log(`  ${status} ${category}: ${data.productCount} products`);
    });
  }
}

// Main execution
async function main() {
  const scraper = new AldiScraper();
  
  try {
    await scraper.scrapeAllCategories();
  } catch (error) {
    console.error('❌ Scraping failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = AldiScraper;
