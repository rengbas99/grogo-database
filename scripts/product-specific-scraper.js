/**
 * Product-Specific Scraper - Uses existing scrapers to find specific products by name
 * Fallback system that searches for exact product names using the working scrapers
 */

const admin = require('firebase-admin');
const axios = require('axios');
const cheerio = require('cheerio');
const SainsburysFinalScraper = require('./sainsburys-final-scraper');
const LidlFinalScraper = require('./lidl-final-scraper');
const IcelandFinalScraper = require('./iceland-final-scraper');
const AldiFinalScraper = require('./aldi-final-scraper');

// Initialize Firebase Admin SDK
const serviceAccount = require('../config/firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://grogo-mvp.firebaseio.com"
  });
}

const db = admin.firestore();

class ProductSpecificScraper {
  constructor() {
    this.scrapers = {
      'Sainsburys': new SainsburysFinalScraper(),
      'Lidl': new LidlFinalScraper(),
      'Iceland': new IcelandFinalScraper(),
      'Aldi': new AldiFinalScraper()
    };
    
    this.results = {
      updated: 0,
      notFound: 0,
      priceDifferences: 0,
      offersFound: 0,
      errors: 0
    };
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

  // Search for specific product using store scraper
  async searchProductInStore(productName, storeName) {
    try {
      console.log(`🔍 Searching ${storeName} for: "${productName}"`);
      
      const scraper = this.scrapers[storeName];
      if (!scraper) {
        console.log(`   ❌ No scraper available for ${storeName}`);
        return null;
      }

      // Try different search variations
      const searchTerms = [
        productName, // Original name
        this.cleanProductName(productName), // Cleaned name
        productName.split(' ').slice(0, 3).join(' '), // First 3 words
        productName.split(' ').slice(0, 2).join(' '), // First 2 words
        productName.split(' ')[0] // First word only
      ];

      // Remove duplicates and empty strings
      const uniqueTerms = [...new Set(searchTerms.filter(term => term && term.trim()))];

      for (const searchTerm of uniqueTerms) {
        try {
          console.log(`   🔍 Trying search term: "${searchTerm}"`);
          
          const products = await scraper.scrapeCompleteProducts(searchTerm);
          
          if (products && products.length > 0) {
            // Find the best match
            const bestMatch = this.findBestMatch(productName, products);
            
            if (bestMatch) {
              console.log(`   ✅ Found match: ${bestMatch.name}`);
              console.log(`   💰 Price: £${bestMatch.price}${bestMatch.clubcardPrice ? ` (Clubcard: £${bestMatch.clubcardPrice})` : ''}`);
              
              if (bestMatch.offer) {
                console.log(`   🎯 Offer: ${bestMatch.offer}`);
                this.results.offersFound++;
              }
              
              return {
                name: bestMatch.name,
                image: bestMatch.image,
                price: parseFloat(bestMatch.price) || 0,
                loyaltyPrice: parseFloat(bestMatch.clubcardPrice) || null,
                offer: bestMatch.offer,
                store: storeName
              };
            }
          }
          
          // Small delay between search attempts
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.log(`   ⚠️  Search failed for "${searchTerm}": ${error.message}`);
          continue;
        }
      }
      
      console.log(`   ❌ No products found for "${productName}" in ${storeName}`);
      return null;
      
    } catch (error) {
      console.error(`❌ Error searching ${storeName} for "${productName}":`, error.message);
      this.results.errors++;
      return null;
    }
  }

  // Google Images fallback when store scrapers fail
  async searchGoogleImages(productName, storeName) {
    try {
      console.log(`🔍 Google Images fallback for: "${productName}" (${storeName})`);
      
      const searchQuery = `${productName} ${storeName} site:${this.getStoreDomain(storeName)}`;
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

  // Find best matching product from search results
  findBestMatch(originalName, products) {
    if (!products || products.length === 0) return null;
    
    const originalLower = originalName.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;
    
    for (const product of products) {
      const productName = product.name || '';
      const productLower = productName.toLowerCase();
      
      // Calculate similarity score
      let score = 0;
      const originalWords = originalLower.split(' ');
      const productWords = productLower.split(' ');
      
      // Check for exact word matches
      for (const word of originalWords) {
        if (word.length > 2) { // Ignore short words
          if (productWords.some(pw => pw.includes(word) || word.includes(pw))) {
            score += 2;
          }
        }
      }
      
      // Check for partial matches
      if (productLower.includes(originalLower) || originalLower.includes(productLower)) {
        score += 1;
      }
      
      // Prefer products with images and prices
      if (product.image && product.price) {
        score += 1;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
    }
    
    // Only return if we have a reasonable match (at least 2 points)
    return bestScore >= 2 ? bestMatch : null;
  }

  // Cross-examine prices
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
      const productRef = db.collection('products').doc(productId);
      batch.update(productRef, {
        image: scrapedData.image,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Update store_products collection
      const storeProductsSnapshot = await db.collection('store_products')
        .where('productId', '==', productId)
        .where('storeName', '==', scrapedData.store)
        .get();
      
      storeProductsSnapshot.forEach(doc => {
        const storeProductRef = db.collection('store_products').doc(doc.id);
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
      console.log('🚀 Starting Product-Specific Scraper...');
      console.log('📋 Strategy: Use existing scrapers to search for specific product names');
      console.log('🎯 Focus: All stores with working scrapers');
      
      // Get all products from Firebase
      const productsSnapshot = await db.collection('products').get();
      const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      console.log(`📊 Found ${products.length} products in database`);
      
      // Get store products for price comparison
      const storeProductsSnapshot = await db.collection('store_products').get();
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
          if (!storeName || typeof storeName !== 'string') {
            console.log(`   ⏭️  Skipping invalid store name: ${storeName}`);
            continue;
          }
          
          // Skip Aldi as requested
          if (storeName === 'Aldi' || storeName.includes('Aldi')) {
            console.log(`   ⏭️  Skipping Aldi (already has everything)`);
            continue;
          }
          
          // For Iceland, process all products (not just frozen)
          // Note: Iceland sells both frozen and non-frozen products
          
          // Search for the product
          let scrapedData = await this.searchProductInStore(product.name, storeName);
          
          if (scrapedData && scrapedData.image && scrapedData.price) {
            // Found complete data from store scraper
            console.log(`   ✅ Found complete data from ${storeName} scraper`);
          } else if (scrapedData && scrapedData.price) {
            // Found price but no image, try Google Images fallback
            console.log(`   🔍 Found price but no image, trying Google Images fallback...`);
            const googleImage = await this.searchGoogleImages(product.name, storeName);
            
            if (googleImage) {
              scrapedData.image = googleImage;
              console.log(`   ✅ Updated with Google Images fallback`);
            } else {
              console.log(`   ❌ Could not find image for ${product.name} in ${storeName}`);
              this.results.notFound++;
              continue;
            }
          } else {
            console.log(`   ❌ Could not find complete data for ${product.name} in ${storeName}`);
            this.results.notFound++;
            continue;
          }
          
          // Process the found data
          if (scrapedData && scrapedData.image && scrapedData.price) {
            // Find current price in database
            const currentStoreProduct = associatedStores.find(sp => sp.storeName === storeName);
            const dbPrice = currentStoreProduct ? currentStoreProduct.price : null;
            
            // Cross-examine prices
            const priceDiff = this.crossExaminePrice(dbPrice, scrapedData.price, product.name, storeName);
            
            // Update Firebase
            await this.updateFirebase(product.id, scrapedData, dbPrice);
            
            // Show offer information
            if (scrapedData.offer) {
              console.log(`   🎯 OFFER DETECTED: ${scrapedData.offer}`);
            }
          }
          
          // Delay between searches
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // Final summary
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📊 PRODUCT-SPECIFIC SCRAPER FINAL SUMMARY`);
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

// Run the scraper
const scraper = new ProductSpecificScraper();
scraper.updateProducts().catch(console.error);
