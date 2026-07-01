import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';

export class LocalStorage {
  constructor(baseDir = './data') {
    this.baseDir = baseDir;
    this.productsDir = path.join(baseDir, 'products');
    this.sessionsDir = path.join(baseDir, 'sessions');
    this.backupsDir = path.join(baseDir, 'backups');
  }

  async initialize() {
    // Create all necessary directories
    await fs.ensureDir(this.baseDir);
    await fs.ensureDir(this.productsDir);
    await fs.ensureDir(this.sessionsDir);
    await fs.ensureDir(this.backupsDir);
    
    console.log('✅ Local storage initialized');
  }

  // Save products to local JSON files
  async saveProducts(products, sessionId, store, category) {
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    
    // Save individual store-category file
    const storeCategoryFile = path.join(
      this.productsDir, 
      `${store}_${category}_${timestamp}.json`
    );
    
    await fs.writeJson(storeCategoryFile, products, { spaces: 2 });
    console.log(`💾 Saved ${products.length} products to: ${storeCategoryFile}`);
    
    // Update main products file
    await this.updateMainProductsFile(products, sessionId);
    
    // Create backup
    await this.createBackup();
    
    return {
      storeCategoryFile,
      productsCount: products.length
    };
  }

  // Update the main products.json file
  async updateMainProductsFile(newProducts, sessionId) {
    const mainFile = path.join(this.baseDir, 'products.json');
    
    let existingProducts = [];
    if (await fs.pathExists(mainFile)) {
      existingProducts = await fs.readJson(mainFile);
    }
    
    // Add session info to new products
    const productsWithSession = newProducts.map(product => ({
      ...product,
      sessionId,
      addedAt: moment().toISOString()
    }));
    
    // Merge with existing products (avoid duplicates by ID)
    const existingIds = new Set(existingProducts.map(p => p.id));
    const uniqueNewProducts = productsWithSession.filter(p => !existingIds.has(p.id));
    
    const allProducts = [...existingProducts, ...uniqueNewProducts];
    
    await fs.writeJson(mainFile, allProducts, { spaces: 2 });
    console.log(`📊 Updated main products file: ${allProducts.length} total products`);
    
    return allProducts;
  }

  // Create timestamped backup
  async createBackup() {
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const backupFile = path.join(this.backupsDir, `products_backup_${timestamp}.json`);
    
    const mainFile = path.join(this.baseDir, 'products.json');
    if (await fs.pathExists(mainFile)) {
      await fs.copy(mainFile, backupFile);
      console.log(`💾 Backup created: ${backupFile}`);
    }
  }

  // Save scraping session metadata
  async saveSession(sessionData) {
    const sessionFile = path.join(this.sessionsDir, `${sessionData.id}.json`);
    await fs.writeJson(sessionFile, {
      ...sessionData,
      createdAt: moment().toISOString()
    });
    
    console.log(`📝 Session saved: ${sessionFile}`);
    return sessionFile;
  }

  // Get all products
  async getAllProducts() {
    const mainFile = path.join(this.baseDir, 'products.json');
    if (!await fs.pathExists(mainFile)) {
      return [];
    }
    
    return await fs.readJson(mainFile);
  }

  // Get products by store
  async getProductsByStore(storeName) {
    const allProducts = await this.getAllProducts();
    return allProducts.filter(product => 
      product.store.toLowerCase() === storeName.toLowerCase()
    );
  }

  // Get products by category
  async getProductsByCategory(category) {
    const allProducts = await this.getAllProducts();
    return allProducts.filter(product => 
      product.category.toLowerCase() === category.toLowerCase()
    );
  }

  // Get products with filters
  async getProducts(filters = {}) {
    let products = await this.getAllProducts();
    
    if (filters.store) {
      products = products.filter(p => p.store.toLowerCase() === filters.store.toLowerCase());
    }
    
    if (filters.category) {
      products = products.filter(p => p.category.toLowerCase() === filters.category.toLowerCase());
    }
    
    if (filters.minPrice) {
      products = products.filter(p => p.price >= filters.minPrice);
    }
    
    if (filters.maxPrice) {
      products = products.filter(p => p.price <= filters.maxPrice);
    }
    
    if (filters.brand) {
      products = products.filter(p => 
        p.brand.toLowerCase().includes(filters.brand.toLowerCase())
      );
    }
    
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        p.description.toLowerCase().includes(searchTerm) ||
        p.brand.toLowerCase().includes(searchTerm)
      );
    }
    
    return products;
  }

  // Get statistics
  async getStats() {
    const products = await this.getAllProducts();
    
    if (products.length === 0) {
      return {
        totalProducts: 0,
        totalValue: 0,
        averagePrice: 0,
        storeBreakdown: {},
        categoryBreakdown: {},
        lastUpdated: null
      };
    }
    
    const storeCounts = {};
    const categoryCounts = {};
    const totalValue = products.reduce((sum, product) => sum + (product.price || 0), 0);
    
    products.forEach(product => {
      storeCounts[product.store] = (storeCounts[product.store] || 0) + 1;
      categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
    });
    
    return {
      totalProducts: products.length,
      totalValue: Math.round(totalValue * 100) / 100,
      averagePrice: Math.round((totalValue / products.length) * 100) / 100,
      storeBreakdown: storeCounts,
      categoryBreakdown: categoryCounts,
      lastUpdated: moment().toISOString(),
      stores: Object.keys(storeCounts),
      categories: Object.keys(categoryCounts)
    };
  }

  // Export to CSV
  async exportToCSV(filename = null) {
    const products = await this.getAllProducts();
    
    if (products.length === 0) {
      console.log('⚠️ No products to export');
      return null;
    }
    
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const csvFile = filename || path.join(this.baseDir, `products_export_${timestamp}.csv`);
    
    // Convert to CSV format
    const headers = [
      'id', 'store', 'category', 'name', 'description', 'price', 'originalPrice',
      'currency', 'brand', 'sku', 'availability', 'rating', 'reviewCount',
      'weight', 'unit', 'url', 'scrapedAt', 'addedAt'
    ];
    
    const csvContent = [
      headers.join(','),
      ...products.map(product => 
        headers.map(header => {
          const value = product[header] || '';
          return `"${value.toString().replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');
    
    await fs.writeFile(csvFile, csvContent);
    console.log(`📊 CSV exported: ${csvFile}`);
    
    return csvFile;
  }

  // Clean old backups (keep last 10)
  async cleanOldBackups(keepCount = 10) {
    const backupFiles = await fs.readdir(this.backupsDir);
    const jsonBackups = backupFiles
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (jsonBackups.length > keepCount) {
      const filesToDelete = jsonBackups.slice(keepCount);
      
      for (const file of filesToDelete) {
        await fs.remove(path.join(this.backupsDir, file));
        console.log(`🗑️ Deleted old backup: ${file}`);
      }
    }
  }

  // Get file sizes and disk usage
  async getStorageInfo() {
    const mainFile = path.join(this.baseDir, 'products.json');
    const mainSize = await fs.pathExists(mainFile) ? 
      (await fs.stat(mainFile)).size : 0;
    
    const backupFiles = await fs.readdir(this.backupsDir);
    const backupSize = backupFiles.reduce(async (total, file) => {
      const filePath = path.join(this.backupsDir, file);
      const stats = await fs.stat(filePath);
      return (await total) + stats.size;
    }, Promise.resolve(0));
    
    return {
      mainFileSize: mainSize,
      backupFilesCount: backupFiles.length,
      totalBackupSize: await backupSize,
      totalSize: mainSize + await backupSize
    };
  }
}

