import { validateApifyToken, PRODUCT_CATEGORIES, SCRAPING_CONFIG } from '../config/apify-config.js';
import { normalizeProductData } from '../utils/data-processor.js';
import { StorageManager } from '../storage/storage-manager.js';
import { TescoScraper } from './tesco-scraper.js';
import { AsdaScraper } from './asda-scraper.js';
import { SainsburysScraper } from './sainsburys-scraper.js';
import { LidlScraper } from './lidl-scraper.js';
import { IcelandScraper } from './iceland-scraper.js';
import fs from 'fs-extra';
import path from 'path';

class ScrapingOrchestrator {
  constructor() {
    this.scrapers = {
      tesco: new TescoScraper(),
      asda: new AsdaScraper(),
      sainsburys: new SainsburysScraper(),
      lidl: new LidlScraper(),
      iceland: new IcelandScraper()
    };
    
    this.storageManager = new StorageManager();
    this.results = [];
    this.startTime = null;
  }

  async initialize() {
    console.log('🚀 Initializing UK Supermarket Scraper...');
    
    // Validate Apify token
    const isValid = await validateApifyToken();
    if (!isValid) {
      throw new Error('Invalid Apify token. Please check your APIFY_TOKEN environment variable.');
    }

    // Initialize storage manager
    await this.storageManager.initialize();
    
    this.startTime = new Date();
    console.log(`✅ Initialization complete. Starting at ${this.startTime.toISOString()}`);
  }

  async scrapeAllStores() {
    console.log('\n🛒 Starting comprehensive scraping of all UK supermarkets...');
    console.log(`📊 Target: ${Object.keys(PRODUCT_CATEGORIES).length} categories × ${Object.keys(this.scrapers).length} stores`);
    
    const allResults = [];
    
    for (const [categoryKey, categoryData] of Object.entries(PRODUCT_CATEGORIES)) {
      console.log(`\n📦 Processing category: ${categoryData.name}`);
      console.log(`🔍 Search terms: ${categoryData.searchTerms.join(', ')}`);
      
      const categoryResults = [];
      
      // Scrape each store for this category
      for (const [storeName, scraper] of Object.entries(this.scrapers)) {
        try {
          console.log(`\n🏪 Scraping ${storeName.toUpperCase()} for ${categoryData.name}...`);
          
          const rawProducts = await scraper.scrapeWithSearchTerm(categoryData.searchTerms[0]);
          
          // Normalize the data
          const normalizedProducts = rawProducts.map(product => 
            normalizeProductData(product, storeName, categoryKey)
          );
          
          // Save to storage (local + Firebase backup)
          const saveResult = await this.storageManager.saveProducts(
            normalizedProducts,
            storeName,
            categoryKey
          );
          
          categoryResults.push(...normalizedProducts);
          allResults.push(...normalizedProducts);
          
          console.log(`✅ ${storeName} completed: ${normalizedProducts.length} products`);
          console.log(`💾 Saved locally: ${saveResult.local ? 'Yes' : 'No'}`);
          console.log(`🔥 Firebase backup: ${saveResult.firebase ? 'Yes' : 'No'}`);
          
          // Add delay between stores
          await this.delay(SCRAPING_CONFIG.SCRAPING_DELAY_MS);
          
        } catch (error) {
          console.error(`❌ Error scraping ${storeName} for ${categoryData.name}:`, error.message);
          // Continue with other stores even if one fails
        }
      }
      
      console.log(`📊 Category ${categoryData.name} completed: ${categoryResults.length} total products`);
    }
    
    this.results = allResults;
    return allResults;
  }

