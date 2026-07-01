/**
 * Sainsbury's Apify Integration Scraper
 * Uses Apify API to scrape Sainsbury's products with enhanced product search
 */

import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';

dotenv.config();

class SainsburysApifyScraper {
  constructor() {
    this.client = new ApifyClient({
      token: process.env.APIFY_TOKEN,
    });
    this.actorId = 'zGhd4ucc2ffvbsw2k'; // Sainsbury's scraper actor ID
    this.postcode = 'UB8 1QW';
  }

  /**
   * Search for specific products using Apify
   */
  async searchProducts(searchTerms, maxItemsPerTerm = 8) {
    console.log(`\n🔍 Searching Sainsbury's for: ${searchTerms.join(', ')}`);
    console.log(`📊 Maximum ${maxItemsPerTerm} products per search term`);
    
    const results = [];
    
    for (const term of searchTerms) {
      try {
        console.log(`\n📦 Searching for: "${term}" (max ${maxItemsPerTerm} products)`);
        
        const input = {
          start_urls: [
            {
              url: `https://www.sainsburys.co.uk/gol-ui/SearchResults/${encodeURIComponent(term)}`
            }
          ],
          max_items: maxItemsPerTerm,
          max_items_per_url: maxItemsPerTerm,
          proxySettings: {
            useApifyProxy: true
          }
        };

        console.log('🚀 Starting Apify run...');
        const run = await this.client.actor(this.actorId).call(input);
        console.log(`⏳ Run ID: ${run.id}`);
        
        // Wait for completion
        const runInfo = await this.client.run(run.id).waitForFinish();
        console.log(`✅ Run completed with status: ${runInfo.status}`);
        
        if (runInfo.status === 'SUCCEEDED') {
          const dataset = this.client.dataset(runInfo.defaultDatasetId);
          const { items } = await dataset.listItems();
          
          console.log(`📊 Found ${items.length} items for "${term}"`);
          
          // Process and enhance the results with proper price extraction
          const processedItems = items.map(item => {
            // Extract price from Apify data structure - handle different product types
            let price = null;
            let priceRange = '';
            
            // Handle catchweight products (like chicken with weight ranges)
            if (item.catchweight && item.catchweight.length > 0) {
              const firstRange = item.catchweight[0];
              price = firstRange.retail_price?.price || firstRange.unit_price?.price;
              priceRange = firstRange.range || '';
            } else {
              // Handle regular products
              price = item.retail_price?.price || item.unit_price?.price;
            }
            
            // If no price found, check if there's a promotion with original price
            if (!price && item.promotions?.[0]?.original_price) {
              price = item.promotions[0].original_price;
            }
            
            const priceText = typeof price === 'number' ? `£${price.toFixed(2)}` : (price || 'No price');
            const fullPriceText = priceRange ? `${priceText} (${priceRange})` : priceText;
            
            return {
              ...item,
              // Add extracted price for easy access
              extractedPrice: fullPriceText,
              price: fullPriceText,
              priceRange: priceRange,
              // Add promotion info if available
              promotion: item.promotions?.[0]?.strap_line || '',
              originalPrice: item.promotions?.[0]?.original_price ? `£${item.promotions[0].original_price.toFixed(2)}` : '',
              // Add other useful fields
              searchTerm: term,
              store: 'Sainsburys',
              postcode: this.postcode,
              scrapedAt: new Date().toISOString(),
              source: 'Apify',
              // Add availability
              availability: item.is_available ? 'Available' : 'Out of Stock',
              // Add rating info
              rating: item.reviews_info?.average_rating || 0,
              reviewCount: item.reviews_info?.total || 0,
              // Add product type info
              productType: item.product_type || 'BASIC',
              // Add catchweight info if available
              catchweightInfo: item.catchweight || null
            };
          });
          
          results.push(...processedItems);
          
          // Log sample data with proper price
          if (processedItems.length > 0) {
            const sample = processedItems[0];
            console.log(`✅ Sample product: ${sample.name || 'Unknown'} - ${sample.price} ${sample.promotion ? `(${sample.promotion})` : ''}`);
          }
        } else {
          console.log(`❌ Run failed for "${term}"`);
        }
        
      } catch (error) {
        console.error(`❌ Error searching for "${term}":`, error.message);
      }
    }
    
    return results;
  }

