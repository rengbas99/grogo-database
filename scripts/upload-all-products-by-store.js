#!/usr/bin/env node

/**
 * Upload All Products by Store
 * Uploads all 726 products from local data, organized by store with CDN images
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

class StoreProductUploader {
  constructor() {
    this.db = null;
    this.uploadStats = {
      totalProducts: 0,
      productsUploaded: 0,
      storeProductsUploaded: 0,
      errors: 0,
      stores: {},
      startTime: new Date()
    };
  }

  async uploadAllProducts() {
    try {
      console.log('🚀 Uploading All Products by Store...');
      console.log('=' .repeat(60));

      // Initialize Firebase
      await this.initializeFirebase();

      // Load local data
      const localData = await this.loadLocalData();
      this.uploadStats.totalProducts = localData.length;

      console.log(`📦 Found ${localData.length} products to upload`);

      // Group products by store
      const productsByStore = this.groupProductsByStore(localData);
      
      // Upload products for each store
      for (const [storeName, products] of Object.entries(productsByStore)) {
        console.log(`\n🏪 Uploading ${products.length} products for ${storeName}...`);
        await this.uploadStoreProducts(storeName, products);
      }

      // Display final results
      this.displayResults();

    } catch (error) {
      console.error('❌ Error uploading products:', error);
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

  async loadLocalData() {
    const filePath = path.join(__dirname, '..', 'data', 'essentials', 'complete-essentials-with-prices-2025-09-20.json');
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Local data file not found');
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const products = data.products || data;
    
    console.log(`📂 Loaded ${products.length} products from local file`);
    return products;
  }

  groupProductsByStore(products) {
    const grouped = {};
    
    products.forEach(product => {
      const store = product.store || 'Unknown';
      if (!grouped[store]) {
        grouped[store] = [];
      }
      grouped[store].push(product);
    });

    // Display grouping
    console.log('\n📊 Products by Store:');
    Object.entries(grouped).forEach(([store, storeProducts]) => {
      console.log(`   ${store}: ${storeProducts.length} products`);
    });

    return grouped;
  }

  async uploadStoreProducts(storeName, products) {
    const batchSize = 50;
    const totalBatches = Math.ceil(products.length / batchSize);
    
    this.uploadStats.stores[storeName] = {
      total: products.length,
      uploaded: 0,
      errors: 0
    };

    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, products.length);
      const batch = products.slice(start, end);

      console.log(`   📦 Batch ${i + 1}/${totalBatches} (${batch.length} products)...`);

      try {
        await this.uploadBatch(storeName, batch);
        this.uploadStats.stores[storeName].uploaded += batch.length;
        console.log(`   ✅ Batch ${i + 1} uploaded successfully`);
      } catch (error) {
        console.error(`   ❌ Error uploading batch ${i + 1}:`, error.message);
        this.uploadStats.stores[storeName].errors += batch.length;
        this.uploadStats.errors += batch.length;
      }

      // Small delay between batches
      if (i < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  async uploadBatch(storeName, products) {
    const batch = this.db.batch();
    const productRefs = [];

    // Create product documents
    for (const product of products) {
      try {
        const productData = this.prepareProductData(product);
        
        // Create product document
        const productRef = this.db.collection('products').doc();
        batch.set(productRef, {
          ...productData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        productRefs.push({
          ref: productRef,
          originalProduct: product
        });

        this.uploadStats.productsUploaded++;

      } catch (error) {
        console.error(`   ⚠️  Error preparing product "${product.name}":`, error.message);
        this.uploadStats.errors++;
      }
    }

    // Commit the batch
    await batch.commit();

    // Create store product relationships
    await this.createStoreProductRelationships(storeName, productRefs);
  }

  prepareProductData(product) {
    return {
      name: product.name || 'Unknown Product',
      brand: product.brand || 'Unknown Brand',
      category: product.category || 'Uncategorized',
      subcategory: product.subcategory || null,
      description: product.description || null,
      image: product.image || null,
      imageSource: product.imageSource || 'Unknown',
      price: product.price || null,
      currency: product.currency || 'GBP',
      unit: product.unit || null,
      size: product.size || null,
      nutrition: product.nutrition || null,
      ingredients: product.ingredients || null,
      allergens: product.allergens || null,
      expiry: product.expiry || null,
      inStock: product.inStock !== false,
      store: product.store || 'Unknown Store',
      productId: product.productId || product.id || null,
      barcode: product.barcode || null,
      tags: product.tags || []
    };
  }

  async createStoreProductRelationships(storeName, productRefs) {
    const batch = this.db.batch();

    for (const { ref: productRef, originalProduct } of productRefs) {
      try {
        const storeProductRef = this.db.collection('store_products').doc();
        batch.set(storeProductRef, {
          productId: productRef.id,
          storeId: this.getStoreId(storeName),
          storeName: storeName,
          productName: originalProduct.name || 'Unknown Product',
          price: originalProduct.price || null,
          currency: originalProduct.currency || 'GBP',
          image: originalProduct.image || null,
          inStock: originalProduct.inStock !== false,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        this.uploadStats.storeProductsUploaded++;

      } catch (error) {
        console.error(`   ⚠️  Error creating store product relationship:`, error.message);
        this.uploadStats.errors++;
      }
    }

    if (this.uploadStats.storeProductsUploaded > 0) {
      await batch.commit();
    }
  }

  getStoreId(storeName) {
    const storeMap = {
      'Iceland': 'iceland',
      'Aldi': 'aldi',
      'Tesco': 'tesco',
      'Sainsbury': 'sainsburys',
      'Lidl': 'lidl'
    };

    if (!storeName) return 'unknown';
    
    const normalizedStore = storeName.toLowerCase();
    for (const [key, value] of Object.entries(storeMap)) {
      if (normalizedStore.includes(key.toLowerCase())) {
        return value;
      }
    }
    
    return 'unknown';
  }

  displayResults() {
    const duration = (new Date() - this.uploadStats.startTime) / 1000;
    
    console.log('\n🎉 UPLOAD COMPLETED!');
    console.log('=' .repeat(60));
    console.log(`⏱️  Duration: ${duration.toFixed(1)} seconds`);
    console.log(`📦 Total Products: ${this.uploadStats.totalProducts}`);
    console.log(`✅ Products Uploaded: ${this.uploadStats.productsUploaded}`);
    console.log(`🏪 Store Products Uploaded: ${this.uploadStats.storeProductsUploaded}`);
    console.log(`❌ Errors: ${this.uploadStats.errors}`);
    
    console.log('\n📊 BY STORE:');
    Object.entries(this.uploadStats.stores).forEach(([store, stats]) => {
      const successRate = ((stats.uploaded / stats.total) * 100).toFixed(1);
      console.log(`   ${store}: ${stats.uploaded}/${stats.total} (${successRate}%)`);
    });

    const overallSuccessRate = ((this.uploadStats.productsUploaded / this.uploadStats.totalProducts) * 100).toFixed(1);
    console.log(`\n📈 Overall Success Rate: ${overallSuccessRate}%`);

    if (this.uploadStats.productsUploaded > 0) {
      console.log('\n🔥 Firebase is now populated with all your product data!');
      console.log('✅ All products organized by store with CDN images');
    }
  }
}

// Main execution
async function main() {
  const uploader = new StoreProductUploader();
  await uploader.uploadAllProducts();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = StoreProductUploader;
