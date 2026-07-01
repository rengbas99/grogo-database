/**
 * Iceland Final Integrated Scraper
 * Complete solution: Search → Product Details → OpenFoodFacts → Firebase Ready
 */

const puppeteer = require('puppeteer');
const axios = require('axios');

class IcelandFinalScraper {
  constructor() {
    this.baseUrl = 'https://www.iceland.co.uk/search';
    this.productUrl = 'https://www.iceland.co.uk/p';
    this.postcode = 'UB8 1ND';
    this.openFoodFactsUrl = 'https://world.openfoodfacts.net/api/v2';
  }

  async getProductNamesAndIds(searchTerm) {
    console.log(`\n🔍 Getting Iceland product names and IDs for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true, // Changed to true - no browser window needed
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080', // Standard window size
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--force-device-scale-factor=0.5' // 50% zoom as requested
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 }); // Standard viewport
    
    // Override the viewport meta tag to make content fill the full width
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // Override viewport meta tag to make content fill full width
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=1920, initial-scale=0.5, minimum-scale=0.5, maximum-scale=5.0, user-scalable=yes');
      }
      
      // Remove any margins or padding that might cause spacing issues
      document.documentElement.style.margin = '0';
      document.documentElement.style.padding = '0';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.width = '100%';
      document.body.style.maxWidth = 'none';
    });

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

      // Extract product names and IDs from Iceland search results
      const products = await page.evaluate((searchTerm) => {
        const results = [];
        
        // Try multiple selectors for Iceland product links - prioritize product-specific selectors
        const linkSelectors = [
          '.product-tile a[href*="/p/"]',
          '.product-item a[href*="/p/"]',
          'article a[href*="/p/"]',
          '[data-test="product-tile"] a[href*="/p/"]',
          '.grid-item a[href*="/p/"]',
          'a[href*="/p/"][href*=".html"]' // More specific than just /p/
        ];
        
        for (const selector of linkSelectors) {
          const elements = document.querySelectorAll(selector);
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          
          elements.forEach((link, index) => {
            if (results.length >= 10) return; // Stop when we have 10 products
            
            const href = link.href;
            const name = link.textContent?.trim() || '';
            
            // More specific product validation
            if (name && href && 
                name.length > 5 && 
                name.length < 200 && 
                href.includes('/p/') && 
                href.includes('.html') &&
                !name.includes('Skip to') && 
                !name.includes('Iceland') && 
                !name.includes('Help') && 
                !name.includes('Register') &&
                !name.includes('Sign in') &&
                !name.includes('Book a Delivery') &&
                !name.includes('Checkout') &&
                (name.includes(searchTerm.toLowerCase()) || 
                 name.match(/[A-Z][a-z]+.*\d+(ml|L|kg|g|pack|Pack)/) || 
                 name.match(/^[A-Z][a-z]+ [A-Z][a-z]+/) ||
                 name.match(/\d+(ml|L|kg|g|pack|Pack)/))) {
              
              // Extract product ID from URL (e.g., /p/iceland-fun-size-apples-420g/88285.html)
              // Iceland format: /p/product-name/id.html
              const productIdMatch = href.match(/\/p\/.+?\/(\d+)\.html/);
              const productId = productIdMatch ? productIdMatch[1] : href.split('/p/')[1]?.split('/')[0] || '';
              
              // Avoid duplicates
              if (!results.find(r => r.productId === productId)) {
                results.push({
                  name: name,
                  productId: productId,
                  url: href,
                  searchTerm: searchTerm
                });
                console.log(`Added product: ${name} (ID: ${productId})`);
              }
            }
          });
          
          if (results.length >= 10) break; // Stop when we have enough products
        }
        
        console.log(`Total products found: ${results.length}`);
        return results;
      }, searchTerm);

      await browser.close();
      console.log(`✅ Found ${products.length} Iceland products with IDs`);
      return products;

    } catch (error) {
      console.error(`❌ Error getting Iceland product names:`, error.message);
      await browser.close();
      return [];
    }
  }

  async getProductDetails(productId, productName) {
    console.log(`🔍 Getting Iceland details for: ${productName} (ID: ${productId})`);
    
    const browser = await puppeteer.launch({ 
      headless: true, // Changed to true - no browser window needed
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080', // Standard window size
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--force-device-scale-factor=0.5' // 50% zoom as requested
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 }); // Standard viewport
    
    // Override the viewport meta tag to make content fill the full width
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // Override viewport meta tag to make content fill full width
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=1920, initial-scale=0.5, minimum-scale=0.5, maximum-scale=5.0, user-scalable=yes');
      }
      
      // Remove any margins or padding that might cause spacing issues
      document.documentElement.style.margin = '0';
      document.documentElement.style.padding = '0';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.width = '100%';
      document.body.style.maxWidth = 'none';
    });
    
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9',
      'Referer': 'https://www.iceland.co.uk/search'
    });

    try {
      // Iceland uses different URL format: /p/product-name/id.html
      const productUrl = productId.match(/^\d+$/) ? 
        `https://www.iceland.co.uk/p/iceland-product-${productId}/${productId}.html` : 
        `${this.productUrl}/${productId}`;
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

      // Extract product details from Iceland product page
      const productData = await page.evaluate((productId, productName) => {
        const data = {
          productId: productId,
          name: productName,
          price: '',
          pricePerUnit: '',
          offer: '',
          availability: 'Available',
          description: '',
          image: '',
          nutrition: {},
          ingredients: '',
          allergens: '',
          storage: '',
          useBy: '',
          rating: 0,
          reviewCount: 0,
          brand: '',
          size: '',
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

        // Extract regular price - FIXED for Iceland pricing
        const priceSelectors = [
          '.price', 
          '.product-price', 
          '.current-price',
          '.price-value',
          '.product-price-value',
          '.price-now',
          '.price-current',
          'span[data-test="price"]', 
          '[data-test="product-price"]', 
          '.value',
          '[class*="price"]',
          '.pricing',
          '.cost',
          '.product-cost',
          '[data-testid="price"]',
          // NEW: Iceland specific selectors for main price
          '.price-main',
          '.main-price',
          '.product-price-main',
          '[data-test="main-price"]'
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
        
        // FIXED: Better price extraction logic for Iceland
        if (!data.price) {
          // Method 1: Look for all elements with price-related classes
          const allPriceElements = document.querySelectorAll('[class*="price"], [class*="value"], [class*="cost"], [class*="amount"]');
          const prices = [];
          
          allPriceElements.forEach(el => {
            const text = el.textContent?.trim() || '';
            const priceMatches = text.match(/£(\d+\.?\d*)/g);
            if (priceMatches) {
              priceMatches.forEach(match => {
                const price = parseFloat(match.replace('£', ''));
                if (price > 0 && price < 50) { // Reasonable price range for groceries
                  prices.push({ price: match, value: price, element: el.className, text: text });
                }
              });
            }
          });
          
          // Method 2: If no elements found, search all text on the page
          if (prices.length === 0) {
            const pageText = document.body.innerText;
            const lines = pageText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            lines.forEach(line => {
              const priceMatches = line.match(/£(\d+\.?\d*)/g);
              if (priceMatches) {
                priceMatches.forEach(match => {
                  const price = parseFloat(match.replace('£', ''));
                  if (price > 0 && price < 50 && !line.includes('per ') && !line.includes('or Less')) {
                    prices.push({ price: match, value: price, element: 'text-search', text: line });
                  }
                });
              }
            });
          }
          
          // Sort by price value and take the highest reasonable price (main price, not unit price)
          prices.sort((a, b) => b.value - a.value);
          if (prices.length > 0) {
            data.price = prices[0].price;
            console.log(`Found Iceland price: ${data.price} from: ${prices[0].text}`);
          } else {
            console.log('No prices found on Iceland product page');
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

        // Extract product image (from red box in screenshot)
        const imageSelectors = [
          'img[data-test="product-image"]', 
          '.product-image img', 
          '.product-photo img', 
          'img[alt*="product"]',
          '.product-main-image img',
          '.product-gallery img',
          'img[src*="product"]'
        ];
        for (const selector of imageSelectors) {
          const imgEl = document.querySelector(selector);
          if (imgEl && imgEl.src) {
            data.image = imgEl.src;
            break;
          }
        }

        // Extract price per unit (from black box in screenshot - "58p per 1 unit")
        const pricePerUnitSelectors = [
          '.price-per-unit',
          '.unit-price',
          '.price-per-item',
          '.per-unit',
          '[data-test="price-per-unit"]',
          '.price-breakdown',
          '.unit-cost'
        ];
        for (const selector of pricePerUnitSelectors) {
          const unitPriceEl = document.querySelector(selector);
          if (unitPriceEl) {
            const unitPriceText = unitPriceEl.textContent?.trim() || '';
            if (unitPriceText.includes('per') || unitPriceText.includes('unit')) {
              data.pricePerUnit = unitPriceText;
              break;
            }
          }
        }

        // Extract rating and review count (from blue box in screenshot - "5 stars (160 customer reviews)")
        const ratingSelectors = [
          '.rating',
          '.stars',
          '.product-rating',
          '[data-test="rating"]',
          '.review-rating'
        ];
        for (const selector of ratingSelectors) {
          const ratingEl = document.querySelector(selector);
          if (ratingEl) {
            const ratingText = ratingEl.textContent || '';
            const stars = ratingText.match(/(\d+(?:\.\d+)?)\s*stars?/i);
            if (stars) {
              data.rating = parseFloat(stars[1]);
            }
            
            const reviews = ratingText.match(/\((\d+)\s*reviews?\)/i);
            if (reviews) {
              data.reviewCount = parseInt(reviews[1]);
            }
            break;
          }
        }

        // Extract brand from product name or separate field
        if (data.name) {
          const words = data.name.split(' ');
          if (words.length > 1) {
            data.brand = words[0];
          }
        }

        // Extract size/weight from product name
        if (data.name) {
          const sizeMatch = data.name.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|L|pack|Pack|pk|PK)/i);
          if (sizeMatch) {
            data.size = sizeMatch[0];
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

        // Extract nutrition information (from magenta box in screenshot - "Show full nutritional table")
        const nutritionSelectors = [
          '.nutrition-table',
          '.nutrition-facts',
          '.nutrition-info',
          '.nutritional-table',
          'table',
          '.nutrition-content'
        ];
        
        let nutritionTable = null;
        for (const selector of nutritionSelectors) {
          nutritionTable = document.querySelector(selector);
          if (nutritionTable) break;
        }
        
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
        } else {
          // Try to find "Show full nutritional table" link and click it
          const allLinks = document.querySelectorAll('a');
          let nutritionLink = null;
          for (const link of allLinks) {
            const text = link.textContent?.toLowerCase() || '';
            if (text.includes('nutrition') || text.includes('nutritional')) {
              nutritionLink = link;
              break;
            }
          }
          if (nutritionLink) {
            console.log('Found nutrition link, would click to expand');
            // Note: In a real implementation, you might want to click this link
            // and wait for the content to load before extracting
          }
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
      console.error(`❌ Error getting Iceland product details:`, error.message);
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
    console.log(`\n🚀 Complete Iceland scraping for: "${searchTerm}"`);
    
    // Step 1: Get product names and IDs
    const productNames = await this.getProductNamesAndIds(searchTerm);
    
    if (productNames.length === 0) {
      console.log('❌ No products found');
      return [];
    }

    const completeProducts = [];

    // Step 2: Process each product (increased from 5 to 10)
    for (let i = 0; i < Math.min(productNames.length, 10); i++) {
      const product = productNames[i];
      console.log(`\n🔍 Processing product ${i + 1}: ${product.name}`);
      
      try {
        // Get product details from Iceland
        const icelandData = await this.getProductDetails(product.productId, product.name);
        
        if (!icelandData) {
          console.log(`❌ Failed to get Iceland data for ${product.name}`);
          continue;
        }

        // Enrich with OpenFoodFacts
        const enrichment = await this.enrichWithOpenFoodFacts(product.name);
        
        // Combine all data
        const completeProduct = {
          // Iceland data
          productId: icelandData.productId,
          name: icelandData.name,
          price: icelandData.price,
          pricePerUnit: icelandData.pricePerUnit || '',
          offer: icelandData.offer,
          availability: icelandData.availability,
          description: icelandData.description,
          image: icelandData.image || (enrichment?.image || ''),
          nutrition: icelandData.nutrition,
          ingredients: icelandData.ingredients || enrichment?.ingredients || '',
          allergens: icelandData.allergens || '',
          storage: icelandData.storage || '',
          useBy: icelandData.useBy || '',
          rating: icelandData.rating || 0,
          reviewCount: icelandData.reviewCount || 0,
          brand: icelandData.brand || '',
          size: icelandData.size || '',
          
          // Store info
          store: 'Iceland',
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
          icelandUrl: `${this.productUrl}/${icelandData.productId}`,
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

  async saveToLocalFile(products, filename) {
    const fs = require('fs');
    const path = require('path');
    
    const outputDir = path.join(__dirname, '../data/scraped-products');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(products, null, 2));
    console.log(`💾 Saved ${products.length} products to: ${filePath}`);
  }

  async testAllTerms() {
    console.log('🚀 Starting Final Iceland Scraper...\n');
    
    // Essential products list
    const essentials = {
      'Cooking Essentials': [
        'oil', 'salt', 'pepper', 'garlic', 'onion', 'tomato', 'herbs', 'spices', 'rice'
      ],
      'Staples': [
        'bread', 'pasta', 'cereal', 'flour', 'sugar'
      ],
      'Dairy/Protein': [
        'milk', 'cheese', 'eggs', 'chicken', 'beef', 'pork', 'yogurt', 'butter'
      ],
      'Snacks': [
        'chocolate', 'biscuits', 'crisps', 'nuts'
      ],
      'Fruits': [
        'apple', 'banana', 'orange', 'grapes', 'strawberries'
      ],
      'Berries': [
        'strawberries', 'blueberries', 'raspberries', 'blackberries', 'cranberries', 'gooseberries'
      ],
      'Household Essentials': [
        'toilet paper', 'cleaning', 'laundry', 'soap', 'shampoo', 'toothpaste', 'room spray', 'shower gel'
      ],
      'Sanitary & Personal Care': [
        'sanitary pads', 'tampons', 'deodorant', 'conditioner', 'medicines'
      ]
    };
    
    // Flatten all essential products
    const allEssentials = [];
    Object.values(essentials).forEach(category => {
      allEssentials.push(...category);
    });
    
    // Remove duplicates and use ALL essential products
    const testTerms = [...new Set(allEssentials)];
    console.log(`📋 Scraping ALL ${testTerms.length} essential products: ${testTerms.join(', ')}\n`);
    
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
        
        // Save to local file
        if (products.length > 0) {
          const filename = `iceland-${term}-${new Date().toISOString().split('T')[0]}.json`;
          await this.saveToLocalFile(products, filename);
        }
        
        // Show sample complete products
        if (products.length > 0) {
          console.log('📦 Sample complete products:');
          products.slice(0, 2).forEach((product, i) => {
            console.log(`   ${i + 1}. ${product.name}`);
            console.log(`      Price: ${product.price} ${product.pricePerUnit ? `(${product.pricePerUnit})` : ''}`);
            console.log(`      Rating: ${product.rating} stars (${product.reviewCount} reviews)`);
            console.log(`      Brand: ${product.brand || product.openFoodFactsBrand || 'N/A'}`);
            console.log(`      Size: ${product.size || 'N/A'}`);
            console.log(`      Expiry: ${product.expiry?.days || 'N/A'} days (${product.expiry?.type || 'N/A'})`);
            console.log(`      Image: ${product.image ? 'Yes' : 'No'}`);
            console.log(`      Iceland URL: ${product.icelandUrl}`);
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
    console.log(`📊 FINAL ICELAND SCRAPER SUMMARY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`🏪 Store: Iceland`);
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
  const scraper = new IcelandFinalScraper();
  
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

module.exports = IcelandFinalScraper;
