/**
 * Tesco Product Detail Scraper
 * Uses product IDs to get exact product details including pricing
 */

const puppeteer = require('puppeteer');

class TescoProductDetailScraper {
  constructor() {
    this.baseUrl = 'https://www.tesco.com/groceries/en-GB/products';
    this.postcode = 'UB8 1ND';
  }

  async scrapeProductDetail(productId, productName) {
    console.log(`\n🔍 Scraping product detail for: ${productName} (ID: ${productId})`);
    
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
      'Referer': 'https://www.tesco.com/groceries/en-GB/search'
    });

    // Remove webdriver property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    try {
      const productUrl = `${this.baseUrl}/${productId}`;
      console.log(`🌐 Navigating to: ${productUrl}`);
      
      // Navigate to product page
      await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if we got blocked
      const pageContent = await page.evaluate(() => document.body.innerText);
      if (pageContent.includes('Access Denied') || pageContent.includes('Sorry') || pageContent.includes('404')) {
        console.log(`❌ Access Denied or 404 for product ${productId}`);
        await browser.close();
        return null;
      }

      // Extract detailed product information
      const productData = await page.evaluate((productId, productName) => {
        const data = {
          productId: productId,
          name: productName, // Use the name we already have
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
          useBy: '',
          scrapedAt: new Date().toISOString()
        };

        // Extract product name (in case it's different)
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

        // Extract Clubcard price
        const clubcardSelectors = [
          '.clubcard-price',
          '.clubcard',
          '[data-test="clubcard-price"]',
          '.nectar-price',
          '[class*="clubcard"]'
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
          '.savings',
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
          'img[alt*="product"]',
          'img[alt*="' + productName.split(' ')[0] + '"]'
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

        // Extract use-by date
        const useByEl = document.querySelector('.use-by, .expiry, [data-test="use-by"]');
        if (useByEl) {
          data.useBy = useByEl.textContent?.trim() || '';
        }

        return data;
      }, productId, productName);

      await browser.close();
      
      if (productData.price) {
        console.log(`✅ Success: ${productData.name} - ${productData.price}${productData.clubcardPrice ? ` (Clubcard: ${productData.clubcardPrice})` : ''}`);
        return productData;
      } else {
        console.log(`⚠️  No price found for ${productName}`);
        return productData;
      }

    } catch (error) {
      console.error(`❌ Error scraping product ${productId}:`, error.message);
      await browser.close();
      return null;
    }
  }

  async testProductDetails() {
    console.log('🚀 Testing Tesco Product Detail Scraping...\n');
    
    // Test with some known product IDs from our previous results
    const testProducts = [
      { id: '251627289', name: 'Hovis Soft White Medium Sliced Bread 800g' },
      { id: '315452138', name: 'Capri-Sun Zero Apple and Blackcurrant 8 x 200ml Kids\' Juice Drink' },
      { id: '284477542', name: 'Rosedene Farms Gala Apples 6 Pack' }
    ];

    const results = [];

    for (const product of testProducts) {
      try {
        const productData = await this.scrapeProductDetail(product.id, product.name);
        
        if (productData) {
          results.push(productData);
          console.log(`✅ Product ${product.id}: ${productData.name} - ${productData.price || 'No price'}`);
        } else {
          console.log(`❌ Failed to scrape product ${product.id}`);
        }

        // Delay between products
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (error) {
        console.error(`❌ Error testing product ${product.id}:`, error.message);
      }
    }

    console.log(`\n📊 Product Detail Scraping Results:`);
    console.log(`✅ Successful: ${results.length}/${testProducts.length}`);
    console.log(`📦 Products with prices: ${results.filter(p => p.price).length}`);

    return results;
  }
}

// Main execution
async function main() {
  const scraper = new TescoProductDetailScraper();
  
  try {
    await scraper.testProductDetails();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = TescoProductDetailScraper;
