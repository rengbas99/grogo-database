/**
 * Sainsbury's Final Integrated Scraper
 * Complete solution: Search → Product Details → OpenFoodFacts → Firebase Ready
 */

const puppeteer = require('puppeteer');
const axios = require('axios');

class SainsburysFinalScraper {
  constructor() {
    this.baseUrl = 'https://www.sainsburys.co.uk/gol-ui/SearchResults';
    this.productUrl = 'https://www.sainsburys.co.uk/gol-ui/product';
    this.postcode = 'UB8 1QW';
    this.openFoodFactsUrl = 'https://world.openfoodfacts.net/api/v2';
  }

  async getProductNamesAndIds(searchTerm) {
    console.log(`\n Getting Sainsbury's product names and IDs for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      const url = `${this.baseUrl}/${searchTerm}`;
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

      // Extract product names and IDs from Sainsbury's search results
      const products = await page.evaluate((searchTerm) => {
        const results = [];
        
        // Try multiple selectors for Sainsbury's product links
        const linkSelectors = [
          'a[href*="/product/"]',
          'a[data-test="product-title"]',
          '.product-tile a',
          '.product-item a',
          'article a'
        ];
        
        for (const selector of linkSelectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach((link, index) => {
            if (index < 20) { // INCREASED: Get more products
              const href = link.href;
              const name = link.textContent?.trim() || '';
              
              // SIMPLIFIED: Just capture ALL products with /product/ URLs
              if (name && href && 
                  name.length > 3 && 
                  name.length < 300 && 
                  href.includes('/product/')) {
                
                // Extract product ID from URL (e.g., /product/sainsburys-spring-onions-bunch-100g)
                const productId = href.split('/product/')[1] || '';
                
                results.push({
                  name: name,
                  productId: productId,
                  url: href,
                  searchTerm: searchTerm
                });
              }
            }
          });
          if (results.length > 0) break; // If we found products with this selector, stop
        }
        
        // FILTER: Prioritize cooking oils over baby products
        const cookingOils = results.filter(product => 
          product.name.toLowerCase().includes('oil') && 
          !product.name.toLowerCase().includes('baby') &&
          !product.name.toLowerCase().includes('johnson')
        );
        
        const otherProducts = results.filter(product => 
          !product.name.toLowerCase().includes('oil') ||
          product.name.toLowerCase().includes('baby') ||
          product.name.toLowerCase().includes('johnson')
        );
        
        // Return cooking oils first, then other products
        return [...cookingOils, ...otherProducts];
      }, searchTerm);

      await browser.close();
      console.log(`✅ Found ${products.length} Sainsbury's products with IDs`);
      return products;

    } catch (error) {
      console.error(`❌ Error getting Sainsbury's product names:`, error.message);
      if (browser) await browser.close();
      return [];
    }
  }

  async handleSainsburysCookies(page) {
    try {
      // Wait for cookie consent popup
      await page.waitForSelector('button[id="onetrust-accept-btn-handler"]', { timeout: 5000 });
      await page.click('button[id="onetrust-accept-btn-handler"]');
      console.log('✅ Sainsbury\'s cookie consent accepted');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return true;
    } catch (error) {
      console.log('ℹ️  No Sainsbury\'s cookie consent popup found');
      return false;
    }
  }

