/**
 * Grogo Backend API Server
 * Integrates scraping, smart pantry, and store detection
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('rate-limiter-flexible');
const winston = require('winston');

// Services
const APIFirstService = require('./services/APIFirstService');
const SmartPantryService = require('./services/SmartPantryService');
const LegalCompliantScraper = require('./scrapers/LegalCompliantScraper');
const FirebaseService = require('./services/FirebaseService');
const TwoBasketService = require('./services/TwoBasketService');

// Routes
const productRoutes = require('./routes/products');

// Initialize services
const apiFirstService = new APIFirstService();
const smartPantryService = new SmartPantryService();
const legalScraper = new LegalCompliantScraper();
const firebaseService = FirebaseService;
const twoBasketService = TwoBasketService;

// Rate limiting
const rateLimiter = new rateLimit.RateLimiterMemory({
  keyPrefix: 'middleware',
  points: 200, // Number of requests - increased
  duration: 60, // Per 60 seconds
});

// Request queue to prevent overwhelming Firebase
const requestQueue = [];
let isProcessingQueue = false;

const processQueue = async () => {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  while (requestQueue.length > 0) {
    const { req, res, next } = requestQueue.shift();
    try {
      await next();
    } catch (error) {
      console.error('Queue processing error:', error);
    }
  }
  isProcessingQueue = false;
};

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());

// Request queue middleware for product endpoints
app.use('/api/products', (req, res, next) => {
  if (requestQueue.length > 10) {
    return res.status(503).json({ 
      success: false, 
      error: 'Server busy, please try again later' 
    });
  }
  
  requestQueue.push({ req, res, next });
  processQueue();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting middleware
app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({ error: 'Too many requests' });
  }
});

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// API Routes
app.use('/api/products/categorized', require('./routes/categorizedProducts'));
app.use('/api/products', productRoutes);

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Grogo Backend API',
    version: '1.0.0',
    description: 'API for Grogo grocery shopping and pantry management',
    baseUrl: `http://${req.get('host')}/api`,
    endpoints: {
      health: {
        'GET /health': 'Health check endpoint',
        'GET /api/health/apis': 'Check API health status'
      },
      products: {
        'GET /api/products/:storeId': 'Get products for a specific store with filtering/sorting',
        'GET /api/products/:storeId/categories': 'Get categories for a store',
        'GET /api/products/:storeId/brands': 'Get brands for a store',
        'GET /api/products/search/:storeId': 'Search products within a store',
        'GET /api/products/options/sort': 'Get available sort options',
        'GET /api/products/options/filter': 'Get available filter options',
        'GET /api/products/search': 'Search products across all stores (API-first)',
        'GET /api/products/categorized': 'Get all categorized products from JSON file',
        'GET /api/products/categorized/search': 'Search within categorized products'
      },
      stores: {
        'POST /api/stores/nearby': 'Find nearby stores based on location'
      },
      pantry: {
        'POST /api/pantry/scan': 'Scan QR code for pantry management',
        'GET /api/pantry/:userId': 'Get user pantry items',
        'PUT /api/pantry/:pantryItemId': 'Update pantry item',
        'DELETE /api/pantry/:pantryItemId': 'Remove pantry item'
      },
      twoBaskets: {
        'POST /api/two-baskets/segregate': 'Segregate shopping list into two baskets',
        'POST /api/two-baskets/confirm-primary': 'Confirm primary basket haul',
        'POST /api/two-baskets/confirm-secondary': 'Confirm secondary basket haul',
        'POST /api/two-baskets/manual-entry': 'Handle manual entry for unavailable items'
      },
      scraper: {
        'POST /api/scraper/legal': 'Start legal scraping job',
        'GET /api/scraper/status': 'Get scraping status',
        'GET /api/compliance/report': 'Get compliance report'
      }
    },
    stores: {
      tesco_uxbridge: 'Tesco Uxbridge - 62 High St, Uxbridge UB8 1ND',
      sainsbury_uxbridge: 'Sainsbury Uxbridge - York Rd, Uxbridge UB8 1QW',
      aldi_west_drayton: 'Aldi West Drayton - High St, West Drayton UB7 7QN',
      lidl_uxbridge_cowley: 'Lidl Uxbridge - 137 Cowley Rd, Uxbridge, London UB8 2AG',
      lidl_uxbridge_high_st: 'Lidl Uxbridge - High St, Uxbridge UB8 1LA'
    },
    examples: {
      getProducts: 'GET /api/products/tesco_uxbridge?page=1&limit=20&category=Fruits%20%26%20Vegetables',
      searchProducts: 'GET /api/products/search/tesco_uxbridge?q=milk&page=1&limit=10',
      getCategories: 'GET /api/products/tesco_uxbridge/categories',
      getBrands: 'GET /api/products/tesco_uxbridge/brands',
      findStores: 'POST /api/stores/nearby {"latitude": 51.5462, "longitude": -0.4776, "maxDistance": 5000}'
    },
    status: 'operational',
    lastUpdated: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      firebase: firebaseService.initialized,
      pantry: smartPantryService.initialized
    }
  });
});

// Product search endpoints
app.get('/api/products/search', async (req, res) => {
  try {
    const { query, store = 'all', limit = 20 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    logger.info(`Product search: ${query} in ${store}`);
    
    // Use API-first approach
    const products = await apiFirstService.searchProducts(query, store, parseInt(limit));

    res.json({
      success: true,
      products: products,
      total: products.length,
      query: query,
      store: store,
      source: 'api_first'
    });
  } catch (error) {
    logger.error('Product search failed:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Store detection endpoints
app.post('/api/stores/nearby', async (req, res) => {
  try {
    const { latitude, longitude, store = 'all', maxDistance = 5000 } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    let nearbyStores = [];
    
    if (store === 'all') {
      // Get stores from all available sources
      const tescoStores = await apiFirstService.getStoreLocations('tesco', latitude, longitude, maxDistance);
      const sainsburysStores = await apiFirstService.getStoreLocations('sainsburys', latitude, longitude, maxDistance);
      nearbyStores = [...tescoStores, ...sainsburysStores];
    } else {
      nearbyStores = await apiFirstService.getStoreLocations(store, latitude, longitude, maxDistance);
    }

    res.json({
      success: true,
      stores: nearbyStores,
      total: nearbyStores.length,
      source: 'api_first'
    });
  } catch (error) {
    logger.error('Store detection failed:', error);
    res.status(500).json({ error: 'Store detection failed' });
  }
});

// QR code scanning endpoints
app.post('/api/pantry/scan', async (req, res) => {
  try {
    const { qrData, userId } = req.body;
    
    if (!qrData || !userId) {
      return res.status(400).json({ error: 'QR data and user ID are required' });
    }

    const result = await smartPantryService.scanProductQR(qrData, userId);

    res.json(result);
  } catch (error) {
    logger.error('QR scan failed:', error);
    res.status(500).json({ error: 'QR scan failed' });
  }
});

// Pantry management endpoints
app.get('/api/pantry/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const pantry = await smartPantryService.getUserPantry(userId);

    res.json({
      success: true,
      pantry: pantry,
      total: pantry.length
    });
  } catch (error) {
    logger.error('Get pantry failed:', error);
    res.status(500).json({ error: 'Failed to get pantry' });
  }
});

app.put('/api/pantry/:pantryItemId', async (req, res) => {
  try {
    const { pantryItemId } = req.params;
    const updates = req.body;

    await smartPantryService.updatePantryItem(pantryItemId, updates);

    res.json({ success: true });
  } catch (error) {
    logger.error('Update pantry item failed:', error);
    res.status(500).json({ error: 'Failed to update pantry item' });
  }
});

app.delete('/api/pantry/:pantryItemId', async (req, res) => {
  try {
    const { pantryItemId } = req.params;

    await smartPantryService.removeFromPantry(pantryItemId);

    res.json({ success: true });
  } catch (error) {
    logger.error('Remove pantry item failed:', error);
    res.status(500).json({ error: 'Failed to remove pantry item' });
  }
});

// API health and compliance endpoints
app.get('/api/health/apis', async (req, res) => {
  try {
    const health = await apiFirstService.checkAPIHealth();
    res.json({ success: true, health });
  } catch (error) {
    logger.error('API health check failed:', error);
    res.status(500).json({ error: 'API health check failed' });
  }
});

app.get('/api/compliance/report', async (req, res) => {
  try {
    const report = await legalScraper.generateComplianceReport();
    res.json({ success: true, report });
  } catch (error) {
    logger.error('Compliance report failed:', error);
    res.status(500).json({ error: 'Compliance report failed' });
  }
});

// Legal scraping endpoints (with compliance checks)
app.post('/api/scraper/legal', async (req, res) => {
  try {
    const { maxProducts = 50, purpose = 'price_comparison' } = req.body;
    
    logger.info(`Starting legal scraping job for ${maxProducts} products`);
    
    // Check if scraping is permissible
    const isPermissible = await legalScraper.isScrapingPermissible(purpose, 'product_name');
    if (!isPermissible) {
      return res.status(403).json({ 
        error: 'Scraping not permissible for this purpose',
        reason: 'Legal compliance check failed'
      });
    }
    
    // Run legal scraping in background
    setImmediate(async () => {
      try {
        const count = await legalScraper.scrapeFromSitemap(
          'https://www.tesco.com/sitemaps/en-GB/groceries/products-index.xml',
          maxProducts
        );
        logger.info(`Legal scraping completed: ${count.length} products processed`);
      } catch (error) {
        logger.error('Background legal scraping failed:', error);
      }
    });

    res.json({ 
      success: true, 
      message: 'Legal scraping job started',
      maxProducts: maxProducts,
      compliance: 'verified'
    });
  } catch (error) {
    logger.error('Start legal scraping failed:', error);
    res.status(500).json({ error: 'Failed to start legal scraping' });
  }
});

app.get('/api/scraper/status', async (req, res) => {
  try {
    // Get scraping status from database or cache
    const status = {
      isRunning: false, // This would be tracked in a real implementation
      lastRun: new Date(),
      totalProducts: 0, // This would be calculated from database
      compliance: 'verified',
      legalBasis: 'legitimate_interest'
    };

    res.json({ success: true, status });
  } catch (error) {
    logger.error('Get scraping status failed:', error);
    res.status(500).json({ error: 'Failed to get scraping status' });
  }
});

// Helper function to search products in Firebase
async function searchProductsInFirebase(query, category, limit) {
  try {
    let queryRef = firebaseService.db.collection('products');
    
    // Add category filter if specified
    if (category) {
      queryRef = queryRef.where('category', '==', category);
    }
    
    // Add text search (Firebase doesn't have full-text search, so we use array-contains for now)
    // In production, you'd use Algolia or Elasticsearch for proper text search
    const snapshot = await queryRef.limit(parseInt(limit)).get();
    
    const products = [];
    snapshot.forEach(doc => {
      const product = doc.data();
      if (product.name.toLowerCase().includes(query.toLowerCase())) {
        products.push({
          id: doc.id,
          ...product
        });
      }
    });
    
    return products;
  } catch (error) {
    logger.error('Firebase product search failed:', error);
    return [];
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize services and start server
async function startServer() {
  try {
    console.log('🚀 Starting Grogo Backend Server...\n');
    
    // Initialize Firebase
    await firebaseService.initialize();
    console.log('✅ Firebase service initialized');
    
    // Initialize API-First Service
    await apiFirstService.init();
    console.log('✅ API-First Service initialized');
    
    // Initialize Smart Pantry Service
    await smartPantryService.init();
    console.log('✅ Smart Pantry Service initialized');
    
    // Initialize Legal Compliant Scraper
    await legalScraper.init();
    console.log('✅ Legal Compliant Scraper initialized');
    
    // Initialize Two Basket Service
    await twoBasketService.init();
    console.log('✅ Two Basket Service initialized');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`\n🎉 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔍 API docs: http://localhost:${PORT}/api`);
      console.log('\n📋 Available endpoints:');
      console.log('   GET  /health - Health check');
      console.log('   GET  /api/products/search?query=...&store=... - Search products (API-first)');
      console.log('   GET  /api/products/:storeId - Get products for store with filtering/sorting');
      console.log('   GET  /api/products/:storeId/categories - Get store categories');
      console.log('   GET  /api/products/:storeId/brands - Get store brands');
      console.log('   GET  /api/products/search/:storeId - Search products in store');
      console.log('   GET  /api/products/options/sort - Get sort options');
      console.log('   GET  /api/products/options/filter - Get filter options');
      console.log('   POST /api/stores/nearby - Find nearby stores (API-first)');
      console.log('   POST /api/pantry/scan - Scan QR code');
      console.log('   GET  /api/pantry/:userId - Get user pantry');
      console.log('   PUT  /api/pantry/:pantryItemId - Update pantry item');
      console.log('   DELETE /api/pantry/:pantryItemId - Remove pantry item');
      console.log('   GET  /api/health/apis - Check API health');
      console.log('   GET  /api/compliance/report - Get compliance report');
      console.log('   POST /api/scraper/legal - Start legal scraping job');
      console.log('   GET  /api/scraper/status - Get scraping status');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Two-basket system endpoints
app.post('/api/two-baskets/segregate', async (req, res) => {
  try {
    const { shoppingList, userLatitude, userLongitude } = req.body;
    
    if (!shoppingList || !userLatitude || !userLongitude) {
      return res.status(400).json({ error: 'Shopping list, latitude, and longitude are required' });
    }

    const basketData = await twoBasketService.segregateIntoTwoBaskets(
      shoppingList, 
      userLatitude, 
      userLongitude
    );
    
    res.json({
      success: true,
      data: basketData
    });
  } catch (error) {
    logger.error('Failed to segregate into two baskets:', error);
    res.status(500).json({ error: 'Failed to segregate shopping list' });
  }
});

app.post('/api/two-baskets/confirm-primary', async (req, res) => {
  try {
    const { basket1Items, userId, storeId } = req.body;
    
    if (!basket1Items || !userId || !storeId) {
      return res.status(400).json({ error: 'Basket items, user ID, and store ID are required' });
    }

    const result = await twoBasketService.confirmPrimaryHaul(basket1Items, userId, storeId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to confirm primary haul:', error);
    res.status(500).json({ error: 'Failed to confirm primary haul' });
  }
});

app.post('/api/two-baskets/confirm-secondary', async (req, res) => {
  try {
    const { basket2Items, userId, selectedStoreId } = req.body;
    
    if (!basket2Items || !userId || !selectedStoreId) {
      return res.status(400).json({ error: 'Basket items, user ID, and selected store ID are required' });
    }

    const result = await twoBasketService.confirmSecondaryHaul(basket2Items, userId, selectedStoreId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to confirm secondary haul:', error);
    res.status(500).json({ error: 'Failed to confirm secondary haul' });
  }
});

app.post('/api/two-baskets/manual-entry', async (req, res) => {
  try {
    const { unavailableItems, userId, storeId, storeName } = req.body;
    
    if (!unavailableItems || !userId || !storeId || !storeName) {
      return res.status(400).json({ error: 'Unavailable items, user ID, store ID, and store name are required' });
    }

    const result = await twoBasketService.handleManualEntry(unavailableItems, userId, storeId, storeName);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to handle manual entry:', error);
    res.status(500).json({ error: 'Failed to handle manual entry' });
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

// Start the server
startServer();