  /**
   * Test version - 5 categories, 2 products per category
   */
  async searchTestProducts() {
    const testSearches = [
      'cooking oil', 'salt', 'milk', 'chicken', 'bread'
    ];

    console.log(`\n🧪 TEST MODE: Searching 5 categories with 2 products each...`);
    console.log(`📋 Test search terms: ${testSearches.join(', ')}`);
    
    return await this.searchProducts(testSearches, 2);
  }

  /**
   * Full version - all categories, maximum 8 products per item
   */
  async searchSpecificProducts() {
    // Consolidated search terms with duplicates removed
    const consolidatedSearches = [
      // FOOD CUPBOARD - 74 products
      'cooking oil', 'olive oil', 'vegetable oil', 'sunflower oil', 'rapeseed oil',
      'salt', 'pink himalayan salt', 'sea salt', 'table salt', 'pepper', 'garlic', 'onion', 'tomato', 'herbs', 'spices',
      'rice', 'ginger garlic paste', 'pasta', 'cereal', 'flour', 'sugar',
      'chocolate', 'biscuits', 'crisps', 'nuts', 'fruits',
      
      // FRESH FOOD - 69 products
      'peppers', 'milk', 'cheese', 'eggs', 'chicken', 'beef', 'pork', 'lamb', 
      'yogurt', 'butter', 'apples', 'grapes', 'strawberries', 'blueberries',
      
      // HEALTH & BEAUTY - 46 products
      'soap', 'shampoo', 'toothpaste', 'shower gel', 'sanitary pads', 'tampons',
      'deodorant', 'conditioner', 'medicines',
      
      // HOUSEHOLD - 19 products
      'toilet paper', 'cleaning products', 'laundry detergent', 'room spray',
      
      // BAKERY - 5 products
      'white bread', 'wholemeal bread', 'sliced bread', 'tortillas', 'pita bread',
      
      // DRINKS - 12 products
      'juice', 'water', 'soft drinks', 'tea', 'coffee',
      
      // FROZEN FOOD - 5 products
      'frozen fruits', 'frozen vegetables', 'frozen meals',
      
      // TREATS & SNACKS - 2 products
      'premium chocolate', 'snacks',
      
      // Additional specific searches (avoiding duplicates)
      'halal chicken', 'halal meat', 'fresh chicken', 'chicken breast',
      'greek yogurt', 'natural yogurt', 'vanilla yogurt', 'plain yogurt',
      'spring onions', 'red onions', 'white onions',
      'whole milk', 'semi skimmed milk', 'skimmed milk', 'organic milk',
      
      // Original essential items
      'oil', 'milk'
    ];

    // Remove duplicates while preserving order
    const uniqueSearches = [...new Set(consolidatedSearches)];
    
    console.log(`\n🎯 FULL MODE: Starting comprehensive product searches across ${uniqueSearches.length} unique categories...`);
    console.log(`📋 Search terms: ${uniqueSearches.join(', ')}`);
    console.log(`📊 Maximum 8 products per search term`);
    
    return await this.searchProducts(uniqueSearches, 8);
  }

  /**
   * Search by product URLs (for specific products)
   */
  async searchByUrls(urls) {
    console.log(`\n🔗 Searching specific URLs: ${urls.length} URLs`);
    
    const input = {
      start_urls: urls.map(url => ({ url })),
      max_items: urls.length,
      max_items_per_url: 1,
      proxySettings: {
        useApifyProxy: true
      }
    };

    try {
      const run = await this.client.actor(this.actorId).call(input);
      console.log(`⏳ Run ID: ${run.id}`);
      
      const runInfo = await this.client.run(run.id).waitForFinish();
      console.log(`✅ Run completed with status: ${runInfo.status}`);
      
      if (runInfo.status === 'SUCCEEDED') {
        const dataset = this.client.dataset(runInfo.defaultDatasetId);
        const { items } = await dataset.listItems();
        
        console.log(`📊 Found ${items.length} specific products`);
        
        return items.map(item => ({
          ...item,
          store: 'Sainsburys',
          postcode: this.postcode,
          scrapedAt: new Date().toISOString(),
          source: 'Apify'
        }));
      }
    } catch (error) {
      console.error('❌ Error searching by URLs:', error.message);
    }
    
    return [];
  }

