/**
 * Tesco Google Search Scraper
 * Uses Google search to access Tesco product pages and get precise pricing
 */

const puppeteer = require('puppeteer');

class TescoGoogleScraper {
  constructor() {
    this.baseUrl = 'https://www.tesco.com/groceries/en-GB/search';
    this.postcode = 'UB8 1ND';
  }

  async scrapeProducts(searchTerm) {
    console.log(`\n🔍 Google-assisted Tesco scraping for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      // Step 1: Get product names from Tesco search
      const url = `${this.baseUrl}?query=${encodeURIComponent(searchTerm)}`;
      console.log(`🌐 Step 1: Getting product names from Tesco search...`);
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

      // Get product names and IDs from Tesco search
      const productLinks = await page.evaluate((searchTerm) => {
        const links = [];
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
              links.push({ name, href });
            }
          }
        });
        
        return links;
      }, searchTerm);

      console.log(`✅ Found ${productLinks.length} product names from Tesco search`);

      const products = [];

      // Step 2: For each product, search Google and get precise pricing
      for (let i = 0; i < Math.min(productLinks.length, 5); i++) { // Limit to 5 for testing
        const productLink = productLinks[i];
        console.log(`\n🔍 Step 2: Processing product ${i + 1}: ${productLink.name}`);
        
        try {
          // Search Google for the product
          const googleQuery = `${productLink.name} tesco site:tesco.com`;
          const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`;
          
          console.log(`🌐 Searching Google: ${googleQuery}`);
          await page.goto(googleUrl, { waitUntil: 'networkidle2', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Find and click the Tesco product link from Google results
          const tescoLink = await page.evaluate(() => {
            const links = document.querySelectorAll('a[href*="tesco.com/groceries/en-GB/products/"]');
            return links.length > 0 ? links[0].href : null;
          });

          if (tescoLink) {
            console.log(`🔗 Found Tesco link: ${tescoLink}`);
            
            // Navigate to the Tesco product page
            await page.goto(tescoLink, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Extract precise product data from the product page
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
                '.current-price',
                '.value'
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
            }, searchTerm, 'Tesco', this.postcode);

            if (productData.name) {
              products.push(productData);
              console.log(`✅ ${productData.name} - ${productData.price}${productData.clubcardPrice ? ` (Clubcard: ${productData.clubcardPrice})` : ''}`);
            } else {
              console.log(`⚠️  Could not extract data from product page`);
            }

          } else {
            console.log(`❌ No Tesco product link found in Google results`);
          }

        } catch (error) {
          console.error(`❌ Error processing product ${i + 1}:`, error.message);
        }

        // Delay between products
        await new Promise(resolve => setTimeout(resolve, 3000));
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
    console.log('🚀 Starting Google-assisted Tesco scraping...\n');
    
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
    console.log(`📊 GOOGLE-ASSISTED TESCO SCRAPER SUMMARY`);
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
  const scraper = new TescoGoogleScraper();
  
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

module.exports = TescoGoogleScraper;