  async getProductDetails(productId, productName) {
    console.log(`🔍 Getting details for: ${productName} (ID: ${productId})`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      const url = `${this.productUrl}/${productId}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookies
      await this.handleSainsburysCookies(page);

      // Extract product details
      const productDetails = await page.evaluate(() => {
        const details = {
          name: '',
          price: '',
          clubcardPrice: '',
          offer: '',
          availability: 'Available',
          description: '',
          image: '',
          nutrition: {},
          ingredients: '',
          allergens: '',
          storage: '',
          useBy: ''
        };

        // Product name
        const nameSelectors = [
          'h1[data-test="product-title"]',
          'h1.product-title',
          '.product-title',
          'h1'
        ];
        for (const selector of nameSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            details.name = element.textContent.trim();
            break;
          }
        }

        // Price
        const priceSelectors = [
          '[data-test="price-current"]',
          '.price-current',
          '.price',
          '[class*="price"]'
        ];
        for (const selector of priceSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            details.price = element.textContent.trim();
            break;
          }
        }

        // Clubcard price
        const clubcardSelectors = [
          '[data-test="price-clubcard"]',
          '.price-clubcard',
          '[class*="clubcard"]'
        ];
        for (const selector of clubcardSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            details.clubcardPrice = element.textContent.trim();
            break;
          }
        }

        // Offer
        const offerSelectors = [
          '[data-test="offer"]',
          '.offer',
          '[class*="offer"]'
        ];
        for (const selector of offerSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            details.offer = element.textContent.trim();
            break;
          }
        }

        // Description
        const descSelectors = [
          '[data-test="product-description"]',
          '.product-description',
          '.description'
        ];
        for (const selector of descSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            details.description = element.textContent.trim();
            break;
          }
        }

        // Image
        const imgSelectors = [
          'img[data-test="product-image"]',
          '.product-image img',
          'img[alt*="product"]'
        ];
        for (const selector of imgSelectors) {
          const element = document.querySelector(selector);
          if (element && element.src) {
            details.image = element.src;
            break;
          }
        }

        return details;
      });

      await browser.close();
      return productDetails;

    } catch (error) {
      console.error(`❌ Error getting product details for ${productName}:`, error.message);
      if (browser) await browser.close();
      return null;
    }
  }

  async enrichWithOpenFoodFacts(productName) {
    try {
      const response = await axios.get(`${this.openFoodFactsUrl}/search`, {
        params: {
          search_terms: productName,
          page_size: 1,
          fields: 'product_name,nutrition_grades,image_url,ingredients_text,allergens_tags,expiration_date'
        }
      });

      if (response.data && response.data.products && response.data.products.length > 0) {
        const product = response.data.products[0];
        return {
          nutrition: product.nutrition_grades || {},
          image: product.image_url || '',
          ingredients: product.ingredients_text || '',
          allergens: product.allergens_tags || [],
          expiration: product.expiration_date || ''
        };
      }
    } catch (error) {
      console.log(`ℹ️  No OpenFoodFacts data for: ${productName}`);
    }
    return null;
  }

  async scrapeCompleteProducts(searchTerm) {
    console.log(`\n🚀 Complete Sainsbury's scraping for: "${searchTerm}"`);
    
    try {
      // Get product names and IDs
      const products = await this.getProductNamesAndIds(searchTerm);
      
      if (products.length === 0) {
        console.log('❌ No products found');
        return [];
      }

      const completeProducts = [];

      // Process each product
      for (let i = 0; i < Math.min(products.length, 5); i++) {
        const product = products[i];
        console.log(`\n🔍 Processing product ${i + 1}: ${product.name}`);
        
        try {
          // Get detailed product information
          const details = await this.getProductDetails(product.productId, product.name);
          
          if (details) {
            // Enrich with OpenFoodFacts
            const enrichment = await this.enrichWithOpenFoodFacts(product.name);
            
            const completeProduct = {
              productId: product.productId,
              name: details.name || product.name,
              price: details.price || '',
              clubcardPrice: details.clubcardPrice || '',
              offer: details.offer || '',
              availability: details.availability || 'Available',
              description: details.description || '',
              image: details.image || (enrichment?.image || ''),
              nutrition: details.nutrition || {},
              ingredients: details.ingredients || (enrichment?.ingredients || ''),
              allergens: details.allergens || (enrichment?.allergens?.join(', ') || ''),
              storage: details.storage || '',
              useBy: details.useBy || (enrichment?.expiration || ''),
              store: 'Sainsburys',
              postcode: this.postcode,
              searchTerm: searchTerm,
              scrapedAt: new Date().toISOString(),
              openFoodFactsNutrition: enrichment?.nutrition || {}
            };

            completeProducts.push(completeProduct);
            console.log(`✅ Complete: ${completeProduct.name} - ${completeProduct.price}`);
          }
        } catch (error) {
          console.error(`❌ Error processing ${product.name}:`, error.message);
        }
      }

      console.log(`✅ Found ${completeProducts.length} products for ${searchTerm}`);
      return completeProducts;

    } catch (error) {
      console.error(`❌ Error in complete Sainsbury's scraping:`, error.message);
      return [];
    }
  }

  async testAllTerms() {
    const testTerms = ['onion', 'milk', 'bread'];
    
    for (const term of testTerms) {
      console.log(`\n🧪 Testing Sainsbury's scraper with: ${term}`);
      const products = await this.scrapeCompleteProducts(term);
      console.log(`Found ${products.length} products for ${term}`);
    }
  }
}

// Test function
async function main() {
  const scraper = new SainsburysFinalScraper();
  await scraper.testAllTerms();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = SainsburysFinalScraper;
alse 