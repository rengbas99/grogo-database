import { LocalStorage } from './local-storage.js';
import { FirebaseBackup } from './firebase-backup.js';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';

export class StorageManager {
  constructor() {
    this.localStorage = new LocalStorage();
    this.firebaseBackup = new FirebaseBackup();
    this.currentSessionId = null;
  }

  async initialize() {
    console.log('🚀 Initializing storage manager...');
    
    // Initialize local storage
    await this.localStorage.initialize();
    
    // Try to initialize Firebase (optional)
    const firebaseAvailable = await this.firebaseBackup.initialize();
    
    if (firebaseAvailable) {
      console.log('✅ Local storage + Firebase backup ready');
    } else {
      console.log('✅ Local storage ready (Firebase backup not available)');
    }
    
    // Create new session
    this.currentSessionId = uuidv4();
    console.log(`📝 Session ID: ${this.currentSessionId}`);
    
    return true;
  }

  // Save products with local storage + Firebase backup
  async saveProducts(products, store, category) {
    console.log(`💾 Saving ${products.length} products from ${store} - ${category}...`);
    
    try {
      // Save to local storage first
      const localResult = await this.localStorage.saveProducts(
        products, 
        this.currentSessionId, 
        store, 
        category
      );
      
      // Try to backup to Firebase
      const firebaseResult = await this.firebaseBackup.backupProducts(
        products, 
        this.currentSessionId
      );
      
      return {
        local: localResult,
        firebase: firebaseResult,
        sessionId: this.currentSessionId
      };
      
    } catch (error) {
      console.error('❌ Error saving products:', error.message);
      throw error;
    }
  }

  // Save scraping session metadata
  async saveSession(sessionData) {
    const sessionInfo = {
      id: this.currentSessionId,
      ...sessionData,
      startedAt: moment().toISOString(),
      status: 'completed'
    };
    
    // Save locally
    await this.localStorage.saveSession(sessionInfo);
    
    console.log(`📝 Session saved: ${this.currentSessionId}`);
    return sessionInfo;
  }

  // Get all products (from local storage)
  async getAllProducts() {
    return await this.localStorage.getAllProducts();
  }

  // Get products by store
  async getProductsByStore(storeName) {
    return await this.localStorage.getProductsByStore(storeName);
  }

  // Get products by category
  async getProductsByCategory(category) {
    return await this.localStorage.getProductsByCategory(category);
  }

  // Get products with filters
  async getProducts(filters = {}) {
    return await this.localStorage.getProducts(filters);
  }

  // Get statistics
  async getStats() {
    return await this.localStorage.getStats();
  }

  // Export to CSV
  async exportToCSV(filename = null) {
    return await this.localStorage.exportToCSV(filename);
  }

  // Backup all data to Firebase
  async backupToFirebase() {
    console.log('🔄 Starting Firebase backup...');
    return await this.firebaseBackup.backupAllProducts();
  }

  // Sync with Firebase (two-way)
  async syncWithFirebase() {
    console.log('🔄 Syncing with Firebase...');
    return await this.firebaseBackup.syncWithFirebase();
  }

  // Compare local vs Firebase data
  async compareData() {
    return await this.firebaseBackup.compareData();
  }

  // Get storage information
  async getStorageInfo() {
    const localInfo = await this.localStorage.getStorageInfo();
    const firebaseStats = await this.firebaseBackup.getFirebaseStats();
    
    return {
      local: localInfo,
      firebase: firebaseStats,
      sessionId: this.currentSessionId
    };
  }

  // Clean up old data
  async cleanup(keepBackups = 10) {
    console.log('🧹 Cleaning up old data...');
    await this.localStorage.cleanOldBackups(keepBackups);
    console.log('✅ Cleanup completed');
  }

  // Get recent sessions
  async getRecentSessions(limit = 10) {
    // This would read from the sessions directory
    // Implementation depends on your needs
    return [];
  }

  // Search products
  async searchProducts(searchTerm, filters = {}) {
    const searchFilters = {
      ...filters,
      search: searchTerm
    };
    
    return await this.localStorage.getProducts(searchFilters);
  }

  // Get products by price range
  async getProductsByPriceRange(minPrice, maxPrice, filters = {}) {
    const priceFilters = {
      ...filters,
      minPrice,
      maxPrice
    };
    
    return await this.localStorage.getProducts(priceFilters);
  }

  // Get products by brand
  async getProductsByBrand(brand, filters = {}) {
    const brandFilters = {
      ...filters,
      brand
    };
    
    return await this.localStorage.getProducts(brandFilters);
  }
}

