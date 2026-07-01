/**
 * Lidl OpenFoodFacts Web Scraper
 * Scrapes product information directly from OpenFoodFacts product pages
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class LidlOpenFoodFactsScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.products = [];
    this.categories = {
      'Nuts & Seeds': [],
      'Dairy & Yogurt': [],
      'Cereals & Breakfast': [],
      'Protein Drinks': [],
      'Bakery & Bread': [],
      'Rice & Grains': [],
      'Fruits & Vegetables': [],
      'Honey & Sweeteners': [],
      'Meat & Poultry': [],
      'Other': []
    };
  }

  async init() {
    console.log('🚀 Initializing Lidl OpenFoodFacts Scraper...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    // Set user agent
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set viewport
    await this.page.setViewport({ width: 1920, height: 1080 });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // Categorize product based on name and categories
  categorizeProduct(product) {
    const name = product.name?.toLowerCase() || '';
    const categories = product.categories || [];
    const categoryString = categories.join(' ').toLowerCase();

    // Nuts & Seeds
    if (name.includes('cashew') || name.includes('walnut') || name.includes('almond') || 
        name.includes('mixed nuts') || name.includes('haselnuss') || name.includes('mandeln') ||
        categoryString.includes('nuts')) {
      return 'Nuts & Seeds';
    }

    // Dairy & Yogurt
    if (name.includes('yogurt') || name.includes('yoghurt') || name.includes('pudding') ||
        name.includes('milbona') || categoryString.includes('dairy') || categoryString.includes('yogurt')) {
      return 'Dairy & Yogurt';
    }

    // Cereals & Breakfast
    if (name.includes('bran flakes') || name.includes('granola') || name.includes('crownfield') ||
        categoryString.includes('cereals') || categoryString.includes('breakfast')) {
      return 'Cereals & Breakfast';
    }

    // Protein Drinks
    if (name.includes('protein drink') || name.includes('gusto') || name.includes('vaniglia') ||
        categoryString.includes('protein') || categoryString.includes('drink')) {
      return 'Protein Drinks';
    }

    // Bakery & Bread
    if (name.includes('tortilla') || name.includes('wraps') ||
        categoryString.includes('bakery') || categoryString.includes('bread')) {
      return 'Bakery & Bread';
    }

    // Rice & Grains
    if (name.includes('rice') || name.includes('basmati') ||
        categoryString.includes('rice') || categoryString.includes('grains')) {
      return 'Rice & Grains';
    }

    // Fruits & Vegetables
    if (name.includes('banana') || name.includes('tomato') || name.includes('grapes') ||
        name.includes('easy-peelers') || name.includes('sushi') || name.includes('bananes') ||
        name.includes('trauben') || categoryString.includes('fruits') || categoryString.includes('vegetables')) {
      return 'Fruits & Vegetables';
    }

    // Honey & Sweeteners
    if (name.includes('honey') || name.includes('manuka') ||
        categoryString.includes('honey') || categoryString.includes('sweeteners')) {
      return 'Honey & Sweeteners';
    }

    // Meat & Poultry
    if (name.includes('chicken') || name.includes('eggs') || name.includes('birchwood') ||
        categoryString.includes('meat') || categoryString.includes('poultry')) {
      return 'Meat & Poultry';
    }

    return 'Other';
  }

  // Scrape product page
  async scrapeProduct(url) {
    try {
      console.log(`🔍 Scraping: ${url}`);
      
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const productData = await this.page.evaluate(() => {
        // Extract product information
        const getTextContent = (selector) => {
          const element = document.querySelector(selector);
          return element ? element.textContent.trim() : '';
        };
        
        const getTextContentAll = (selector) => {
          const elements = document.querySelectorAll(selector);
          return Array.from(elements).map(el => el.textContent.trim());
        };
        
        const getAttribute = (selector, attr) => {
          const element = document.querySelector(selector);
          return element ? element.getAttribute(attr) : '';
        };
        
        // Basic Info
        const name = getTextContent('h1[data-testid="product-name"]') || 
                    getTextContent('.product-name') || 
                    getTextContent('h1') || 
                    document.title.split(' - ')[0];
        
        const brand = getTextContent('[data-testid="brand"]') || 
                     getTextContent('.brand') || 
                     getTextContent('a[href*="/brand/"]');
        
        const barcode = getTextContent('[data-testid="barcode"]') || 
                       getTextContent('.barcode') || 
                       getTextContent('span[title*="Barcode"]') ||
                       getTextContent('*[title*="Barcode"]');
        
        const quantity = getTextContent('[data-testid="quantity"]') || 
                        getTextContent('.quantity') || 
                        getTextContent('span[title*="Quantity"]') ||
                        getTextContent('*[title*="Quantity"]');
        
        // Categories
        const categories = getTextContentAll('[data-testid="category"]') || 
                          getTextContentAll('.category') || 
                          getTextContentAll('a[href*="/category/"]');
        
        // Labels
        const labels = getTextContentAll('[data-testid="label"]') || 
                      getTextContentAll('.label') || 
                      getTextContentAll('.badge');
        
        // Nutrition
        const nutriscore = getTextContent('[data-testid="nutriscore"]') || 
                          getTextContent('.nutriscore') || 
                          getTextContent('.nutri-score');
        
        // Images - try multiple selectors
        const imageSelectors = [
          'img[data-testid="product-image"]',
          '.product-image img',
          'img[alt*="product"]',
          'img[alt*="' + name + '"]',
          '.product img',
          'img[src*="product"]',
          'img[src*="openfoodfacts"]',
          'img[alt*="' + name.split(' ')[0] + '"]'
        ];
        
        let image = '';
        for (const selector of imageSelectors) {
          const img = document.querySelector(selector);
          if (img && img.src) {
            image = img.src;
            break;
          }
        }
        
        // Ingredients
        const ingredients = getTextContent('[data-testid="ingredients"]') || 
                           getTextContent('.ingredients') || 
                           getTextContent('div[title*="Ingredients"]') ||
                           getTextContent('*[title*="Ingredients"]');
        
        // Allergens
        const allergens = getTextContentAll('[data-testid="allergen"]') || 
                         getTextContentAll('.allergen') || 
                         getTextContentAll('.allergens span');
        
        // Nutrition facts - comprehensive extraction
        const nutritionFacts = {};
        const nutritionFactsPer100g = {};
        const nutritionFactsPerServing = {};
        
        // Try multiple selectors for nutrition tables
        const nutritionSelectors = [
          '.nutrition-facts table tr',
          '.nutrition-table tr',
          'table.nutrition tr',
          '[data-testid="nutrition-table"] tr',
          '.nutrition tr',
          'table tr:has(td)'
        ];
        
        let nutritionTable = null;
        for (const selector of nutritionSelectors) {
          const table = document.querySelector(selector);
          if (table) {
            nutritionTable = table;
            break;
          }
        }
        
        if (nutritionTable) {
          const rows = nutritionTable.querySelectorAll('tr');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 3) {
              const nutrient = cells[0].textContent.trim();
              const per100g = cells[1].textContent.trim();
              const perServing = cells[2].textContent.trim();
              
              if (nutrient && nutrient !== 'Nutrition facts') {
                nutritionFactsPer100g[nutrient] = per100g;
                nutritionFactsPerServing[nutrient] = perServing;
                nutritionFacts[nutrient] = {
                  per100g: per100g,
                  perServing: perServing
                };
              }
            }
          });
        }
        
        // Also try to extract individual nutrition values
        const nutritionLabels = [
          'Energy', 'Fat', 'Saturated fat', 'Carbohydrates', 'Sugars', 
          'Fiber', 'Proteins', 'Salt', 'Sodium', 'Cholesterol', 'Trans fat'
        ];
        
        // Extract nutrition values by searching through all text content
        nutritionLabels.forEach(label => {
          const allElements = document.querySelectorAll('*');
          for (const el of allElements) {
            const text = el.textContent;
            if (text.includes(label) && text.match(/\d/)) {
              const match = text.match(new RegExp(`${label}[^\\d]*(\\d+(?:\\.\\d+)?)\\s*([a-zA-Z%]+)?`, 'i'));
              if (match && !nutritionFacts[label]) {
                nutritionFacts[label] = {
                  value: match[1],
                  unit: match[2] || '',
                  per100g: match[1] + (match[2] || '')
                };
                break;
              }
            }
          }
        });
        
        // EcoScore
        const ecoscore = getTextContent('[data-testid="ecoscore"]') || 
                        getTextContent('.ecoscore') || 
                        getTextContent('.eco-score');
        
        // Stores
        const stores = getTextContentAll('[data-testid="store"]') || 
                      getTextContentAll('.store') || 
                      getTextContentAll('a[href*="/store/"]');
        
        // Countries
        const countries = getTextContentAll('[data-testid="country"]') || 
                         getTextContentAll('.country') || 
                         getTextContentAll('a[href*="/country/"]');
        
        return {
          name,
          brand,
          barcode,
          quantity,
          categories,
          labels,
          nutriscore,
          image,
          ingredients,
          allergens,
          nutritionFacts,
          nutritionFactsPer100g,
          nutritionFactsPerServing,
          ecoscore,
          stores,
          countries,
          url: window.location.href,
          // Additional extracted data
          servingSize: getTextContent('[data-testid="serving-size"]') || 
                      getTextContent('.serving-size') || 
                      getTextContent('*[title*="Serving size"]'),
          expirationDate: getTextContent('[data-testid="expiration"]') || 
                         getTextContent('.expiration') || 
                         getTextContent('*[title*="Expiration"]'),
          manufacturingDate: getTextContent('[data-testid="manufacturing"]') || 
                            getTextContent('.manufacturing') || 
                            getTextContent('*[title*="Manufacturing"]')
        };
      });
      
      // Add additional processing
      productData.store = 'Lidl';
      productData.scraped_at = new Date().toISOString();
      productData.source = 'OpenFoodFacts';
      
      // Categorize product
      const category = this.categorizeProduct(productData);
      productData.category = category;
      
      console.log(`✅ Scraped: ${productData.name} → ${category}`);
      
      return productData;
      
    } catch (error) {
      console.error(`❌ Error scraping ${url}:`, error.message);
      return null;
    }
  }

  // Process all product URLs
  async processProducts() {
    const productUrls = [
      'https://world.openfoodfacts.org/product/20267605/cashews-cashew-nuts-alesto',
      'https://world.openfoodfacts.org/product/20047238/mixed-nuts-alesto',
      'https://world.openfoodfacts.org/product/20005733/walnuts-alesto',
      'https://world.openfoodfacts.org/product/4056489148739/natural-yogurt-milbona-lidl',
      'https://world.openfoodfacts.org/product/20621483/bran-flakes-crownfield',
      'https://world.openfoodfacts.org/product/4056489406662/high-protein-drink-gusto-vaniglia-lidl',
      'https://world.openfoodfacts.org/product/20029838/haselnuss-fin-carre',
      'https://world.openfoodfacts.org/product/4056489175315/free-range-eggs-lidl',
      'https://world.openfoodfacts.org/product/4335619072541/lidl-chicken-legs-birchwood',
      'https://world.openfoodfacts.org/product/4056489902089/flame-grilled-chicken-breast-chunks-lidl',
      'https://world.openfoodfacts.org/product/4056489851721/both-in-one-tortilla-wraps-lidl',
      'https://world.openfoodfacts.org/product/4056489046714/8-seeded-tortilla-wraps-lidl',
      'https://world.openfoodfacts.org/product/20071974/basmati-rice-raw-lidl',
      'https://world.openfoodfacts.org/product/4056489173823/white-rice-lidl-simply',
      'https://world.openfoodfacts.org/product/4056489713036/chopped-tomatoes-simply-lidl',
      'https://world.openfoodfacts.org/product/20724696/mandeln-alesto',
      'https://world.openfoodfacts.org/product/40218787/salad-tomatoes-oaklands',
      'https://world.openfoodfacts.org/product/0207165265064/lidl-raisin-and-almond-granola-crownfield',
      'https://world.openfoodfacts.org/product/4056489710066/runny-honey-lidl',
      'https://world.openfoodfacts.org/product/4056489519928/manuka-honey-lidl',
      'https://world.openfoodfacts.org/product/2250100001324/bananes-lidl',
      'https://world.openfoodfacts.org/product/20525453/trauben-rot-und-kernlos-lidl',
      'https://world.openfoodfacts.org/product/20205751/easy-peelers-lidl',
      'https://world.openfoodfacts.org/product/20941277/sushi-box-lidl'
    ];

    console.log('🚀 Processing Lidl OpenFoodFacts Product Pages');
    console.log('=' .repeat(60));
    console.log(`📦 Total products: ${productUrls.length}`);
    console.log('=' .repeat(60));

    for (let i = 0; i < productUrls.length; i++) {
      const url = productUrls[i];
      
      console.log(`\n🔍 Processing ${i + 1}/${productUrls.length}: ${url}`);
      
      const productData = await this.scrapeProduct(url);
      
      if (productData) {
        // Add to categories
        this.categories[productData.category].push(productData);
        this.products.push(productData);
        
        console.log(`✅ ${productData.name} → ${productData.category}`);
      } else {
        console.log(`❌ Failed to scrape ${url}`);
      }
      
      // Rate limiting - wait 2 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return this.products;
  }

  // Generate comprehensive report
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      total_products: this.products.length,
      categories: {},
      summary: {
        nutrition_data: this.products.filter(p => p.nutritionFacts && Object.keys(p.nutritionFacts).length > 0).length,
        images_available: this.products.filter(p => p.image).length,
        ecoscore_available: this.products.filter(p => p.ecoscore).length,
        ingredients_available: this.products.filter(p => p.ingredients).length,
        allergens_available: this.products.filter(p => p.allergens.length > 0).length
      },
      products: this.products
    };

    // Category breakdown
    for (const [categoryName, products] of Object.entries(this.categories)) {
      if (products.length > 0) {
        report.categories[categoryName] = {
          count: products.length,
          products: products.map(p => ({
            name: p.name,
            brand: p.brand,
            nutriscore: p.nutriscore,
            ecoscore: p.ecoscore,
            image: p.image,
            url: p.url
          }))
        };
      }
    }

    return report;
  }

  // Save data to files
  async saveData() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save complete data
    const completeFile = `lidl-openfoodfacts-scraped-${timestamp}.json`;
    const completePath = path.join(__dirname, '..', 'data', 'essentials', 'lidl', completeFile);
    
    // Save categorized data
    const categorizedFile = `lidl-openfoodfacts-scraped-categorized-${timestamp}.json`;
    const categorizedPath = path.join(__dirname, '..', 'data', 'essentials', 'lidl', categorizedFile);
    
    // Ensure directory exists
    const dir = path.dirname(completePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Save complete data
    await fs.promises.writeFile(completePath, JSON.stringify(this.products, null, 2));
    
    // Save categorized data
    await fs.promises.writeFile(categorizedPath, JSON.stringify(this.categories, null, 2));
    
    // Save report
    const report = this.generateReport();
    const reportFile = `lidl-openfoodfacts-scraped-report-${timestamp}.json`;
    const reportPath = path.join(__dirname, '..', 'data', 'essentials', 'lidl', reportFile);
    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n💾 Data saved to:`);
    console.log(`   Complete: ${completePath}`);
    console.log(`   Categorized: ${categorizedPath}`);
    console.log(`   Report: ${reportPath}`);

    return { completePath, categorizedPath, reportPath };
  }

  // Print summary
  printSummary() {
    console.log('\n📊 LIDL OPENFOODFACTS SCRAPING SUMMARY');
    console.log('=' .repeat(60));
    console.log(`📦 Total products scraped: ${this.products.length}`);
    
    console.log('\n📂 CATEGORY BREAKDOWN:');
    for (const [categoryName, products] of Object.entries(this.categories)) {
      if (products.length > 0) {
        console.log(`   ${categoryName}: ${products.length} products`);
        products.forEach(p => {
          console.log(`     - ${p.name} (${p.brand}) - NutriScore: ${p.nutriscore || 'N/A'}`);
        });
      }
    }

    console.log('\n📈 DATA QUALITY:');
    const nutritionCount = this.products.filter(p => p.nutritionFacts && Object.keys(p.nutritionFacts).length > 0).length;
    const imageCount = this.products.filter(p => p.image).length;
    const ecoscoreCount = this.products.filter(p => p.ecoscore).length;
    const ingredientsCount = this.products.filter(p => p.ingredients).length;
    
    console.log(`   Nutrition data: ${nutritionCount}/${this.products.length} (${Math.round(nutritionCount/this.products.length*100)}%)`);
    console.log(`   Images available: ${imageCount}/${this.products.length} (${Math.round(imageCount/this.products.length*100)}%)`);
    console.log(`   EcoScore available: ${ecoscoreCount}/${this.products.length} (${Math.round(ecoscoreCount/this.products.length*100)}%)`);
    console.log(`   Ingredients available: ${ingredientsCount}/${this.products.length} (${Math.round(ingredientsCount/this.products.length*100)}%)`);
  }
}

// Main execution
async function main() {
  const scraper = new LidlOpenFoodFactsScraper();
  
  try {
    await scraper.init();
    await scraper.processProducts();
    await scraper.saveData();
    scraper.printSummary();
  } catch (error) {
    console.error('❌ Error in scraping:', error.message);
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = LidlOpenFoodFactsScraper;
