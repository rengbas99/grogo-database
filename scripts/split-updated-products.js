/**
 * Split Updated Products with Prices
 * Splits the complete-essentials-with-prices into Iceland and Aldi folders
 * Overwrites existing files in the products folders
 */

const fs = require('fs');
const path = require('path');

class UpdatedProductsSplitter {
  constructor() {
    this.sourceFile = 'data/essentials/complete-essentials-with-prices-2025-09-20.json';
    this.icelandDir = 'data/products/Iceland Products';
    this.aldiDir = 'data/products/Aldi Products';
  }

  // Load the updated complete essentials data
  loadUpdatedData() {
    try {
      const data = JSON.parse(fs.readFileSync(this.sourceFile, 'utf8'));
      console.log(`📦 Loaded updated complete essentials: ${data.products.length} products`);
      return data.products;
    } catch (error) {
      console.error('❌ Error loading updated data:', error.message);
      return [];
    }
  }

  // Categorize products based on search terms and product names
  categorizeProduct(product) {
    const name = product.name.toLowerCase();
    const searchTerm = product.searchTerm ? product.searchTerm.toLowerCase() : '';

    // Cooking Essentials
    if (searchTerm.includes('oil') || searchTerm.includes('salt') || searchTerm.includes('pepper') ||
        searchTerm.includes('garlic') || searchTerm.includes('onion') || searchTerm.includes('tomato') ||
        searchTerm.includes('herbs') || searchTerm.includes('spices') || searchTerm.includes('rice') ||
        name.includes('oil') || name.includes('salt') || name.includes('pepper')) {
      return 'Cooking Essentials';
    }

    // Staples
    if (searchTerm.includes('bread') || searchTerm.includes('pasta') || searchTerm.includes('rice') ||
        searchTerm.includes('flour') || searchTerm.includes('sugar') || searchTerm.includes('cereal') ||
        name.includes('bread') || name.includes('pasta') || name.includes('rice')) {
      return 'Staples';
    }

    // Dairy/Protein
    if (searchTerm.includes('milk') || searchTerm.includes('cheese') || searchTerm.includes('eggs') ||
        searchTerm.includes('yogurt') || searchTerm.includes('butter') || searchTerm.includes('chicken') ||
        searchTerm.includes('beef') || searchTerm.includes('pork') || searchTerm.includes('fish') ||
        name.includes('milk') || name.includes('cheese') || name.includes('eggs')) {
      return 'Dairy/Protein';
    }

    // Snacks
    if (searchTerm.includes('crisp') || searchTerm.includes('biscuit') || searchTerm.includes('chocolate') ||
        searchTerm.includes('snack') || searchTerm.includes('cracker') || searchTerm.includes('nuts') ||
        name.includes('crisp') || name.includes('biscuit') || name.includes('chocolate')) {
      return 'Snacks';
    }

    // Fruits
    if (searchTerm.includes('apple') || searchTerm.includes('banana') || searchTerm.includes('orange') ||
        searchTerm.includes('grape') || searchTerm.includes('berry') || searchTerm.includes('fruit') ||
        name.includes('apple') || name.includes('banana') || name.includes('orange')) {
      return 'Fruits';
    }

    // Vegetables
    if (searchTerm.includes('tomato') || searchTerm.includes('onion') || searchTerm.includes('carrot') ||
        searchTerm.includes('potato') || searchTerm.includes('vegetable') || searchTerm.includes('lettuce') ||
        name.includes('tomato') || name.includes('onion') || name.includes('carrot')) {
      return 'Vegetables';
    }

    // Household Essentials
    if (searchTerm.includes('toilet') || searchTerm.includes('cleaning') || searchTerm.includes('soap') ||
        searchTerm.includes('shampoo') || searchTerm.includes('tissue') || searchTerm.includes('detergent') ||
        name.includes('toilet') || name.includes('cleaning') || name.includes('soap')) {
      return 'Household Essentials';
    }

    // Sanitary & Personal Care
    if (searchTerm.includes('sanitary') || searchTerm.includes('tampon') || searchTerm.includes('pad') ||
        searchTerm.includes('deodorant') || searchTerm.includes('toothpaste') || searchTerm.includes('shower') ||
        name.includes('sanitary') || name.includes('tampon') || name.includes('pad')) {
      return 'Sanitary & Personal Care';
    }

    // Frozen Foods
    if (searchTerm.includes('frozen') || searchTerm.includes('ice') || searchTerm.includes('freezer') ||
        name.includes('frozen') || name.includes('ice')) {
      return 'Frozen Foods';
    }

    // Beverages
    if (searchTerm.includes('drink') || searchTerm.includes('juice') || searchTerm.includes('water') ||
        searchTerm.includes('soda') || searchTerm.includes('tea') || searchTerm.includes('coffee') ||
        name.includes('drink') || name.includes('juice') || name.includes('water')) {
      return 'Beverages';
    }

    // Default category
    return 'Other';
  }

