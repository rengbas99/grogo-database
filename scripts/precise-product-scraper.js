/**
 * Precise Product Scraper
 * Finds product names and links, then clicks into each product page for accurate data
 */

const puppeteer = require('puppeteer');

class PreciseProductScraper {
  constructor() {
    this.stores = {
      'Tesco': {
        baseUrl: 'https://www.tesco.com/groceries/en-GB/search',
        postcode: 'UB8 1ND'
      },
      'Sainsburys': {
        baseUrl: 'https://www.sainsburys.co.uk/gol-ui/SearchResults',
        postcode: 'UB8 1QW'
      }
    };
  }

  async scrapeTescoWithPrecision(searchTerm) {
    console.log(`\n🏪 Precise scraping Tesco for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      const url = `${this.stores.Tesco.baseUrl}?query=${encodeURIComponent(searchTerm)}`;
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

      // First, find product links
      const productLinks = await page.evaluate((searchTerm) => {
        const links = [];
        const productElements = document.querySelectorAll('a[data-test="product-title"], a[href*="/products/"]');
        
        productElements.forEach((link, index) => {
          if (index < 10) { // Limit to first 10 products
            const href = link.href;
            const name = link.textContent?.trim() || '';
            
            if (name && href && name.length > 5 && name.includes(searchTerm.toLowerCase())) {
              links.push({ name, href });
            }
          }
        });
        
        return links;
      }, searchTerm);

      console.log(`🔍 Found ${productLinks.length} product links`);

      const products = [];

      // Now click into each product page for precise data
      for (let i = 0; i < Math.min(productLinks.length, 5); i++) { // Limit to 5 for testing
        const productLink = productLinks[i];
        console.log(`\n🔍 Scraping product ${i + 1}: ${productLink.name}`);
        
        try {
          // Navigate to product page
          await page.goto(productLink.href, { waitUntil: 'networkidle2', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Extract precise product data
          const productData = await page.evaluate((searchTerm, storeName, postcode) => {
            const data = {
              name: '',
              price: '',
              clubcardPrice: '',
              offer: '',
              availability: 'Available',
              description: '',
              ingredients: '',
              nutrition: '',
              image: '',
              searchTerm,
              store: storeName,
              postcode,
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
              if (nameEl) {
                data.name = nameEl.textContent?.trim() || '';
                break;
              }
            }

            // Extract regular price
            const priceSelectors = [
              'span[data-test="price"]',
              '.price',
              '.product-price',
              '[data-test="product-price"]',
              '.current-price'
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

            // Extract Clubcard price
            const clubcardSelectors = [
              '.clubcard-price',
              '.clubcard',
              '[data-test="clubcard-price"]',
              '.nectar-price'
            ];
            
            for (const selector of clubcardSelectors) {
              const clubcardEl = document.querySelector(selector);
              if (clubcardEl) {
                const clubcardText = clubcardEl.textContent?.trim() || '';
                const clubcardMatch = clubcardText.match(/£(\d+\.?\d*)/);
                if (clubcardMatch) {
                  data.clubcardPrice = clubcardMatch[0];
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
              '.savings'
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
              if (imgEl) {
                data.image = imgEl.src || '';
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
                data.description = descEl.textContent?.trim().substring(0, 200) || '';
                break;
              }
            }

            return data;
          }, searchTerm, 'Tesco', this.stores.Tesco.postcode);

          if (productData.name) {
            products.push(productData);
            console.log(`✅ ${productData.name} - ${productData.price}${productData.clubcardPrice ? ` (Clubcard: ${productData.clubcardPrice})` : ''}`);
          }

        } catch (error) {
          console.error(`❌ Error scraping product ${i + 1}:`, error.message);
        }

        // Delay between products
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error:`, error.message);
      await browser.close();
      return [];
    }
  }

  async scrapeSainsburysWithPrecision(searchTerm) {
    console.log(`\n🏪 Precise scraping Sainsbury's for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      const url = `${this.stores.Sainsburys.baseUrl}/${searchTerm}`;
      console.log(`🌐 Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookie consent
      try {
        await page.waitForSelector('[data-testid="consent-banner"], .cookie-banner', { timeout: 5000 });
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

      // First, find product links
      const productLinks = await page.evaluate((searchTerm) => {
        const links = [];
        const productElements = document.querySelectorAll('a[href*="/product/"], a[href*="/products/"]');
        
        productElements.forEach((link, index) => {
          if (index < 10) { // Limit to first 10 products
            const href = link.href;
            const name = link.textContent?.trim() || '';
            
            if (name && href && name.length > 5 && name.includes(searchTerm.toLowerCase())) {
              links.push({ name, href });
            }
          }
        });
        
        return links;
      }, searchTerm);

      console.log(`🔍 Found ${productLinks.length} product links`);

      const products = [];

      // Now click into each product page for precise data
      for (let i = 0; i < Math.min(productLinks.length, 5); i++) { // Limit to 5 for testing
        const productLink = productLinks[i];
        console.log(`\n🔍 Scraping product ${i + 1}: ${productLink.name}`);
        
        try {
          // Navigate to product page
          await page.goto(productLink.href, { waitUntil: 'networkidle2', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Extract precise product data
          const productData = await page.evaluate((searchTerm, storeName, postcode) => {
            const data = {
              name: '',
              price: '',
              nectarPrice: '',
              offer: '',
              availability: 'Available',
              description: '',
              ingredients: '',
              nutrition: '',
              image: '',
              searchTerm,
              store: storeName,
              postcode,
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
              if (nameEl) {
                data.name = nameEl.textContent?.trim() || '';
                break;
              }
            }

            // Extract regular price
            const priceSelectors = [
              '.price',
              '.product-price',
              '[data-test="product-price"]',
              '.current-price',
              '.price-current'
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

            // Extract Nectar price
            const nectarSelectors = [
              '.nectar-price',
              '.nectar',
              '[data-test="nectar-price"]',
              '.clubcard-price'
            ];
            
            for (const selector of nectarSelectors) {
              const nectarEl = document.querySelector(selector);
              if (nectarEl) {
                const nectarText = nectarEl.textContent?.trim() || '';
                const nectarMatch = nectarText.match(/£(\d+\.?\d*)/);
                if (nectarMatch) {
                  data.nectarPrice = nectarMatch[0];
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
              '.savings'
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
              if (imgEl) {
                data.image = imgEl.src || '';
                break;
              }
            }

            return data;
          }, searchTerm, 'Sainsburys', this.stores.Sainsburys.postcode);

          if (productData.name) {
            products.push(productData);
            console.log(`✅ ${productData.name} - ${productData.price}${productData.nectarPrice ? ` (Nectar: ${productData.nectarPrice})` : ''}`);
          }

        } catch (error) {
          console.error(`❌ Error scraping product ${i + 1}:`, error.message);
        }

        // Delay between products
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error:`, error.message);
      await browser.close();
      return [];
    }
  }

  async testBothStores(searchTerm = 'apple') {
    console.log(`\n🚀 Testing precise scraping for: "${searchTerm}"`);
    
    const results = {};

    // Test Tesco
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏪 TESTING TESCO PRECISE SCRAPING`);
      console.log(`${'='.repeat(60)}`);
      
      const tescoProducts = await this.scrapeTescoWithPrecision(searchTerm);
      results.Tesco = {
        success: true,
        productCount: tescoProducts.length,
        products: tescoProducts
      };
      
      console.log(`\n📦 Tesco Products Found:`);
      tescoProducts.forEach((product, i) => {
        console.log(`  ${i + 1}. ${product.name}`);
        console.log(`     Price: ${product.price}`);
        if (product.clubcardPrice) {
          console.log(`     Clubcard Price: ${product.clubcardPrice}`);
        }
        if (product.offer) {
          console.log(`     Offer: ${product.offer}`);
        }
      });
      
    } catch (error) {
      console.error(`❌ Error testing Tesco:`, error.message);
      results.Tesco = {
        success: false,
        productCount: 0,
        products: [],
        error: error.message
      };
    }

    // Test Sainsbury's
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏪 TESTING SAINSBURY'S PRECISE SCRAPING`);
      console.log(`${'='.repeat(60)}`);
      
      const sainsburysProducts = await this.scrapeSainsburysWithPrecision(searchTerm);
      results.Sainsburys = {
        success: true,
        productCount: sainsburysProducts.length,
        products: sainsburysProducts
      };
      
      console.log(`\n📦 Sainsbury's Products Found:`);
      sainsburysProducts.forEach((product, i) => {
        console.log(`  ${i + 1}. ${product.name}`);
        console.log(`     Price: ${product.price}`);
        if (product.nectarPrice) {
          console.log(`     Nectar Price: ${product.nectarPrice}`);
        }
        if (product.offer) {
          console.log(`     Offer: ${product.offer}`);
        }
      });
      
    } catch (error) {
      console.error(`❌ Error testing Sainsbury's:`, error.message);
      results.Sainsburys = {
        success: false,
        productCount: 0,
        products: [],
        error: error.message
      };
    }

    // Print summary
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 PRECISE SCRAPING SUMMARY`);
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
    console.log(`  ✅ Successful Stores: ${successfulStores}/2`);
    console.log(`  📈 Success Rate: ${(successfulStores / 2 * 100).toFixed(1)}%`);

    return results;
  }
}

// Main execution
async function main() {
  const scraper = new PreciseProductScraper();
  
  try {
    await scraper.testBothStores('apple');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = PreciseProductScraper;
