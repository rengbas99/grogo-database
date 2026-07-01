#!/usr/bin/env node

/**
 * Merge Additional Products
 * Add extra products from 1,682 total to existing 1,380 products in Firebase
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

class AdditionalProductsMerger {
  constructor() {
    this.db = null;
    this.mergeStats = {
      totalAdditionalProducts: 0,
      productsAdded: 0,
      productsUpdated: 0,
      errors: 0,
      stores: {},
      startTime: new Date()
    };
  }

  async mergeAdditionalProducts() {
    try {
      console.log('🔄 Merging Additional Products to Firebase...');
      console.log('=' .repeat(60));

      // Initialize Firebase
      await this.initializeFirebase();

      // Load additional product sources
      const additionalSources = await this.loadAdditionalSources();

      // Merge each source
      for (const source of additionalSources) {
        console.log(`\n📦 Processing ${source.name}...`);
        await this.mergeSource(source);
      }

      // Display results
      this.displayResults();

    } catch (error) {
      console.error('❌ Error merging additional products:', error);
    }
  }

  async initializeFirebase() {
    if (!admin.apps.length) {
      const serviceAccount = require('../config/firebase-service-account.json');
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    }
    this.db = admin.firestore();
    console.log('✅ Firebase connected');
  }

  async loadAdditionalSources() {
    const sources = [];

    // Check for separate store files
    const storeFiles = [
      {
        name: 'Tesco Products',
        path: '../data/products/Tesco Products/tesco-final-products.json',
        storeId: 'tesco_uxbridge',
        storeName: 'Tesco Uxbridge'
      },
      {
        name: 'Lidl Products',
        path: '../data/products/Lidl products/lidl-openfoodfacts-products.json',
        storeId: 'lidl_uxbridge_cowley',
        storeName: 'Lidl Uxbridge Cowley'
      },
      {
        name: 'Sainsbury\'s Products',
        path: '../data/products/Sainsbury\'s Products/sainsbury-final-products.json',
        storeId: 'sainsbury_uxbridge',
        storeName: 'Sainsbury\'s Uxbridge'
      }
    ];

    for (const storeFile of storeFiles) {
      const filePath = path.join(__dirname, storeFile.path);
      
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const products = Array.isArray(data) ? data : (data.products || []);
          
          if (products.length > 0) {
            sources.push({
              ...storeFile,
              products: products,
              count: products.length
            });
            console.log(`   ✅ Found ${products.length} products in ${storeFile.name}`);
          }
        } catch (error) {
          console.log(`   ❌ Error reading ${storeFile.name}: ${error.message}`);
        }
      } else {
        console.log(`   ⚠️  File not found: ${storeFile.path}`);
      }
    }

    return sources;
  }

  async mergeSource(source) {
    try {
      console.log(`   📊 Processing ${source.count} products for ${source.storeName}...`);

      // Initialize store stats
      this.mergeStats.stores[source.storeName] = {
        total: source.count,
        added: 0,
        updated: 0,
        errors: 0
      };

      // Check if store exists
      const storeRef = this.db.collection('stores').doc(source.storeId);
      const storeDoc = await storeRef.get();

      if (!storeDoc.exists) {
        console.log(`   🏪 Creating store: ${source.storeName}`);
        await this.createStore(storeRef, source);
      }

      // Process products by category
      await this.processProductsByCategory(source);

    } catch (error) {
      console.error(`   ❌ Error processing ${source.name}:`, error.message);
      this.mergeStats.errors++;
    }
  }

  async createStore(storeRef, source) {
    const storeData = {
      name: source.storeName,
      address: this.getStoreAddress(source.storeId),
      storeId: source.storeId,
      productCount: source.count,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    await storeRef.set(storeData);
    console.log(`   ✅ Store created: ${source.storeName}`);
  }

  getStoreAddress(storeId) {
    const addresses = {
      'tesco_uxbridge': '62 High St, Uxbridge UB8 1ND',
      'sainsbury_uxbridge': 'York Rd, Uxbridge UB8 1QW',
      'lidl_uxbridge_cowley': '137 Cowley Rd, Uxbridge, London UB8 2AG',
      'lidl_uxbridge_high_st': 'High St, Uxbridge UB8 1LA',
      'aldi_west_drayton': 'High St, West Drayton UB7 7QN',
      'iceland_uxbridge': "27 Grainge's Yard, Uxbridge UB8 1LH"
    };
    return addresses[storeId] || 'Address not specified';
  }

  async processProductsByCategory(source) {
    const storeRef = this.db.collection('stores').doc(source.storeId);
    const categoryMap = new Map();

    // Group products by category
    source.products.forEach(product => {
      const category = this.normalizeCategory(product.category || 'Uncategorized');
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category).push(product);
    });

    console.log(`   📂 Found ${categoryMap.size} categories`);

    // Process each category
    for (const [categoryName, products] of categoryMap) {
      console.log(`   📁 Processing category: ${categoryName} (${products.length} products)`);
      await this.processCategory(storeRef, categoryName, products, source);
    }
  }

  normalizeCategory(category) {
    if (!category) return 'Uncategorized';
    
    // Normalize category names to match existing structure
    const categoryMap = {
      'Pantry Essentials': 'pantry-essentials',
      'Fruits & Vegetables': 'fruits-vegetables',
      'Dairy & Eggs': 'dairy-eggs',
      'Meat & Seafood': 'meat-seafood',
      'Bakery & Bread': 'bakery-bread',
      'Snacks & Beverages': 'snacks-beverages',
      'Household & Cleaning': 'household-cleaning',
      'Health & Beauty': 'health-beauty',
      'Frozen Foods': 'frozen-foods',
      'Cooking Essentials': 'cooking-essentials',
      'Staples': 'staples',
      'Dairy/Protein': 'dairy-protein',
      'Snacks': 'snacks',
      'Fruits': 'fruits',
      'Household Essentials': 'household-essentials',
      'Sanitary & Personal Care': 'sanitary-personal-care',
      'Frozen Chicken': 'frozen-chicken',
      'Frozen Turkey': 'frozen-turkey',
      'Doner & Kebab': 'doner-kebab',
      'Frozen Beef': 'frozen-beef',
      'Frozen Lamb': 'frozen-lamb',
      'Halal Frozen': 'halal-frozen',
      'Maggi Products': 'maggi-products'
    };

    return categoryMap[category] || category.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  async processCategory(storeRef, categoryName, products, source) {
    try {
      const categoryRef = storeRef.collection('categories').doc(categoryName);
      
      // Check if category exists
      const categoryDoc = await categoryRef.get();
      if (!categoryDoc.exists) {
        await categoryRef.set({
          name: categoryName,
          productCount: products.length,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Process products in batches
      const batchSize = 50;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        await this.processProductBatch(categoryRef, batch, source);
        
        console.log(`   📦 Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(products.length/batchSize)}`);
      }

    } catch (error) {
      console.error(`   ❌ Error processing category ${categoryName}:`, error.message);
      this.mergeStats.stores[source.storeName].errors += products.length;
    }
  }

  async processProductBatch(categoryRef, products, source) {
    const batch = this.db.batch();

    for (const product of products) {
      try {
        const productId = product.id || product.productId || this.generateProductId(product);
        const productRef = categoryRef.collection('products').doc(productId);

        const productData = {
          id: productId,
          name: product.name || product.productName || 'Unknown Product',
          price: product.price || null,
          currency: product.currency || 'GBP',
          image: product.image || null,
          description: product.description || null,
          brand: product.brand || 'Unknown Brand',
          category: product.category || 'Uncategorized',
          subcategory: product.subcategory || null,
          inStock: product.inStock !== false,
          storeId: source.storeId,
          storeType: source.storeId.split('_')[0],
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        batch.set(productRef, productData);
        this.mergeStats.productsAdded++;
        this.mergeStats.stores[source.storeName].added++;

      } catch (error) {
        console.error(`   ⚠️  Error processing product "${product.name}":`, error.message);
        this.mergeStats.errors++;
        this.mergeStats.stores[source.storeName].errors++;
      }
    }

    await batch.commit();
  }

  generateProductId(product) {
    const name = (product.name || product.productName || 'unknown').toLowerCase();
    const brand = (product.brand || 'unknown').toLowerCase();
    return `${brand}-${name}`.replace(/[^a-z0-9-]/g, '-').substring(0, 50);
  }

  displayResults() {
    const duration = (new Date() - this.mergeStats.startTime) / 1000;
    
    console.log('\n🎉 ADDITIONAL PRODUCTS MERGE COMPLETED!');
    console.log('=' .repeat(60));
    console.log(`⏱️  Duration: ${duration.toFixed(1)} seconds`);
    console.log(`✅ Products Added: ${this.mergeStats.productsAdded}`);
    console.log(`🔄 Products Updated: ${this.mergeStats.productsUpdated}`);
    console.log(`❌ Errors: ${this.mergeStats.errors}`);
    
    console.log('\n📊 BY STORE:');
    Object.entries(this.mergeStats.stores).forEach(([store, stats]) => {
      const successRate = ((stats.added / stats.total) * 100).toFixed(1);
      console.log(`   ${store}: ${stats.added}/${stats.total} (${successRate}%)`);
    });

    const totalProcessed = Object.values(this.mergeStats.stores).reduce((sum, stats) => sum + stats.total, 0);
    const totalAdded = Object.values(this.mergeStats.stores).reduce((sum, stats) => sum + stats.added, 0);
    const overallSuccessRate = totalProcessed > 0 ? ((totalAdded / totalProcessed) * 100).toFixed(1) : 0;
    
    console.log(`\n📈 Overall Success Rate: ${overallSuccessRate}%`);
    console.log(`📦 Total Products Processed: ${totalProcessed}`);

    if (this.mergeStats.productsAdded > 0) {
      console.log('\n🔥 Firebase now has additional products!');
      console.log('✅ Tesco, Lidl, and Sainsbury\'s products added to stores collection');
      console.log('📱 Your mobile app should now show more products!');
    }
  }
}

// Main execution
async function main() {
  const merger = new AdditionalProductsMerger();
  await merger.mergeAdditionalProducts();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = AdditionalProductsMerger;