  // Separate products by store and categorize
  separateAndCategorize(products) {
    const icelandProducts = products.filter(p => p.store === 'Iceland');
    const aldiProducts = products.filter(p => p.store === 'Aldi');

    console.log(`🇮🇸 Iceland products: ${icelandProducts.length}`);
    console.log(`🇩🇪 Aldi products: ${aldiProducts.length}`);

    // Categorize Iceland products
    const icelandCategorized = this.categorizeProducts(icelandProducts, 'Iceland');
    
    // Categorize Aldi products
    const aldiCategorized = this.categorizeProducts(aldiProducts, 'Aldi');

    return { icelandCategorized, aldiCategorized };
  }

  // Categorize products for a specific store
  categorizeProducts(products, store) {
    const categorized = {};
    
    products.forEach(product => {
      const category = this.categorizeProduct(product);
      
      if (!categorized[category]) {
        categorized[category] = [];
      }
      
      categorized[category].push(product);
    });

    // Add metadata
    const result = {
      timestamp: new Date().toISOString(),
      store: store,
      totalProducts: products.length,
      categories: {},
      products: products,
      categorizedProducts: categorized
    };

    // Add category statistics
    Object.keys(categorized).forEach(category => {
      result.categories[category] = {
        count: categorized[category].length,
        products: categorized[category].map(p => ({
          name: p.name,
          price: p.price,
          brand: p.brand,
          image: p.image ? '✅' : '❌',
          imageSource: p.image ? this.getImageSource(p.image) : 'N/A'
        }))
      };
    });

    return result;
  }

  // Get image source type
  getImageSource(imageUrl) {
    if (imageUrl.includes('assets.iceland.co.uk')) return 'Iceland CDN';
    if (imageUrl.includes('dm.emea.cms.aldi.cx')) return 'Aldi CDN';
    if (imageUrl.includes('openfoodfacts')) return 'OpenFoodFacts';
    if (imageUrl.includes('unsplash')) return 'Unsplash';
    return 'Other';
  }