  async scrapeSpecificStores(stores, categories = null) {
    console.log(`\n🎯 Scraping specific stores: ${stores.join(', ')}`);
    
    const targetCategories = categories ? 
      Object.fromEntries(Object.entries(PRODUCT_CATEGORIES).filter(([key]) => categories.includes(key))) :
      PRODUCT_CATEGORIES;
    
    const allResults = [];
    
    for (const [categoryKey, categoryData] of Object.entries(targetCategories)) {
      console.log(`\n📦 Processing category: ${categoryData.name}`);
      
      for (const storeName of stores) {
        if (!this.scrapers[storeName.toLowerCase()]) {
          console.warn(`⚠️ Unknown store: ${storeName}`);
          continue;
        }
        
        try {
          console.log(`\n🏪 Scraping ${storeName.toUpperCase()} for ${categoryData.name}...`);
          
          const storeResults = await this.scrapers[storeName.toLowerCase()].scrapeCategory(
            categoryKey,
            categoryData.searchTerms,
            SCRAPING_CONFIG.OUTPUT_DIRECTORY
          );
          
          allResults.push(...storeResults);
          console.log(`✅ ${storeName} completed: ${storeResults.length} products`);
          
          await this.delay(SCRAPING_CONFIG.SCRAPING_DELAY_MS);
          
        } catch (error) {
          console.error(`❌ Error scraping ${storeName} for ${categoryData.name}:`, error.message);
        }
      }
    }
    
    this.results = allResults;
    return allResults;
  }

  async processAndSaveResults() {
    console.log('\n📊 Processing and saving results...');
    
    try {
      // Get all products from storage
      const allProducts = await this.storageManager.getAllProducts();
      
      if (allProducts.length === 0) {
        console.log('⚠️ No products found in storage');
        return;
      }

      // Get statistics
      const stats = await this.storageManager.getStats();
      
      // Export to CSV if requested
      if (SCRAPING_CONFIG.OUTPUT_FORMAT === 'csv' || SCRAPING_CONFIG.OUTPUT_FORMAT === 'both') {
        await this.storageManager.exportToCSV();
      }
      
      // Save session metadata
      await this.storageManager.saveSession({
        totalProducts: allProducts.length,
        stores: Object.keys(stats.storeBreakdown),
        categories: Object.keys(stats.categoryBreakdown),
        duration: Math.round((new Date() - this.startTime) / 1000)
      });
      
      // Print summary
      this.printSummary(stats);
      
      // Try to backup to Firebase
      console.log('\n🔥 Attempting Firebase backup...');
      const backupSuccess = await this.storageManager.backupToFirebase();
      
      if (backupSuccess) {
        console.log('✅ Firebase backup completed');
      } else {
        console.log('⚠️ Firebase backup failed (check your configuration)');
      }
      
      return { allProducts, stats };
      
    } catch (error) {
      console.error('❌ Error processing results:', error.message);
      throw error;
    }
  }

  printSummary(summary) {
    const endTime = new Date();
    const duration = Math.round((endTime - this.startTime) / 1000);
    
    console.log('\n🎉 SCRAPING COMPLETED!');
    console.log('='.repeat(50));
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📦 Total Products: ${summary.totalProducts}`);
    console.log(`💰 Total Value: £${summary.totalValue}`);
    console.log(`💵 Average Price: £${summary.averagePrice}`);
    console.log('\n🏪 Store Breakdown:');
    Object.entries(summary.storeBreakdown).forEach(([store, count]) => {
      console.log(`   ${store}: ${count} products`);
    });
    console.log('\n📂 Category Breakdown:');
    Object.entries(summary.categoryBreakdown).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} products`);
    });
    console.log('='.repeat(50));
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    // Add any cleanup logic here
    console.log('✅ Cleanup complete');
  }
}

// Main execution function
async function main() {
  const orchestrator = new ScrapingOrchestrator();
  
  try {
    await orchestrator.initialize();
    
    // Check command line arguments
    const args = process.argv.slice(2);
    const stores = args.includes('--stores') ? 
      args[args.indexOf('--stores') + 1]?.split(',') : 
      null;
    const categories = args.includes('--categories') ? 
      args[args.indexOf('--categories') + 1]?.split(',') : 
      null;
    
    // Run scraping
    if (stores) {
      await orchestrator.scrapeSpecificStores(stores, categories);
    } else {
      await orchestrator.scrapeAllStores();
    }
    
    // Process results
    await orchestrator.processAndSaveResults();
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await orchestrator.cleanup();
  }
}

// Export for use as module
export { ScrapingOrchestrator };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
