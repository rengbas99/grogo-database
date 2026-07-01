/**
 * Aldi Price Scraper using Apify API
 * Scrapes prices for Aldi products from complete-essentials dataset
 */

require('dotenv').config();
const { ApifyClient } = require('apify-client');
const fs = require('fs');

class AldiPriceScraper {
  constructor() {
    this.client = new ApifyClient({
      token: process.env.APIFY_TOKEN,
    });
    this.completeEssentialsFile = 'data/essentials/complete-essentials-2025-09-19T16-55-28-560Z.json';
    this.outputFile = 'data/aldi-prices-2025-09-20.json';
  }

  // Load complete essentials data
  loadCompleteEssentials() {
    try {
      const data = JSON.parse(fs.readFileSync(this.completeEssentialsFile, 'utf8'));
      console.log(`📦 Loaded complete essentials: ${data.products.length} products`);
      return data.products;
    } catch (error) {
      console.error('❌ Error loading complete essentials:', error.message);
      return [];
    }
  }

  // Extract Aldi products and build product URLs
  extractAldiProducts(products) {
    const aldiProducts = products.filter(p => p.store === 'Aldi');
    console.log(`🇩🇪 Found ${aldiProducts.length} Aldi products`);
    
    // Build product URLs from product IDs for UK Aldi
    const inputURL = aldiProducts.map(product => {
      const productId = product.productId;
      return {
        url: `https://www.aldi.co.uk/product/${productId}`
      };
    });

    return { aldiProducts, inputURL };
  }

  // Scrape prices using Apify API
  async scrapePrices(inputURL) {
    console.log('🚀 Starting Aldi price scraping with Apify API...');
    
    const input = {
      "inputURL": inputURL,
      "maxItem": 100,
      "maxRetries": 3,
      "postCode": "UB8 1ND"
    };

    try {
      console.log(`📡 Scraping ${inputURL.length} Aldi products...`);
      
      // Run the Actor
      const run = await this.client.actor("LSX9Qcw5kdKUV2o9O").call(input);
      console.log(`✅ Apify run completed: ${run.id}`);

      // Fetch results
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
      console.log(`📊 Retrieved ${items.length} items from Apify`);

      return items;
    } catch (error) {
      console.error('❌ Error scraping prices:', error.message);
      return [];
    }
  }

  // Match scraped prices with original products
  matchPricesWithProducts(aldiProducts, scrapedData) {
    console.log('🔗 Matching scraped prices with original products...');
    
    const priceMap = new Map();
    
    // Create a map of product SKUs to prices
    scrapedData.forEach(item => {
      if (item.data && item.data.sku) {
        const productData = item.data;
        priceMap.set(productData.sku, {
          price: productData.price?.amountRelevantDisplay || '',
          availability: productData.notForSale ? 'Out of Stock' : 'Available',
          offer: productData.price?.wasPriceDisplay || '',
          pricePerUnit: productData.price?.comparisonDisplay || '',
          description: productData.description || productData.storageInstructions || '',
          brand: productData.brandName || '',
          images: productData.assets?.[0]?.url || '',
          category: productData.categories?.[0]?.name || '',
          sellingSize: productData.sellingSize || '',
          ingredients: productData.ingredients || '',
          allergens: productData.allergens || []
        });
      }
    });

    // Update products with prices
    const updatedProducts = aldiProducts.map(product => {
      // Extract SKU from productId (last part after the last dash)
      const sku = product.productId.split('-').pop();
      const priceData = priceMap.get(sku);
      
      if (priceData) {
        return {
          ...product,
          price: priceData.price,
          availability: priceData.availability,
          offer: priceData.offer,
          pricePerUnit: priceData.pricePerUnit,
          description: priceData.description || product.description || '',
          brand: priceData.brand || product.brand || '',
          image: priceData.images || product.image || '',
          category: priceData.category || product.category || '',
          sellingSize: priceData.sellingSize || '',
          ingredients: priceData.ingredients || product.ingredients || '',
          allergens: priceData.allergens || product.allergens || [],
          priceScrapedAt: new Date().toISOString()
        };
      } else {
        console.log(`⚠️  No price found for: ${product.name} (SKU: ${sku})`);
        return product;
      }
    });

    return updatedProducts;
  }

  // Save results
  async saveResults(updatedProducts) {
    const results = {
      timestamp: new Date().toISOString(),
      totalProducts: updatedProducts.length,
      productsWithPrices: updatedProducts.filter(p => p.price && p.price !== '').length,
      products: updatedProducts
    };

    await fs.promises.writeFile(this.outputFile, JSON.stringify(results, null, 2));
    console.log(`✅ Saved results to: ${this.outputFile}`);
    
    return results;
  }

  // Generate summary
  generateSummary(results) {
    console.log('\n📊 ALDI PRICE SCRAPING SUMMARY');
    console.log('=' .repeat(60));
    console.log(`📦 Total Products: ${results.totalProducts}`);
    console.log(`💰 Products with Prices: ${results.productsWithPrices} (${Math.round(results.productsWithPrices/results.totalProducts*100)}%)`);
    
    // Show sample products with prices
    const withPrices = results.products.filter(p => p.price && p.price !== '');
    console.log('\n📋 SAMPLE PRODUCTS WITH PRICES:');
    withPrices.slice(0, 5).forEach((product, i) => {
      console.log(`   ${i+1}. ${product.name}: ${product.price}`);
    });
  }

  // Main execution
  async run() {
    console.log('🚀 Starting Aldi Price Scraping...');
    console.log('=' .repeat(60));

    try {
      // Load complete essentials data
      const allProducts = this.loadCompleteEssentials();
      if (allProducts.length === 0) {
        console.log('❌ No products found in source file');
        return;
      }

      // Extract Aldi products
      const { aldiProducts, inputURL } = this.extractAldiProducts(allProducts);
      if (aldiProducts.length === 0) {
        console.log('❌ No Aldi products found');
        return;
      }

      // Scrape prices
      const scrapedData = await this.scrapePrices(inputURL);
      if (scrapedData.length === 0) {
        console.log('❌ No price data scraped');
        return;
      }

      // Match prices with products
      const updatedProducts = this.matchPricesWithProducts(aldiProducts, scrapedData);

      // Save results
      const results = await this.saveResults(updatedProducts);

      // Generate summary
      this.generateSummary(results);

      console.log('\n✅ Aldi price scraping completed successfully!');

    } catch (error) {
      console.error('❌ Error during scraping:', error.message);
    }
  }
}

// Main execution
async function main() {
  const scraper = new AldiPriceScraper();
  await scraper.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = AldiPriceScraper;
