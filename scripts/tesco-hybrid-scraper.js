/**
 * Tesco Hybrid Scraper
 * Gets exact product names from search + OpenFoodFacts enrichment
 */

const puppeteer = require('puppeteer');
const axios = require('axios');

class TescoHybridScraper {
  constructor() {
    this.baseUrl = 'https://www.tesco.com/groceries/en-GB/search';
    this.postcode = 'UB8 1ND';
    this.openFoodFactsUrl = 'https://world.openfoodfacts.net/api/v2';
  }

  async getExactProductNames(searchTerm) {
    console.log(`\n🔍 Getting exact product names for: "${searchTerm}"`);
    
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

      // Get exact product names and basic info from search results
      const productNames = await page.evaluate((searchTerm) => {
        const products = [];
        const elements = document.querySelectorAll('a[href*="/products/"]');
        
        elements.forEach((link, index) => {
          if (index < 10) { // Limit to first 10 products
            const href = link.href;
            const name = link.textContent?.trim() || '';
            
            if (name && href && 
                name.length > 5 && 
                name.length < 200 && 
                href.includes('/products/') && 
                !name.includes('Skip to') && 
                !name.includes('Tesco') && 
                !name.includes('Help') && 
                (name.includes(searchTerm.toLowerCase()) || 
                 name.match(/[A-Z][a-z]+.*\d+(ml|L|kg|g|pack|Pack)/) || 
                 name.match(/^[A-Z][a-z]+ [A-Z][a-z]+/))) {
              
              // Extract product ID from URL
              const productId = href.match(/\/products\/(\d+)/)?.[1] || '';
              
              products.push({
                name: name,
                productId: productId,
                url: href,
                searchTerm: searchTerm
              });
            }
          }
        });
        
        return products;
      }, searchTerm);

      await browser.close();
      console.log(`✅ Found ${productNames.length} exact product names`);
      return productNames;

    } catch (error) {
      console.error(`❌ Error getting product names:`, error.message);
      await browser.close();
      return [];
    }
  }

  async enrichWithOpenFoodFacts(productName) {
    console.log(`🔍 Enriching "${productName}" with OpenFoodFacts...`);
    
    try {
      // Search OpenFoodFacts for the product
      const searchUrl = `${this.openFoodFactsUrl}/search?search_terms=${encodeURIComponent(productName)}&page_size=1`;
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Grogo-MVP/1.0 (https://grogo.com)',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.products && response.data.products.length > 0) {
        const product = response.data.products[0];
        
        return {
          nutrition: product.nutriments || {},
          ingredients: product.ingredients_text || '',
          image: product.image_url || '',
          categories: product.categories_tags || [],
          brand: product.brands || '',
          expiry: this.getExpiryInfo(product),
          openFoodFactsId: product._id || ''
        };
      } else {
        console.log(`⚠️  No OpenFoodFacts data found for "${productName}"`);
        return null;
      }

    } catch (error) {
      console.error(`❌ Error enriching with OpenFoodFacts:`, error.message);
      return null;
    }
  }

  getExpiryInfo(product) {
    // Extract expiry information from OpenFoodFacts data
    const categories = product.categories_tags || [];
    const productName = product.product_name || '';
    
    // Basic expiry rules based on category
    if (categories.some(cat => cat.includes('fresh-produce') || cat.includes('fruits'))) {
      return {
        type: 'fresh',
        days: 7,
        storage: 'Refrigerate',
        notes: 'Store in refrigerator, consume within 7 days'
      };
    } else if (categories.some(cat => cat.includes('dairy') || cat.includes('milk'))) {
      return {
        type: 'dairy',
        days: 7,
        storage: 'Refrigerate',
        notes: 'Store in refrigerator, check use-by date'
      };
    } else if (categories.some(cat => cat.includes('bread') || cat.includes('bakery'))) {
      return {
        type: 'bakery',
        days: 3,
        storage: 'Room temperature',
        notes: 'Store at room temperature, consume within 3 days'
      };
    } else {
      return {
        type: 'general',
        days: 30,
        storage: 'Check packaging',
        notes: 'Check packaging for expiry date'
      };
    }
  }

  async scrapeProducts(searchTerm) {
    console.log(`\n🚀 Hybrid scraping for: "${searchTerm}"`);
    
    // Step 1: Get exact product names from Tesco
    const productNames = await this.getExactProductNames(searchTerm);
    
    if (productNames.length === 0) {
      console.log('❌ No product names found');
      return [];
    }

    const enrichedProducts = [];

    // Step 2: Enrich each product with OpenFoodFacts data
    for (let i = 0; i < Math.min(productNames.length, 5); i++) {
      const product = productNames[i];
      console.log(`\n🔍 Processing product ${i + 1}: ${product.name}`);
      
      try {
        // Enrich with OpenFoodFacts
        const enrichment = await this.enrichWithOpenFoodFacts(product.name);
        
        const enrichedProduct = {
          name: product.name,
          productId: product.productId,
          url: product.url,
          price: 'Price from store', // We'll get this from store later
          availability: 'Available',
          searchTerm: product.searchTerm,
          store: 'Tesco',
          postcode: this.postcode,
          scrapedAt: new Date().toISOString(),
          // OpenFoodFacts enrichment
          nutrition: enrichment?.nutrition || {},
          ingredients: enrichment?.ingredients || '',
          image: enrichment?.image || '',
          categories: enrichment?.categories || [],
          brand: enrichment?.brand || '',
          expiry: enrichment?.expiry || {},
          openFoodFactsId: enrichment?.openFoodFactsId || ''
        };

        enrichedProducts.push(enrichedProduct);
        console.log(`✅ Enriched: ${product.name}`);
        
        // Delay between API calls
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ Error processing product ${i + 1}:`, error.message);
      }
    }

    return enrichedProducts;
  }

  async testAllTerms() {
    console.log('🚀 Starting Hybrid Tesco + OpenFoodFacts scraping...\n');
    
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
        
        // Show sample enriched products
        if (products.length > 0) {
          console.log('📦 Sample enriched products:');
          products.slice(0, 2).forEach((product, i) => {
            console.log(`   ${i + 1}. ${product.name}`);
            console.log(`      Brand: ${product.brand || 'N/A'}`);
            console.log(`      Expiry: ${product.expiry?.days || 'N/A'} days (${product.expiry?.type || 'N/A'})`);
            console.log(`      Image: ${product.image ? 'Yes' : 'No'}`);
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
    console.log(`📊 HYBRID TESCO + OPENFOODFACTS SUMMARY`);
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
  const scraper = new TescoHybridScraper();
  
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

module.exports = TescoHybridScraper;
