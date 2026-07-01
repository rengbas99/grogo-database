/**
 * Smart Tesco Scraper
 * Extracts individual products from the large container using text parsing
 */

const puppeteer = require('puppeteer');

class SmartTescoScraper {
  constructor() {
    this.baseUrl = 'https://www.tesco.com/groceries/en-GB/search';
    this.postcode = 'UB8 1ND';
  }

  async scrapeProducts(searchTerm) {
    console.log(`\n🔍 Smart scraping Tesco for: "${searchTerm}"`);
    
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

      // First, find product links for precise scraping
      const productLinks = await page.evaluate((searchTerm) => {
        const links = [];
        
        // Try multiple selectors for product links
        const linkSelectors = [
          'a[data-test="product-title"]',
          'a[href*="/products/"]',
          'a[href*="/product/"]',
          '.product-tile a',
          '.product-item a',
          'article a'
        ];
        
        for (const selector of linkSelectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach((link, index) => {
            if (index < 10) { // Limit to first 10 products
              const href = link.href;
              const name = link.textContent?.trim() || '';
              
              if (name && href && name.length > 5 && name.includes(searchTerm.toLowerCase())) {
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

      // If we found product links, click into each for precise data
      if (productLinks.length > 0) {
        for (let i = 0; i < Math.min(productLinks.length, 5); i++) { // Limit to 5 for testing
          const productLink = productLinks[i];
          console.log(`\n🔍 Precise scraping product ${i + 1}: ${productLink.name}`);
          
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
      } else {
        // Fallback to text parsing if no links found
        console.log(`⚠️  No product links found, falling back to text parsing...`);
        
        const fallbackProducts = await page.evaluate((searchTerm) => {
          const results = [];
          
          // Get all text content from the page
          const pageText = document.body.innerText;
          
          // Split by common product separators and look for product patterns
          const lines = pageText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
          
          // Enhanced product detection patterns
          const productPatterns = [
            // Brand + Product patterns
            /^[A-Z][a-z]+ [A-Z][a-z]+.*\d+(ml|L|kg|g|pack|Pack)$/,
            // Tesco brand patterns
            /^Tesco [A-Z][a-z]+.*\d+(ml|L|kg|g|pack|Pack)$/,
            // Generic product patterns
            /^[A-Z][a-z]+.*\d+(ml|L|kg|g|pack|Pack)$/,
            // Simple product names with search term
            new RegExp(`^.*${searchTerm}.*\\d+(ml|L|kg|g|pack|Pack)$`, 'i')
          ];
          
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
            /Limited time/
          ];
          
          // Clubcard price patterns
          const clubcardPatterns = [
            /\d+p Clubcard Price/,
            /Clubcard Price/,
            /Clubcard/
          ];
        
          // First pass: Extract everything with prices
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Look for price patterns (£X.XX or £X)
            const priceMatch = line.match(/£(\d+\.?\d*)/);
            
            if (priceMatch) {
              // Look backwards for the product name (usually 1-5 lines before the price)
              for (let j = Math.max(0, i - 5); j < i; j++) {
                const prevLine = lines[j];
                
                // Extract everything first, filter later
                if (prevLine && prevLine.length > 5 && prevLine.length < 300) {
                  // Check for offers and clubcard prices in surrounding lines
                  let offer = '';
                  let clubcardPrice = '';
                  for (let k = Math.max(0, i - 3); k < Math.min(lines.length, i + 2); k++) {
                    const offerLine = lines[k];
                    if (offerLine && offerPatterns.some(pattern => pattern.test(offerLine))) {
                      offer = offerLine;
                    }
                    if (offerLine && clubcardPatterns.some(pattern => pattern.test(offerLine))) {
                      clubcardPrice = offerLine;
                    }
                  }
                  
                  results.push({
                    name: prevLine,
                    price: priceMatch[0],
                    offer: offer,
                    clubcardPrice: clubcardPrice,
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
            'Tesco', 'Brand', 'Organic', 'Free Range', // Has brand indicators
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
        
        products.push(...fallbackProducts);
      }
        
        // Also try to extract from specific elements that might contain product data
        const productElements = document.querySelectorAll('*');
        productElements.forEach(el => {
          const text = el.textContent?.trim() || '';
          
          // Look for elements that contain both product name and price
          if (text.includes('£') && text.length > 20 && text.length < 500) {
            const priceMatch = text.match(/£(\d+\.?\d*)/);
            if (priceMatch) {
              // Extract product name (text before the price)
              const priceIndex = text.indexOf(priceMatch[0]);
              const beforePrice = text.substring(0, priceIndex).trim();
              
              // Find the last meaningful line before the price
              const lines = beforePrice.split('\n').map(line => line.trim()).filter(line => line.length > 0);
              const productName = lines[lines.length - 1] || beforePrice;
              
              // Extract everything first, filter later
              if (productName.length > 5 && productName.length < 300) {
                
                // Check for offers in the same element
                let offer = '';
                if (offerPatterns.some(pattern => pattern.test(text))) {
                  const offerMatch = text.match(offerPatterns.find(pattern => pattern.test(text)));
                  if (offerMatch) {
                    offer = offerMatch[0];
                  }
                }
                
                results.push({
                  name: productName,
                  price: priceMatch[0],
                  offer: offer,
                  availability: 'Available',
                  searchTerm,
                  store: 'Tesco',
                  postcode: 'UB8 1ND',
                  scrapedAt: new Date().toISOString()
                });
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
          'Tesco', 'Brand', 'Organic', 'Free Range', // Has brand indicators
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
          if (product.clubcardPrice) {
            console.log(`     Clubcard Price: ${product.clubcardPrice}`);
          }
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
    console.log('🚀 Starting smart Tesco scraping...\n');
    
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
    console.log(`📊 SMART TESCO SCRAPER SUMMARY`);
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
  const scraper = new SmartTescoScraper();
  
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

module.exports = SmartTescoScraper;
