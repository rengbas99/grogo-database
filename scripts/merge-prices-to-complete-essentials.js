/**
 * Merge Prices to Complete Essentials
 * Creates a duplicate of complete-essentials and merges scraped prices
 */

const fs = require('fs');

class PriceMerger {
  constructor() {
    this.completeEssentialsFile = 'data/essentials/complete-essentials-2025-09-19T16-55-28-560Z.json';
    this.aldiPricesFile = 'data/aldi-prices-2025-09-20.json';
    this.icelandPricesFile = 'data/iceland-prices-2025-09-20.json';
    this.outputFile = 'data/essentials/complete-essentials-with-prices-2025-09-20.json';
  }

  // Load complete essentials data
  loadCompleteEssentials() {
    try {
      const data = JSON.parse(fs.readFileSync(this.completeEssentialsFile, 'utf8'));
      console.log(`📦 Loaded complete essentials: ${data.products.length} products`);
      return data;
    } catch (error) {
      console.error('❌ Error loading complete essentials:', error.message);
      return null;
    }
  }

  // Load Aldi prices
  loadAldiPrices() {
    try {
      if (fs.existsSync(this.aldiPricesFile)) {
        const data = JSON.parse(fs.readFileSync(this.aldiPricesFile, 'utf8'));
        console.log(`🇩🇪 Loaded Aldi prices: ${data.products.length} products`);
        return data.products;
      } else {
        console.log('⚠️  Aldi prices file not found, skipping...');
        return [];
      }
    } catch (error) {
      console.error('❌ Error loading Aldi prices:', error.message);
      return [];
    }
  }

  // Load Iceland prices
  loadIcelandPrices() {
    try {
      if (fs.existsSync(this.icelandPricesFile)) {
        const data = JSON.parse(fs.readFileSync(this.icelandPricesFile, 'utf8'));
        console.log(`🇮🇸 Loaded Iceland prices: ${data.products.length} products`);
        return data.products;
      } else {
        console.log('⚠️  Iceland prices file not found, skipping...');
        return [];
      }
    } catch (error) {
      console.error('❌ Error loading Iceland prices:', error.message);
      return [];
    }
  }

  // Create price map for quick lookup
  createPriceMap(priceProducts) {
    const priceMap = new Map();
    
    priceProducts.forEach(product => {
      // Use productId as the key for matching
      if (product.productId) {
        priceMap.set(product.productId, {
          price: product.price || '',
          pricePerUnit: product.pricePerUnit || '',
          offer: product.offer || '',
          availability: product.availability || 'Available',
          description: product.description || '',
          priceScrapedAt: product.priceScrapedAt || new Date().toISOString()
        });
      }
    });

    return priceMap;
  }

  // Merge prices into products
  mergePrices(completeEssentials, aldiPrices, icelandPrices) {
    console.log('🔗 Merging prices into complete essentials...');

    // Create price maps
    const aldiPriceMap = this.createPriceMap(aldiPrices);
    const icelandPriceMap = this.createPriceMap(icelandPrices);

    // Update products with prices
    const updatedProducts = completeEssentials.products.map(product => {
      let priceData = null;

      if (product.store === 'Aldi') {
        priceData = aldiPriceMap.get(product.productId);
      } else if (product.store === 'Iceland') {
        priceData = icelandPriceMap.get(product.productId);
      }

      if (priceData) {
        return {
          ...product,
          price: priceData.price,
          pricePerUnit: priceData.pricePerUnit,
          offer: priceData.offer,
          availability: priceData.availability,
          description: priceData.description || product.description || '',
          priceScrapedAt: priceData.priceScrapedAt
        };
      } else {
        console.log(`⚠️  No price data found for: ${product.name} (${product.store})`);
        return product;
      }
    });

    return {
      ...completeEssentials,
      products: updatedProducts,
      priceMergeTimestamp: new Date().toISOString()
    };
  }

  // Save merged data
  async saveMergedData(mergedData) {
    await fs.promises.writeFile(this.outputFile, JSON.stringify(mergedData, null, 2));
    console.log(`✅ Saved merged data to: ${this.outputFile}`);
  }

  // Generate summary
  generateSummary(mergedData) {
    console.log('\n📊 PRICE MERGE SUMMARY');
    console.log('=' .repeat(60));
    
    const totalProducts = mergedData.products.length;
    const withPrices = mergedData.products.filter(p => p.price && p.price !== '');
    const withDescriptions = mergedData.products.filter(p => p.description && p.description !== '');
    
    console.log(`📦 Total Products: ${totalProducts}`);
    console.log(`💰 Products with Prices: ${withPrices.length} (${Math.round(withPrices.length/totalProducts*100)}%)`);
    console.log(`📝 Products with Descriptions: ${withDescriptions.length} (${Math.round(withDescriptions.length/totalProducts*100)}%)`);

    // Breakdown by store
    const icelandProducts = mergedData.products.filter(p => p.store === 'Iceland');
    const aldiProducts = mergedData.products.filter(p => p.store === 'Aldi');
    
    const icelandWithPrices = icelandProducts.filter(p => p.price && p.price !== '');
    const aldiWithPrices = aldiProducts.filter(p => p.price && p.price !== '');

    console.log(`\n🇮🇸 Iceland: ${icelandWithPrices.length}/${icelandProducts.length} with prices (${Math.round(icelandWithPrices.length/icelandProducts.length*100)}%)`);
    console.log(`🇩🇪 Aldi: ${aldiWithPrices.length}/${aldiProducts.length} with prices (${Math.round(aldiWithPrices.length/aldiProducts.length*100)}%)`);

    // Show sample products with prices
    console.log('\n📋 SAMPLE PRODUCTS WITH PRICES:');
    withPrices.slice(0, 10).forEach((product, i) => {
      console.log(`   ${i+1}. ${product.name} (${product.store}): ${product.price}`);
    });
  }

  // Main execution
  async run() {
    console.log('🚀 Starting Price Merge Process...');
    console.log('=' .repeat(60));

    try {
      // Load complete essentials data
      const completeEssentials = this.loadCompleteEssentials();
      if (!completeEssentials) {
        console.log('❌ Failed to load complete essentials');
        return;
      }

      // Load price data
      const aldiPrices = this.loadAldiPrices();
      const icelandPrices = this.loadIcelandPrices();

      if (aldiPrices.length === 0 && icelandPrices.length === 0) {
        console.log('❌ No price data found to merge');
        return;
      }

      // Merge prices
      const mergedData = this.mergePrices(completeEssentials, aldiPrices, icelandPrices);

      // Save merged data
      await this.saveMergedData(mergedData);

      // Generate summary
      this.generateSummary(mergedData);

      console.log('\n✅ Price merge completed successfully!');

    } catch (error) {
      console.error('❌ Error during merge:', error.message);
    }
  }
}

// Main execution
async function main() {
  const merger = new PriceMerger();
  await merger.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = PriceMerger;






