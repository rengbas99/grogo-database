#!/usr/bin/env node

/**
 * Check Duplicates and Offers
 * Remove duplicates and identify special offers like "3 for £10"
 */

const admin = require('firebase-admin');

class DuplicateChecker {
  constructor() {
    this.db = null;
    this.stats = {
      totalProducts: 0,
      duplicatesFound: 0,
      duplicatesRemoved: 0,
      offersFound: 0,
      stores: {},
      startTime: new Date()
    };
    this.duplicates = [];
    this.offers = [];
  }

  async checkDuplicatesAndOffers() {
    try {
      console.log('🔍 Checking for Duplicates and Special Offers...');
      console.log('=' .repeat(60));

      // Initialize Firebase
      await this.initializeFirebase();

      // Get all stores
      const storesSnapshot = await this.db.collection('stores').get();
      console.log(`📊 Found ${storesSnapshot.size} stores`);

      // Process each store
      for (const storeDoc of storesSnapshot.docs) {
        const storeData = storeDoc.data();
        console.log(`\n🏪 Processing ${storeData.name}...`);
        await this.processStore(storeDoc.id, storeData);
      }

      // Remove duplicates
      await this.removeDuplicates();

      // Display results
      this.displayResults();

    } catch (error) {
      console.error('❌ Error checking duplicates and offers:', error);
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

  async processStore(storeId, storeData) {
    this.stats.stores[storeData.name] = {
      totalProducts: 0,
      duplicates: 0,
      offers: 0
    };

    // Get all categories for this store
    const categoriesSnapshot = await this.db.collection('stores').doc(storeId).collection('categories').get();
    
    for (const categoryDoc of categoriesSnapshot.docs) {
      await this.processCategory(storeId, storeData.name, categoryDoc.id, categoryDoc.ref);
    }
  }

  async processCategory(storeId, storeName, categoryName, categoryRef) {
    const productsSnapshot = await categoryRef.collection('products').get();
    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ref: doc.ref,
      ...doc.data()
    }));

    this.stats.totalProducts += products.length;
    this.stats.stores[storeName].totalProducts += products.length;

    console.log(`   📁 ${categoryName}: ${products.length} products`);

    // Check for duplicates within this category
    await this.findDuplicatesInCategory(products, storeName, categoryName);

