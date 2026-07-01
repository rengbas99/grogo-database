#!/usr/bin/env node

/**
 * Upload Products to Firebase
 * Uploads our scraped product data to Firebase Firestore
 */

const FirebaseService = require('../src/services/FirebaseService');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

class FirebaseUploader {
  constructor() {
    this.firebase = FirebaseService;
    this.uploadStats = {
      productsUploaded: 0,
      storeProductsUploaded: 0,
      errors: 0,
      startTime: new Date()
    };
  }

  async uploadProducts() {
    try {
      console.log('🚀 Starting Firebase Upload...');
      console.log('=' .repeat(60));

      // Initialize Firebase
      await this.firebase.initialize();

      // Load our product data
      const productData = await this.loadProductData();
      
      if (!productData) {
        console.log('❌ No product data found to upload');
        return;
      }

      console.log(`📦 Found ${productData.length} products to upload`);

      // Upload products in batches
      await this.uploadInBatches(productData);

      // Display final stats
      this.displayStats();

    } catch (error) {
      console.error('❌ Error uploading products:', error);
    }
  }

  async loadProductData() {
    try {
      // Try to load the complete essentials with prices first
      const completeEssentialsPath = path.join(__dirname, '..', 'data', 'essentials', 'complete-essentials-with-prices-2025-09-20.json');
      
      if (fs.existsSync(completeEssentialsPath)) {
        console.log('📂 Loading complete essentials with prices...');
        const data = JSON.parse(fs.readFileSync(completeEssentialsPath, 'utf8'));
        return data.products || data;
      }

      // Fallback to individual store files
      console.log('📂 Loading individual store products...');
      const products = [];

      // Load Iceland products
      const icelandPath = path.join(__dirname, '..', 'data', 'products', 'Iceland Products', 'iceland-products.json');
      if (fs.existsSync(icelandPath)) {
        const icelandData = JSON.parse(fs.readFileSync(icelandPath, 'utf8'));
        if (Array.isArray(icelandData)) {
          products.push(...icelandData);
        } else if (icelandData.products) {
          products.push(...icelandData.products);
        }
        console.log(`   ✅ Loaded ${Array.isArray(icelandData) ? icelandData.length : icelandData.products?.length || 0} Iceland products`);
      }

      // Load Aldi products
      const aldiPath = path.join(__dirname, '..', 'data', 'products', 'Aldi Products', 'aldi-products.json');
      if (fs.existsSync(aldiPath)) {
        const aldiData = JSON.parse(fs.readFileSync(aldiPath, 'utf8'));
        if (Array.isArray(aldiData)) {
          products.push(...aldiData);
        } else if (aldiData.products) {
          products.push(...aldiData.products);
        }
        console.log(`   ✅ Loaded ${Array.isArray(aldiData) ? aldiData.length : aldiData.products?.length || 0} Aldi products`);
      }

      return products;
    } catch (error) {
      console.error('❌ Error loading product data:', error);
      return null;
    }
  }

  async uploadInBatches(products) {
    const batchSize = 50; // Firestore batch limit is 500, but we'll use 50 for safety
    const totalBatches = Math.ceil(products.length / batchSize);

    console.log(`\n📤 Uploading in ${totalBatches} batches of ${batchSize} products each...`);

    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, products.length);
      const batch = products.slice(start, end);

      console.log(`\n📦 Batch ${i + 1}/${totalBatches} (${batch.length} products)...`);

      try {
        await this.uploadBatch(batch);
        console.log(`   ✅ Batch ${i + 1} uploaded successfully`);
      } catch (error) {
        console.error(`   ❌ Error uploading batch ${i + 1}:`, error.message);
        this.uploadStats.errors++;
      }

      // Small delay between batches to avoid rate limiting
      if (i < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async uploadBatch(products) {
    const batch = this.firebase.db.batch();
    const productRefs = [];

    // Create product documents
    for (const product of products) {
      try {
        // Clean and prepare product data
        const productData = this.prepareProductData(product);
        
        // Create product document
        const productRef = this.firebase.db.collection('products').doc();
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

    // Now create store product relationships
    await this.createStoreProductRelationships(productRefs);
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

  async createStoreProductRelationships(productRefs) {
    const batch = this.firebase.db.batch();

    for (const { ref: productRef, originalProduct } of productRefs) {
      try {
        // Create store product relationship
        const storeProductRef = this.firebase.db.collection('store_products').doc();
        batch.set(storeProductRef, {
          productId: productRef.id,
          storeId: this.getStoreId(originalProduct.store),
          storeName: originalProduct.store || 'Unknown Store',
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

    // Commit store product batch
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

  displayStats() {
    const duration = (new Date() - this.uploadStats.startTime) / 1000;
    
    console.log('\n🎉 UPLOAD COMPLETED!');
    console.log('=' .repeat(60));
    console.log(`⏱️  Duration: ${duration.toFixed(1)} seconds`);
    console.log(`📦 Products Uploaded: ${this.uploadStats.productsUploaded}`);
    console.log(`🏪 Store Products Uploaded: ${this.uploadStats.storeProductsUploaded}`);
    console.log(`❌ Errors: ${this.uploadStats.errors}`);
    console.log(`✅ Success Rate: ${((this.uploadStats.productsUploaded / (this.uploadStats.productsUploaded + this.uploadStats.errors)) * 100).toFixed(1)}%`);

    if (this.uploadStats.productsUploaded > 0) {
      console.log('\n🔥 Firebase is now populated with your product data!');
      console.log('You can now check the Firebase Console to see your products.');
    }
  }
}

// Main execution
async function main() {
  const uploader = new FirebaseUploader();
  await uploader.uploadProducts();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = FirebaseUploader;