  /**
   * Get test product data (5 categories, 2 products each)
   */
  async getTestData() {
    console.log('\n🧪 Starting TEST Sainsbury\'s data collection...');
    
    try {
      // Search for test products
      const testProducts = await this.searchTestProducts();
      
      // Remove duplicates based on product name and URL
      const uniqueProducts = testProducts.filter((product, index, self) => 
        index === self.findIndex(p => 
          p.name === product.name && p.url === product.url
        )
      );
      
      console.log(`\n✅ Total unique test products found: ${uniqueProducts.length}`);
      
      // Categorize products
      const categorized = this.categorizeProducts(uniqueProducts);
      
      return {
        products: uniqueProducts,
        categories: categorized,
        summary: {
          total: uniqueProducts.length,
          byCategory: Object.keys(categorized).map(cat => ({
            category: cat,
            count: categorized[cat].length
          }))
        },
        mode: 'TEST'
      };
      
    } catch (error) {
      console.error('❌ Error in test data collection:', error.message);
      return { products: [], categories: {}, summary: { total: 0, byCategory: [] }, mode: 'TEST' };
    }
  }

  /**
   * Get comprehensive product data (all categories, max 8 per item)
   */
  async getComprehensiveData() {
    console.log('\n🚀 Starting FULL Sainsbury\'s data collection...');
    
    try {
      // Search for specific products
      const specificProducts = await this.searchSpecificProducts();
      
      // Search for some specific product URLs
      const specificUrls = [
        'https://www.sainsburys.co.uk/gol-ui/product/sainsburys-spring-onions-bunch-100g',
        'https://www.sainsburys.co.uk/gol-ui/product/sainsburys-whole-milk-1-pint-568ml',
        'https://www.sainsburys.co.uk/gol-ui/product/sainsburys-white-sliced-bread-800g'
      ];
      
      const urlProducts = await this.searchByUrls(specificUrls);
      
      // Combine all results
      const allProducts = [...specificProducts, ...urlProducts];
      
      // Remove duplicates based on product name and URL
      const uniqueProducts = allProducts.filter((product, index, self) => 
        index === self.findIndex(p => 
          p.name === product.name && p.url === product.url
        )
      );
      
      console.log(`\n✅ Total unique products found: ${uniqueProducts.length}`);
      
      // Categorize products
      const categorized = this.categorizeProducts(uniqueProducts);
      
      return {
        products: uniqueProducts,
        categories: categorized,
        summary: {
          total: uniqueProducts.length,
          byCategory: Object.keys(categorized).map(cat => ({
            category: cat,
            count: categorized[cat].length
          }))
        },
        mode: 'FULL'
      };
      
    } catch (error) {
      console.error('❌ Error in comprehensive data collection:', error.message);
      return { products: [], categories: {}, summary: { total: 0, byCategory: [] }, mode: 'FULL' };
    }
  }

