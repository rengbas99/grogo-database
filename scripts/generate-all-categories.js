/**
 * Generate All Categories Script
 * Runs category generation for all categories one by one
 */

const { spawn } = require('child_process');
const path = require('path');

class AllCategoriesGenerator {
  constructor() {
    this.categories = [
      'Vegetables & Fruit',
      'Dairy', 
      'Meat & Poultry',
      'Bakery Items',
      'Breakfast Items',
      'Spices & World Foods',
      'Salad & Sandwiches',
      'Frozen Food Products',
      'Essentials',
      'Snacks & Beverages'
    ];
  }

  /**
   * Generate all categories
   */
  async generateAllCategories(options = {}) {
    const {
      productsPerStore = 2,
      delayBetweenCategories = 10000, // 10 seconds
      continueOnError = true
    } = options;

    console.log('🚀 Starting generation of all categories...');
    console.log(`Products per store: ${productsPerStore}`);
    console.log(`Delay between categories: ${delayBetweenCategories}ms\n`);

    const results = {
      totalCategories: this.categories.length,
      completed: 0,
      failed: 0,
      categories: {}
    };

    for (let i = 0; i < this.categories.length; i++) {
      const category = this.categories[i];
      console.log(`\n📦 Processing category ${i + 1}/${this.categories.length}: ${category}`);
      console.log('=' .repeat(60));

      try {
        const result = await this.runCategoryGeneration(category, productsPerStore);
        results.categories[category] = {
          status: 'completed',
          result: result
        };
        results.completed++;

        console.log(`✅ ${category} completed successfully`);

      } catch (error) {
        console.error(`❌ ${category} failed: ${error.message}`);
        results.categories[category] = {
          status: 'failed',
          error: error.message
        };
        results.failed++;

        if (!continueOnError) {
          console.error('Stopping due to error (continueOnError = false)');
          break;
        }
      }

      // Add delay between categories (except for the last one)
      if (i < this.categories.length - 1) {
        console.log(`\n⏳ Waiting ${delayBetweenCategories}ms before next category...`);
        await this.delay(delayBetweenCategories);
      }
    }

    // Generate final summary
    this.printFinalSummary(results);

    return results;
  }

  /**
   * Run category generation as a separate process
   */
  async runCategoryGeneration(category, productsPerStore) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, 'generate-category-products.js');
      const child = spawn('node', [scriptPath, category, productsPerStore.toString()], {
        stdio: 'inherit'
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, category, productsPerStore });
        } else {
          reject(new Error(`Category generation failed with code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Print final summary
   */
  printFinalSummary(results) {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 FINAL SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Total categories: ${results.totalCategories}`);
    console.log(`Completed: ${results.completed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Success rate: ${Math.round((results.completed / results.totalCategories) * 100)}%`);

    console.log('\n📋 Category Status:');
    Object.entries(results.categories).forEach(([category, status]) => {
      const statusIcon = status.status === 'completed' ? '✅' : '❌';
      console.log(`  ${statusIcon} ${category}`);
    });

    if (results.failed > 0) {
      console.log('\n❌ Failed Categories:');
      Object.entries(results.categories)
        .filter(([_, status]) => status.status === 'failed')
        .forEach(([category, status]) => {
          console.log(`  - ${category}: ${status.error}`);
        });
    }

    console.log('\n🎉 All categories processing completed!');
  }

  /**
   * Delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const generator = new AllCategoriesGenerator();
  
  const args = process.argv.slice(2);
  const productsPerStore = parseInt(args[0]) || 2;
  const delayBetweenCategories = parseInt(args[1]) || 10000;

  try {
    const results = await generator.generateAllCategories({
      productsPerStore,
      delayBetweenCategories,
      continueOnError: true
    });

    process.exit(results.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('❌ Master generation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = AllCategoriesGenerator;
