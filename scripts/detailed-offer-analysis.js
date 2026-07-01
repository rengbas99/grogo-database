#!/usr/bin/env node

/**
 * Detailed Offer Analysis
 * Show specific offer details for products with special offers
 */

const admin = require('firebase-admin');

class DetailedOfferAnalyzer {
  constructor() {
    this.db = null;
    this.offers = [];
    this.startTime = new Date();
  }

  async analyzeOffers() {
    try {
      console.log('🎯 Detailed Offer Analysis...');
      console.log('=' .repeat(60));

      // Initialize Firebase
      await this.initializeFirebase();

      // Get all stores
      const storesSnapshot = await this.db.collection('stores').get();
      console.log(`📊 Analyzing offers across ${storesSnapshot.size} stores`);

      // Process each store
      for (const storeDoc of storesSnapshot.docs) {
        const storeData = storeDoc.data();
        console.log(`\n🏪 Analyzing ${storeData.name}...`);
        await this.analyzeStoreOffers(storeDoc.id, storeData);
      }

      // Display detailed results
      this.displayDetailedResults();

    } catch (error) {
      console.error('❌ Error analyzing offers:', error);
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

  async analyzeStoreOffers(storeId, storeData) {
    // Get all categories for this store
    const categoriesSnapshot = await this.db.collection('stores').doc(storeId).collection('categories').get();
    
    for (const categoryDoc of categoriesSnapshot.docs) {
      await this.analyzeCategoryOffers(storeId, storeData.name, categoryDoc.id, categoryDoc.ref);
    }
  }

  async analyzeCategoryOffers(storeId, storeName, categoryName, categoryRef) {
    const productsSnapshot = await categoryRef.collection('products').get();
    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    for (const product of products) {
      const offerDetails = this.extractOfferDetails(product);
      if (offerDetails.hasOffer) {
        this.offers.push({
          store: storeName,
          storeId: storeId,
          category: categoryName,
          productId: product.id,
          productName: product.name,
          price: product.price,
          currency: product.currency || 'GBP',
          description: product.description || '',
          brand: product.brand || 'Unknown',
          offerDetails: offerDetails
        });
      }
    }
  }

  extractOfferDetails(product) {
    const name = (product.name || '').toLowerCase();
    const description = (typeof product.description === 'string' ? product.description : '').toLowerCase();
    const fullText = `${name} ${description}`;

    const offerPatterns = [
      {
        pattern: /(\d+)\s*for\s*£?(\d+(?:\.\d{2})?)/gi,
        type: 'multibuy',
        description: 'Multibuy offer'
      },
      {
        pattern: /(\d+)\s*for\s*(\d+(?:\.\d{2})?)\s*£/gi,
        type: 'multibuy',
        description: 'Multibuy offer'
      },
      {
        pattern: /buy\s*(\d+)\s*get\s*(\d+)\s*free/gi,
        type: 'bogof',
        description: 'Buy X Get Y Free'
      },
      {
        pattern: /(\d+)%\s*off/gi,
        type: 'percentage_discount',
        description: 'Percentage discount'
      },
      {
        pattern: /half\s*price/gi,
        type: 'half_price',
        description: 'Half price offer'
      },
      {
        pattern: /bogof/gi,
        type: 'bogof',
        description: 'Buy One Get One Free'
      },
      {
        pattern: /bogo/gi,
        type: 'bogof',
        description: 'Buy One Get One Free'
      },
      {
        pattern: /multibuy/gi,
        type: 'multibuy',
        description: 'Multibuy offer'
      },
      {
        pattern: /special\s*offer/gi,
        type: 'special_offer',
        description: 'Special offer'
      },
      {
        pattern: /deal/gi,
        type: 'deal',
        description: 'Special deal'
      },
      {
        pattern: /save\s*£?(\d+(?:\.\d{2})?)/gi,
        type: 'save_amount',
        description: 'Save amount offer'
      },
      {
        pattern: /reduced\s*to\s*£?(\d+(?:\.\d{2})?)/gi,
        type: 'reduced_price',
        description: 'Reduced price'
      },
      {
        pattern: /was\s*£?(\d+(?:\.\d{2})?)\s*now\s*£?(\d+(?:\.\d{2})?)/gi,
        type: 'was_now',
        description: 'Was/Now pricing'
      }
    ];

    const foundOffers = [];

    for (const offerPattern of offerPatterns) {
      const matches = fullText.match(offerPattern.pattern);
      if (matches) {
        matches.forEach(match => {
          foundOffers.push({
            type: offerPattern.type,
            description: offerPattern.description,
            match: match,
            details: this.parseOfferMatch(match, offerPattern.type)
          });
        });
      }
    }

    return {
      hasOffer: foundOffers.length > 0,
      offers: foundOffers,
      originalText: {
        name: product.name,
        description: product.description
      }
    };
  }

  parseOfferMatch(match, type) {
    switch (type) {
      case 'multibuy':
        const multibuyMatch = match.match(/(\d+)\s*for\s*£?(\d+(?:\.\d{2})?)/i);
        if (multibuyMatch) {
          return {
            quantity: parseInt(multibuyMatch[1]),
            price: parseFloat(multibuyMatch[2]),
            unitPrice: parseFloat(multibuyMatch[2]) / parseInt(multibuyMatch[1])
          };
        }
        break;
      
      case 'percentage_discount':
        const percentMatch = match.match(/(\d+)%\s*off/i);
        if (percentMatch) {
          return {
            discountPercent: parseInt(percentMatch[1])
          };
        }
        break;
      
      case 'save_amount':
        const saveMatch = match.match(/save\s*£?(\d+(?:\.\d{2})?)/i);
        if (saveMatch) {
          return {
            saveAmount: parseFloat(saveMatch[1])
          };
        }
        break;
      
      case 'was_now':
        const wasNowMatch = match.match(/was\s*£?(\d+(?:\.\d{2})?)\s*now\s*£?(\d+(?:\.\d{2})?)/i);
        if (wasNowMatch) {
          return {
            wasPrice: parseFloat(wasNowMatch[1]),
            nowPrice: parseFloat(wasNowMatch[2]),
            savings: parseFloat(wasNowMatch[1]) - parseFloat(wasNowMatch[2])
          };
        }
        break;
      
      default:
        return { raw: match };
    }
    return { raw: match };
  }

  displayDetailedResults() {
    const duration = (new Date() - this.startTime) / 1000;
    
    console.log('\n🎯 DETAILED OFFER ANALYSIS RESULTS');
    console.log('=' .repeat(60));
    console.log(`⏱️  Analysis Duration: ${duration.toFixed(1)} seconds`);
    console.log(`🎯 Total Products with Offers: ${this.offers.length}`);

    if (this.offers.length === 0) {
      console.log('\n❌ No special offers found in the database');
      return;
    }

    // Group offers by store
    const offersByStore = {};
    this.offers.forEach(offer => {
      if (!offersByStore[offer.store]) {
        offersByStore[offer.store] = [];
      }
      offersByStore[offer.store].push(offer);
    });

    console.log('\n📊 OFFERS BY STORE:');
    console.log('=' .repeat(40));

    Object.entries(offersByStore).forEach(([store, offers]) => {
      console.log(`\n🏪 ${store.toUpperCase()}`);
      console.log(`   Total Offers: ${offers.length}`);
      console.log('   ' + '─'.repeat(50));

      offers.forEach((offer, index) => {
        console.log(`\n   ${index + 1}. ${offer.productName}`);
        console.log(`      💰 Price: £${offer.price || 'N/A'} ${offer.currency}`);
        console.log(`      🏷️  Brand: ${offer.brand}`);
        console.log(`      📂 Category: ${offer.category}`);
        console.log(`      📝 Description: ${offer.description || 'No description'}`);
        
        console.log(`      🎯 OFFER DETAILS:`);
        offer.offerDetails.offers.forEach((offerDetail, offerIndex) => {
          console.log(`         ${offerIndex + 1}. ${offerDetail.description}: "${offerDetail.match}"`);
          
          if (offerDetail.details) {
            Object.entries(offerDetail.details).forEach(([key, value]) => {
              if (typeof value === 'number') {
                console.log(`            ${key}: ${value}`);
              } else {
                console.log(`            ${key}: ${value}`);
              }
            });
          }
        });
      });
    });

    // Summary by offer type
    console.log('\n📈 OFFER TYPE SUMMARY:');
    console.log('=' .repeat(40));
    
    const offerTypeCount = {};
    this.offers.forEach(offer => {
      offer.offerDetails.offers.forEach(offerDetail => {
        offerTypeCount[offerDetail.type] = (offerTypeCount[offerDetail.type] || 0) + 1;
      });
    });

    Object.entries(offerTypeCount).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} offers`);
    });

    // Look for specific Iceland offers
    const icelandOffers = this.offers.filter(offer => 
      offer.store.toLowerCase().includes('iceland')
    );

    if (icelandOffers.length > 0) {
      console.log('\n🛒 ICELAND SPECIFIC OFFERS:');
      console.log('=' .repeat(40));
      icelandOffers.forEach(offer => {
        console.log(`   • ${offer.productName} - £${offer.price}`);
        offer.offerDetails.offers.forEach(offerDetail => {
          console.log(`     ${offerDetail.description}: ${offerDetail.match}`);
        });
      });
    } else {
      console.log('\n❌ No Iceland-specific offers found');
    }
  }
}

// Main execution
async function main() {
  const analyzer = new DetailedOfferAnalyzer();
  await analyzer.analyzeOffers();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DetailedOfferAnalyzer;
