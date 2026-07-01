/**
 * Iceland Frozen Foods Scraper
 * Focused on: Chicken, Turkey, Doner, Beef, Lamb, Halal, Maggi frozen products
 */

const IcelandEssentialsScraper = require('./iceland-essentials-scraper');
const fs = require('fs');
const path = require('path');

class IcelandFrozenScraper extends IcelandEssentialsScraper {
  constructor() {
    super();
    
    // Focused frozen food categories
    this.frozenCategories = {
      'Chicken Frozen': [
        'frozen chicken',
        'chicken breast frozen',
        'chicken thighs frozen',
        'chicken wings frozen',
        'chicken nuggets',
        'chicken strips',
        'chicken burgers',
        'chicken fillets frozen'
      ],
      'Turkey Frozen': [
        'frozen turkey',
        'turkey breast frozen',
        'turkey mince frozen',
        'turkey burgers',
        'turkey fillets frozen'
      ],
      'Doner & Kebab': [
        'doner kebab',
        'doner meat',
        'kebab meat',
        'doner strips',
        'kebab strips',
        'doner burgers'
      ],
      'Beef Frozen': [
        'frozen beef',
        'beef mince frozen',
        'beef burgers frozen',
        'beef steaks frozen',
        'beef strips frozen',
        'beef fillets frozen'
      ],
      'Lamb Frozen': [
        'frozen lamb',
        'lamb mince frozen',
        'lamb chops frozen',
        'lamb burgers frozen',
        'lamb fillets frozen'
      ],
      'Halal Frozen': [
        'halal chicken',
        'halal beef',
        'halal lamb',
        'halal meat',
        'halal frozen'
      ],
      'Maggi Products': [
        'maggi',
        'maggi noodles',
        'maggi soup',
        'maggi sauce',
        'maggi seasoning'
      ]
    };
    
    this.totalStats = {
      totalProducts: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      productsWithImages: 0,
      productsWithoutImages: 0,
      openFoodFactsFound: 0,
      openFoodFactsNotFound: 0,
      categories: {}
    };
  }