  // Delete existing files in the directories
  async clearExistingFiles() {
    try {
      // Clear Iceland directory
      const icelandFiles = fs.readdirSync(this.icelandDir);
      for (const file of icelandFiles) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.icelandDir, file));
          console.log(`🗑️  Deleted: ${file}`);
        }
      }

      // Clear Aldi directory
      const aldiFiles = fs.readdirSync(this.aldiDir);
      for (const file of aldiFiles) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.aldiDir, file));
          console.log(`🗑️  Deleted: ${file}`);
        }
      }

      console.log('✅ Existing files cleared');
    } catch (error) {
      console.error('❌ Error clearing existing files:', error.message);
    }
  }

  // Save categorized data to files
  async saveCategorizedData(icelandData, aldiData) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save Iceland data
    const icelandFile = path.join(this.icelandDir, `iceland-products-${timestamp}.json`);
    await fs.promises.writeFile(icelandFile, JSON.stringify(icelandData, null, 2));
    console.log(`✅ Saved Iceland data: ${icelandFile}`);

    // Save Aldi data
    const aldiFile = path.join(this.aldiDir, `aldi-products-${timestamp}.json`);
    await fs.promises.writeFile(aldiFile, JSON.stringify(aldiData, null, 2));
    console.log(`✅ Saved Aldi data: ${aldiFile}`);

    // Overwrite the main files
    const icelandMainFile = path.join(this.icelandDir, 'iceland-products.json');
    const aldiMainFile = path.join(this.aldiDir, 'aldi-products.json');
    
    await fs.promises.writeFile(icelandMainFile, JSON.stringify(icelandData, null, 2));
    await fs.promises.writeFile(aldiMainFile, JSON.stringify(aldiData, null, 2));
    
    console.log(`✅ Overwritten main files:`);
    console.log(`   Iceland: ${icelandMainFile}`);
    console.log(`   Aldi: ${aldiMainFile}`);

    return { icelandFile, aldiFile, icelandMainFile, aldiMainFile };
  }

  // Generate summary
  generateSummary(icelandData, aldiData) {
    console.log('\n📊 UPDATED PRODUCTS SPLIT SUMMARY');
    console.log('=' .repeat(60));
    
    console.log('\n🇮🇸 ICELAND CATEGORIES:');
    Object.entries(icelandData.categories).forEach(([category, data]) => {
      console.log(`   ${category}: ${data.count} products`);
    });

    console.log('\n🇩🇪 ALDI CATEGORIES:');
    Object.entries(aldiData.categories).forEach(([category, data]) => {
      console.log(`   ${category}: ${data.count} products`);
    });

    console.log('\n📈 DATA QUALITY:');
    const icelandWithImages = icelandData.products.filter(p => p.image && p.image.includes('assets.'));
    const aldiWithImages = aldiData.products.filter(p => p.image && p.image.includes('assets.'));
    const icelandWithPrices = icelandData.products.filter(p => p.price && p.price !== '');
    const aldiWithPrices = aldiData.products.filter(p => p.price && p.price !== '');

    console.log(`   Iceland with CDN images: ${icelandWithImages.length}/${icelandData.products.length} (${Math.round(icelandWithImages.length/icelandData.products.length*100)}%)`);
    console.log(`   Aldi with CDN images: ${aldiWithImages.length}/${aldiData.products.length} (${Math.round(aldiWithImages.length/aldiData.products.length*100)}%)`);
    console.log(`   Iceland with prices: ${icelandWithPrices.length}/${icelandData.products.length} (${Math.round(icelandWithPrices.length/icelandData.products.length*100)}%)`);
    console.log(`   Aldi with prices: ${aldiWithPrices.length}/${aldiData.products.length} (${Math.round(aldiWithPrices.length/aldiData.products.length*100)}%)`);

    // Show sample products
    console.log('\n📋 SAMPLE ICELAND PRODUCTS:');
    icelandData.products.slice(0, 3).forEach((product, i) => {
      console.log(`   ${i+1}. ${product.name}`);
      console.log(`      Price: ${product.price || 'N/A'} | Image: ${product.image ? '✅' : '❌'}`);
    });

    console.log('\n📋 SAMPLE ALDI PRODUCTS:');
    aldiData.products.slice(0, 3).forEach((product, i) => {
      console.log(`   ${i+1}. ${product.name}`);
      console.log(`      Price: ${product.price || 'N/A'} | Image: ${product.image ? '✅' : '❌'}`);
    });
  }

  // Main execution
  async run() {
    console.log('🚀 Starting Updated Products Split...');
    console.log('=' .repeat(60));

    try {
      // Load updated data
      const products = this.loadUpdatedData();
      if (products.length === 0) {
        console.log('❌ No products found in source file');
        return;
      }

      // Clear existing files
      await this.clearExistingFiles();

      // Separate and categorize
      const { icelandCategorized, aldiCategorized } = this.separateAndCategorize(products);

      // Save categorized data
      const files = await this.saveCategorizedData(icelandCategorized, aldiCategorized);

      // Generate summary
      this.generateSummary(icelandCategorized, aldiCategorized);

      console.log('\n✅ Updated products split and categorization completed successfully!');

    } catch (error) {
      console.error('❌ Error during split:', error.message);
    }
  }
}

// Main execution
async function main() {
  const splitter = new UpdatedProductsSplitter();
  await splitter.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = UpdatedProductsSplitter;






