#!/usr/bin/env node

/**
 * Check Missing Stores
 * Investigates why Tesco, Lidl, and Sainsbury's products are missing
 */

const fs = require('fs');
const path = require('path');

class MissingStoresChecker {
  constructor() {
    this.localData = null;
    this.storeBreakdown = {};
  }

  async checkMissingStores() {
    try {
      console.log('🔍 Checking Missing Stores...');
      console.log('=' .repeat(60));

      // Load local data
      await this.loadLocalData();

      // Analyze store breakdown
      this.analyzeStoreBreakdown();

      // Check for other store files
      await this.checkOtherStoreFiles();

      // Display results
      this.displayResults();

    } catch (error) {
      console.error('❌ Error checking missing stores:', error);
    }
  }

  async loadLocalData() {
    const filePath = path.join(__dirname, '..', 'data', 'essentials', 'complete-essentials-with-prices-2025-09-20.json');
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Local data file not found');
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    this.localData = data.products || data;
    
    console.log(`📂 Loaded ${this.localData.length} products from local file`);
  }

  analyzeStoreBreakdown() {
    console.log('\n📊 ANALYZING STORE BREAKDOWN:');
    console.log('=' .repeat(40));

    this.localData.forEach(product => {
      const store = product.store || 'Unknown';
      if (!this.storeBreakdown[store]) {
        this.storeBreakdown[store] = {
          count: 0,
          withPrice: 0,
          withImage: 0,
          categories: new Set(),
          brands: new Set()
        };
      }

      this.storeBreakdown[store].count++;
      if (product.price) this.storeBreakdown[store].withPrice++;
      if (product.image) this.storeBreakdown[store].withImage++;
      if (product.category) this.storeBreakdown[store].categories.add(product.category);
      if (product.brand) this.storeBreakdown[store].brands.add(product.brand);
    });

    // Display breakdown
    Object.entries(this.storeBreakdown).forEach(([store, stats]) => {
      console.log(`\n🏪 ${store.toUpperCase()}:`);
      console.log(`   Products: ${stats.count}`);
      console.log(`   With Prices: ${stats.withPrice} (${((stats.withPrice/stats.count)*100).toFixed(1)}%)`);
      console.log(`   With Images: ${stats.withImage} (${((stats.withImage/stats.count)*100).toFixed(1)}%)`);
      console.log(`   Categories: ${stats.categories.size}`);
      console.log(`   Brands: ${stats.brands.size}`);
    });
  }

  async checkOtherStoreFiles() {
    console.log('\n📁 CHECKING OTHER STORE FILES:');
    console.log('=' .repeat(40));

    const possiblePaths = [
      '../data/products/Tesco Products/',
      '../data/products/Lidl products/',
      '../data/products/Sainsbury\'s Products/',
      '../data/scraped-products/',
      '../data/essentials/'
    ];

    for (const dirPath of possiblePaths) {
      const fullPath = path.join(__dirname, dirPath);
      if (fs.existsSync(fullPath)) {
        console.log(`\n📂 Found directory: ${dirPath}`);
        
        try {
          const files = fs.readdirSync(fullPath);
          const jsonFiles = files.filter(file => file.endsWith('.json'));
          
          console.log(`   JSON files: ${jsonFiles.length}`);
          jsonFiles.forEach(file => {
            console.log(`   - ${file}`);
            
            // Try to read and analyze the file
            try {
              const filePath = path.join(fullPath, file);
              const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              
              if (Array.isArray(data)) {
                console.log(`     Products: ${data.length}`);
                if (data.length > 0 && data[0].store) {
                  const stores = [...new Set(data.map(item => item.store))];
                  console.log(`     Stores: ${stores.join(', ')}`);
                }
              } else if (data.products && Array.isArray(data.products)) {
                console.log(`     Products: ${data.products.length}`);
                if (data.products.length > 0 && data.products[0].store) {
                  const stores = [...new Set(data.products.map(item => item.store))];
                  console.log(`     Stores: ${stores.join(', ')}`);
                }
              }
            } catch (error) {
              console.log(`     (Could not parse JSON)`);
            }
          });
        } catch (error) {
          console.log(`   Error reading directory: ${error.message}`);
        }
      } else {
        console.log(`❌ Directory not found: ${dirPath}`);
      }
    }
  }

  displayResults() {
    console.log('\n📋 SUMMARY:');
    console.log('=' .repeat(30));
    
    const totalProducts = Object.values(this.storeBreakdown).reduce((sum, stats) => sum + stats.count, 0);
    console.log(`Total products in local data: ${totalProducts}`);
    
    const stores = Object.keys(this.storeBreakdown);
    console.log(`Stores found: ${stores.join(', ')}`);
    
    console.log('\n🤔 ANALYSIS:');
    if (stores.length === 2 && stores.includes('Iceland') && stores.includes('Aldi')) {
      console.log('❌ Only Iceland and Aldi products found in local data');
      console.log('💡 This explains why Tesco, Lidl, and Sainsbury\'s are missing from Firebase');
      console.log('🔍 We need to check if we have separate files for other stores');
    } else {
      console.log('✅ Multiple stores found in local data');
    }
  }
}

// Main execution
async function main() {
  const checker = new MissingStoresChecker();
  await checker.checkMissingStores();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = MissingStoresChecker;


