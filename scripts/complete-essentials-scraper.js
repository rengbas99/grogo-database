/**
 * Complete Essentials Scraper - Iceland & Aldi
 * Runs both stores for all essential categories
 * Extracts: Product Name, Photo, Price, Nutrition, Expiry, Ingredients, Allergens
 */

const IcelandEssentialsScraper = require('./iceland-essentials-scraper');
const AldiEssentialsScraper = require('./aldi-essentials-scraper');
const fs = require('fs');
const path = require('path');

class CompleteEssentialsScraper {
  constructor() {
    this.icelandScraper = new IcelandEssentialsScraper();
    this.aldiScraper = new AldiEssentialsScraper();
    
    this.essentials = {
      'Cooking Essentials': ['oil', 'salt', 'pepper', 'garlic', 'onion', 'tomato', 'herbs', 'spices', 'rice'],
      'Staples': ['bread', 'pasta', 'cereal', 'flour', 'sugar'],
      'Dairy/Protein': ['milk', 'cheese', 'eggs', 'chicken', 'beef', 'pork', 'yogurt', 'butter'],
      'Snacks': ['chocolate', 'biscuits', 'crisps', 'nuts'],
      'Fruits': ['apple', 'banana', 'orange', 'grapes', 'strawberries'],
      'Household Essentials': ['toilet paper', 'cleaning', 'laundry', 'soap', 'shampoo', 'toothpaste'],
      'Sanitary & Personal Care': ['sanitary pads', 'tampons', 'deodorant', 'conditioner'],
      'Frozen Chicken': ['frozen chicken', 'chicken breast frozen', 'chicken thighs frozen', 'chicken wings frozen', 'chicken nuggets', 'chicken strips', 'chicken burgers', 'chicken fillets frozen'],
      'Frozen Turkey': ['frozen turkey', 'turkey breast frozen', 'turkey mince frozen', 'turkey burgers', 'turkey fillets frozen'],
      'Doner & Kebab': ['doner kebab', 'doner meat', 'kebab meat', 'doner strips', 'kebab strips', 'doner burgers'],
      'Frozen Beef': ['frozen beef', 'beef mince frozen', 'beef burgers frozen', 'beef steaks frozen', 'beef strips frozen', 'beef fillets frozen'],
      'Frozen Lamb': ['frozen lamb', 'lamb mince frozen', 'lamb chops frozen', 'lamb burgers frozen', 'lamb fillets frozen'],
      'Halal Frozen': ['halal chicken', 'halal beef', 'halal lamb', 'halal meat', 'halal frozen'],
      'Maggi Products': ['maggi', 'maggi noodles', 'maggi soup', 'maggi sauce', 'maggi seasoning']
    };
    
    this.totalStats = {
      totalProducts: 0,
      icelandProducts: 0,
      aldiProducts: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      productsWithImages: 0,
      productsWithoutImages: 0,
      openFoodFactsFound: 0,
      openFoodFactsNotFound: 0,
      categories: {}
    };
  }

