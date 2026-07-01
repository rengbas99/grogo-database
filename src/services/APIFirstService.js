/**
 * API-First Service
 * Prioritizes official APIs and partnerships over scraping
 * Implements fallback to public data only when APIs are unavailable
 */

const axios = require('axios');
const logger = require('../utils/logger');
const firebaseService = require('./FirebaseService');

class APIFirstService {
  constructor() {
    this.firebaseService = firebaseService;
    this.apiEndpoints = {
      // Official APIs (when available)
      tesco: {
        apiKey: process.env.TESCO_API_KEY,
        baseUrl: 'https://api.tesco.com/v1',
        endpoints: {
          products: '/products',
          search: '/products/search',
          categories: '/categories',
          stores: '/stores'
        }
      },
      sainsburys: {
        apiKey: process.env.SAINSBURYS_API_KEY,
        baseUrl: 'https://api.sainsburys.co.uk/v1',
        endpoints: {
          products: '/products',
          search: '/products/search',
          categories: '/categories',
          stores: '/stores'
        }
      },
      // Third-party APIs
      openFoodFacts: {
        baseUrl: 'https://world.openfoodfacts.org/api/v0',
        endpoints: {
          product: '/product',
          search: '/cgi/search.pl'
        }
      },
      nutritionix: {
        apiKey: process.env.NUTRITIONIX_API_KEY,
        baseUrl: 'https://trackapi.nutritionix.com/v2',
        endpoints: {
          search: '/search/instant',
          nutrients: '/natural/nutrients'
        }
      }
    };
  }

  async init() {
    try {
      await this.firebaseService.initialize();
      logger.info('API-First Service initialized');
    } catch (error) {
      logger.error('Failed to initialize API-First Service:', error);
      throw error;
    }
  }

  /**
   * Search for products using official APIs first, fallback to public data
   */
  async searchProducts(query, store = 'all', limit = 20) {
    try {
      logger.info(`Searching for products: ${query} in ${store}`);
      
      const results = [];
      
      // Try official APIs first
      if (store === 'all' || store === 'tesco') {
        const tescoResults = await this.searchTescoAPI(query, limit);
        results.push(...tescoResults);
      }
      
      if (store === 'all' || store === 'sainsburys') {
        const sainsburysResults = await this.searchSainsburysAPI(query, limit);
        results.push(...sainsburysResults);
      }
      
      // If no results from APIs, try OpenFoodFacts (public database)
      if (results.length === 0) {
        const openFoodResults = await this.searchOpenFoodFacts(query, limit);
        results.push(...openFoodResults);
      }
      
      // If still no results, try database search
      if (results.length === 0) {
        const dbResults = await this.searchDatabase(query, limit);
        results.push(...dbResults);
      }
      
      logger.info(`Found ${results.length} products for query: ${query}`);
      return results.slice(0, limit);
    } catch (error) {
      logger.error('Product search failed:', error);
      return [];
    }
  }

  /**
   * Search Tesco official API
   */
  async searchTescoAPI(query, limit) {
    try {
      const config = this.apiEndpoints.tesco;
      
      if (!config.apiKey) {
        logger.warn('Tesco API key not configured, skipping API search');
        return [];
      }

      const response = await axios.get(`${config.baseUrl}${config.endpoints.search}`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Accept': 'application/json',
          'User-Agent': 'Grogo/1.0.0'
        },
        params: {
          query: query,
          limit: limit,
          include: 'pricing,availability,images'
        },
        timeout: 10000
      });

      const products = response.data.products || [];
      
