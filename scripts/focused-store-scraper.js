/**
 * Focused Store Scraper
 * Uses working Tesco and Aldi models, creates specific scrapers for Sainsburys, Lidl, Iceland
 * Gets product names from stores, enriches with OpenFoodFacts API
 */

const puppeteer = require('puppeteer');
const OpenFoodFactsService = require('../src/services/OpenFoodFactsService');

class FocusedStoreScraper {
  constructor() {
    this.openFoodFacts = new OpenFoodFactsService();
    this.stores = {
      'Tesco': {
        baseUrl: 'https://www.tesco.com/groceries/en-GB/search',
        postcode: 'UB8 1ND',
        method: 'smart-text-parsing' // Use working smart text parsing
      },
      'Aldi': {
        baseUrl: 'https://www.aldi.co.uk/search',
        postcode: 'UB8 1LB',
        method: 'selector-based' // Use working selector-based approach
      },
      'Sainsburys': {
        baseUrl: 'https://www.sainsburys.co.uk/gol-ui/groceries/fruit-and-vegetables/fresh-fruit/apples/c:1034099',
        postcode: 'UB8 1QW',
        method: 'category-page' // Use category page approach
      },
      'Lidl': {
        baseUrl: 'https://www.lidl.co.uk/q/search',
        postcode: 'UB8 1LA',
        method: 'search-page' // Use search page approach
      },
      'Iceland': {
        baseUrl: 'https://www.iceland.co.uk/search',
        postcode: 'UB8 1LH',
        method: 'search-page' // Use search page approach
      }
    };
  }