  async runCompleteEssentials() {
    console.log('🚀 RUNNING COMPLETE ESSENTIALS SCRAPER');
    console.log('=' .repeat(60));
    console.log('🏪 Stores: Iceland & Aldi');
    console.log('📦 Categories: 7 essential categories');
    console.log('🔍 Terms: 35+ essential search terms');
    console.log('=' .repeat(60));
    
    const allProducts = [];
    const startTime = new Date();

    // Process each category
    for (const [category, terms] of Object.entries(this.essentials)) {
      console.log(`\n📦 PROCESSING CATEGORY: ${category.toUpperCase()}`);
      console.log(`🔍 Terms: ${terms.join(', ')}`);
      console.log('-'.repeat(50));
      
      this.totalStats.categories[category] = {
        totalProducts: 0,
        icelandProducts: 0,
        aldiProducts: 0
      };

      for (const term of terms) {
        console.log(`\n🔍 Scraping term: "${term}"`);
        
        try {
          // Scrape Iceland
          console.log(`\n🏪 ICELAND - ${term}`);
          const icelandProducts = await this.icelandScraper.scrapeIceland(term);
          
          if (icelandProducts.length > 0) {
            allProducts.push(...icelandProducts);
            this.totalStats.icelandProducts += icelandProducts.length;
            this.totalStats.categories[category].icelandProducts += icelandProducts.length;
            this.totalStats.categories[category].totalProducts += icelandProducts.length;
            
            console.log(`✅ Iceland: ${icelandProducts.length} products found`);
          }
          
          // Update stats from Iceland scraper
          this.updateStats(this.icelandScraper.stats);
          
          // Delay between stores
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Scrape Aldi
          console.log(`\n🏪 ALDI - ${term}`);
          const aldiProducts = await this.aldiScraper.scrapeAldi(term);
          
          if (aldiProducts.length > 0) {
            allProducts.push(...aldiProducts);
            this.totalStats.aldiProducts += aldiProducts.length;
            this.totalStats.categories[category].aldiProducts += aldiProducts.length;
            this.totalStats.categories[category].totalProducts += aldiProducts.length;
            
            console.log(`✅ Aldi: ${aldiProducts.length} products found`);
          }
          
          // Update stats from Aldi scraper
          this.updateStats(this.aldiScraper.stats);
          
          // Delay between terms
          console.log(`⏳ Waiting 3 seconds before next term...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (error) {
          console.error(`❌ Error processing term "${term}":`, error.message);
        }
      }
      
      console.log(`\n✅ Category "${category}" completed: ${this.totalStats.categories[category].totalProducts} products`);
    }

    // Save all products
    if (allProducts.length > 0) {
      await this.saveCompleteData(allProducts, startTime);
    }

    // Final summary
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n🎉 COMPLETE ESSENTIALS SCRAPER FINISHED!');
    console.log('=' .repeat(60));
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📊 Total products scraped: ${allProducts.length}`);
    console.log(`🏪 Iceland products: ${this.totalStats.icelandProducts}`);
    console.log(`🏪 Aldi products: ${this.totalStats.aldiProducts}`);
    console.log(`✅ Successful scrapes: ${this.totalStats.successfulScrapes}`);
    console.log(`❌ Failed scrapes: ${this.totalStats.failedScrapes}`);
    console.log(`🖼️  Products with images: ${this.totalStats.productsWithImages}`);
    console.log(`📊 OpenFoodFacts found: ${this.totalStats.openFoodFactsFound}`);
    console.log(`❌ OpenFoodFacts not found: ${this.totalStats.openFoodFactsNotFound}`);
    
    console.log('\n📦 CATEGORY BREAKDOWN:');
    for (const [category, stats] of Object.entries(this.totalStats.categories)) {
      console.log(`   ${category}: ${stats.totalProducts} products (Iceland: ${stats.icelandProducts}, Aldi: ${stats.aldiProducts})`);
    }
  }

  updateStats(scraperStats) {
    this.totalStats.successfulScrapes += scraperStats.successfulScrapes;
    this.totalStats.failedScrapes += scraperStats.failedScrapes;
    this.totalStats.productsWithImages += scraperStats.productsWithImages;
    this.totalStats.productsWithoutImages += scraperStats.productsWithoutImages;
    this.totalStats.openFoodFactsFound += scraperStats.openFoodFactsFound;
    this.totalStats.openFoodFactsNotFound += scraperStats.openFoodFactsNotFound;
  }

  async saveCompleteData(products, startTime) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `complete-essentials-${timestamp}.json`;
      const filepath = path.join(__dirname, '..', 'data', 'essentials', filename);
      
      // Prepare comprehensive data
      const saveData = {
        timestamp: new Date().toISOString(),
        duration: Math.round((new Date() - startTime) / 1000),
        stores: ['Iceland', 'Aldi'],
        totalProducts: products.length,
        stats: this.totalStats,
        essentials: this.essentials,
        products: products,
        summary: {
          totalProducts: products.length,
          icelandProducts: products.filter(p => p.store === 'Iceland').length,
          aldiProducts: products.filter(p => p.store === 'Aldi').length,
          productsWithImages: products.filter(p => p.image).length,
          productsWithNutrition: products.filter(p => Object.keys(p.openFoodFactsNutrition).length > 0).length,
          productsWithExpiry: products.filter(p => p.openFoodFactsExpiry).length,
          categories: [...new Set(products.map(p => p.category))],
          imageSources: {
            icelandOfficial: products.filter(p => p.image && p.image.includes('assets.iceland.co.uk')).length,
            aldiOfficial: products.filter(p => p.image && p.image.includes('dm.emea.cms.aldi.cx')).length,
            openFoodFacts: products.filter(p => p.image && p.image.includes('openfoodfacts.org')).length,
            other: products.filter(p => p.image && !p.image.includes('assets.iceland.co.uk') && !p.image.includes('dm.emea.cms.aldi.cx') && !p.image.includes('openfoodfacts.org')).length
          }
        }
      };
      
      // Save to file
      await fs.promises.writeFile(filepath, JSON.stringify(saveData, null, 2));
      console.log(`\n💾 Complete essentials saved to: ${filepath}`);
      console.log(`📊 Total products saved: ${products.length}`);
      
      return filepath;
    } catch (error) {
      console.error('❌ Error saving complete data:', error.message);
      return null;
    }
  }

  async runQuickTest() {
    console.log('🧪 QUICK TEST - Running both stores with "apple"');
    console.log('=' .repeat(50));
    
    // Reset stats
    this.totalStats = {
      totalProducts: 0,
      icelandProducts: 0,
      aldiProducts: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      productsWithImages: 0,
      productsWithoutImages: 0,
      openFoodFactsFound: 0,
      openFoodFactsNotFound: 0,
      categories: {}
    };

    const allProducts = [];

    // Test Iceland
    console.log('\n🍎 Testing Iceland with "apple"...');
    const icelandProducts = await this.icelandScraper.scrapeIceland('apple');
    if (icelandProducts.length > 0) {
      allProducts.push(...icelandProducts);
      this.totalStats.icelandProducts += icelandProducts.length;
    }
    this.updateStats(this.icelandScraper.stats);

    // Test Aldi
    console.log('\n🍎 Testing Aldi with "apple"...');
    const aldiProducts = await this.aldiScraper.scrapeAldi('apple');
    if (aldiProducts.length > 0) {
      allProducts.push(...aldiProducts);
      this.totalStats.aldiProducts += aldiProducts.length;
    }
    this.updateStats(this.aldiScraper.stats);

    // Save test results
    if (allProducts.length > 0) {
      await this.saveCompleteData(allProducts, new Date());
    }

    // Summary
    console.log('\n📊 QUICK TEST SUMMARY:');
    console.log(`✅ Total products: ${allProducts.length}`);
    console.log(`🏪 Iceland: ${this.totalStats.icelandProducts}`);
    console.log(`🏪 Aldi: ${this.totalStats.aldiProducts}`);
    console.log(`🖼️  With images: ${this.totalStats.productsWithImages}`);
    console.log(`📊 OpenFoodFacts: ${this.totalStats.openFoodFactsFound}`);
  }
}

// Main execution
async function main() {
  const scraper = new CompleteEssentialsScraper();
  
  // Check command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--test') || args.includes('-t')) {
    await scraper.runQuickTest();
  } else if (args.includes('--full') || args.includes('-f')) {
    await scraper.runCompleteEssentials();
  } else {
    console.log('Usage:');
    console.log('  node complete-essentials-scraper.js --test    # Quick test with apples');
    console.log('  node complete-essentials-scraper.js --full    # Complete essentials scrape');
    console.log('\nRunning quick test by default...\n');
    await scraper.runQuickTest();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = CompleteEssentialsScraper;