  /**
   * Categorize products based on your existing product structure
   */
  categorizeProducts(products) {
    const categories = {
      'Food Cupboard': [],
      'Fresh Food': [],
      'Health & Beauty': [],
      'Household': [],
      'Bakery': [],
      'Drinks': [],
      'Frozen Food': [],
      'Home & Ents': [],
      'Treats & Snacks': [],
      'Other': []
    };

    products.forEach(product => {
      const name = (product.name || '').toLowerCase();
      const searchTerm = (product.searchTerm || '').toLowerCase();
      
      // Food Cupboard - oils, salt, pepper, garlic, onion, tomato, herbs, spices, rice, ginger garlic paste, bread, pasta, cereal, flour, sugar, chocolate, biscuits, crisps, nuts, fruits
      if (name.includes('oil') || name.includes('salt') || name.includes('pepper') || 
          name.includes('garlic') || name.includes('onion') || name.includes('tomato') ||
          name.includes('herb') || name.includes('spice') || name.includes('rice') ||
          name.includes('ginger') || name.includes('pasta') || name.includes('cereal') ||
          name.includes('flour') || name.includes('sugar') || name.includes('chocolate') ||
          name.includes('biscuit') || name.includes('crisp') || name.includes('nut') ||
          searchTerm.includes('oil') || searchTerm.includes('salt') || searchTerm.includes('pepper') ||
          searchTerm.includes('garlic') || searchTerm.includes('onion') || searchTerm.includes('tomato') ||
          searchTerm.includes('herb') || searchTerm.includes('spice') || searchTerm.includes('rice') ||
          searchTerm.includes('ginger') || searchTerm.includes('pasta') || searchTerm.includes('cereal') ||
          searchTerm.includes('flour') || searchTerm.includes('sugar') || searchTerm.includes('chocolate') ||
          searchTerm.includes('biscuit') || searchTerm.includes('crisp') || searchTerm.includes('nut')) {
        categories['Food Cupboard'].push(product);
      }
      // Fresh Food - peppers, garlic, onions, pasta, milk, cheese, eggs, chicken, beef, pork, lamb, yogurt, butter, nuts, apples, grapes, strawberries, blueberries
      else if (name.includes('pepper') || name.includes('milk') || name.includes('cheese') ||
               name.includes('egg') || name.includes('chicken') || name.includes('beef') ||
               name.includes('pork') || name.includes('lamb') || name.includes('yogurt') ||
               name.includes('butter') || name.includes('apple') || name.includes('grape') ||
               name.includes('strawberr') || name.includes('blueberr') ||
               searchTerm.includes('pepper') || searchTerm.includes('milk') || searchTerm.includes('cheese') ||
               searchTerm.includes('egg') || searchTerm.includes('chicken') || searchTerm.includes('beef') ||
               searchTerm.includes('pork') || searchTerm.includes('lamb') || searchTerm.includes('yogurt') ||
               searchTerm.includes('butter') || searchTerm.includes('apple') || searchTerm.includes('grape') ||
               searchTerm.includes('strawberr') || searchTerm.includes('blueberr')) {
        categories['Fresh Food'].push(product);
      }
      // Health & Beauty - soap, shampoo, toothpaste, shower gel, sanitary pads, tampons, deodorant, conditioner, medicines
      else if (name.includes('soap') || name.includes('shampoo') || name.includes('toothpaste') ||
               name.includes('shower gel') || name.includes('sanitary') || name.includes('tampon') ||
               name.includes('deodorant') || name.includes('conditioner') || name.includes('medicine') ||
               searchTerm.includes('soap') || searchTerm.includes('shampoo') || searchTerm.includes('toothpaste') ||
               searchTerm.includes('shower gel') || searchTerm.includes('sanitary') || searchTerm.includes('tampon') ||
               searchTerm.includes('deodorant') || searchTerm.includes('conditioner') || searchTerm.includes('medicine')) {
        categories['Health & Beauty'].push(product);
      }
      // Household - toilet paper, cleaning products, laundry detergent, room spray
      else if (name.includes('toilet paper') || name.includes('cleaning') || name.includes('laundry') ||
               name.includes('detergent') || name.includes('room spray') ||
               searchTerm.includes('toilet paper') || searchTerm.includes('cleaning') || searchTerm.includes('laundry') ||
               searchTerm.includes('detergent') || searchTerm.includes('room spray')) {
        categories['Household'].push(product);
      }
      // Bakery - bread products
      else if (name.includes('bread') || name.includes('tortilla') || name.includes('pita') ||
               searchTerm.includes('bread') || searchTerm.includes('tortilla') || searchTerm.includes('pita')) {
        categories['Bakery'].push(product);
      }
      // Drinks - juice, water, soft drinks, tea, coffee
      else if (name.includes('juice') || name.includes('water') || name.includes('soft drink') ||
               name.includes('tea') || name.includes('coffee') ||
               searchTerm.includes('juice') || searchTerm.includes('water') || searchTerm.includes('soft drink') ||
               searchTerm.includes('tea') || searchTerm.includes('coffee')) {
        categories['Drinks'].push(product);
      }
      // Frozen Food - frozen fruits, frozen vegetables, frozen meals
      else if (name.includes('frozen') ||
               searchTerm.includes('frozen')) {
        categories['Frozen Food'].push(product);
      }
      // Treats & Snacks - premium chocolate, snacks
      else if (name.includes('premium') || name.includes('snack') ||
               searchTerm.includes('premium') || searchTerm.includes('snack')) {
        categories['Treats & Snacks'].push(product);
      }
      // Home & Ents - room spray
      else if (name.includes('room spray') || searchTerm.includes('room spray')) {
        categories['Home & Ents'].push(product);
      }
      else {
        categories['Other'].push(product);
      }
    });

    return categories;
  }

