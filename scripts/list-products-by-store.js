#!/usr/bin/env node

/**
 * List Products by Store
 * Shows detailed breakdown of all products organized by store
 */

const admin = require('firebase-admin');

class ProductLister {
  constructor() {
    this.db = null;
    this.storeStats = {};
  }

  async listProductsByStore() {
    try {
      console.log('📋 Listing All Products by Store...');
      console.log('=' .repeat(60));

      // Initialize Firebase
      await this.initializeFirebase();

      // Get all products
      const productsSnapshot = await this.db.collection('products').get();
      console.log(`📦 Total products in Firebase: ${productsSnapshot.size}`);

      // Group products by store
      const productsByStore = {};
      const imageAnalysis = {
        icelandCdn: 0,
        aldiCdn: 0,
        openfoodfacts: 0,
        placeholder: 0,
        noImage: 0
      };

      productsSnapshot.forEach(doc => {
        const data = doc.data();
        const store = data.store || 'Unknown';
        
        if (!productsByStore[store]) {
          productsByStore[store] = [];
        }
        
        productsByStore[store].push({
          id: doc.id,
          name: data.name,
          price: data.price,
          image: data.image,
          category: data.category,
          brand: data.brand
        });

        // Analyze image source
        if (data.image) {
          if (data.image.includes('assets.iceland.co.uk')) {
            imageAnalysis.icelandCdn++;
          } else if (data.image.includes('dm.emea.cms.aldi.cx')) {
            imageAnalysis.aldiCdn++;
          } else if (data.image.includes('openfoodfacts.org')) {
            imageAnalysis.openfoodfacts++;
          } else if (data.image.includes('placeholder') || data.image.includes('logo')) {
            imageAnalysis.placeholder++;
          }
        } else {
          imageAnalysis.noImage++;
        }
      });

      // Display results for each store
      Object.entries(productsByStore).forEach(([store, products]) => {
        console.log(`\n🏪 ${store.toUpperCase()} (${products.length} products)`);
        console.log('=' .repeat(50));
        
        // Show first 10 products
        products.slice(0, 10).forEach((product, index) => {
          console.log(`${index + 1}. ${product.name}`);
          console.log(`   Price: £${product.price || 'N/A'}`);
          console.log(`   Brand: ${product.brand || 'Unknown'}`);
          console.log(`   Category: ${product.category || 'Unknown'}`);
          console.log(`   Image: ${product.image ? '✅' : '❌'}`);
          if (product.image) {
            const imageSource = this.getImageSource(product.image);
            console.log(`   Source: ${imageSource}`);
          }
          console.log('');
        });

        if (products.length > 10) {
          console.log(`   ... and ${products.length - 10} more products`);
        }

        // Store statistics
        this.storeStats[store] = {
          total: products.length,
          withPrice: products.filter(p => p.price).length,
          withImage: products.filter(p => p.image).length,
          categories: [...new Set(products.map(p => p.category).filter(Boolean))],
          brands: [...new Set(products.map(p => p.brand).filter(Boolean))]
        };
      });

      // Display summary
      this.displaySummary(imageAnalysis);

    } catch (error) {
      console.error('❌ Error listing products:', error);
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

  getImageSource(imageUrl) {
    if (imageUrl.includes('assets.iceland.co.uk')) return 'Iceland CDN';
    if (imageUrl.includes('dm.emea.cms.aldi.cx')) return 'Aldi CDN';
    if (imageUrl.includes('openfoodfacts.org')) return 'OpenFoodFacts';
    if (imageUrl.includes('placeholder') || imageUrl.includes('logo')) return 'Placeholder';
    return 'Other';
  }

  displaySummary(imageAnalysis) {
    console.log('\n📊 SUMMARY BY STORE:');
    console.log('=' .repeat(60));
    
    Object.entries(this.storeStats).forEach(([store, stats]) => {
      console.log(`\n🏪 ${store.toUpperCase()}:`);
      console.log(`   Total Products: ${stats.total}`);
      console.log(`   With Prices: ${stats.withPrice} (${((stats.withPrice/stats.total)*100).toFixed(1)}%)`);
      console.log(`   With Images: ${stats.withImage} (${((stats.withImage/stats.total)*100).toFixed(1)}%)`);
      console.log(`   Categories: ${stats.categories.length} (${stats.categories.slice(0, 3).join(', ')}${stats.categories.length > 3 ? '...' : ''})`);
      console.log(`   Brands: ${stats.brands.length} (${stats.brands.slice(0, 3).join(', ')}${stats.brands.length > 3 ? '...' : ''})`);
    });

    console.log('\n🖼️  IMAGE ANALYSIS:');
    console.log('=' .repeat(30));
    console.log(`Iceland CDN Images: ${imageAnalysis.icelandCdn}`);
    console.log(`Aldi CDN Images: ${imageAnalysis.aldiCdn}`);
    console.log(`OpenFoodFacts Images: ${imageAnalysis.openfoodfacts}`);
    console.log(`Placeholder Images: ${imageAnalysis.placeholder}`);
    console.log(`No Images: ${imageAnalysis.noImage}`);

    const totalImages = imageAnalysis.icelandCdn + imageAnalysis.aldiCdn + imageAnalysis.openfoodfacts + imageAnalysis.placeholder;
    const cdnImages = imageAnalysis.icelandCdn + imageAnalysis.aldiCdn;
    const cdnPercentage = totalImages > 0 ? ((cdnImages / totalImages) * 100).toFixed(1) : 0;
    
    console.log(`\n📈 CDN Image Coverage: ${cdnImages}/${totalImages} (${cdnPercentage}%)`);
  }
}

// Main execution
async function main() {
  const lister = new ProductLister();
  await lister.listProductsByStore();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ProductLister;


