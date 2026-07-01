/**
 * Weekly Scraper Server
 * Runs the master scraper every week to keep product data up to date
 */

const cron = require('node-cron');
const MasterScraper = require('./master-scraper');
const fs = require('fs');
const path = require('path');

class WeeklyScraperServer {
  constructor() {
    this.masterScraper = new MasterScraper();
    this.isRunning = false;
    this.lastRun = null;
    this.logFile = path.join(__dirname, '../logs/weekly-scraper.log');
    
    // Ensure logs directory exists
    const logsDir = path.dirname(this.logFile);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    // Write to log file
    fs.appendFileSync(this.logFile, logMessage + '\n');
  }

  async runWeeklyScrape() {
    if (this.isRunning) {
      this.log('⚠️  Weekly scrape already running, skipping...');
      return;
    }

    this.isRunning = true;
    this.log('🚀 Starting weekly product scraping...');
    
    try {
      const startTime = new Date();
      
      // Run the master scraper
      await this.masterScraper.run();
      
      const endTime = new Date();
      const duration = Math.round((endTime - startTime) / 1000 / 60); // minutes
      
      this.lastRun = endTime;
      this.log(`✅ Weekly scrape completed successfully in ${duration} minutes`);
      
      // Save run statistics
      await this.saveRunStatistics({
        startTime,
        endTime,
        duration,
        status: 'success'
      });
      
    } catch (error) {
      this.log(`❌ Weekly scrape failed: ${error.message}`);
      
      // Save error statistics
      await this.saveRunStatistics({
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        status: 'error',
        error: error.message
      });
      
    } finally {
      this.isRunning = false;
    }
  }

  async saveRunStatistics(stats) {
    const statsFile = path.join(__dirname, '../logs/scraper-stats.json');
    let allStats = [];
    
    try {
      if (fs.existsSync(statsFile)) {
        allStats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
      }
    } catch (e) {
      this.log('⚠️  Could not read existing stats file');
    }
    
    allStats.push(stats);
    
    // Keep only last 52 runs (1 year)
    if (allStats.length > 52) {
      allStats = allStats.slice(-52);
    }
    
    fs.writeFileSync(statsFile, JSON.stringify(allStats, null, 2));
  }

  start() {
    this.log('🕐 Starting Weekly Scraper Server...');
    
    // Run immediately on startup (for testing)
    this.log('🔄 Running initial scrape...');
    this.runWeeklyScrape();
    
    // Schedule weekly runs every Sunday at 2 AM
    cron.schedule('0 2 * * 0', () => {
      this.log('⏰ Weekly cron triggered - starting scrape...');
      this.runWeeklyScrape();
    });
    
    // Schedule daily health checks at 6 AM
    cron.schedule('0 6 * * *', () => {
      this.log('💓 Daily health check...');
      this.log(`Last run: ${this.lastRun ? this.lastRun.toISOString() : 'Never'}`);
      this.log(`Currently running: ${this.isRunning ? 'Yes' : 'No'}`);
    });
    
    this.log('✅ Weekly Scraper Server started successfully');
    this.log('📅 Next scheduled run: Every Sunday at 2:00 AM');
    this.log('💓 Health checks: Every day at 6:00 AM');
  }

  stop() {
    this.log('🛑 Stopping Weekly Scraper Server...');
    // In a real implementation, you'd stop the cron jobs here
    process.exit(0);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextScheduledRun: this.getNextScheduledRun(),
      uptime: process.uptime()
    };
  }

  getNextScheduledRun() {
    const now = new Date();
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + (7 - now.getDay()));
    nextSunday.setHours(2, 0, 0, 0);
    
    if (nextSunday <= now) {
      nextSunday.setDate(nextSunday.getDate() + 7);
    }
    
    return nextSunday;
  }
}

// Create and start the server
const server = new WeeklyScraperServer();

// Handle graceful shutdown
process.on('SIGINT', () => {
  server.log('🛑 Received SIGINT, shutting down gracefully...');
  server.stop();
});

process.on('SIGTERM', () => {
  server.log('🛑 Received SIGTERM, shutting down gracefully...');
  server.stop();
});

// Start the server
server.start();

// Keep the process alive
process.on('uncaughtException', (error) => {
  server.log(`❌ Uncaught Exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  server.log(`❌ Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

module.exports = WeeklyScraperServer;