  async runFrozenScrape() {
    console.log('🧊 ICELAND FROZEN FOODS SCRAPER');
    console.log('=' .repeat(60));
    console.log('🏪 Store: Iceland');
    console.log('📦 Categories: 7 frozen food categories');
    console.log('🔍 Terms: 40+ frozen food search terms');
    console.log('⏱️  Estimated time: ~20-30 minutes');
    console.log('=' .repeat(60));
    
    const allProducts = [];
    const startTime = new Date();

    // Process each frozen category
    for (const [category, terms] of Object.entries(this.frozenCategories)) {
      console.log(`\n🧊 PROCESSING FROZEN CATEGORY: ${category.toUpperCase()}`);
      console.log(`🔍 Terms: ${terms.join(', ')}`);
      console.log('-'.repeat(50));
      
      this.totalStats.categories[category] = {
        totalProducts: 0,
        successfulScrapes: 0,
        failedScrapes: 0
      };

      for (const term of terms) {
        console.log(`\n🔍 Scraping frozen term: "${term}"`);
        
        try {
          // Scrape Iceland for this frozen term
          const products = await this.scrapeIceland(term);
          
          if (products.length > 0) {
            allProducts.push(...products);
            this.totalStats.categories[category].totalProducts += products.length;
            this.totalStats.categories[category].successfulScrapes += products.length;
            
            console.log(`✅ Found ${products.length} frozen products for "${term}"`);
          } else {
            console.log(`ℹ️  No products found for "${term}"`);
          }
          
          // Update overall stats
          this.updateStats(this.stats);
          
          // Delay between terms
          console.log(`⏳ Waiting 2 seconds before next term...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`❌ Error processing frozen term "${term}":`, error.message);
          this.totalStats.categories[category].failedScrapes++;
        }
      }
      
      console.log(`\n✅ Category "${category}" completed: ${this.totalStats.categories[category].totalProducts} products`);
    }

    // Save all frozen products
    if (allProducts.length > 0) {
      await this.saveFrozenData(allProducts, startTime);
    }

    // Final summary
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n🧊 ICELAND FROZEN SCRAPER FINISHED!');
    console.log('=' .repeat(60));
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📊 Total frozen products scraped: ${allProducts.length}`);
    console.log(`✅ Successful scrapes: ${this.totalStats.successfulScrapes}`);
    console.log(`❌ Failed scrapes: ${this.totalStats.failedScrapes}`);
    console.log(`🖼️  Products with images: ${this.totalStats.productsWithImages}`);
    console.log(`📊 OpenFoodFacts found: ${this.totalStats.openFoodFactsFound}`);
    
    console.log('\n🧊 FROZEN CATEGORY BREAKDOWN:');
    for (const [category, stats] of Object.entries(this.totalStats.categories)) {
      console.log(`   ${category}: ${stats.totalProducts} products`);
    }
    
    return allProducts;
  }

  updateStats(scraperStats) {
    this.totalStats.successfulScrapes += scraperStats.successfulScrapes;
    this.totalStats.failedScrapes += scraperStats.failedScrapes;
    this.totalStats.productsWithImages += scraperStats.productsWithImages;
    this.totalStats.productsWithoutImages += scraperStats.productsWithoutImages;
    this.totalStats.openFoodFactsFound += scraperStats.openFoodFactsFound;
    this.totalStats.openFoodFactsNotFound += scraperStats.openFoodFactsNotFound;
  }

  async saveFrozenData(products, startTime) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `iceland-frozen-${timestamp}.json`;
      const filepath = path.join(__dirname, '..', 'data', 'essentials', 'iceland', filename);
      
      // Prepare comprehensive frozen data
      const saveData = {
        timestamp: new Date().toISOString(),
        duration: Math.round((new Date() - startTime) / 1000),
        store: 'Iceland',
        productType: 'Frozen Foods',
        totalProducts: products.length,
        stats: this.totalStats,
        frozenCategories: this.frozenCategories,
        products: products,
        summary: {
          totalProducts: products.length,
          productsWithImages: products.filter(p => p.image).length,
          productsWithNutrition: products.filter(p => Object.keys(p.openFoodFactsNutrition).length > 0).length,
          productsWithExpiry: products.filter(p => p.openFoodFactsExpiry).length,
          categories: [...new Set(products.map(p => p.category))],
          imageSources: {
            icelandOfficial: products.filter(p => p.image && p.image.includes('assets.iceland.co.uk')).length,
            openFoodFacts: products.filter(p => p.image && p.image.includes('openfoodfacts.org')).length,
            other: products.filter(p => p.image && !p.image.includes('assets.iceland.co.uk') && !p.image.includes('openfoodfacts.org')).length
          },
          frozenProductTypes: {
            chicken: products.filter(p => p.name.toLowerCase().includes('chicken')).length,
            turkey: products.filter(p => p.name.toLowerCase().includes('turkey')).length,
            doner: products.filter(p => p.name.toLowerCase().includes('doner') || p.name.toLowerCase().includes('kebab')).length,
            beef: products.filter(p => p.name.toLowerCase().includes('beef')).length,
            lamb: products.filter(p => p.name.toLowerCase().includes('lamb')).length,
            halal: products.filter(p => p.name.toLowerCase().includes('halal')).length,
            maggi: products.filter(p => p.name.toLowerCase().includes('maggi')).length
          }
        }
      };
      
      // Save to file
      await fs.promises.writeFile(filepath, JSON.stringify(saveData, null, 2));
      console.log(`\n💾 Iceland frozen foods saved to: ${filepath}`);
      console.log(`📊 Total frozen products saved: ${products.length}`);
      
      return filepath;
    } catch (error) {
      console.error('❌ Error saving frozen data:', error.message);
      return null;
    }
  }

  async runQuickTest() {
    console.log('🧪 QUICK FROZEN TEST - Running with "frozen chicken"');
    console.log('=' .repeat(50));
    
    // Reset stats
    this.totalStats = {
      totalProducts: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      productsWithImages: 0,
      productsWithoutImages: 0,
      openFoodFactsFound: 0,
      openFoodFactsNotFound: 0,
      categories: {}
    };

    const allProducts = [];

    // Test with frozen chicken
    console.log('\n🍗 Testing Iceland with "frozen chicken"...');
    const products = await this.scrapeIceland('frozen chicken');
    if (products.length > 0) {
      allProducts.push(...products);
      this.totalStats.totalProducts += products.length;
    }
    this.updateStats(this.stats);

    // Save test results
    if (allProducts.length > 0) {
      await this.saveFrozenData(allProducts, new Date());
    }

    // Summary
    console.log('\n📊 QUICK FROZEN TEST SUMMARY:');
    console.log(`✅ Total frozen products: ${allProducts.length}`);
    console.log(`🖼️  With images: ${this.totalStats.productsWithImages}`);
    console.log(`📊 OpenFoodFacts: ${this.totalStats.openFoodFactsFound}`);
  }
}

// Main execution
async function main() {
  const scraper = new IcelandFrozenScraper();
  
  // Check command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--test') || args.includes('-t')) {
    await scraper.runQuickTest();
  } else if (args.includes('--full') || args.includes('-f')) {
    await scraper.runFrozenScrape();
  } else {
    console.log('Usage:');
    console.log('  node iceland-frozen-scraper.js --test    # Quick test with frozen chicken');
    console.log('  node iceland-frozen-scraper.js --full    # Complete frozen foods scrape');
    console.log('\nRunning quick test by default...\n');
    await scraper.runQuickTest();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = IcelandFrozenScraper;
