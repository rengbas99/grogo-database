/**
 * Logger utility for the scraping service
 */

const winston = require('winston');
const path = require('path');
const { LRUCache } = require('lru-cache');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create LRU cache for log deduplication (replaces inflight)
const logCache = new LRUCache({ max: 1000, ttl: 1000 * 60 * 5 }); // 5 minutes TTL

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'grogo-scraper' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
        })
      )
    }),
    
    // Write all logs to file
    new winston.transports.File({
      filename: path.join(logsDir, 'scraper.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Write error logs to separate file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add custom methods
logger.scraper = (store, message, meta = {}) => {
  logger.info(`[${store.toUpperCase()}] ${message}`, meta);
};

logger.scraperError = (store, message, error, meta = {}) => {
  logger.error(`[${store.toUpperCase()}] ${message}`, { error: error.message, stack: error.stack, ...meta });
};

logger.scraperSuccess = (store, message, meta = {}) => {
  logger.info(`[${store.toUpperCase()}] ✅ ${message}`, meta);
};

logger.scraperWarning = (store, message, meta = {}) => {
  logger.warn(`[${store.toUpperCase()}] ⚠️ ${message}`, meta);
};

// Deduplication method to prevent spam logs
logger.deduplicatedLog = (level, message, meta = {}) => {
  const key = `${level}:${message}:${JSON.stringify(meta)}`;
  if (!logCache.has(key)) {
    logCache.set(key, true);
    logger[level](message, meta);
  }
};

module.exports = logger;
