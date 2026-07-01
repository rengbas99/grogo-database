#!/usr/bin/env node

import { ScrapingOrchestrator } from './scrapers/orchestrator.js';
import { validateApifyToken, PRODUCT_CATEGORIES, SCRAPING_CONFIG } from './config/apify-config.js';
import { StorageManager } from './storage/storage-manager.js';
import fs from 'fs-extra';
import path from 'path';

class GrogoDatabase {
  constructor() {
    this.orchestrator = new ScrapingOrchestrator();
    this.storageManager = new StorageManager();
  }

  async setup() {
    console.log('🚀 Setting up Grogo Database...');
    
    // Check if .env file exists
    if (!fs.existsSync('.env')) {
      console.log('⚠️  .env file not found. Please copy env.example to .env and add your Apify token.');
      console.log('   cp env.example .env');
      console.log('   # Then edit .env and add your APIFY_TOKEN');
      return false;
    }

    // Validate Apify token
    const isValid = await validateApifyToken();
    if (!isValid) {
      console.log('❌ Invalid Apify token. Please check your .env file.');
      return false;
    }

    // Create necessary directories
    await fs.ensureDir(SCRAPING_CONFIG.OUTPUT_DIRECTORY);
    await fs.ensureDir('./logs');
    
    console.log('✅ Setup complete!');
    return true;
  }

  async scrapeAll() {
    console.log('🛒 Starting full scraping of all UK supermarkets...');
    await this.orchestrator.initialize();
    await this.orchestrator.scrapeAllStores();
    await this.orchestrator.processAndSaveResults();
  }

  async scrapeStores(stores, categories = null) {
    console.log(`🎯 Scraping specific stores: ${stores.join(', ')}`);
    await this.orchestrator.initialize();
    await this.orchestrator.scrapeSpecificStores(stores, categories);
    await this.orchestrator.processAndSaveResults();
  }

  async scrapeCategory(category, stores = null) {
    const targetStores = stores || Object.keys(this.orchestrator.scrapers);
    console.log(`📦 Scraping category: ${category} from stores: ${targetStores.join(', ')}`);
    await this.orchestrator.initialize();
    await this.orchestrator.scrapeSpecificStores(targetStores, [category]);
    await this.orchestrator.processAndSaveResults();
  }

  async listCategories() {
    console.log('\n📂 Available Categories:');
    Object.entries(PRODUCT_CATEGORIES).forEach(([key, category]) => {
      console.log(`   ${key}: ${category.name}`);
      console.log(`      Search terms: ${category.searchTerms.join(', ')}`);
    });
  }

  async listStores() {
    console.log('\n🏪 Available Stores:');
    Object.keys(this.orchestrator.scrapers).forEach(store => {
      console.log(`   ${store}`);
    });
  }

