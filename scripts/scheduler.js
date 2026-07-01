/**
 * Scheduler for Enhanced Essentials Scraper
 * Runs every 10 minutes to monitor prices and availability
 */

const { spawn } = require('child_process');
const path = require('path');

class ScraperScheduler {
  constructor() {
    this.interval = 10 * 60 * 1000; // 10 minutes in milliseconds
    this.isRunning = false;
    this.runCount = 0;
    this.startTime = new Date();
  }

  async runScraper() {
    if (this.isRunning) {
      console.log('⏳ Previous scraper run still in progress, skipping...');
      return;
    }

    this.isRunning = true;
    this.runCount++;
    
    const timestamp = new Date().toISOString();
    console.log(`\n🚀 Starting scraper run #${this.runCount} at ${timestamp}`);
    
    try {
      const scraperPath = path.join(__dirname, 'enhanced-essentials-scraper.js');
      const scraper = spawn('node', [scraperPath], {
        stdio: 'inherit',
        cwd: __dirname
      });
      
      scraper.on('close', (code) => {
        this.isRunning = false;
        if (code === 0) {
          console.log(`✅ Scraper run #${this.runCount} completed successfully`);
        } else {
          console.log(`❌ Scraper run #${this.runCount} failed with code ${code}`);
        }
      });
      
      scraper.on('error', (error) => {
        this.isRunning = false;
        console.error(`❌ Scraper run #${this.runCount} error:`, error.message);
      });
      
    } catch (error) {
      this.isRunning = false;
      console.error(`❌ Failed to start scraper run #${this.runCount}:`, error.message);
    }
  }

  start() {
    console.log('🕐 Starting Enhanced Essentials Scraper Scheduler...');
    console.log(`⏰ Running every ${this.interval / 60000} minutes`);
    console.log(`📅 Started at: ${this.startTime.toISOString()}`);
    console.log(`🔄 Next run in: ${this.interval / 60000} minutes`);
    
    // Run immediately on start
    this.runScraper();
    
    // Then run every 10 minutes
    setInterval(() => {
      this.runScraper();
    }, this.interval);
  }

  stop() {
    console.log('\n🛑 Stopping scheduler...');
    console.log(`📊 Total runs completed: ${this.runCount}`);
    console.log(`⏱️ Total runtime: ${Math.round((Date.now() - this.startTime.getTime()) / 60000)} minutes`);
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the scheduler
const scheduler = new ScraperScheduler();
scheduler.start();

// Keep the process running
console.log('\n💡 Press Ctrl+C to stop the scheduler');
console.log('📝 Monitor logs for scraper activity...\n');
