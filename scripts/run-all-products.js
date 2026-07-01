/**
 * Run All Products - Update all products with real images using Google Images fallback
 */

const admin = require('firebase-admin');
const axios = require('axios');
const cheerio = require('cheerio');

// Initialize Firebase Admin SDK
const serviceAccount = require('../config/firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://grogo-mvp.firebaseio.com"
  });
}

const db = admin.firestore();

class AllProductsUpdater {
  constructor() {
    this.results = {
      updated: 0,
      notFound: 0,
      errors: 0,
      skipped: 0
    };
    this.batch = db.batch();
    this.batchCount = 0;
    this.maxBatchSize = 100;
  }

  // Google Images fallback
  async searchGoogleImages(productName, storeName) {
    try {
      // Try multiple search strategies
      const searchStrategies = [
        `${productName} ${storeName}`, // Product name + store
        `${productName}`, // Just product name
        `${this.cleanProductName(productName)} ${storeName}`, // Cleaned name + store
        `${this.cleanProductName(productName)}`, // Just cleaned name
      ];
      
      for (const searchQuery of searchStrategies) {
        const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchQuery)}`;
        
        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          },
          timeout: 15000
        });
        
        const $ = cheerio.load(response.data);
        const imageUrls = [];
        
        // Extract image URLs from Google search results
        $('img').each((i, el) => {
          const src = $(el).attr('src');
          const dataSrc = $(el).attr('data-src');
          const dataOriginal = $(el).attr('data-original');
          
          const imageUrl = src || dataSrc || dataOriginal;
          
          if (imageUrl && imageUrl.startsWith('http') && 
              !imageUrl.includes('googleusercontent.com') && 
              !imageUrl.includes('gstatic.com') &&
              !imageUrl.includes('google.com') &&
              (imageUrl.includes('.jpg') || imageUrl.includes('.jpeg') || imageUrl.includes('.png') || imageUrl.includes('.webp'))) {
            imageUrls.push(imageUrl);
          }
        });
        
        // Also try to extract from script tags that might contain image data
        $('script').each((i, el) => {
          const scriptContent = $(el).html();
          if (scriptContent) {
            const urlMatches = scriptContent.match(/https?:\/\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi);
            if (urlMatches) {
              urlMatches.forEach(url => {
                if (!url.includes('googleusercontent.com') && !url.includes('gstatic.com')) {
                  imageUrls.push(url);
                }
              });
            }
          }
        });
        
        // Try to find a valid image
        for (let i = 0; i < Math.min(5, imageUrls.length); i++) {
          const imageUrl = imageUrls[i];
          
          if (await this.validateImageUrl(imageUrl)) {
            return imageUrl;
          }
        }
        
        // Small delay between searches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Google Images search error:`, error.message);
      return null;
    }
  }

  // Clean product name for better search results
  cleanProductName(productName) {
    if (!productName) return '';
    
    let cleaned = productName.trim();
    
    // Remove common brand prefixes
    const brandPrefixes = [
      'Tesco', 'Sainsbury\'s', 'Aldi', 'Iceland', 'Lidl', 'Asda', 'Morrisons',
      'Alpenfest', 'Rosedene Farms', 'Capri-Sun', 'British', 'West Country',
      'Ladies\'', 'Men\'s', 'Kids\'', 'Baby', 'Family', 'Premium', 'Luxury',
      'Standard', 'XL', 'Large', 'Medium', 'Small', 'Mini', 'Wonky'
    ];
    
    for (const prefix of brandPrefixes) {
      const regex = new RegExp(`^${prefix}\\s+`, 'i');
      cleaned = cleaned.replace(regex, '');
    }
    
    // Remove common suffixes
    const suffixes = [
      'Pack', '6 Pack', '12 Pack', '4 Pack', '9 Pack', '5 Pack',
      'Loose Class 1', 'Loose', 'Class 1', 'Megapack',
      'With Applicators', 'Cardboard Applicator',
      'Anti-Perspirant Deodorant', 'Deodorant',
      'Shampoo/Conditioner', 'Shampoo/Bath',
      'Toothpaste/Toothbrush', 'Toothpaste',
      'Handcooked', 'Ridged', 'Zero', 'Zero Sugar',
      'Free Range', 'Organic', 'British', 'Large', 'Medium', 'Small'
    ];
    
    for (const suffix of suffixes) {
      const regex = new RegExp(`\\s+${suffix}$`, 'i');
      cleaned = cleaned.replace(regex, '');
    }
    
    // Clean up extra spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  // Validate image URL
  async validateImageUrl(url) {
    try {
      const response = await axios.head(url, { 
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      const contentType = response.headers['content-type'];
      return response.status === 200 && contentType && contentType.startsWith('image/');
    } catch (error) {
      return false;
    }
  }

  // Add to batch for Firebase update
  async addToBatch(productId, imageUrl) {
    const productRef = db.collection('products').doc(productId);
    this.batch.update(productRef, {
      image: imageUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    this.batchCount++;
    
    if (this.batchCount >= this.maxBatchSize) {
      await this.commitBatch();
    }
  }

  // Commit batch to Firebase
  async commitBatch() {
    if (this.batchCount > 0) {
      try {
        await this.batch.commit();
        console.log(`✅ Committed batch of ${this.batchCount} updates`);
        this.batch = db.batch();
        this.batchCount = 0;
      } catch (error) {
        console.error('❌ Batch commit error:', error.message);
        this.results.errors += this.batchCount;
        this.batch = db.batch();
        this.batchCount = 0;
      }
    }
  }

  // Update all products
  async updateAllProducts() {
    try {
      console.log('🚀 Starting comprehensive product image update...\n');
      
      // Get all products from Firebase
      const productsSnapshot = await db.collection('products').get();
      const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      console.log(`📊 Found ${products.length} products to process`);
      
      // Get store mapping
      const storesSnapshot = await db.collection('stores').get();
      const storeMap = {};
      storesSnapshot.docs.forEach(doc => {
        const store = doc.data();
        storeMap[store.name] = store.id;
      });
      
      let processed = 0;
      
      for (const product of products) {
        processed++;
        console.log(`\n🔄 [${processed}/${products.length}] Processing: ${product.name}`);
        
        // Skip if already has a good image
        if (product.image && !product.image.includes('picsum.photos') && !product.image.includes('openfoodfacts.org')) {
          console.log(`   ⏭️  Skipping - already has good image`);
          this.results.skipped++;
          continue;
        }
        
        // Get associated stores
        const storeProductsSnapshot = await db.collection('store_products')
          .where('productId', '==', product.id)
          .get();
        
        const associatedStores = storeProductsSnapshot.docs.map(doc => doc.data());
        const storeNames = [...new Set(associatedStores.map(sp => sp.storeName))];
        
        if (storeNames.length === 0) {
          console.log(`   ⏭️  Skipping - no associated stores`);
          this.results.skipped++;
          continue;
        }
        
        console.log(`   🏪 Associated stores: ${storeNames.join(', ')}`);
        
        let foundImage = false;
        
        // Try to find image for each store
        for (const storeName of storeNames) {
          if (!storeName || typeof storeName !== 'string') {
            continue;
          }
          
          console.log(`   🔍 Searching ${storeName}...`);
          
          const googleImage = await this.searchGoogleImages(product.name, storeName);
          
          if (googleImage) {
            console.log(`   ✅ Found image for ${storeName}: ${googleImage.substring(0, 80)}...`);
            
            await this.addToBatch(product.id, googleImage);
            this.results.updated++;
            foundImage = true;
            break; // Found image, move to next product
          } else {
            console.log(`   ❌ No image found for ${storeName}`);
          }
          
          // Delay between store searches
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (!foundImage) {
          console.log(`   ❌ No image found for any store`);
          this.results.notFound++;
        }
        
        // Delay between products
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Commit any remaining batch
      await this.commitBatch();
      
      // Final summary
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 COMPREHENSIVE UPDATE SUMMARY`);
      console.log(`${'='.repeat(60)}`);
      console.log(`✅ Products updated: ${this.results.updated}`);
      console.log(`⏭️  Products skipped: ${this.results.skipped}`);
      console.log(`❌ Products not found: ${this.results.notFound}`);
      console.log(`❌ Errors: ${this.results.errors}`);
      console.log(`📊 Total processed: ${processed}`);
      
      return this.results;
      
    } catch (error) {
      console.error('❌ Update failed:', error);
      await this.commitBatch(); // Try to commit any pending batch
      return this.results;
    }
  }
}

// Run the comprehensive update
const updater = new AllProductsUpdater();
updater.updateAllProducts().catch(console.error);
