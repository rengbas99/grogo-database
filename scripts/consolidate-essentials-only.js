/**
 * Consolidate Essentials Only
 * Filters and consolidates only the essential scraper outputs, removing test/mock data
 */

const admin = require('firebase-admin');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

// Store categories based on your descriptions
const STORE_CATEGORIES = {
  'Tesco': {
    'Vegetables & Fruit': ['apple', 'banana', 'carrot', 'potato', 'onion', 'tomato', 'lettuce', 'cucumber', 'pepper', 'avocado', 'strawberry', 'blueberry'],
    'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'eggs'],
    'Meat & Poultry': ['chicken', 'beef', 'pork', 'lamb', 'sausage', 'bacon', 'mince'],
    'Bakery Items': ['bread', 'roll', 'pastry', 'cake', 'cookie', 'baguette', 'sourdough', 'croissant'],
    'Breakfast Items': ['cereal', 'porridge', 'granola', 'oats', 'muesli'],
    'Spices & World Foods': ['spice', 'herb', 'sauce', 'paste', 'curry', 'pasta sauce'],
    'Frozen Food Products': ['frozen', 'pizza', 'ice cream', 'ready meal'],
    'Essentials': ['toilet paper', 'cleaning', 'laundry', 'soap', 'shampoo', 'toothpaste', 'deodorant'],
    'Snacks & Beverages': ['chocolate', 'biscuit', 'crisp', 'nut', 'sweet', 'juice', 'water', 'coffee', 'tea']
  },
  'Sainsburys': {
    'Vegetables & Fruit': ['apple', 'banana', 'carrot', 'potato', 'onion', 'tomato', 'lettuce', 'cucumber', 'pepper', 'avocado', 'strawberry', 'blueberry'],
    'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'eggs'],
    'Meat & Poultry': ['chicken', 'beef', 'pork', 'lamb', 'sausage', 'bacon', 'mince'],
    'Bakery Items': ['bread', 'roll', 'pastry', 'cake', 'cookie', 'baguette', 'sourdough', 'croissant'],
    'Breakfast Items': ['cereal', 'porridge', 'granola', 'oats', 'muesli'],
    'Spices & World Foods': ['spice', 'herb', 'sauce', 'paste', 'curry', 'pasta sauce'],
    'Frozen Food Products': ['frozen', 'pizza', 'ice cream', 'ready meal'],
    'Essentials': ['toilet paper', 'cleaning', 'laundry', 'soap', 'shampoo', 'toothpaste', 'deodorant'],
    'Snacks & Beverages': ['chocolate', 'biscuit', 'crisp', 'nut', 'sweet', 'juice', 'water', 'coffee', 'tea']
  },
  'Lidl': {
    'Vegetables & Fruit': ['apple', 'banana', 'carrot', 'potato', 'onion', 'tomato', 'lettuce', 'cucumber', 'pepper', 'avocado', 'strawberry', 'blueberry'],
    'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'eggs'],
    'Meat & Poultry': ['chicken', 'beef', 'pork', 'lamb', 'sausage', 'bacon', 'mince'],
    'Bakery Items': ['bread', 'roll', 'pastry', 'cake', 'cookie', 'baguette', 'sourdough', 'croissant'],
    'Breakfast Items': ['cereal', 'porridge', 'granola', 'oats', 'muesli'],
    'Spices & World Foods': ['spice', 'herb', 'sauce', 'paste', 'curry', 'pasta sauce'],
    'Frozen Food Products': ['frozen', 'pizza', 'ice cream', 'ready meal'],
    'Essentials': ['toilet paper', 'cleaning', 'laundry', 'soap', 'shampoo', 'toothpaste', 'deodorant'],
    'Snacks & Beverages': ['chocolate', 'biscuit', 'crisp', 'nut', 'sweet', 'juice', 'water', 'coffee', 'tea']
  },
  'Aldi': {
    'Vegetables & Fruit': ['apple', 'banana', 'carrot', 'potato', 'onion', 'tomato', 'lettuce', 'cucumber', 'pepper', 'avocado', 'strawberry', 'blueberry'],
    'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'eggs'],
    'Meat & Poultry': ['chicken', 'beef', 'pork', 'lamb', 'sausage', 'bacon', 'mince'],
    'Bakery Items': ['bread', 'roll', 'pastry', 'cake', 'cookie', 'baguette', 'sourdough', 'croissant'],
    'Breakfast Items': ['cereal', 'porridge', 'granola', 'oats', 'muesli'],
    'Spices & World Foods': ['spice', 'herb', 'sauce', 'paste', 'curry', 'pasta sauce'],
    'Frozen Food Products': ['frozen', 'pizza', 'ice cream', 'ready meal'],
    'Essentials': ['toilet paper', 'cleaning', 'laundry', 'soap', 'shampoo', 'toothpaste', 'deodorant'],
    'Snacks & Beverages': ['chocolate', 'biscuit', 'crisp', 'nut', 'sweet', 'juice', 'water', 'coffee', 'tea']
  },
  'Iceland': {
    'Frozen Food Products': ['frozen', 'pizza', 'ice cream', 'ready meal', 'frozen vegetable', 'frozen fruit', 'frozen meat', 'frozen fish'],
    'Vegetables & Fruit': ['apple', 'banana', 'carrot', 'potato', 'onion', 'tomato', 'lettuce', 'cucumber', 'pepper', 'avocado', 'strawberry', 'blueberry'],
    'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'eggs'],
    'Meat & Poultry': ['chicken', 'beef', 'pork', 'lamb', 'sausage', 'bacon', 'mince'],
    'Bakery Items': ['bread', 'roll', 'pastry', 'cake', 'cookie', 'baguette', 'sourdough', 'croissant'],
    'Breakfast Items': ['cereal', 'porridge', 'granola', 'oats', 'muesli'],
    'Spices & World Foods': ['spice', 'herb', 'sauce', 'paste', 'curry', 'pasta sauce'],
    'Essentials': ['toilet paper', 'cleaning', 'laundry', 'soap', 'shampoo', 'toothpaste', 'deodorant'],
    'Snacks & Beverages': ['chocolate', 'biscuit', 'crisp', 'nut', 'sweet', 'juice', 'water', 'coffee', 'tea']
  }
};

