#!/usr/bin/env node

/**
 * Master scraping script for all stores
 */

require('dotenv').config();
const TescoScraper = require('../src/scrapers/TescoScraper');
const FirebaseService = require('../src/services/FirebaseService');
const logger = require('../src/utils/logger');
const { getAllStores } = require('../src/config/scrapers');

async function scrapeAllStores() {
  const startTime = Date.now();
  logger.info('Starting comprehensive scraping of all stores...');
  
  try {
    // Initialize Firebase
    await FirebaseService.initialize();
    logger.info('Firebase initialized successfully');
    
    const stores = getAllStores();
    const results = {};
    
    for (const store of stores) {
      try {
        logger.info(`Starting scraping for ${store}...`);
        const storeStartTime = Date.now();
        
        let scraper;
        switch (store) {
          case 'tesco':
            scraper = new TescoScraper();
            break;
          // Add other scrapers here as they're implemented
          default:
            logger.warn(`Scraper for ${store} not implemented yet, skipping...`);
            continue;
        }
        
        await scraper.init();
        
        // Scrape all categories
        const allProducts = [];
        for (const category of scraper.config.categories) {
          try {
            logger.info(`Scraping ${store} - ${category}...`);
            const categoryProducts = await scraper.scrapeCategory(category);
            allProducts.push(...categoryProducts);
            
            // Save products to Firebase
            if (categoryProducts.length > 0) {
              await FirebaseService.saveScrapedData(categoryProducts);
              logger.info(`Saved ${categoryProducts.length} products from ${store} - ${category}`);
            }
            
            // Delay between categories
            await scraper.delay(5000);
          } catch (error) {
            logger.error(`Failed to scrape ${store} - ${category}:`, error);
          }
        }
        
        await scraper.close();
        
        const storeDuration = Date.now() - storeStartTime;
        results[store] = {
          products: allProducts.length,
          duration: storeDuration,
          success: true
        };
        
        logger.info(`Completed ${store}: ${allProducts.length} products in ${Math.round(storeDuration / 1000)}s`);
        
        // Delay between stores
        await new Promise(resolve => setTimeout(resolve, 10000));
        
      } catch (error) {
        logger.error(`Failed to scrape ${store}:`, error);
        results[store] = {
          products: 0,
          duration: 0,
          success: false,
          error: error.message
        };
      }
    }
    
    const totalDuration = Date.now() - startTime;
    const totalProducts = Object.values(results).reduce((sum, result) => sum + result.products, 0);
    
    logger.info('Scraping completed!');
    logger.info(`Total products scraped: ${totalProducts}`);
    logger.info(`Total duration: ${Math.round(totalDuration / 1000)}s`);
    logger.info('Results:', results);
    
  } catch (error) {
    logger.error('Scraping failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  scrapeAllStores().catch(error => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = scrapeAllStores;