    // Check for offers
    await this.findOffers(products, storeName, categoryName);
  }

  async findDuplicatesInCategory(products, storeName, categoryName) {
    const productMap = new Map();
    const duplicates = [];

    for (const product of products) {
      // Create a key for duplicate detection
      const key = this.createDuplicateKey(product);
      
      if (productMap.has(key)) {
        const existing = productMap.get(key);
        duplicates.push({
          store: storeName,
          category: categoryName,
          duplicate: product,
          original: existing,
          key: key
        });
        this.stats.duplicatesFound++;
        this.stats.stores[storeName].duplicates++;
      } else {
        productMap.set(key, product);
      }
    }

    if (duplicates.length > 0) {
      console.log(`   ⚠️  Found ${duplicates.length} duplicates in ${categoryName}`);
      this.duplicates.push(...duplicates);
    }
  }

  createDuplicateKey(product) {
    // Create a key based on name, brand, and price for duplicate detection
    const name = (product.name || '').toLowerCase().trim();
    const brand = (product.brand || '').toLowerCase().trim();
    const price = product.price || 0;
    
    // Normalize the name for better matching
    const normalizedName = name
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();
    
    return `${brand}|${normalizedName}|${price}`;
  }

  async findOffers(products, storeName, categoryName) {
    const offerPatterns = [
      /(\d+)\s*for\s*£?(\d+(?:\.\d{2})?)/gi,
      /(\d+)\s*for\s*(\d+(?:\.\d{2})?)\s*£/gi,
      /buy\s*(\d+)\s*get\s*(\d+)\s*free/gi,
      /(\d+)%\s*off/gi,
      /half\s*price/gi,
      /bogof/gi,
      /bogo/gi,
      /multibuy/gi,
      /special\s*offer/gi,
      /deal/gi
    ];

    for (const product of products) {
      const text = `${product.name} ${product.description || ''}`.toLowerCase();
      
      for (const pattern of offerPatterns) {
        const matches = text.match(pattern);
        if (matches) {
          const offer = {
            store: storeName,
            category: categoryName,
            product: product.name,
            price: product.price,
            offer: matches[0],
            fullText: text,
            productRef: product.ref
          };
          
          this.offers.push(offer);
          this.stats.offersFound++;
          this.stats.stores[storeName].offers++;
          
          console.log(`   🎯 Offer found: "${product.name}" - ${matches[0]}`);
          break; // Only count one offer per product
        }
      }
    }
  }

  async removeDuplicates() {
    if (this.duplicates.length === 0) {
      console.log('\n✅ No duplicates found to remove');
      return;
    }

    console.log(`\n🗑️  Removing ${this.duplicates.length} duplicates...`);

    for (const duplicate of this.duplicates) {
      try {
        // Remove the duplicate (keep the original)
        await duplicate.duplicate.ref.delete();
        this.stats.duplicatesRemoved++;
        
        console.log(`   ✅ Removed duplicate: "${duplicate.duplicate.name}"`);
      } catch (error) {
        console.error(`   ❌ Error removing duplicate "${duplicate.duplicate.name}":`, error.message);
      }
    }
  }

  displayResults() {
    const duration = (new Date() - this.stats.startTime) / 1000;
    
    console.log('\n📊 DUPLICATE CHECK AND OFFER ANALYSIS COMPLETE!');
    console.log('=' .repeat(60));
    console.log(`⏱️  Duration: ${duration.toFixed(1)} seconds`);
    console.log(`📦 Total Products Analyzed: ${this.stats.totalProducts}`);
    console.log(`🔄 Duplicates Found: ${this.stats.duplicatesFound}`);
    console.log(`🗑️  Duplicates Removed: ${this.stats.duplicatesRemoved}`);
    console.log(`🎯 Special Offers Found: ${this.stats.offersFound}`);
    
    console.log('\n📊 BY STORE:');
    Object.entries(this.stats.stores).forEach(([store, stats]) => {
      console.log(`   ${store}:`);
      console.log(`     Products: ${stats.totalProducts}`);
      console.log(`     Duplicates: ${stats.duplicates}`);
      console.log(`     Offers: ${stats.offers}`);
    });

    if (this.offers.length > 0) {
      console.log('\n🎯 SPECIAL OFFERS FOUND:');
      console.log('=' .repeat(40));
      
      // Group offers by store
      const offersByStore = {};
      this.offers.forEach(offer => {
        if (!offersByStore[offer.store]) {
          offersByStore[offer.store] = [];
        }
        offersByStore[offer.store].push(offer);
      });

      Object.entries(offersByStore).forEach(([store, offers]) => {
        console.log(`\n🏪 ${store}:`);
        offers.forEach(offer => {
          console.log(`   • ${offer.product} - £${offer.price} (${offer.offer})`);
        });
      });

      // Look specifically for Iceland "3 for £10" type offers
      const icelandOffers = this.offers.filter(offer => 
        offer.store.toLowerCase().includes('iceland') && 
        offer.offer.match(/\d+\s*for\s*£?(\d+(?:\.\d{2})?)/i)
      );

      if (icelandOffers.length > 0) {
        console.log('\n🛒 ICELAND MULTIBUY OFFERS:');
        console.log('=' .repeat(40));
        icelandOffers.forEach(offer => {
          console.log(`   • ${offer.product} - £${offer.price} (${offer.offer})`);
        });
      }
    }

    if (this.stats.duplicatesRemoved > 0) {
      console.log(`\n✅ Database cleaned! Removed ${this.stats.duplicatesRemoved} duplicate products`);
    }

    if (this.stats.offersFound > 0) {
      console.log(`\n🎯 Found ${this.stats.offersFound} special offers across all stores`);
    }
  }
}

// Main execution
async function main() {
  const checker = new DuplicateChecker();
  await checker.checkDuplicatesAndOffers();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DuplicateChecker;

