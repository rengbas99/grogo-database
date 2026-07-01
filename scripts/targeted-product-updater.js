/**
 * Targeted Product Updater - Uses existing product names to find correct images and prices
 * Focuses on specific product searches, not category scraping
 * Extracts images from black boxes, prices from red boxes, mentions offers
 */

const admin = require('firebase-admin');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccount = require('../config/firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://grogo-mvp.firebaseio.com"
  });
}

const db = admin.firestore();

const COLLECTIONS = {
  PRODUCTS: 'products',
  STORE_PRODUCTS: 'store_products',
  STORES: 'stores',
};

class TargetedProductUpdater {
  constructor() {
    this.results = {
      updated: 0,
      notFound: 0,
      priceDifferences: 0,
      offersFound: 0,
      errors: 0
    };
  }

  // Generic HTTP GET request
  async fetchPage(url) {
    try {
      const response = await axios.get(url, {
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
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch ${url}: ${error.message}`);
      return null;
    }
  }

  // Search Sainsbury's for specific product
  async searchSainsburys(productName) {
    try {
      console.log(`🔍 Searching Sainsbury's for: "${productName}"`);
      
      // Use Sainsbury's search API
      const searchUrl = `https://www.sainsburys.co.uk/groceries-api/gol-services/productsearch/v1/products?filter[keyword]=${encodeURIComponent(productName)}&page=1&pageSize=5`;
      
      const data = await this.fetchPage(searchUrl);
      if (!data || !data.products || data.products.length === 0) {
        console.log(`   ❌ No products found for "${productName}"`);
        return null;
      }

      // Find best match
      const product = data.products[0];
      const imageUrl = product.image;
      const currentPrice = product.price?.current;
      const loyaltyPrice = product.price?.loyalty;
      const offers = product.promotions || [];

      console.log(`   ✅ Found: ${product.name}`);
      console.log(`   💰 Price: £${currentPrice}${loyaltyPrice ? ` (Loyalty: £${loyaltyPrice})` : ''}`);
      if (offers.length > 0) {
        console.log(`   🎯 Offers: ${offers.map(o => o.name).join(', ')}`);
        this.results.offersFound++;
      }

      return {
        name: product.name,
        imageUrl: imageUrl,
        price: currentPrice,
        loyaltyPrice: loyaltyPrice,
        offers: offers,
        store: 'Sainsburys'
      };
    } catch (error) {
      console.error(`❌ Error searching Sainsbury's for "${productName}":`, error.message);
      this.results.errors++;
      return null;
    }
  }

  // Search Lidl for specific product
  async searchLidl(productName) {
    try {
      console.log(`🔍 Searching Lidl for: "${productName}"`);
      
      const searchUrl = `https://www.lidl.co.uk/s?q=${encodeURIComponent(productName)}`;
      const html = await this.fetchPage(searchUrl);
      if (!html) return null;

      const $ = cheerio.load(html);
      const productCard = $('.product-grid-box').first();
      
      if (productCard.length === 0) {
        console.log(`   ❌ No products found for "${productName}"`);
        return null;
      }

      // Extract image (black box area)
      const imageUrl = productCard.find('img').attr('src');
      
      // Extract price (red box area)
      const priceText = productCard.find('.pricebox__price').text().trim();
      const priceMatch = priceText.match(/£(\d+\.\d{2})/);
      const currentPrice = priceMatch ? parseFloat(priceMatch[1]) : null;
      
      // Check for offers (red boxes)
      const offerText = productCard.find('.pricebox__discount, .pricebox__offer').text().trim();
      const hasOffer = offerText.length > 0;
      
      if (hasOffer) {
        console.log(`   🎯 Offer detected: ${offerText}`);
        this.results.offersFound++;
      }

      console.log(`   ✅ Found: ${productCard.find('.product-grid-box__title').text().trim()}`);
      console.log(`   💰 Price: £${currentPrice}${hasOffer ? ' (OFFER!)' : ''}`);

      return {
        name: productCard.find('.product-grid-box__title').text().trim(),
        imageUrl: imageUrl,
        price: currentPrice,
        offer: hasOffer,
        offerText: offerText,
        store: 'Lidl'
      };
    } catch (error) {
      console.error(`❌ Error searching Lidl for "${productName}":`, error.message);
      this.results.errors++;
      return null;
    }
  }

  // Search Iceland for specific product (focus on frozen except raw frozen)
  async searchIceland(productName) {
    try {
      console.log(`🔍 Searching Iceland for: "${productName}"`);
      
      const searchUrl = `https://www.iceland.co.uk/search?q=${encodeURIComponent(productName)}`;
      const html = await this.fetchPage(searchUrl);
      if (!html) return null;

      const $ = cheerio.load(html);
      const productCard = $('.product-tile').first();
      
      if (productCard.length === 0) {
        console.log(`   ❌ No products found for "${productName}"`);
        return null;
      }

      // Extract image (black box area)
      const imageUrl = productCard.find('.product-tile__image img').attr('src');
      
      // Extract price (red box area)
      const priceText = productCard.find('.price__current').text().trim();
      const priceMatch = priceText.match(/£(\d+\.\d{2})/);
      const currentPrice = priceMatch ? parseFloat(priceMatch[1]) : null;
      
      // Check for Iceland offers (look for keywords like "3 for one", "2 for", "buy one get one")
      const offerKeywords = ['3 for', '2 for', 'buy one get one', 'bogo', 'half price', 'special offer', 'deal'];
      const allText = productCard.text().toLowerCase();
      const foundOffers = offerKeywords.filter(keyword => allText.includes(keyword));
      const hasOffer = foundOffers.length > 0;
      
      if (hasOffer) {
        console.log(`   🎯 Iceland Offer detected: ${foundOffers.join(', ')}`);
        this.results.offersFound++;
      }

      console.log(`   ✅ Found: ${productCard.find('.product-tile__title').text().trim()}`);
      console.log(`   💰 Price: £${currentPrice}${hasOffer ? ' (OFFER!)' : ''}`);

      return {
        name: productCard.find('.product-tile__title').text().trim(),
        imageUrl: imageUrl,
        price: currentPrice,
        offer: hasOffer,
        offerText: foundOffers.join(', '),
        store: 'Iceland'
      };
    } catch (error) {
      console.error(`❌ Error searching Iceland for "${productName}":`, error.message);
      this.results.errors++;
      return null;
    }
  }

  // Google Images search as fallback to find product pages
  async searchGoogleImages(productName, storeName) {
    try {
      console.log(`🔍 Searching Google Images for: "${productName}" (${storeName})`);
      
      const searchQuery = `${productName} ${storeName} site:${this.getStoreDomain(storeName)}`;
      const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchQuery)}`;
      
      const html = await this.fetchPage(searchUrl);
      if (!html) return null;

      const $ = cheerio.load(html);
      const imageUrls = [];
      
      // Extract image URLs from Google search results
      $('img').each((i, el) => {
        const src = $(el).attr('src');
        if (src && src.startsWith('http') && !src.includes('googleusercontent.com') && !src.includes('gstatic.com')) {
          imageUrls.push(src);
        }
      });
      
      console.log(`   📊 Found ${imageUrls.length} potential images from Google`);
      
      // Try to find a valid image
      for (const imageUrl of imageUrls.slice(0, 5)) {
        if (await this.validateImageUrl(imageUrl)) {
          console.log(`   ✅ Found valid Google image: ${imageUrl.substring(0, 80)}...`);
          return imageUrl;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Google Images search error:`, error.message);
      return null;
    }
  }

  // Get store domain for Google search
  getStoreDomain(storeName) {
    const domains = {
      'Sainsburys': 'sainsburys.co.uk',
      'Lidl': 'lidl.co.uk',
      'Iceland': 'iceland.co.uk',
      'Aldi': 'aldi.co.uk'
    };
    return domains[storeName] || '';
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

  // Cross-examine prices between database and scraped data
  crossExaminePrice(dbPrice, scrapedPrice, productName, store) {
    if (!dbPrice || !scrapedPrice) return null;
    
    const difference = Math.abs(dbPrice - scrapedPrice);
    const percentDiff = (difference / dbPrice) * 100;
    
    if (percentDiff > 5) { // More than 5% difference
      console.log(`   ⚠️  PRICE DIFFERENCE DETECTED:`);
      console.log(`      Database: £${dbPrice}`);
      console.log(`      Scraped:  £${scrapedPrice}`);
      console.log(`      Difference: £${difference.toFixed(2)} (${percentDiff.toFixed(1)}%)`);
      this.results.priceDifferences++;
      return {
        database: dbPrice,
        scraped: scrapedPrice,
        difference: difference,
        percentDiff: percentDiff
      };
    }
    
    return null;
  }

  // Update Firebase with new data
  async updateFirebase(productId, scrapedData, dbPrice) {
    try {
      const batch = db.batch();
      
      // Update products collection
      const productRef = db.collection(COLLECTIONS.PRODUCTS).doc(productId);
      batch.update(productRef, {
        image: scrapedData.imageUrl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Update store_products collection
      const storeProductsSnapshot = await db.collection(COLLECTIONS.STORE_PRODUCTS)
        .where('productId', '==', productId)
        .where('storeName', '==', scrapedData.store)
        .get();
      
      storeProductsSnapshot.forEach(doc => {
        const storeProductRef = db.collection(COLLECTIONS.STORE_PRODUCTS).doc(doc.id);
        batch.update(storeProductRef, {
          price: scrapedData.price,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      
      await batch.commit();
      console.log(`   ✅ Updated Firebase for ${scrapedData.name}`);
      this.results.updated++;
      
    } catch (error) {
      console.error(`❌ Error updating Firebase:`, error.message);
      this.results.errors++;
    }
  }

  // Main function to update products
  async updateProducts() {
    try {
      console.log('🚀 Starting Targeted Product Updater...');
      console.log('📋 Strategy: Use existing product names, search specific products, extract images/prices');
      console.log('🎯 Focus: Sainsbury\'s, Lidl, Iceland (frozen except raw frozen)');
      console.log('❌ Skipping: Aldi (already has everything)');
      
      // Get all products from Firebase
      const productsSnapshot = await db.collection(COLLECTIONS.PRODUCTS).get();
      const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      console.log(`📊 Found ${products.length} products in database`);
      
      // Get store products for price comparison
      const storeProductsSnapshot = await db.collection(COLLECTIONS.STORE_PRODUCTS).get();
      const storeProducts = storeProductsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Create mapping for quick lookup
      const productStoreMap = new Map();
      storeProducts.forEach(sp => {
        if (!productStoreMap.has(sp.productId)) {
          productStoreMap.set(sp.productId, []);
        }
        productStoreMap.get(sp.productId).push(sp);
      });
      
      // Process each product
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🔄 Processing ${i + 1}/${products.length}: ${product.name}`);
        
        const associatedStores = productStoreMap.get(product.id) || [];
        const storeNames = [...new Set(associatedStores.map(sp => sp.storeName))];
        
        console.log(`   📍 Associated stores: ${storeNames.join(', ')}`);
        
        // Search each associated store
        for (const storeName of storeNames) {
          let scrapedData = null;
          
          // Skip if storeName is undefined or empty
          if (!storeName || typeof storeName !== 'string') {
            console.log(`   ⏭️  Skipping invalid store name: ${storeName}`);
            continue;
          }
          
          // Skip Aldi as requested
          if (storeName === 'Aldi' || storeName.includes('Aldi')) {
            console.log(`   ⏭️  Skipping Aldi (already has everything)`);
            continue;
          }
          
          // Search based on store
          switch (storeName) {
            case 'Sainsburys':
            case 'Sainsbury\'s':
              scrapedData = await this.searchSainsburys(product.name);
              break;
            case 'Lidl':
              scrapedData = await this.searchLidl(product.name);
              break;
            case 'Iceland':
              // For Iceland, focus on frozen products (except raw frozen)
              if (product.category && typeof product.category === 'string' && 
                  product.category.toLowerCase().includes('frozen') && 
                  !product.name.toLowerCase().includes('raw')) {
                scrapedData = await this.searchIceland(product.name);
              } else {
                console.log(`   ⏭️  Skipping non-frozen product for Iceland`);
                continue;
              }
              break;
            default:
              console.log(`   ⏭️  Unknown store: ${storeName}`);
              continue;
          }
          
          if (scrapedData && scrapedData.imageUrl && scrapedData.price) {
            // Find current price in database
            const currentStoreProduct = associatedStores.find(sp => sp.storeName === storeName);
            const dbPrice = currentStoreProduct ? currentStoreProduct.price : null;
            
            // Cross-examine prices
            const priceDiff = this.crossExaminePrice(dbPrice, scrapedData.price, product.name, storeName);
            
            // Update Firebase
            await this.updateFirebase(product.id, scrapedData, dbPrice);
            
            // Show offer information
            if (scrapedData.offer || scrapedData.offers) {
              console.log(`   🎯 OFFER DETECTED: ${scrapedData.offerText || scrapedData.offers.map(o => o.name).join(', ')}`);
            }
            
          } else if (scrapedData && scrapedData.price && !scrapedData.imageUrl) {
            // Try Google Images as fallback for missing images
            console.log(`   🔍 Trying Google Images fallback for missing image...`);
            const googleImage = await this.searchGoogleImages(product.name, storeName);
            
            if (googleImage) {
              scrapedData.imageUrl = googleImage;
              
              // Find current price in database
              const currentStoreProduct = associatedStores.find(sp => sp.storeName === storeName);
              const dbPrice = currentStoreProduct ? currentStoreProduct.price : null;
              
              // Cross-examine prices
              const priceDiff = this.crossExaminePrice(dbPrice, scrapedData.price, product.name, storeName);
              
              // Update Firebase
              await this.updateFirebase(product.id, scrapedData, dbPrice);
              
              console.log(`   ✅ Updated with Google Images fallback`);
            } else {
              console.log(`   ❌ Could not find image for ${product.name} in ${storeName}`);
              this.results.notFound++;
            }
          } else {
            console.log(`   ❌ Could not find complete data for ${product.name} in ${storeName}`);
            this.results.notFound++;
          }
          
          // Delay between searches
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Final summary
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📊 TARGETED PRODUCT UPDATER FINAL SUMMARY`);
      console.log(`${'='.repeat(80)}`);
      console.log(`✅ Products updated: ${this.results.updated}`);
      console.log(`❌ Products not found: ${this.results.notFound}`);
      console.log(`⚠️  Price differences detected: ${this.results.priceDifferences}`);
      console.log(`🎯 Offers found: ${this.results.offersFound}`);
      console.log(`❌ Errors: ${this.results.errors}`);
      
      return this.results;
      
    } catch (error) {
      console.error('❌ Process failed:', error);
      return this.results;
    }
  }
}

// Run the updater
const updater = new TargetedProductUpdater();
updater.updateProducts().catch(console.error);
