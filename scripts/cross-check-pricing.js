/**
 * Cross Check Pricing - Verify and compare prices across different sources
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

class PriceCrossChecker {
  constructor() {
    this.results = {
      checked: 0,
      priceDifferences: 0,
      offersFound: 0,
      errors: 0,
      priceDiscrepancies: []
    };
  }

  // Get store-specific search URLs
  getStoreSearchUrl(productName, storeName) {
    const storeUrls = {
      'Iceland': `https://www.iceland.co.uk/search?q=${encodeURIComponent(productName)}`,
      'Lidl': `https://www.lidl.co.uk/search?query=${encodeURIComponent(productName)}`,
      'Aldi': `https://www.aldi.co.uk/search?query=${encodeURIComponent(productName)}`,
      'Tesco': `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(productName)}`,
      'Sainsburys': `https://www.sainsburys.co.uk/gol-ui/groceries/search?searchTerm=${encodeURIComponent(productName)}`
    };
    return storeUrls[storeName] || null;
  }

  // Scrape price from store website
  async scrapeStorePrice(productName, storeName) {
    try {
      const searchUrl = this.getStoreSearchUrl(productName, storeName);
      if (!searchUrl) return null;

      console.log(`   🔍 Scraping ${storeName}: ${searchUrl}`);

      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      let price = null;
      let offer = null;

      // Iceland specific selectors
      if (storeName === 'Iceland') {
        $('.product-tile .price, .product-item .price, .price').each((i, el) => {
          const priceText = $(el).text().trim();
          const priceMatch = priceText.match(/£(\d+\.?\d*)/);
          if (priceMatch && !price) {
            price = parseFloat(priceMatch[1]);
          }
        });
        
        // Look for offers (red boxes)
        $('.offer, .promotion, .deal, .special').each((i, el) => {
          const offerText = $(el).text().trim();
          if (offerText.includes('for') || offerText.includes('off') || offerText.includes('%')) {
            offer = offerText;
          }
        });
      }
      
      // Lidl specific selectors
      else if (storeName === 'Lidl') {
        $('.price, .product-price, .current-price').each((i, el) => {
          const priceText = $(el).text().trim();
          const priceMatch = priceText.match(/£(\d+\.?\d*)/);
          if (priceMatch && !price) {
            price = parseFloat(priceMatch[1]);
          }
        });
      }
      
      // Aldi specific selectors
      else if (storeName === 'Aldi') {
        $('.price, .product-price, .current-price').each((i, el) => {
          const priceText = $(el).text().trim();
          const priceMatch = priceText.match(/£(\d+\.?\d*)/);
          if (priceMatch && !price) {
            price = parseFloat(priceMatch[1]);
          }
        });
      }
      
      // Tesco specific selectors
      else if (storeName === 'Tesco') {
        $('.price, .product-price, .current-price').each((i, el) => {
          const priceText = $(el).text().trim();
          const priceMatch = priceText.match(/£(\d+\.?\d*)/);
          if (priceMatch && !price) {
            price = parseFloat(priceMatch[1]);
          }
        });
      }

      return { price, offer };
    } catch (error) {
      console.log(`   ❌ Error scraping ${storeName}: ${error.message}`);
      return null;
    }
  }

  // Check for price differences
  checkPriceDifference(dbPrice, scrapedPrice, threshold = 0.05) {
    if (!dbPrice || !scrapedPrice) return false;
    const difference = Math.abs(dbPrice - scrapedPrice);
    const percentageDiff = difference / dbPrice;
    return percentageDiff > threshold;
  }

  // Cross check pricing for a product
  async crossCheckProduct(product, storeProducts) {
    console.log(`\n🔄 Cross-checking: ${product.name}`);
    
    const productResults = {
      productName: product.name,
      dbPrices: {},
      scrapedPrices: {},
      differences: [],
      offers: []
    };

    // Get database prices for each store
    storeProducts.forEach(sp => {
      if (sp.price) {
        productResults.dbPrices[sp.storeName] = sp.price;
      }
    });

    console.log(`   📊 DB Prices: ${JSON.stringify(productResults.dbPrices)}`);

    // Scrape current prices from each store
    const storeNames = [...new Set(storeProducts.map(sp => sp.storeName))];
    
    for (const storeName of storeNames) {
      if (!storeName) continue;
      
      const scraped = await this.scrapeStorePrice(product.name, storeName);
      if (scraped) {
        productResults.scrapedPrices[storeName] = scraped.price;
        if (scraped.offer) {
          productResults.offers.push(`${storeName}: ${scraped.offer}`);
          this.results.offersFound++;
        }
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`   🌐 Scraped Prices: ${JSON.stringify(productResults.scrapedPrices)}`);

    // Compare prices
    for (const storeName of storeNames) {
      const dbPrice = productResults.dbPrices[storeName];
      const scrapedPrice = productResults.scrapedPrices[storeName];
      
      if (dbPrice && scrapedPrice) {
        const hasDifference = this.checkPriceDifference(dbPrice, scrapedPrice);
        
        if (hasDifference) {
          const difference = Math.abs(dbPrice - scrapedPrice);
          const percentageDiff = ((difference / dbPrice) * 100).toFixed(1);
          
          productResults.differences.push({
            store: storeName,
            dbPrice: dbPrice,
            scrapedPrice: scrapedPrice,
            difference: difference,
            percentageDiff: percentageDiff
          });
          
          this.results.priceDifferences++;
          
          console.log(`   ⚠️  PRICE DIFFERENCE in ${storeName}:`);
          console.log(`      DB: £${dbPrice} | Scraped: £${scrapedPrice} | Diff: £${difference.toFixed(2)} (${percentageDiff}%)`);
        } else {
          console.log(`   ✅ Price match in ${storeName}: £${dbPrice}`);
        }
      } else if (dbPrice && !scrapedPrice) {
        console.log(`   ❌ Could not scrape price for ${storeName} (DB has: £${dbPrice})`);
      } else if (!dbPrice && scrapedPrice) {
        console.log(`   ℹ️  Found price for ${storeName}: £${scrapedPrice} (not in DB)`);
      }
    }

    if (productResults.differences.length > 0 || productResults.offers.length > 0) {
      this.results.priceDiscrepancies.push(productResults);
    }

    this.results.checked++;
  }

  // Run cross-check on sample products
  async runCrossCheck() {
    try {
      console.log('💰 Starting price cross-check...\n');
      
      // Get sample products with their store products
      const productsSnapshot = await db.collection('products').limit(20).get();
      const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      console.log(`📊 Cross-checking ${products.length} sample products...\n`);
      
      for (const product of products) {
        // Get store products for this product
        const storeProductsSnapshot = await db.collection('store_products')
          .where('productId', '==', product.id)
          .get();
        
        const storeProducts = storeProductsSnapshot.docs.map(doc => doc.data());
        
        if (storeProducts.length > 0) {
          await this.crossCheckProduct(product, storeProducts);
        } else {
          console.log(`\n⏭️  Skipping ${product.name} - no store products found`);
        }
        
        // Delay between products
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Final summary
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 PRICE CROSS-CHECK SUMMARY`);
      console.log(`${'='.repeat(60)}`);
      console.log(`✅ Products checked: ${this.results.checked}`);
      console.log(`⚠️  Price differences found: ${this.results.priceDifferences}`);
      console.log(`🎁 Offers found: ${this.results.offersFound}`);
      console.log(`❌ Errors: ${this.results.errors}`);
      
      if (this.results.priceDiscrepancies.length > 0) {
        console.log(`\n🔍 DETAILED DISCREPANCIES:`);
        this.results.priceDiscrepancies.forEach((discrepancy, index) => {
          console.log(`\n${index + 1}. ${discrepancy.productName}`);
          if (discrepancy.differences.length > 0) {
            console.log(`   Price Differences:`);
            discrepancy.differences.forEach(diff => {
              console.log(`     ${diff.store}: DB £${diff.dbPrice} vs Scraped £${diff.scrapedPrice} (${diff.percentageDiff}% diff)`);
            });
          }
          if (discrepancy.offers.length > 0) {
            console.log(`   Offers Found:`);
            discrepancy.offers.forEach(offer => {
              console.log(`     ${offer}`);
            });
          }
        });
      }
      
      return this.results;
      
    } catch (error) {
      console.error('❌ Cross-check failed:', error);
      return this.results;
    }
  }
}

// Run the cross-check
const checker = new PriceCrossChecker();
checker.runCrossCheck().catch(console.error);
