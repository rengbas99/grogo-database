#!/usr/bin/env node

/**
 * Upload All Stores to Firebase
 * Uploads products from all store files (Tesco, Lidl, Sainsbury's, etc.)
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

class AllStoresUploader {
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

  async uploadAllStores() {
    try {
      console.log('🚀 Uploading ALL Store Products to Firebase...');
      console.log('=' .repeat(60));

      // Initialize Firebase
      await this.initializeFirebase();

      // Define store files to upload
      const storeFiles = [
        {
          name: 'Tesco',
          path: '../data/products/Tesco Products/tesco-final-products.json',
          storeId: 'tesco'
        },
        {
          name: 'Lidl',
          path: '../data/products/Lidl products/lidl-openfoodfacts-products.json',
          storeId: 'lidl'
        },
        {
          name: 'Sainsbury\'s',
          path: '../data/products/Sainsbury\'s Products/sainsbury-final-products.json',
          storeId: 'sainsburys'
        }
      ];

      // Upload each store
      for (const storeFile of storeFiles) {
        console.log(`\n🏪 Uploading ${storeFile.name} products...`);
        await this.uploadStoreFile(storeFile);
      }

      // Display final results
      this.displayResults();

    } catch (error) {
      console.error('❌ Error uploading stores:', error);
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

  async uploadStoreFile(storeFile) {
    try {
      const filePath = path.join(__dirname, storeFile.path);
      
      if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${storeFile.path}`);
        return;
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const products = Array.isArray(data) ? data : (data.products || []);
      
      console.log(`   📂 Found ${products.length} products in ${storeFile.name}`);
      
      if (products.length === 0) {
        console.log(`   ⚠️  No products to upload for ${storeFile.name}`);
        return;
      }

      // Initialize store stats
      this.uploadStats.stores[storeFile.name] = {
        total: products.length,
        uploaded: 0,
        errors: 0
      };

      // Upload products in batches
      await this.uploadStoreProducts(storeFile, products);

    } catch (error) {
      console.error(`❌ Error uploading ${storeFile.name}:`, error.message);
    }
  }

  async uploadStoreProducts(storeFile, products) {
    const batchSize = 50;
    const totalBatches = Math.ceil(products.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, products.length);
      const batch = products.slice(start, end);

      console.log(`   📦 Batch ${i + 1}/${totalBatches} (${batch.length} products)...`);

      try {
        await this.uploadBatch(storeFile, batch);
        this.uploadStats.stores[storeFile.name].uploaded += batch.length;
        console.log(`   ✅ Batch ${i + 1} uploaded successfully`);
      } catch (error) {
        console.error(`   ❌ Error uploading batch ${i + 1}:`, error.message);
        this.uploadStats.stores[storeFile.name].errors += batch.length;
        this.uploadStats.errors += batch.length;
      }

      // Small delay between batches
      if (i < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  async uploadBatch(storeFile, products) {
    const batch = this.db.batch();
    const productRefs = [];

    // Create product documents
    for (const product of products) {
      try {
        const productData = this.prepareProductData(product, storeFile.name);
        
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
    await this.createStoreProductRelationships(storeFile, productRefs);
  }

  prepareProductData(product, storeName) {
    return {
      name: product.name || product.productName || 'Unknown Product',
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
      store: storeName,
      productId: product.productId || product.id || null,
      barcode: product.barcode || null,
      tags: product.tags || []
    };
  }

  async createStoreProductRelationships(storeFile, productRefs) {
    const batch = this.db.batch();

    for (const { ref: productRef, originalProduct } of productRefs) {
      try {
        const storeProductRef = this.db.collection('store_products').doc();
        batch.set(storeProductRef, {
          productId: productRef.id,
          storeId: storeFile.storeId,
          storeName: storeFile.name,
          productName: originalProduct.name || originalProduct.productName || 'Unknown Product',
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

  displayResults() {
    const duration = (new Date() - this.uploadStats.startTime) / 1000;
    
    console.log('\n🎉 ALL STORES UPLOAD COMPLETED!');
    console.log('=' .repeat(60));
    console.log(`⏱️  Duration: ${duration.toFixed(1)} seconds`);
    console.log(`✅ Products Uploaded: ${this.uploadStats.productsUploaded}`);
    console.log(`🏪 Store Products Uploaded: ${this.uploadStats.storeProductsUploaded}`);
    console.log(`❌ Errors: ${this.uploadStats.errors}`);
    
    console.log('\n📊 BY STORE:');
    Object.entries(this.uploadStats.stores).forEach(([store, stats]) => {
      const successRate = ((stats.uploaded / stats.total) * 100).toFixed(1);
      console.log(`   ${store}: ${stats.uploaded}/${stats.total} (${successRate}%)`);
    });

    const totalProducts = Object.values(this.uploadStats.stores).reduce((sum, stats) => sum + stats.total, 0);
    const totalUploaded = Object.values(this.uploadStats.stores).reduce((sum, stats) => sum + stats.uploaded, 0);
    const overallSuccessRate = totalProducts > 0 ? ((totalUploaded / totalProducts) * 100).toFixed(1) : 0;
    
    console.log(`\n📈 Overall Success Rate: ${overallSuccessRate}%`);
    console.log(`📦 Total Products Processed: ${totalProducts}`);

    if (this.uploadStats.productsUploaded > 0) {
      console.log('\n🔥 Firebase now has ALL store products!');
      console.log('✅ Tesco, Lidl, and Sainsbury\'s products added');
    }
  }
}

// Main execution
async function main() {
  const uploader = new AllStoresUploader();
  await uploader.uploadAllStores();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = AllStoresUploader;