class EssentialsConsolidator {
  constructor() {
    this.essentialProducts = [];
    this.categorizedProducts = {};
    this.dataQuality = {
      totalProducts: 0,
      productsWithImages: 0,
      productsWithDescriptions: 0,
      productsWithExpiry: 0,
      productsWithPrices: 0,
      productsWithCategories: 0
    };
  }

  async initializeFirebase() {
    try {
      if (admin.apps.length === 0) {
        const serviceAccount = require('../config/firebase-service-account.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      }
      console.log('✅ Firebase initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error.message);
      return false;
    }
  }

  isEssentialProduct(product) {
    // Check if product is from essential scraper
    if (product.isEssential === true) {
      return true;
    }
    
    // Check if product has essential search terms
    const essentialTerms = [
      'oil', 'salt', 'pepper', 'garlic', 'onion', 'tomato', 'herbs', 'spices',
      'bread', 'rice', 'pasta', 'cereal', 'flour', 'sugar',
      'milk', 'cheese', 'eggs', 'chicken', 'beef', 'pork', 'yogurt', 'butter',
      'chocolate', 'biscuits', 'crisps', 'nuts',
      'apple', 'banana', 'orange', 'grapes', 'strawberries',
      'toilet paper', 'cleaning', 'laundry', 'soap', 'shampoo',
      'sanitary pads', 'tampons', 'toothpaste', 'deodorant', 'conditioner'
    ];
    
    const productName = (product.name || '').toLowerCase();
    const searchTerm = (product.searchTerm || '').toLowerCase();
    
    return essentialTerms.some(term => 
      productName.includes(term) || searchTerm.includes(term)
    );
  }

  isMockProduct(product) {
    const name = (product.name || '').toLowerCase();
    const id = (product.id || '').toLowerCase();
    
    const mockIndicators = [
      'test', 'mock', 'sample', 'dummy', 'fake', 'example',
      'debug', 'trial', 'demo', 'placeholder'
    ];
    
    return mockIndicators.some(indicator => 
      name.includes(indicator) || id.includes(indicator)
    );
  }

  categorizeProduct(product) {
    const store = product.store || 'undefined';
    const productName = (product.name || '').toLowerCase();
    const searchTerm = (product.searchTerm || '').toLowerCase();
    
    // Get store categories
    const storeCategories = STORE_CATEGORIES[store] || STORE_CATEGORIES['Tesco'];
    
    // Find the best matching category
    let bestCategory = 'Uncategorized';
    let bestScore = 0;
    
    for (const [category, keywords] of Object.entries(storeCategories)) {
      let score = 0;
      
      // Check product name against keywords
      for (const keyword of keywords) {
        if (productName.includes(keyword)) {
          score += 2;
        }
      }
      
      // Check search term against keywords
      for (const keyword of keywords) {
        if (searchTerm.includes(keyword)) {
          score += 1;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }
    
    return {
      ...product,
      categorizedCategory: bestCategory,
      categoryScore: bestScore
    };
  }

  async loadFirebaseProducts() {
    console.log('🔥 Loading products from Firebase...');
    try {
      const db = admin.firestore();
      const productsSnapshot = await db.collection('products').get();
      
      if (productsSnapshot.empty) {
        console.log('❌ No products found in Firebase');
        return [];
      }
      
      const products = [];
      productsSnapshot.forEach(doc => {
        const product = doc.data();
        products.push({
          ...product,
          id: doc.id,
          source: 'firebase'
        });
      });
      
      console.log(`✅ Loaded ${products.length} products from Firebase`);
      return products;
    } catch (error) {
      console.error('❌ Error loading Firebase products:', error.message);
      return [];
    }
  }

  async loadLocalBackupProducts() {
    console.log('📁 Loading products from local backups...');
    const backupDir = path.join(__dirname, '../data/scraped-products');
    const files = fs.readdirSync(backupDir).filter(file => file.endsWith('.json'));
    
    let allBackupProducts = [];
    
    for (const file of files) {
      try {
        const filePath = path.join(backupDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        let products = [];
        if (Array.isArray(data)) {
          products = data;
        } else if (data.products && Array.isArray(data.products)) {
          products = data.products;
        } else if (data.essentials) {
          // Skip essentials file structure
          continue;
        }
        
        const enrichedProducts = products.map(product => ({
          ...product,
          source: 'local_backup',
          backupFile: file
        }));
        
        allBackupProducts.push(...enrichedProducts);
        console.log(`✅ Loaded ${enrichedProducts.length} products from ${file}`);
      } catch (error) {
        console.log(`❌ Error reading ${file}: ${error.message}`);
      }
    }
    
    console.log(`✅ Total backup products loaded: ${allBackupProducts.length}`);
    return allBackupProducts;
  }

  analyzeDataQuality(products) {
    this.dataQuality.totalProducts = products.length;
    
    products.forEach(product => {
      if (product.image || product.imageUrl || product.photo) this.dataQuality.productsWithImages++;
      if (product.description || product.desc) this.dataQuality.productsWithDescriptions++;
      if (product.expiry || product.expiryDate || product.bestBefore) this.dataQuality.productsWithExpiry++;
      if (product.price && product.price !== '') this.dataQuality.productsWithPrices++;
      if (product.category || product.categorizedCategory) this.dataQuality.productsWithCategories++;
    });
  }

  async consolidateEssentials() {
    console.log('🔍 Starting essentials consolidation...\n');
    
    // Initialize Firebase
    const firebaseReady = await this.initializeFirebase();
    if (!firebaseReady) {
      console.log('❌ Cannot proceed without Firebase');
      return;
    }
    
    // Load products from all sources
    const firebaseProducts = await this.loadFirebaseProducts();
    const backupProducts = await this.loadLocalBackupProducts();
    
    // Combine all products
    const allProducts = [...firebaseProducts, ...backupProducts];
    console.log(`\n📊 Total products loaded: ${allProducts.length}`);
    
    // Filter for essential products only
    console.log('\n🔍 Filtering for essential products...');
    const essentialProducts = allProducts.filter(product => 
      this.isEssentialProduct(product) && !this.isMockProduct(product)
    );
    
    console.log(`✅ Found ${essentialProducts.length} essential products`);
    console.log(`❌ Filtered out ${allProducts.length - essentialProducts.length} non-essential products`);
    
    // Categorize essential products
    console.log('\n🏷️  Categorizing essential products...');
    for (const product of essentialProducts) {
      const categorized = this.categorizeProduct(product);
      const store = categorized.store || 'undefined';
      
      if (!this.categorizedProducts[store]) {
        this.categorizedProducts[store] = {};
      }
      if (!this.categorizedProducts[store][categorized.categorizedCategory]) {
        this.categorizedProducts[store][categorized.categorizedCategory] = [];
      }
      this.categorizedProducts[store][categorized.categorizedCategory].push(categorized);
    }
    
    // Analyze data quality
    this.analyzeDataQuality(essentialProducts);
    
    // Generate reports
    await this.generateEssentialsReports(essentialProducts);
    
    return this.categorizedProducts;
  }

  async generateEssentialsReports(products) {
    console.log('\n📋 Generating essentials reports...');
    
    // Generate CSV
    await this.generateEssentialsCSV(products);
    
    // Generate detailed log
    await this.generateEssentialsLog(products);
    
    // Print summary
    this.printEssentialsSummary();
  }

  async generateEssentialsCSV(products) {
    console.log('📄 Generating essentials CSV...');
    
    const csvHeaders = [
      'ID', 'Name', 'Store', 'Category', 'Categorized Category', 'Price', 'Search Term',
      'Has Image', 'Has Description', 'Has Expiry', 'Has Price', 'Image URL', 'Description',
      'Expiry Date', 'Storage Info', 'Ingredients', 'Allergens', 'Nutrition Info',
      'Scraped At', 'Source', 'Backup File', 'Category Score', 'Is Essential'
    ];
    
    let csvContent = csvHeaders.join(',') + '\n';
    
    for (const product of products) {
      const row = [
        product.id || '',
        `"${(product.name || '').replace(/"/g, '""')}"`,
        product.store || '',
        product.category || '',
        product.categorizedCategory || '',
        product.price || '',
        product.searchTerm || '',
        product.image || product.imageUrl || product.photo ? 'Yes' : 'No',
        product.description || product.desc ? 'Yes' : 'No',
        product.expiry || product.expiryDate || product.bestBefore ? 'Yes' : 'No',
        product.price && product.price !== '' ? 'Yes' : 'No',
        product.image || product.imageUrl || '',
        `"${(product.description || product.desc || '').replace(/"/g, '""')}"`,
        product.expiry || product.expiryDate || product.bestBefore || '',
        product.storage || '',
        product.ingredients || '',
        product.allergens || '',
        product.nutrition ? JSON.stringify(product.nutrition).replace(/"/g, '""') : '',
        product.scrapedAt || '',
        product.source || '',
        product.backupFile || '',
        product.categoryScore || 0,
        product.isEssential ? 'Yes' : 'No'
      ];
      csvContent += row.join(',') + '\n';
    }
    
    const csvPath = path.join(__dirname, '../data/essentials-only-categorized.csv');
    await fsPromises.writeFile(csvPath, csvContent);
    console.log(`✅ Essentials CSV saved to: ${csvPath}`);
  }

  async generateEssentialsLog(products) {
    console.log('📝 Generating essentials log...');
    
    const logContent = {
      timestamp: new Date().toISOString(),
      summary: {
        totalEssentialProducts: products.length,
        dataQuality: this.dataQuality
      },
      storeBreakdown: {},
      categoryBreakdown: {},
      essentialsList: {
        'Cooking Essentials': ['oil', 'salt', 'pepper', 'garlic', 'onion', 'tomato', 'herbs', 'spices'],
        'Staples': ['bread', 'rice', 'pasta', 'cereal', 'flour', 'sugar'],
        'Dairy/Protein': ['milk', 'cheese', 'eggs', 'chicken', 'beef', 'pork', 'yogurt', 'butter'],
        'Snacks': ['chocolate', 'biscuits', 'crisps', 'nuts'],
        'Fruits': ['apple', 'banana', 'orange', 'grapes', 'strawberries'],
        'Household Essentials': ['toilet paper', 'cleaning', 'laundry', 'soap', 'shampoo'],
        'Sanitary & Personal Care': ['sanitary pads', 'tampons', 'toothpaste', 'deodorant', 'shampoo', 'conditioner']
      },
      categorizationDetails: {}
    };
    
    // Store breakdown
    for (const [store, categories] of Object.entries(this.categorizedProducts)) {
      logContent.storeBreakdown[store] = {};
      let storeTotal = 0;
      
      for (const [category, products] of Object.entries(categories)) {
        logContent.storeBreakdown[store][category] = products.length;
        storeTotal += products.length;
        
        if (!logContent.categoryBreakdown[category]) {
          logContent.categoryBreakdown[category] = 0;
        }
        logContent.categoryBreakdown[category] += products.length;
      }
      
      logContent.storeBreakdown[store].total = storeTotal;
    }
    
    // Categorization details
    for (const [store, categories] of Object.entries(this.categorizedProducts)) {
      logContent.categorizationDetails[store] = {};
      for (const [category, products] of Object.entries(categories)) {
        logContent.categorizationDetails[store][category] = {
          count: products.length,
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            hasImage: !!(p.image || p.imageUrl),
            hasDescription: !!(p.description || p.desc),
            hasExpiry: !!(p.expiry || p.expiryDate || p.bestBefore),
            categoryScore: p.categoryScore
          }))
        };
      }
    }
    
    const logPath = path.join(__dirname, '../data/essentials-only-log.json');
    await fsPromises.writeFile(logPath, JSON.stringify(logContent, null, 2));
    console.log(`✅ Essentials log saved to: ${logPath}`);
  }

  printEssentialsSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 ESSENTIALS ONLY - CONSOLIDATED SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\n📈 Essentials Statistics:`);
    console.log(`   Total Essential Products: ${this.dataQuality.totalProducts}`);
    
    console.log(`\n📊 Data Quality:`);
    console.log(`   Products with Images: ${this.dataQuality.productsWithImages} (${Math.round(this.dataQuality.productsWithImages / this.dataQuality.totalProducts * 100)}%)`);
    console.log(`   Products with Descriptions: ${this.dataQuality.productsWithDescriptions} (${Math.round(this.dataQuality.productsWithDescriptions / this.dataQuality.totalProducts * 100)}%)`);
    console.log(`   Products with Expiry Info: ${this.dataQuality.productsWithExpiry} (${Math.round(this.dataQuality.productsWithExpiry / this.dataQuality.totalProducts * 100)}%)`);
    console.log(`   Products with Prices: ${this.dataQuality.productsWithPrices} (${Math.round(this.dataQuality.productsWithPrices / this.dataQuality.totalProducts * 100)}%)`);
    console.log(`   Products with Categories: ${this.dataQuality.productsWithCategories} (${Math.round(this.dataQuality.productsWithCategories / this.dataQuality.totalProducts * 100)}%)`);
    
    console.log(`\n🏪 Store Breakdown (Essentials Only):`);
    for (const [store, categories] of Object.entries(this.categorizedProducts)) {
      const total = Object.values(categories).reduce((sum, products) => sum + products.length, 0);
      console.log(`   ${store}: ${total} essential products`);
      for (const [category, products] of Object.entries(categories)) {
        console.log(`     ${category}: ${products.length} products`);
      }
    }
    
    console.log(`\n📁 Files Generated:`);
    console.log(`   📄 CSV: data/essentials-only-categorized.csv`);
    console.log(`   📝 Log: data/essentials-only-log.json`);
    
    console.log('\n✅ Essentials consolidation complete!');
  }
}

// Run the consolidator
const consolidator = new EssentialsConsolidator();
consolidator.consolidateEssentials().then(() => {
  console.log('\n🎉 Essentials consolidation completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Consolidation failed:', error);
  process.exit(1);
});
