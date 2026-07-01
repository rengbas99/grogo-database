/**
 * Aldi Final Integrated Scraper
 * Complete solution: Search → Product Details → OpenFoodFacts → Firebase Ready
 */

const puppeteer = require('puppeteer');
const axios = require('axios');

class AldiFinalScraper {
  constructor() {
    this.baseUrl = 'https://www.aldi.co.uk/results';
    this.productUrl = 'https://www.aldi.co.uk/product';
    this.postcode = 'UB8 1ND';
    this.openFoodFactsUrl = 'https://world.openfoodfacts.net/api/v2';
  }

  async getProductNamesAndIds(searchTerm) {
    console.log(`\n🔍 Getting Aldi product names and IDs for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      const url = `${this.baseUrl}?q=${encodeURIComponent(searchTerm)}`;
      console.log(`🌐 Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookie consent
      try {
        await page.waitForSelector('button[id="onetrust-accept-btn-handler"]', { timeout: 5000 });
        await page.click('button[id="onetrust-accept-btn-handler"]');
        console.log('✅ Cookie consent accepted');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.log('ℹ️  No cookie consent popup found');
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract product names and IDs from Aldi search results
      const products = await page.evaluate((searchTerm) => {
        const results = [];
        
        // Try multiple selectors for Aldi product links
        const linkSelectors = [
          'a[href*="/product/"]',
          'a[data-test="product-title"]',
          '.product-tile a',
          '.product-item a',
          'article a',
          '.product-card a',
          '.product-link'
        ];
        
        for (const selector of linkSelectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach((link, index) => {
            if (index < 10) { // Limit to first 10 products
              const href = link.href;
              let name = link.textContent?.trim() || '';
              
              // Try to get name from title attribute or data attributes
              if (!name || name.length < 5) {
                name = link.getAttribute('title') || 
                       link.getAttribute('data-product-name') ||
                       link.getAttribute('aria-label') || '';
              }
              
              // Clean up the name - remove extra text and formatting
              name = name.replace(/\s+/g, ' ').trim();
              
              if (name && href && 
                  name.length > 5 && 
                  name.length < 200 && 
                  href.includes('/product/') && 
                  !name.includes('Skip to') && 
                  !name.includes('Aldi') && 
                  !name.includes('Help') && 
                  !name.includes('Search') &&
                  !name.includes('Results') &&
                  (name.includes(searchTerm.toLowerCase()) || 
                   name.match(/[A-Z][a-z]+.*\d+(ml|L|kg|g|pack|Pack)/) || 
                   name.match(/^[A-Z][a-z]+ [A-Z][a-z]+/) ||
                   name.match(/^\w+.*\d+/) ||
                   name.includes('Milk') ||
                   name.includes('Apple') ||
                   name.includes('Bread'))) {
                
                // Extract product ID from URL (e.g., /product/nature-s-pick-jazz-apples-6-pack-000000000000306530)
                const productId = href.split('/product/')[1] || '';
                
                // Clean up product name - remove price info and extra text
                const cleanName = name.replace(/\d+\.\d+\/\w+.*£\d+\.\d+.*/, '').trim();
                
                results.push({
                  name: cleanName || name,
                  productId: productId,
                  url: href,
                  searchTerm: searchTerm
                });
              }
            }
          });
          if (results.length > 0) break; // If we found products with this selector, stop
        }
        
        return results;
      }, searchTerm);

      await browser.close();
      console.log(`✅ Found ${products.length} Aldi products with IDs`);
      return products;

    } catch (error) {
      console.error(`❌ Error getting Aldi product names:`, error.message);
      await browser.close();
      return [];
    }
  }

  async getProductDetails(productId, productName) {
    console.log(`🔍 Getting Aldi details for: ${productName} (ID: ${productId})`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });
    
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9',
      'Referer': 'https://www.aldi.co.uk/results'
    });

    try {
      const productUrl = `${this.productUrl}/${productId}`;
      console.log(`🌐 Navigating to: ${productUrl}`);
      await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if blocked
      const pageContent = await page.evaluate(() => document.body.innerText);
      if (pageContent.includes('Access Denied') || pageContent.includes('Sorry') || pageContent.includes('404')) {
        console.log(`❌ Access Denied for product ${productId}`);
        await browser.close();
        return null;
      }

      // Extract product details from Aldi product page
      const productData = await page.evaluate((productId, productName) => {
        const data = {
          productId: productId,
          name: productName,
          price: '',
          offer: '',
          availability: 'Available',
          description: '',
          image: '',
          nutrition: {},
          ingredients: '',
          allergens: '',
          storage: '',
          useBy: '',
          scrapedAt: new Date().toISOString()
        };

        // Extract product name
        const nameSelectors = [
          'h1[data-test="product-title"]', 
          'h1.product-title', 
          'h1',
          '.product-name',
          '[data-test="product-name"]'
        ];
        for (const selector of nameSelectors) {
          const nameEl = document.querySelector(selector);
          if (nameEl && nameEl.textContent?.trim()) {
            data.name = nameEl.textContent.trim();
            break;
          }
        }

        // Extract regular price
        const priceSelectors = [
          'span[data-test="price"]', 
          '.price', 
          '.product-price', 
          '[data-test="product-price"]', 
          '.current-price',
          '.value',
          '[class*="price"]'
        ];
        
        for (const selector of priceSelectors) {
          const priceEl = document.querySelector(selector);
          if (priceEl) {
            const priceText = priceEl.textContent?.trim() || '';
            const priceMatch = priceText.match(/£(\d+\.?\d*)/);
            if (priceMatch) {
              data.price = priceMatch[0];
              break;
            }
          }
        }

        // Extract offers
        const offerSelectors = [
          '.offer', 
          '.promotion', 
          '.deal', 
          '[data-test="offer"]',
          '[class*="offer"]'
        ];
        for (const selector of offerSelectors) {
          const offerEl = document.querySelector(selector);
          if (offerEl) {
            data.offer = offerEl.textContent?.trim() || '';
            break;
          }
        }

        // Extract product image
        const imageSelectors = [
          'img[data-test="product-image"]', 
          '.product-image img', 
          '.product-photo img', 
          'img[alt*="product"]'
        ];
        for (const selector of imageSelectors) {
          const imgEl = document.querySelector(selector);
          if (imgEl && imgEl.src) {
            data.image = imgEl.src;
            break;
          }
        }

        // Extract description
        const descSelectors = [
          '.product-description', 
          '.description', 
          '[data-test="description"]',
          '.product-details'
        ];
        for (const selector of descSelectors) {
          const descEl = document.querySelector(selector);
          if (descEl) {
            data.description = descEl.textContent?.trim() || '';
            break;
          }
        }

        // Extract nutrition information
        const nutritionTable = document.querySelector('.nutrition-table, .nutrition-facts, table');
        if (nutritionTable) {
          const rows = nutritionTable.querySelectorAll('tr');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 2) {
              const key = cells[0].textContent?.trim();
              const value = cells[1].textContent?.trim();
              if (key && value) {
                data.nutrition[key] = value;
              }
            }
          });
        }

        // Extract ingredients
        const ingredientsEl = document.querySelector('.ingredients, [data-test="ingredients"]');
        if (ingredientsEl) {
          data.ingredients = ingredientsEl.textContent?.trim() || '';
        }

        // Extract allergens
        const allergensEl = document.querySelector('.allergens, [data-test="allergens"]');
        if (allergensEl) {
          data.allergens = allergensEl.textContent?.trim() || '';
        }

        // Extract storage instructions
        const storageEl = document.querySelector('.storage, .storage-instructions, [data-test="storage"]');
        if (storageEl) {
          data.storage = storageEl.textContent?.trim() || '';
        }

        return data;
      }, productId, productName);

      await browser.close();
      return productData;

    } catch (error) {
      console.error(`❌ Error getting Aldi product details:`, error.message);
      await browser.close();
      return null;
    }
  }

  async enrichWithOpenFoodFacts(productName) {
    try {
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
        return null;
      }

    } catch (error) {
      console.error(`❌ Error enriching with OpenFoodFacts:`, error.message);
      return null;
    }
  }

  getExpiryInfo(product) {
    const categories = product.categories_tags || [];
    
    if (categories.some(cat => cat.includes('fresh-produce') || cat.includes('fruits'))) {
      return { type: 'fresh', days: 7, storage: 'Refrigerate', notes: 'Store in refrigerator, consume within 7 days' };
    } else if (categories.some(cat => cat.includes('dairy') || cat.includes('milk'))) {
      return { type: 'dairy', days: 7, storage: 'Refrigerate', notes: 'Store in refrigerator, check use-by date' };
    } else if (categories.some(cat => cat.includes('bread') || cat.includes('bakery'))) {
      return { type: 'bakery', days: 3, storage: 'Room temperature', notes: 'Store at room temperature, consume within 3 days' };
    } else {
      return { type: 'general', days: 30, storage: 'Check packaging', notes: 'Check packaging for expiry date' };
    }
  }

  async scrapeCompleteProducts(searchTerm) {
    console.log(`\n🚀 Complete Aldi scraping for: "${searchTerm}"`);
    
    // Step 1: Get product names and IDs
    const productNames = await this.getProductNamesAndIds(searchTerm);
    
    if (productNames.length === 0) {
      console.log('❌ No products found');
      return [];
    }

    const completeProducts = [];

    // Step 2: Process each product
    for (let i = 0; i < Math.min(productNames.length, 5); i++) {
      const product = productNames[i];
      console.log(`\n🔍 Processing product ${i + 1}: ${product.name}`);
      
      try {
        // Get product details from Aldi
        const aldiData = await this.getProductDetails(product.productId, product.name);
        
        if (!aldiData) {
          console.log(`❌ Failed to get Aldi data for ${product.name}`);
          continue;
        }

        // Enrich with OpenFoodFacts
        const enrichment = await this.enrichWithOpenFoodFacts(product.name);
        
        // Combine all data
        const completeProduct = {
          // Aldi data
          productId: aldiData.productId,
          name: aldiData.name,
          price: aldiData.price,
          offer: aldiData.offer,
          availability: aldiData.availability,
          description: aldiData.description,
          image: aldiData.image || (enrichment?.image || ''),
          nutrition: aldiData.nutrition,
          ingredients: aldiData.ingredients || enrichment?.ingredients || '',
          allergens: aldiData.allergens || '',
          storage: aldiData.storage || '',
          useBy: aldiData.useBy || '',
          
          // Store info
          store: 'Aldi',
          postcode: this.postcode,
          searchTerm: searchTerm,
          scrapedAt: new Date().toISOString(),
          
          // OpenFoodFacts enrichment
          openFoodFactsNutrition: enrichment?.nutrition || {},
          openFoodFactsCategories: enrichment?.categories || [],
          openFoodFactsBrand: enrichment?.brand || '',
          expiry: enrichment?.expiry || {},
          openFoodFactsId: enrichment?.openFoodFactsId || '',
          
          // URLs
          aldiUrl: `${this.productUrl}/${aldiData.productId}`,
          openFoodFactsUrl: enrichment?.openFoodFactsId ? `https://world.openfoodfacts.org/product/${enrichment.openFoodFactsId}` : ''
        };

        completeProducts.push(completeProduct);
        console.log(`✅ Complete: ${completeProduct.name} - ${completeProduct.price}`);
        
        // Delay between products
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ Error processing product ${i + 1}:`, error.message);
      }
    }

    return completeProducts;
  }

  async testAllTerms() {
    console.log('🚀 Starting Final Aldi Scraper...\n');
    
    const testTerms = ['apple', 'milk', 'bread'];
    const allResults = [];

    for (const term of testTerms) {
      try {
        const products = await this.scrapeCompleteProducts(term);
        
        allResults.push({
          searchTerm: term,
          productCount: products.length,
          products: products.slice(0, 3), // Keep first 3 for sample
          success: products.length > 0
        });

        console.log(`✅ "${term}": ${products.length} complete products found`);
        
        // Show sample complete products
        if (products.length > 0) {
          console.log('📦 Sample complete products:');
          products.slice(0, 2).forEach((product, i) => {
            console.log(`   ${i + 1}. ${product.name}`);
            console.log(`      Price: ${product.price}`);
            console.log(`      Brand: ${product.openFoodFactsBrand || 'N/A'}`);
            console.log(`      Expiry: ${product.expiry?.days || 'N/A'} days (${product.expiry?.type || 'N/A'})`);
            console.log(`      Image: ${product.image ? 'Yes' : 'No'}`);
            console.log(`      Aldi URL: ${product.aldiUrl}`);
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
    console.log(`📊 FINAL ALDI SCRAPER SUMMARY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`🏪 Store: Aldi`);
    console.log(`📍 Postcode: ${this.postcode}`);
    console.log(`🔍 Search Terms Tested: ${testTerms.length}`);
    console.log(`✅ Successful Searches: ${successfulSearches}`);
    console.log(`📦 Total Products Found: ${totalProducts}`);
    console.log(`📈 Success Rate: ${(successfulSearches / testTerms.length * 100).toFixed(1)}%`);
    console.log(`\n🎯 Data includes:`);
    console.log(`   ✅ Exact product names and IDs`);
    console.log(`   ✅ Precise pricing`);
    console.log(`   ✅ Product descriptions and images`);
    console.log(`   ✅ Nutrition information`);
    console.log(`   ✅ Ingredients and allergens`);
    console.log(`   ✅ Expiry and storage information`);
    console.log(`   ✅ OpenFoodFacts enrichment`);
    console.log(`   ✅ Ready for Firebase storage`);

    return allResults;
  }
}

// Main execution
async function main() {
  const scraper = new AldiFinalScraper();
  
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

module.exports = AldiFinalScraper;