  async scrapeTesco(searchTerm) {
    console.log(`\n🏪 Scraping Tesco (Smart Text Parsing) for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      const url = `${this.stores.Tesco.baseUrl}?query=${encodeURIComponent(searchTerm)}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookie consent
      try {
        await page.waitForSelector('button[name="accept"]', { timeout: 5000 });
        await page.click('button[name="accept"]');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.log('No cookie consent popup found');
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Smart text parsing (working method)
      const products = await page.evaluate((searchTerm, postcode) => {
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
                postcode,
                scrapedAt: new Date().toISOString()
              });
              i++; // Skip the price line
              if (products.length >= 10) break;
            }
          }
        }
        return products;
      }, searchTerm, this.stores.Tesco.postcode);

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error scraping Tesco:`, error.message);
      await browser.close();
      return [];
    }
  }

  async scrapeAldi(searchTerm) {
    console.log(`\n🏪 Scraping Aldi (Selector-based) for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      const url = `${this.stores.Aldi.baseUrl}?query=${encodeURIComponent(searchTerm)}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Selector-based approach (working method)
      const products = await page.evaluate((searchTerm, postcode) => {
        const products = [];
        const productElements = document.querySelectorAll('.product-tile, .product-item, [class*="product"]');
        
        productElements.forEach(element => {
          const nameEl = element.querySelector('.product-name, h3, h4, [class*="title"]');
          const priceEl = element.querySelector('.price, [class*="price"], .cost');
          
          if (nameEl && priceEl) {
            const name = nameEl.textContent?.trim() || '';
            const price = priceEl.textContent?.trim() || '';
            
            if (name && price && name.length > 3) {
              products.push({
                name,
                price,
                availability: 'Available',
                searchTerm,
                store: 'Aldi',
                postcode,
                scrapedAt: new Date().toISOString()
              });
            }
          }
        });
        
        return products.slice(0, 10);
      }, searchTerm, this.stores.Aldi.postcode);

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error scraping Aldi:`, error.message);
      await browser.close();
      return [];
    }
  }

  async scrapeSainsburys(searchTerm) {
    console.log(`\n🏪 Scraping Sainsburys (Category Page) for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      // Use the specific category page URL
      const url = this.stores.Sainsburys.baseUrl;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookie consent
      try {
        await page.waitForSelector('[data-testid="consent-banner"], .cookie-banner, button[name="accept"]', { timeout: 5000 });
        const acceptButton = await page.$('button[name="accept"], [data-testid="accept-all"], button:contains("Accept")');
        if (acceptButton) {
          await acceptButton.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (e) {
        console.log('No cookie consent popup found');
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract products from category page
      const products = await page.evaluate((searchTerm, postcode) => {
        const products = [];
        
        // Try multiple selectors for Sainsburys
        const selectors = [
          '.sainsbury-product',
          '.product-tile',
          '[class*="product"]',
          'article',
          '.product-item',
          '.product-card'
        ];
        
        let productElements = [];
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            productElements = Array.from(elements);
            break;
          }
        }
        
        productElements.forEach(element => {
          const nameEl = element.querySelector('a[data-testid*="product"], .product-name, h3, h4, [class*="title"]');
          const priceEl = element.querySelector('[class*="price"], .price, span[class*="cost"]');
          
          if (nameEl && priceEl) {
            const name = nameEl.textContent?.trim() || '';
            const price = priceEl.textContent?.trim() || '';
            
            if (name && price && name.length > 3 && !name.includes('Help Centre')) {
              products.push({
                name,
                price,
                availability: 'Available',
                searchTerm,
                store: 'Sainsburys',
                postcode,
                scrapedAt: new Date().toISOString()
              });
            }
          }
        });
        
        // If no products found with selectors, try text parsing
        if (products.length === 0) {
          const pageText = document.body.innerText;
          const lines = pageText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const priceMatch = line.match(/£(\d+\.?\d*)/);
            
            if (priceMatch) {
              for (let j = Math.max(0, i - 3); j < i; j++) {
                const prevLine = lines[j];
                if (prevLine && prevLine.length > 5 && prevLine.length < 100 && 
                    !prevLine.includes('£') && !prevLine.includes('Help Centre') &&
                    !prevLine.includes('Skip to') && !prevLine.includes('Log in')) {
                  
                  products.push({
                    name: prevLine,
                    price: priceMatch[0],
                    availability: 'Available',
                    searchTerm,
                    store: 'Sainsburys',
                    postcode,
                    scrapedAt: new Date().toISOString()
                  });
                  break;
                }
              }
            }
          }
        }
        
        return products.slice(0, 10);
      }, searchTerm, this.stores.Sainsburys.postcode);

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error scraping Sainsburys:`, error.message);
      await browser.close();
      return [];
    }
  }

  async scrapeLidl(searchTerm) {
    console.log(`\n🏪 Scraping Lidl (Search Page) for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      const url = `${this.stores.Lidl.baseUrl}?q=${encodeURIComponent(searchTerm)}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookie consent
      try {
        await page.waitForSelector('[data-testid="consent-banner"], .cookie-banner, button[name="accept"]', { timeout: 5000 });
        const acceptButton = await page.$('button[name="accept"], [data-testid="accept-all"], button:contains("Accept")');
        if (acceptButton) {
          await acceptButton.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (e) {
        console.log('No cookie consent popup found');
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract products from search page
      const products = await page.evaluate((searchTerm, postcode) => {
        const products = [];
        
        // Try multiple selectors for Lidl
        const selectors = [
          '.SearchResultTile',
          '.product-tile',
          '[class*="product"]',
          'article',
          '.product-item',
          '.product-card'
        ];
        
        let productElements = [];
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            productElements = Array.from(elements);
            break;
          }
        }
        
        productElements.forEach(element => {
          const nameEl = element.querySelector('.product-name, h3, h4, [class*="title"]');
          const priceEl = element.querySelector('.price, [class*="price"], .cost');
          
          if (nameEl && priceEl) {
            const name = nameEl.textContent?.trim() || '';
            const price = priceEl.textContent?.trim() || '';
            
            if (name && price && name.length > 3) {
              products.push({
                name,
                price,
                availability: 'Available',
                searchTerm,
                store: 'Lidl',
                postcode,
                scrapedAt: new Date().toISOString()
              });
            }
          }
        });
        
        // If no products found with selectors, try text parsing
        if (products.length === 0) {
          const pageText = document.body.innerText;
          const lines = pageText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const priceMatch = line.match(/£(\d+\.?\d*)/);
            
            if (priceMatch) {
              for (let j = Math.max(0, i - 3); j < i; j++) {
                const prevLine = lines[j];
                if (prevLine && prevLine.length > 5 && prevLine.length < 100 && 
                    !prevLine.includes('£') && !prevLine.includes('Help Centre') &&
                    !prevLine.includes('Skip to') && !prevLine.includes('Log in')) {
                  
                  products.push({
                    name: prevLine,
                    price: priceMatch[0],
                    availability: 'Available',
                    searchTerm,
                    store: 'Lidl',
                    postcode,
                    scrapedAt: new Date().toISOString()
                  });
                  break;
                }
              }
            }
          }
        }
        
        return products.slice(0, 10);
      }, searchTerm, this.stores.Lidl.postcode);

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error scraping Lidl:`, error.message);
      await browser.close();
      return [];
    }
  }

  async scrapeIceland(searchTerm) {
    console.log(`\n🏪 Scraping Iceland (Search Page) for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      const url = `${this.stores.Iceland.baseUrl}?q=${encodeURIComponent(searchTerm)}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookie consent
      try {
        await page.waitForSelector('[data-testid="consent-banner"], .cookie-banner, button[name="accept"]', { timeout: 5000 });
        const acceptButton = await page.$('button[name="accept"], [data-testid="accept-all"], button:contains("Accept")');
        if (acceptButton) {
          await acceptButton.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (e) {
        console.log('No cookie consent popup found');
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract products from search page
      const products = await page.evaluate((searchTerm, postcode) => {
        const products = [];
        
        // Try multiple selectors for Iceland
        const selectors = [
          '.product-tile',
          '.product-item',
          '[class*="product"]',
          'article',
          '.product-card'
        ];
        
        let productElements = [];
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            productElements = Array.from(elements);
            break;
          }
        }
        
        productElements.forEach(element => {
          const nameEl = element.querySelector('.product-name, h3, h4, [class*="title"]');
          const priceEl = element.querySelector('.price, [class*="price"], .cost');
          
          if (nameEl && priceEl) {
            const name = nameEl.textContent?.trim() || '';
            const price = priceEl.textContent?.trim() || '';
            
            if (name && price && name.length > 3) {
              products.push({
                name,
                price,
                availability: 'Available',
                searchTerm,
                store: 'Iceland',
                postcode,
                scrapedAt: new Date().toISOString()
              });
            }
          }
        });
        
        // If no products found with selectors, try text parsing
        if (products.length === 0) {
          const pageText = document.body.innerText;
          const lines = pageText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const priceMatch = line.match(/£(\d+\.?\d*)/);
            
            if (priceMatch) {
              for (let j = Math.max(0, i - 3); j < i; j++) {
                const prevLine = lines[j];
                if (prevLine && prevLine.length > 5 && prevLine.length < 100 && 
                    !prevLine.includes('£') && !prevLine.includes('Help Centre') &&
                    !prevLine.includes('Skip to') && !prevLine.includes('Log in')) {
                  
                  products.push({
                    name: prevLine,
                    price: priceMatch[0],
                    availability: 'Available',
                    searchTerm,
                    store: 'Iceland',
                    postcode,
                    scrapedAt: new Date().toISOString()
                  });
                  break;
                }
              }
            }
          }
        }
        
        return products.slice(0, 10);
      }, searchTerm, this.stores.Iceland.postcode);

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error scraping Iceland:`, error.message);
      await browser.close();
      return [];
    }
  }

  async enrichWithOpenFoodFacts(products) {
    console.log(`\n🔍 Enriching ${products.length} products with OpenFoodFacts data...`);
    
    const enrichedProducts = [];

    for (const product of products) {
      try {
        console.log(`🔍 Searching OpenFoodFacts for: "${product.name}"`);
        
        // Search OpenFoodFacts for this product
        const searchResult = await this.openFoodFacts.searchProducts(product.name, 1, 3);
        
        if (searchResult && searchResult.products && searchResult.products.length > 0) {
          // Find the best match
          const bestMatch = searchResult.products[0];
          
          // Enrich the product with OpenFoodFacts data
          const enrichedProduct = {
            // Store data
            storeName: product.name,
            storePrice: product.price,
            storeAvailability: product.availability,
            store: product.store,
            postcode: product.postcode,
            
            // OpenFoodFacts data
            productName: bestMatch.product_name || product.name,
            brands: bestMatch.brands || '',
            categories: bestMatch.categories || '',
            ingredients: bestMatch.ingredients_text || '',
            allergens: bestMatch.allergens_tags || [],
            additives: bestMatch.additives_tags || [],
            nutrition: bestMatch.nutriments || {},
            novaGroup: bestMatch.nova_group || null,
            ecoscoreGrade: bestMatch.ecoscore_grade || null,
            nutriscoreGrade: bestMatch.nutriscore_grade || null,
            imageUrl: bestMatch.image_url || bestMatch.image_front_url || '',
            barcode: bestMatch.code || null,
            lastModified: bestMatch.last_modified_t || null,
            dataQuality: bestMatch.data_quality_tags || [],
            
            // Combined data
            finalName: bestMatch.product_name || product.name,
            finalPrice: product.price,
            finalImage: bestMatch.image_url || bestMatch.image_front_url || '',
            finalAvailability: product.availability,
            
            // Metadata
            searchTerm: product.searchTerm,
            scrapedAt: product.scrapedAt,
            enrichedAt: new Date().toISOString(),
            enrichmentSource: 'OpenFoodFacts'
          };

          enrichedProducts.push(enrichedProduct);
          console.log(`✅ Enriched: ${enrichedProduct.finalName}`);
          
        } else {
          // No OpenFoodFacts data found, use store data as-is
          const fallbackProduct = {
            storeName: product.name,
            storePrice: product.price,
            storeAvailability: product.availability,
            store: product.store,
            postcode: product.postcode,
            finalName: product.name,
            finalPrice: product.price,
            finalImage: '',
            finalAvailability: product.availability,
            searchTerm: product.searchTerm,
            scrapedAt: product.scrapedAt,
            enrichedAt: new Date().toISOString(),
            enrichmentSource: 'Store Only'
          };
          
          enrichedProducts.push(fallbackProduct);
          console.log(`⚠️  No OpenFoodFacts data for: ${product.name}`);
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Error enriching product "${product.name}":`, error.message);
        
        // Add fallback product
        enrichedProducts.push({
          storeName: product.name,
          storePrice: product.price,
          storeAvailability: product.availability,
          store: product.store,
          postcode: product.postcode,
          finalName: product.name,
          finalPrice: product.price,
          finalImage: '',
          finalAvailability: product.availability,
          searchTerm: product.searchTerm,
          scrapedAt: product.scrapedAt,
          enrichedAt: new Date().toISOString(),
          enrichmentSource: 'Store Only (Error)'
        });
      }
    }

    return enrichedProducts;
  }

  async scrapeAllStores(searchTerm) {
    console.log(`\n🚀 Starting focused scraping for: "${searchTerm}"`);
    
    const allProducts = [];

    // Scrape from all stores
    const storeMethods = [
      { name: 'Tesco', method: () => this.scrapeTesco(searchTerm) },
      { name: 'Aldi', method: () => this.scrapeAldi(searchTerm) },
      { name: 'Sainsburys', method: () => this.scrapeSainsburys(searchTerm) },
      { name: 'Lidl', method: () => this.scrapeLidl(searchTerm) },
      { name: 'Iceland', method: () => this.scrapeIceland(searchTerm) }
    ];

    for (const { name, method } of storeMethods) {
      try {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`Scraping ${name}`);
        console.log(`${'='.repeat(50)}`);
        
        const products = await method();
        allProducts.push(...products);
        
        console.log(`✅ ${name}: ${products.length} products found`);
        
        // Delay between stores
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        console.error(`❌ Error scraping ${name}:`, error.message);
      }
    }

    console.log(`\n📊 Scraping Summary:`);
    console.log(`  Total products found: ${allProducts.length}`);

    // Enrich with OpenFoodFacts
    const enrichedProducts = await this.enrichWithOpenFoodFacts(allProducts);

    console.log(`\n🎯 Final Results:`);
    console.log(`  Enriched products: ${enrichedProducts.length}`);
    console.log(`  OpenFoodFacts enriched: ${enrichedProducts.filter(p => p.enrichmentSource === 'OpenFoodFacts').length}`);
    console.log(`  Store only: ${enrichedProducts.filter(p => p.enrichmentSource !== 'OpenFoodFacts').length}`);

    return enrichedProducts;
  }
}

// Main execution
async function main() {
  const scraper = new FocusedStoreScraper();
  
  try {
    const enrichedProducts = await scraper.scrapeAllStores('apple');
    
    console.log(`\n🎉 Scraping complete! Found ${enrichedProducts.length} enriched products.`);
    
    // Display sample results
    console.log(`\n📦 Sample Products:`);
    enrichedProducts.slice(0, 5).forEach((product, i) => {
      console.log(`\n${i + 1}. ${product.finalName}`);
      console.log(`   Store: ${product.store} | Price: ${product.finalPrice}`);
      console.log(`   Enriched: ${product.enrichmentSource}`);
      if (product.brands) console.log(`   Brand: ${product.brands}`);
      if (product.categories) console.log(`   Category: ${product.categories}`);
    });
    
  } catch (error) {
    console.error('❌ Main execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = FocusedStoreScraper;