      return products.map(product => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.pricing?.current?.value || 0,
        currency: product.pricing?.current?.currency || 'GBP',
        imageUrl: product.images?.[0]?.url || '',
        availability: product.availability?.status || 'unknown',
        store: 'tesco',
        source: 'official_api',
        url: product.url || '',
        lastUpdated: new Date()
      }));
    } catch (error) {
      logger.warn('Tesco API search failed:', error.message);
      return [];
    }
  }

  /**
   * Search Sainsbury's official API
   */
  async searchSainsburysAPI(query, limit) {
    try {
      const config = this.apiEndpoints.sainsburys;
      
      if (!config.apiKey) {
        logger.warn('Sainsbury\'s API key not configured, skipping API search');
        return [];
      }

      const response = await axios.get(`${config.baseUrl}${config.endpoints.search}`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Accept': 'application/json',
          'User-Agent': 'Grogo/1.0.0'
        },
        params: {
          q: query,
          limit: limit,
          include: 'pricing,availability,images'
        },
        timeout: 10000
      });

      const products = response.data.products || [];
      
      return products.map(product => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.pricing?.current?.value || 0,
        currency: product.pricing?.current?.currency || 'GBP',
        imageUrl: product.images?.[0]?.url || '',
        availability: product.availability?.status || 'unknown',
        store: 'sainsburys',
        source: 'official_api',
        url: product.url || '',
        lastUpdated: new Date()
      }));
    } catch (error) {
      logger.warn('Sainsbury\'s API search failed:', error.message);
      return [];
    }
  }

  /**
   * Search OpenFoodFacts (public database)
   */
  async searchOpenFoodFacts(query, limit) {
    try {
      const config = this.apiEndpoints.openFoodFacts;
      
      const response = await axios.get(`${config.baseUrl}${config.endpoints.search}`, {
        params: {
          search_terms: query,
          search_simple: 1,
          action: 'process',
          json: 1,
          page_size: limit
        },
        timeout: 10000
      });

      const products = response.data.products || [];
      
      return products.map(product => ({
        id: product.code,
        name: product.product_name || product.product_name_en || 'Unknown Product',
        brand: product.brands || 'Unknown Brand',
        category: product.categories || 'Unknown Category',
        price: 0, // OpenFoodFacts doesn't have pricing
        currency: 'GBP',
        imageUrl: product.image_url || '',
        availability: 'unknown',
        store: 'openfoodfacts',
        source: 'public_database',
        url: product.url || '',
        lastUpdated: new Date(),
        nutritionalInfo: {
          calories: product.nutriments?.energy_kcal_100g || 0,
          fat: product.nutriments?.fat_100g || 0,
          carbs: product.nutriments?.carbohydrates_100g || 0,
          protein: product.nutriments?.proteins_100g || 0,
          salt: product.nutriments?.sodium_100g || 0
        }
      }));
    } catch (error) {
      logger.warn('OpenFoodFacts search failed:', error.message);
      return [];
    }
  }

  /**
   * Search local database
   */
  async searchDatabase(query, limit) {
    try {
      const snapshot = await this.firebaseService.db
        .collection('products')
        .limit(parseInt(limit))
        .get();

      const products = [];
      const searchLower = query.toLowerCase();

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.name.toLowerCase().includes(searchLower) || 
            data.brand.toLowerCase().includes(searchLower)) {
          products.push({
            id: doc.id,
            name: data.name,
            brand: data.brand,
            category: data.category,
            price: 0, // Would need to get from store_products
            currency: 'GBP',
            imageUrl: data.imageUrl || '',
            availability: 'unknown',
            store: 'database',
            source: 'local_database',
            url: '',
            lastUpdated: data.updatedAt || data.createdAt
          });
        }
      });

      return products;
    } catch (error) {
      logger.error('Database search failed:', error);
      return [];
    }
  }

  /**
   * Get product details by ID
   */
  async getProductDetails(productId, store = 'tesco') {
    try {
      const config = this.apiEndpoints[store];
      
      if (!config || !config.apiKey) {
        logger.warn(`${store} API key not configured, trying database`);
        return await this.getProductFromDatabase(productId);
      }

      const response = await axios.get(`${config.baseUrl}${config.endpoints.products}/${productId}`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Accept': 'application/json',
          'User-Agent': 'Grogo/1.0.0'
        },
        timeout: 10000
      });

      const product = response.data;
      
      return {
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        description: product.description || '',
        price: product.pricing?.current?.value || 0,
        currency: product.pricing?.current?.currency || 'GBP',
        imageUrl: product.images?.[0]?.url || '',
        availability: product.availability?.status || 'unknown',
        store: store,
        source: 'official_api',
        url: product.url || '',
        lastUpdated: new Date(),
        nutritionalInfo: product.nutritionalInfo || null
      };
    } catch (error) {
      logger.warn(`${store} API product details failed:`, error.message);
      return await this.getProductFromDatabase(productId);
    }
  }

  /**
   * Get product from local database
   */
  async getProductFromDatabase(productId) {
    try {
      const doc = await this.firebaseService.db
        .collection('products')
        .doc(productId)
        .get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      
      return {
        id: doc.id,
        name: data.name,
        brand: data.brand,
        category: data.category,
        description: data.description || '',
        price: 0, // Would need to get from store_products
        currency: 'GBP',
        imageUrl: data.imageUrl || '',
        availability: 'unknown',
        store: 'database',
        source: 'local_database',
        url: '',
        lastUpdated: data.updatedAt || data.createdAt
      };
    } catch (error) {
      logger.error('Database product retrieval failed:', error);
      return null;
    }
  }

  /**
   * Get store locations from official APIs
   */
  async getStoreLocations(store = 'tesco', latitude, longitude, radius = 5000) {
    try {
      const config = this.apiEndpoints[store];
      
      if (!config || !config.apiKey) {
        logger.warn(`${store} API key not configured, using database`);
        return await this.getStoreLocationsFromDatabase(store, latitude, longitude, radius);
      }

      const response = await axios.get(`${config.baseUrl}${config.endpoints.stores}`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Accept': 'application/json',
          'User-Agent': 'Grogo/1.0.0'
        },
        params: {
          latitude: latitude,
          longitude: longitude,
          radius: radius,
          limit: 20
        },
        timeout: 10000
      });

      const stores = response.data.stores || [];
      
      return stores.map(store => ({
        id: store.id,
        name: store.name,
        brand: store.brand,
        address: store.address,
        latitude: store.latitude,
        longitude: store.longitude,
        distance: store.distance || 0,
        openingHours: store.openingHours || {},
        phone: store.phone || '',
        email: store.email || '',
        services: store.services || [],
        source: 'official_api',
        lastUpdated: new Date()
      }));
    } catch (error) {
      logger.warn(`${store} API store locations failed:`, error.message);
      return await this.getStoreLocationsFromDatabase(store, latitude, longitude, radius);
    }
  }

  /**
   * Get store locations from local database
   */
  async getStoreLocationsFromDatabase(store, latitude, longitude, radius) {
    try {
      const snapshot = await this.firebaseService.db
        .collection('stores')
        .where('brand', '==', store)
        .get();

      const stores = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const distance = this.calculateDistance(latitude, longitude, data.latitude, data.longitude);
        
        if (distance <= radius) {
          stores.push({
            id: doc.id,
            name: data.name,
            brand: data.brand,
            address: data.address,
            latitude: data.latitude,
            longitude: data.longitude,
            distance: distance,
            openingHours: data.openingHours || {},
            phone: data.phone || '',
            email: data.email || '',
            services: data.services || [],
            source: 'local_database',
            lastUpdated: data.updatedAt || data.createdAt
          });
        }
      });

      return stores.sort((a, b) => a.distance - b.distance);
    } catch (error) {
      logger.error('Database store locations failed:', error);
      return [];
    }
  }

  /**
   * Calculate distance between two coordinates
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check API availability and health
   */
  async checkAPIHealth() {
    const health = {
      timestamp: new Date(),
      apis: {}
    };

    for (const [store, config] of Object.entries(this.apiEndpoints)) {
      try {
        if (config.apiKey) {
          const response = await axios.get(`${config.baseUrl}/health`, {
            headers: {
              'Authorization': `Bearer ${config.apiKey}`,
              'Accept': 'application/json'
            },
            timeout: 5000
          });
          
          health.apis[store] = {
            status: 'healthy',
            responseTime: response.headers['x-response-time'] || 'unknown',
            lastChecked: new Date()
          };
        } else {
          health.apis[store] = {
            status: 'not_configured',
            lastChecked: new Date()
          };
        }
      } catch (error) {
        health.apis[store] = {
          status: 'unhealthy',
          error: error.message,
          lastChecked: new Date()
        };
      }
    }

    return health;
  }
}

module.exports = APIFirstService;