  /**
   * Save results to file (both locally and in scraped-data folder) - Sainsbury's Product Database
   */
  async saveResults(data, filename = 'sainsburys-product-database.json') {
    const fs = await import('fs');
    const path = await import('path');
    
    // Save to scraped-data folder (Sainsbury's specific)
    const scrapedDataPath = path.join(process.cwd(), 'scraped-data', filename);
    const scrapedDataDir = path.dirname(scrapedDataPath);
    if (!fs.existsSync(scrapedDataDir)) {
      fs.mkdirSync(scrapedDataDir, { recursive: true });
    }
    fs.writeFileSync(scrapedDataPath, JSON.stringify(data, null, 2));
    console.log(`💾 Sainsbury's Product Database saved to scraped-data: ${scrapedDataPath}`);
    
    // Also save locally in current directory
    const localPath = path.join(process.cwd(), filename);
    fs.writeFileSync(localPath, JSON.stringify(data, null, 2));
    console.log(`💾 Sainsbury's Product Database saved locally: ${localPath}`);
    
    // Create a comprehensive summary file
    const summaryData = {
      timestamp: new Date().toISOString(),
      store: 'Sainsburys',
      source: 'Apify',
      totalProducts: data.summary.total,
      categories: data.summary.byCategory,
      searchTerms: data.products.map(p => p.searchTerm).filter((term, index, arr) => arr.indexOf(term) === index),
      uniqueSearchTerms: [...new Set(data.products.map(p => p.searchTerm))],
      productCountByCategory: data.summary.byCategory.reduce((acc, cat) => {
        acc[cat.category] = cat.count;
        return acc;
      }, {}),
      notes: 'Sainsbury\'s Product Database - Comprehensive scraping across all categories'
    };
    
    const summaryPath = path.join(process.cwd(), 'sainsburys-database-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
    console.log(`📊 Sainsbury's Database Summary saved: ${summaryPath}`);
    
    // Create a backup with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(process.cwd(), 'scraped-data', `sainsburys-product-database-backup-${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
    console.log(`🔄 Backup created: ${backupPath}`);
  }

  /**
   * Test the scraper (5 categories, 2 products each)
   */
  async test() {
    console.log('🧪 Testing Sainsbury\'s Apify Integration (TEST MODE)...');
    
    try {
      const results = await this.getTestData();
      
      console.log('\n📊 Test Results Summary:');
      console.log(`Total products: ${results.summary.total}`);
      results.summary.byCategory.forEach(cat => {
        console.log(`  ${cat.category}: ${cat.count} products`);
      });
      
      // Save test results
      await this.saveResults(results, 'sainsburys-test-database.json');
      
      return results;
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      return null;
    }
  }

  /**
   * Run full scraping (all categories, max 8 per item)
   */
  async runFullScraping() {
    console.log('🚀 Running FULL Sainsbury\'s Apify Integration...');
    
    try {
      const results = await this.getComprehensiveData();
      
      console.log('\n📊 Full Results Summary:');
      console.log(`Total products: ${results.summary.total}`);
      results.summary.byCategory.forEach(cat => {
        console.log(`  ${cat.category}: ${cat.count} products`);
      });
      
      // Save full results
      await this.saveResults(results, 'sainsburys-product-database.json');
      
      return results;
      
    } catch (error) {
      console.error('❌ Full scraping failed:', error.message);
      return null;
    }
  }
}

// Test function
async function main() {
  const scraper = new SainsburysApifyScraper();
  await scraper.test();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default SainsburysApifyScraper;
