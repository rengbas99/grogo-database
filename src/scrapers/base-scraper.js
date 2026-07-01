import { apifyClient, getActorConfig } from '../config/apify-config.js';
import { processScrapedData } from '../utils/data-processor.js';

export class BaseScraper {
  constructor(storeName) {
    this.storeName = storeName;
    this.isRunning = false;
  }

  async scrapeCategory(category, searchTerms, outputDir) {
    if (this.isRunning) {
      throw new Error(`Scraper for ${this.storeName} is already running`);
    }

    this.isRunning = true;
    console.log(`🛒 Starting ${this.storeName} scraper for category: ${category}`);

    try {
      const allProducts = [];
      
      // Try each search term until we get enough products
      for (const searchTerm of searchTerms) {
        if (allProducts.length >= 10) break; // Limit per category
        
        console.log(`🔍 Searching for "${searchTerm}" in ${this.storeName}...`);
        
        try {
          const products = await this.scrapeWithSearchTerm(searchTerm);
          allProducts.push(...products);
          
          // Add delay between requests
          await this.delay(2000);
        } catch (error) {
          console.warn(`⚠️ Failed to scrape "${searchTerm}" from ${this.storeName}:`, error.message);
        }
      }

      // Process and save the data
      const processedData = await processScrapedData(
        allProducts.slice(0, 10), // Limit to 10 products per category
        this.storeName,
        category,
        outputDir
      );

      console.log(`✅ ${this.storeName} scraper completed for ${category}: ${processedData.length} products`);
      return processedData;

    } catch (error) {
      console.error(`❌ Error in ${this.storeName} scraper for ${category}:`, error.message);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async runApifyActor(config) {
    try {
      console.log(`🚀 Running Apify actor: ${config.actorId}`);
      console.log(`📝 Input:`, JSON.stringify(config.input, null, 2));

      // Run the Apify actor
      const run = await apifyClient.actor(config.actorId).call(config.input, {
        timeout: 300000, // 5 minutes timeout
        memory: 2048, // 2GB memory
        build: 'latest'
      });

      console.log(`⏳ Actor run ID: ${run.id}`);
      console.log(`📊 Run status: ${run.status}`);

      // Wait for the run to complete
      const runInfo = await apifyClient.run(run.id).waitForFinish();
      
      if (runInfo.status !== 'SUCCEEDED') {
        throw new Error(`Actor run failed with status: ${runInfo.status}`);
      }

      // Get the results
      const { items } = await apifyClient.dataset(runInfo.defaultDatasetId).listItems();
      
      console.log(`📦 Retrieved ${items.length} items from ${this.storeName}`);
      return items;

    } catch (error) {
      console.error(`❌ Error running Apify actor for ${this.storeName}:`, error.message);
      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getRunStatus(runId) {
    const run = await apifyClient.run(runId).get();
    return run.status;
  }

  async cancelRun(runId) {
    await apifyClient.run(runId).abort();
    console.log(`🛑 Cancelled run ${runId}`);
  }
}