  async showStats() {
    await this.storageManager.initialize();
    const stats = await this.storageManager.getStats();
    
    if (stats.totalProducts === 0) {
      console.log('📊 No data found. Run scraping first.');
      return;
    }
    
    console.log('\n📊 Current Database Stats:');
    console.log(`   Total Products: ${stats.totalProducts}`);
    console.log(`   Total Value: £${stats.totalValue}`);
    console.log(`   Average Price: £${stats.averagePrice}`);
    console.log(`   Last Updated: ${stats.lastUpdated}`);
    
    console.log('\n🏪 By Store:');
    Object.entries(stats.storeBreakdown).forEach(([store, count]) => {
      console.log(`   ${store}: ${count} products`);
    });
    
    console.log('\n📂 By Category:');
    Object.entries(stats.categoryBreakdown).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} products`);
    });
  }

  async backupToFirebase() {
    console.log('🔥 Starting Firebase backup...');
    await this.storageManager.initialize();
    const success = await this.storageManager.backupToFirebase();
    
    if (success) {
      console.log('✅ Firebase backup completed successfully');
    } else {
      console.log('❌ Firebase backup failed. Check your Firebase configuration.');
    }
  }

  async syncWithFirebase() {
    console.log('🔄 Syncing with Firebase...');
    await this.storageManager.initialize();
    const success = await this.storageManager.syncWithFirebase();
    
    if (success) {
      console.log('✅ Sync completed successfully');
    } else {
      console.log('❌ Sync failed. Check your Firebase configuration.');
    }
  }

  async compareData() {
    console.log('📊 Comparing local vs Firebase data...');
    await this.storageManager.initialize();
    const comparison = await this.storageManager.compareData();
    
    console.log('\n📊 Data Comparison:');
    console.log('='.repeat(40));
    console.log(`Local Products: ${comparison.local.totalProducts}`);
    console.log(`Firebase Products: ${comparison.firebase?.totalProducts || 0}`);
    console.log(`Difference: ${comparison.difference}`);
    console.log('='.repeat(40));
  }

  async searchProducts(searchTerm) {
    console.log(`🔍 Searching for: "${searchTerm}"`);
    await this.storageManager.initialize();
    const products = await this.storageManager.searchProducts(searchTerm);
    
    console.log(`Found ${products.length} products:`);
    products.slice(0, 10).forEach(product => {
      console.log(`   ${product.name} - £${product.price} (${product.store})`);
    });
    
    if (products.length > 10) {
      console.log(`   ... and ${products.length - 10} more`);
    }
  }

  async exportData() {
    console.log('📊 Exporting data to CSV...');
    await this.storageManager.initialize();
    const csvFile = await this.storageManager.exportToCSV();
    
    if (csvFile) {
      console.log(`✅ Data exported to: ${csvFile}`);
    } else {
      console.log('❌ Export failed. No data to export.');
    }
  }
}

// CLI Interface
async function main() {
  const grogo = new GrogoDatabase();
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'setup':
        await grogo.setup();
        break;
        
      case 'scrape-all':
        await grogo.scrapeAll();
        break;
        
      case 'scrape-stores':
        const stores = args[1]?.split(',') || ['tesco', 'asda'];
        const categories = args[2]?.split(',') || null;
        await grogo.scrapeStores(stores, categories);
        break;
        
      case 'scrape-category':
        const category = args[1];
        const targetStores = args[2]?.split(',') || null;
        if (!category) {
          console.log('❌ Please specify a category. Use "list-categories" to see available categories.');
          break;
        }
        await grogo.scrapeCategory(category, targetStores);
        break;
        
      case 'list-categories':
        await grogo.listCategories();
        break;
        
      case 'list-stores':
        await grogo.listStores();
        break;
        
      case 'stats':
        await grogo.showStats();
        break;
        
      case 'backup':
        await grogo.backupToFirebase();
        break;
        
      case 'sync':
        await grogo.syncWithFirebase();
        break;
        
      case 'compare':
        await grogo.compareData();
        break;
        
      case 'search':
        const searchTerm = args[1];
        if (!searchTerm) {
          console.log('❌ Please provide a search term. Example: node src/index.js search "milk"');
          break;
        }
        await grogo.searchProducts(searchTerm);
        break;
        
      case 'export':
        await grogo.exportData();
        break;
        
      case 'help':
      default:
        console.log(`
🛒 Grogo Database - UK Supermarket Product Scraper

Usage: node src/index.js <command> [options]

Scraping Commands:
  setup                 - Initialize the project and validate configuration
  scrape-all           - Scrape all stores and categories
  scrape-stores        - Scrape specific stores [stores] [categories]
  scrape-category      - Scrape specific category [category] [stores]

Data Management:
  stats                - Show current database statistics
  search <term>        - Search products by name/description
  export               - Export data to CSV
  list-categories      - List available product categories
  list-stores          - List available stores

Firebase Commands:
  backup               - Backup local data to Firebase
  sync                 - Two-way sync with Firebase
  compare              - Compare local vs Firebase data

Examples:
  node src/index.js setup
  node src/index.js scrape-all
  node src/index.js scrape-stores tesco,asda
  node src/index.js scrape-category COOKING_ESSENTIALS tesco,asda
  node src/index.js stats
  node src/index.js search "milk"
  node src/index.js backup
  node src/index.js export

Environment Variables:
  APIFY_TOKEN          - Your Apify API token (required)
  MAX_PRODUCTS_PER_CATEGORY - Max products per category (default: 10)
  MAX_PRODUCTS_PER_STORE - Max products per store (default: 50)
  SCRAPING_DELAY_MS    - Delay between requests in ms (default: 2000)
  OUTPUT_DIRECTORY     - Output directory for data (default: ./data)
  
  # Firebase (optional)
  FIREBASE_PROJECT_ID  - Firebase project ID
  FIREBASE_API_KEY     - Firebase API key
  FIREBASE_AUTH_DOMAIN - Firebase auth domain
  FIREBASE_STORAGE_BUCKET - Firebase storage bucket
  FIREBASE_MESSAGING_SENDER_ID - Firebase messaging sender ID
  FIREBASE_APP_ID      - Firebase app ID
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { GrogoDatabase };
