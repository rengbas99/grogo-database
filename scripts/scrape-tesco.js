#!/usr/bin/env node

/**
 * Tesco scraping script
 */

require('dotenv').config();
const TescoScraper = require('../src/scrapers/TescoScraper');
const FirebaseService = require('../src/services/FirebaseService');
const logger = require('../src/utils/logger');

async function scrapeTesco() {
  const scraper = new TescoScraper();
  
  try {
    logger.info('Starting Tesco scraping...');
    
    // Initialize scraper
    await scraper.init();
    
    // Initialize Firebase
    await FirebaseService.initialize();
    
    // Scrape all categories
    const allProducts = [];
    
    for (const category of scraper.config.categories) {
      try {
        logger.info(`Scraping category: ${category}`);
        const categoryProducts = await scraper.scrapeCategory(category);
        allProducts.push(...categoryProducts);
        
        logger.info(`Found ${categoryProducts.length} products in ${category}`);
        
        // Save products to Firebase
        if (categoryProducts.length > 0) {
          await FirebaseService.saveScrapedData(categoryProducts);
          logger.info(`Saved ${categoryProducts.length} products from ${category} to Firebase`);
        }
        
        // Delay between categories
        await scraper.delay(10000);
      } catch (error) {
        logger.error(`Failed to scrape category ${category}:`, error);
      }
    }
    
    logger.info(`Tesco scraping completed. Total products: ${allProducts.length}`);
    
  } catch (error) {
    logger.error('Tesco scraping failed:', error);
    process.exit(1);
  } finally {
    await scraper.close();
  }
}

// Run if called directly
if (require.main === module) {
  scrapeTesco().catch(error => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = scrapeTesco;

