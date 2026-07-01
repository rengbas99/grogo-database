/**
 * Essentials Scraper Final - Iceland & Aldi
 * Extracts: Product Name, Photo, Price, Nutrition, Expiry, Ingredients, Allergens
 * Uses official CDN images: assets.iceland.co.uk & dm.emea.cms.aldi.cx
 */

const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class EssentialsScraperFinal {
  constructor() {
    this.baseUrl = {
      iceland: 'https://www.iceland.co.uk/search',
      aldi: 'https://www.aldi.co.uk/results'
    };
    this.productUrl = {
      iceland: 'https://www.iceland.co.uk/p',
      aldi: 'https://www.aldi.co.uk/product'
    };
    this.postcode = 'UB8 1ND';
    this.openFoodFactsUrl = 'https://world.openfoodfacts.net/api/v2';
    
    // Essentials categories to focus on
    this.essentials = {
      'Cooking Essentials': ['oil', 'salt', 'pepper', 'garlic', 'onion', 'tomato', 'herbs', 'spices', 'rice'],
      'Staples': ['bread', 'pasta', 'cereal', 'flour', 'sugar'],
      'Dairy/Protein': ['milk', 'cheese', 'eggs', 'chicken', 'beef', 'pork', 'yogurt', 'butter'],
      'Snacks': ['chocolate', 'biscuits', 'crisps', 'nuts'],
      'Fruits': ['apple', 'banana', 'orange', 'grapes', 'strawberries'],
      'Household Essentials': ['toilet paper', 'cleaning', 'laundry', 'soap', 'shampoo', 'toothpaste'],
      'Sanitary & Personal Care': ['sanitary pads', 'tampons', 'deodorant', 'conditioner']
    };
    
    this.stats = {
      totalProducts: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      productsWithImages: 0,
      productsWithoutImages: 0,
      openFoodFactsFound: 0,
      openFoodFactsNotFound: 0
    };
  }

  async scrapeIceland(searchTerm) {
    console.log(`\n🏪 Scraping Iceland for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    try {
      const url = `${this.baseUrl.iceland}?q=${encodeURIComponent(searchTerm)}`;
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
        
        const linkSelectors = [
          '.product-tile a[href*="/p/"]',
          '.product-item a[href*="/p/"]',
          'article a[href*="/p/"]',
          '[data-test="product-tile"] a[href*="/p/"]',
          '.grid-item a[href*="/p/"]',
          'a[href*="/p/"][href*=".html"]'
        ];
        
        for (const selector of linkSelectors) {
          const elements = document.querySelectorAll(selector);
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          
          elements.forEach((link, index) => {
            if (results.length >= 5) return; // Limit to 5 products for testing
            
            const href = link.href;
            const name = link.textContent?.trim() || '';
            
            if (name && href && 
                name.length > 5 && 
                name.length < 200 && 
                href.includes('/p/') && 
                !name.includes('Skip to') && 
                !name.includes('Iceland') && 
                !name.includes('Help') && 
                !name.includes('Search') &&
                !name.includes('Results') &&
                (name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                 name.match(/[A-Z][a-z]+.*\d+(ml|L|kg|g|pack|Pack)/) || 
                 name.match(/^[A-Z][a-z]+ [A-Z][a-z]+/) ||
                 name.match(/^\w+.*\d+/))) {
              
              const productId = href.split('/p/')[1] || '';
              const cleanName = name.replace(/\d+\.\d+\/\w+.*£\d+\.\d+.*/, '').trim();
              
              results.push({
                name: cleanName,
                productId: productId,
                url: href,
                searchTerm: searchTerm
              });
            }
          });
          if (results.length > 0) break;
        }
        
        return results;
      }, searchTerm);

      console.log(`✅ Found ${products.length} Iceland products`);

      // Get detailed product information for each product
      const detailedProducts = [];
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        console.log(`\n🔍 Getting details for: ${product.name} (${i + 1}/${products.length})`);
        
        try {
          const details = await this.getIcelandProductDetails(browser, product.productId, product.name);
          if (details) {
            // Enrich with OpenFoodFacts
            const enrichment = await this.enrichWithOpenFoodFacts(product.name);
            
            const completeProduct = {
              productId: product.productId,
              name: details.name || product.name,
              price: details.price || '',
              pricePerUnit: details.pricePerUnit || '',
              offer: details.offer || '',
              availability: details.availability || 'Available',
              description: details.description || '',
              image: details.image || (enrichment?.image || ''),
              nutrition: details.nutrition || {},
              ingredients: details.ingredients || (enrichment?.ingredients || ''),
              allergens: details.allergens || (enrichment?.allergens?.join(', ') || ''),
              storage: details.storage || '',
              useBy: details.useBy || (enrichment?.expiry || ''),
              rating: details.rating || 0,
              reviewCount: details.reviewCount || 0,
              brand: details.brand || '',
              size: details.size || '',
              store: 'Iceland',
              postcode: this.postcode,
              searchTerm: searchTerm,
              scrapedAt: new Date().toISOString(),
              openFoodFactsNutrition: enrichment?.nutrition || {},
              openFoodFactsExpiry: enrichment?.expiry || '',
              category: this.getCategory(searchTerm)
            };

            detailedProducts.push(completeProduct);
            this.stats.successfulScrapes++;
            if (completeProduct.image) this.stats.productsWithImages++;
            if (enrichment) this.stats.openFoodFactsFound++;
            else this.stats.openFoodFactsNotFound++;
            
            console.log(`✅ Complete: ${completeProduct.name} - ${completeProduct.price}`);
          }
        } catch (error) {
          console.error(`❌ Error processing ${product.name}:`, error.message);
          this.stats.failedScrapes++;
        }
      }

      await browser.close();
      return detailedProducts;

    } catch (error) {
      console.error(`❌ Error scraping Iceland:`, error.message);
      if (browser) await browser.close();
      return [];
    }
  }

  async getIcelandProductDetails(browser, productId, productName) {
    console.log(`🔍 Getting Iceland product details for: ${productName}`);
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    try {
      const url = `${this.productUrl.iceland}/${productId}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookies
      try {
        await page.waitForSelector('button[id="onetrust-accept-btn-handler"]', { timeout: 5000 });
        await page.click('button[id="onetrust-accept-btn-handler"]');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        // No cookie popup
      }

      // Extract product details
      const productDetails = await page.evaluate(() => {
        const details = {
          name: '',
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
          size: ''
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
          '.price__current',
          '.price-current',
          '.price',
          '[data-test="price-current"]'
        ];
        for (const selector of priceSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            details.price = element.textContent.trim();
            break;
          }
        }

        // Price per unit
        const pricePerUnitSelectors = [
          '.price-per-unit',
          '.unit-price',
          '.price-per-item',
          '.per-unit',
          '[data-test="price-per-unit"]'
        ];
        for (const selector of pricePerUnitSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            const unitPriceText = element.textContent?.trim() || '';
            if (unitPriceText.includes('per') || unitPriceText.includes('unit')) {
              details.pricePerUnit = unitPriceText;
              break;
            }
          }
        }

        // Offer
        const offerSelectors = [
          '.offer-badge',
          '.offer',
          '.promotion',
          '[data-test="offer"]'
        ];
        for (const selector of offerSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            details.offer = element.textContent.trim();
            break;
          }
        }

        // Image - Extract from official CDN
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
            details.image = imgEl.src;
            break;
          }
        }

        // Rating and reviews
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
            const ratingText = ratingEl.textContent?.trim() || '';
            const ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)/);
            if (ratingMatch) {
              details.rating = parseFloat(ratingMatch[1]);
            }
            
            const reviewMatch = ratingText.match(/\((\d+)\s+reviews?\)/i);
            if (reviewMatch) {
              details.reviewCount = parseInt(reviewMatch[1]);
            }
            break;
          }
        }

        // Description
        const descSelectors = [
          '.product-description',
          '.description',
          '.product-details',
          '[data-test="product-description"]'
        ];
        for (const selector of descSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            details.description = element.textContent.trim();
            break;
          }
        }

        // Brand and size extraction from name
        if (details.name) {
          const nameParts = details.name.split(' ');
          if (nameParts.length > 1) {
            details.brand = nameParts[0];
          }
          
          // Extract size (look for patterns like "325g", "4 Pack", etc.)
          const sizeMatch = details.name.match(/(\d+(?:\.\d+)?\s*(?:ml|L|kg|g|pack|Pack|each|Each))/i);
          if (sizeMatch) {
            details.size = sizeMatch[1];
          }
        }

        return details;
      });

      await page.close();
      return productDetails;

    } catch (error) {
      console.error(`❌ Error getting Iceland product details:`, error.message);
      await page.close();
      return null;
    }
  }

  async scrapeAldi(searchTerm) {
    console.log(`\n🏪 Scraping Aldi for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      const url = `${this.baseUrl.aldi}?q=${encodeURIComponent(searchTerm)}`;
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
            if (index < 5) { // Limit to 5 products for testing
              const href = link.href;
              let name = link.textContent?.trim() || '';
              
              if (!name || name.length < 5) {
                name = link.getAttribute('title') || 
                       link.getAttribute('data-product-name') ||
                       link.getAttribute('aria-label') || '';
              }
              
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
                  (name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                   name.match(/[A-Z][a-z]+.*\d+(ml|L|kg|g|pack|Pack)/) || 
                   name.match(/^[A-Z][a-z]+ [A-Z][a-z]+/) ||
                   name.match(/^\w+.*\d+/))) {
                
                const productId = href.split('/product/')[1] || '';
                const cleanName = name.replace(/\d+\.\d+\/\w+.*£\d+\.\d+.*/, '').trim();
                
                results.push({
                  name: cleanName,
                  productId: productId,
                  url: href,
                  searchTerm: searchTerm
                });
              }
            }
          });
          if (results.length > 0) break;
        }
        
        return results;
      }, searchTerm);

      console.log(`✅ Found ${products.length} Aldi products`);

      // Get detailed product information for each product
      const detailedProducts = [];
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        console.log(`\n🔍 Getting details for: ${product.name} (${i + 1}/${products.length})`);
        
        try {
          const details = await this.getAldiProductDetails(browser, product.productId, product.name);
          if (details) {
            // Enrich with OpenFoodFacts
            const enrichment = await this.enrichWithOpenFoodFacts(product.name);
            
            const completeProduct = {
              productId: product.productId,
              name: details.name || product.name,
              price: details.price || '',
              pricePerUnit: details.pricePerUnit || '',
              offer: details.offer || '',
              availability: details.availability || 'Available',
              description: details.description || '',
              image: details.image || (enrichment?.image || ''),
              nutrition: details.nutrition || {},
              ingredients: details.ingredients || (enrichment?.ingredients || ''),
              allergens: details.allergens || (enrichment?.allergens?.join(', ') || ''),
              storage: details.storage || '',
              useBy: details.useBy || (enrichment?.expiry || ''),
              rating: details.rating || 0,
              reviewCount: details.reviewCount || 0,
              brand: details.brand || '',
              size: details.size || '',
              store: 'Aldi',
              postcode: this.postcode,
              searchTerm: searchTerm,
              scrapedAt: new Date().toISOString(),
              openFoodFactsNutrition: enrichment?.nutrition || {},
              openFoodFactsExpiry: enrichment?.expiry || '',
              category: this.getCategory(searchTerm)
            };

            detailedProducts.push(completeProduct);
            this.stats.successfulScrapes++;
            if (completeProduct.image) this.stats.productsWithImages++;
            if (enrichment) this.stats.openFoodFactsFound++;
            else this.stats.openFoodFactsNotFound++;
            
            console.log(`✅ Complete: ${completeProduct.name} - ${completeProduct.price}`);
          }
        } catch (error) {
          console.error(`❌ Error processing ${product.name}:`, error.message);
          this.stats.failedScrapes++;
        }
      }

      await browser.close();
      return detailedProducts;

    } catch (error) {
      console.error(`❌ Error scraping Aldi:`, error.message);
      if (browser) await browser.close();
      return [];
    }
  }

  async getAldiProductDetails(browser, productId, productName) {
    console.log(`🔍 Getting Aldi product details for: ${productName}`);
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
      const url = `${this.productUrl.aldi}/${productId}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookies
      try {
        await page.waitForSelector('button[id="onetrust-accept-btn-handler"]', { timeout: 5000 });
        await page.click('button[id="onetrust-accept-btn-handler"]');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        // No cookie popup
      }

      // Extract product details
      const productDetails = await page.evaluate(() => {
        const details = {
          name: '',
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
          size: ''
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
          '.price',
          '.price-current',
          '[data-test="price-current"]',
          '.product-price'
        ];
        for (const selector of priceSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            details.price = element.textContent.trim();
            break;
          }
        }

        // Price per unit
        const pricePerUnitSelectors = [
          '.price-per-unit',
          '.unit-price',
          '.price-per-item',
          '.per-unit'
        ];
        for (const selector of pricePerUnitSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            const unitPriceText = element.textContent?.trim() || '';
            if (unitPriceText.includes('per') || unitPriceText.includes('unit')) {
              details.pricePerUnit = unitPriceText;
              break;
            }
          }
        }

        // Image - Extract from official CDN
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
            details.image = imgEl.src;
            break;
          }
        }

        // Brand and size extraction from name
        if (details.name) {
          const nameParts = details.name.split(' ');
          if (nameParts.length > 1) {
            details.brand = nameParts[0];
          }
          
          // Extract size (look for patterns like "325g", "4 Pack", etc.)
          const sizeMatch = details.name.match(/(\d+(?:\.\d+)?\s*(?:ml|L|kg|g|pack|Pack|each|Each))/i);
          if (sizeMatch) {
            details.size = sizeMatch[1];
          }
        }

        return details;
      });

      await page.close();
      return productDetails;

    } catch (error) {
      console.error(`❌ Error getting Aldi product details:`, error.message);
      await page.close();
      return null;
    }
  }

  async enrichWithOpenFoodFacts(productName) {
    try {
      console.log(`🔍 Searching OpenFoodFacts for: ${productName}`);
      
      const response = await axios.get(`${this.openFoodFactsUrl}/search`, {
        params: {
          search_terms: productName,
          page_size: 1,
          fields: 'product_name,nutrition_grades,image_url,ingredients_text,allergens_tags,expiration_date,nutrition_grade_fr,energy_100g,proteins_100g,carbohydrates_100g,fat_100g,fiber_100g,sugars_100g,salt_100g,saturated_fat_100g'
        },
        timeout: 10000
      });

      if (response.data && response.data.products && response.data.products.length > 0) {
        const product = response.data.products[0];
        
        // Extract expiry information
        let expiryInfo = '';
        if (product.expiration_date) {
          expiryInfo = product.expiration_date;
        } else {
          // Estimate expiry based on product type
          const productLower = productName.toLowerCase();
          if (productLower.includes('milk') || productLower.includes('yogurt') || productLower.includes('cheese')) {
            expiryInfo = '7-14 days (refrigerated)';
          } else if (productLower.includes('bread') || productLower.includes('pasta')) {
            expiryInfo = '5-7 days (room temperature)';
          } else if (productLower.includes('apple') || productLower.includes('banana') || productLower.includes('fruit')) {
            expiryInfo = '7-14 days (refrigerated)';
          } else if (productLower.includes('chicken') || productLower.includes('beef') || productLower.includes('meat')) {
            expiryInfo = '2-3 days (refrigerated)';
          } else {
            expiryInfo = 'Check packaging for best before date';
          }
        }

        return {
          nutrition: {
            grade: product.nutrition_grade_fr || product.nutrition_grades?.fr || '',
            energy: product.energy_100g || 0,
            proteins: product.proteins_100g || 0,
            carbohydrates: product.carbohydrates_100g || 0,
            fat: product.fat_100g || 0,
            fiber: product.fiber_100g || 0,
            sugars: product.sugars_100g || 0,
            salt: product.salt_100g || 0,
            saturated_fat: product.saturated_fat_100g || 0
          },
          image: product.image_url || '',
          ingredients: product.ingredients_text || '',
          allergens: product.allergens_tags || [],
          expiry: expiryInfo
        };
      }
    } catch (error) {
      console.log(`ℹ️  No OpenFoodFacts data for: ${productName}`);
    }
    return null;
  }

  getCategory(searchTerm) {
    for (const [category, terms] of Object.entries(this.essentials)) {
      if (terms.some(term => searchTerm.toLowerCase().includes(term.toLowerCase()))) {
        return category;
      }
    }
    return 'Uncategorized';
  }

  async saveToLocalFile(products, store) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `essentials-${store.toLowerCase()}-${timestamp}.json`;
      const filepath = path.join(__dirname, '..', 'data', 'essentials', filename);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      
      // Prepare data for saving
      const saveData = {
        timestamp: new Date().toISOString(),
        store: store,
        totalProducts: products.length,
        stats: this.stats,
        essentials: this.essentials,
        products: products,
        summary: {
          totalProducts: products.length,
          productsWithImages: products.filter(p => p.image).length,
          productsWithNutrition: products.filter(p => Object.keys(p.openFoodFactsNutrition).length > 0).length,
          productsWithExpiry: products.filter(p => p.openFoodFactsExpiry).length,
          categories: [...new Set(products.map(p => p.category))]
        }
      };
      
      // Save to file
      await fs.writeFile(filepath, JSON.stringify(saveData, null, 2));
      console.log(`\n💾 Essentials saved locally to: ${filepath}`);
      console.log(`📊 Total products saved: ${products.length}`);
      
      return filepath;
    } catch (error) {
      console.error('❌ Error saving to local file:', error.message);
      return null;
    }
  }

  async testWithApple() {
    console.log('🧪 TESTING WITH APPLE - Iceland & Aldi');
    console.log('=' .repeat(50));
    
    this.stats = {
      totalProducts: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      productsWithImages: 0,
      productsWithoutImages: 0,
      openFoodFactsFound: 0,
      openFoodFactsNotFound: 0
    };

    // Test Iceland
    console.log('\n🍎 Testing Iceland with "apple"...');
    const icelandProducts = await this.scrapeIceland('apple');
    
    if (icelandProducts.length > 0) {
      await this.saveToLocalFile(icelandProducts, 'Iceland');
    }

    // Test Aldi
    console.log('\n🍎 Testing Aldi with "apple"...');
    const aldiProducts = await this.scrapeAldi('apple');
    
    if (aldiProducts.length > 0) {
      await this.saveToLocalFile(aldiProducts, 'Aldi');
    }

    // Summary
    console.log('\n📊 TEST SUMMARY:');
    console.log(`✅ Successful scrapes: ${this.stats.successfulScrapes}`);
    console.log(`❌ Failed scrapes: ${this.stats.failedScrapes}`);
    console.log(`🖼️  Products with images: ${this.stats.productsWithImages}`);
    console.log(`📊 OpenFoodFacts found: ${this.stats.openFoodFactsFound}`);
    console.log(`❌ OpenFoodFacts not found: ${this.stats.openFoodFactsNotFound}`);
  }

  async runCompleteEssentials() {
    console.log('🚀 RUNNING COMPLETE ESSENTIALS SCRAPER');
    console.log('=' .repeat(50));
    
    this.stats = {
      totalProducts: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      productsWithImages: 0,
      productsWithoutImages: 0,
      openFoodFactsFound: 0,
      openFoodFactsNotFound: 0
    };

    const allProducts = [];

    // Scrape all essentials from both stores
    for (const [category, terms] of Object.entries(this.essentials)) {
      console.log(`\n📦 Processing category: ${category}`);
      
      for (const term of terms) {
        console.log(`\n🔍 Scraping term: ${term}`);
        
        // Iceland
        const icelandProducts = await this.scrapeIceland(term);
        allProducts.push(...icelandProducts);
        
        // Aldi
        const aldiProducts = await this.scrapeAldi(term);
        allProducts.push(...aldiProducts);
        
        // Delay between terms
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Save all products
    if (allProducts.length > 0) {
      await this.saveToLocalFile(allProducts, 'All');
    }

    // Final summary
    console.log('\n🎉 COMPLETE ESSENTIALS SCRAPER FINISHED!');
    console.log(`📊 Total products scraped: ${allProducts.length}`);
    console.log(`✅ Successful scrapes: ${this.stats.successfulScrapes}`);
    console.log(`❌ Failed scrapes: ${this.stats.failedScrapes}`);
    console.log(`🖼️  Products with images: ${this.stats.productsWithImages}`);
    console.log(`📊 OpenFoodFacts found: ${this.stats.openFoodFactsFound}`);
  }
}

// Test function
async function main() {
  const scraper = new EssentialsScraperFinal();
  
  // Test with apple first
  await scraper.testWithApple();
  
  // Uncomment to run complete scraper
  // await scraper.runCompleteEssentials();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = EssentialsScraperFinal;
