const fs = require('fs');
const path = require('path');

// Store configuration
const STORES = {
  tesco_uxbridge: {
    name: "Tesco Uxbridge",
    address: "62 High St, Uxbridge UB8 1ND",
    storeId: "tesco_uxbridge"
  },
  sainsbury_uxbridge: {
    name: "Sainsbury Uxbridge", 
    address: "York Rd, Uxbridge UB8 1QW",
    storeId: "sainsbury_uxbridge"
  },
  aldi_west_drayton: {
    name: "Aldi West Drayton",
    address: "High St, West Drayton UB7 7QN", 
    storeId: "aldi_west_drayton"
  },
  lidl_uxbridge_cowley: {
    name: "Lidl Uxbridge",
    address: "137 Cowley Rd, Uxbridge, London UB8 2AG",
    storeId: "lidl_uxbridge_cowley"
  },
  lidl_uxbridge_high_st: {
    name: "Lidl Uxbridge",
    address: "High St, Uxbridge UB8 1LA", 
    storeId: "lidl_uxbridge_high_st"
  }
};

// Comprehensive product categorization system
const CATEGORIES = {
  'Fruits & Vegetables': {
    keywords: ['apple', 'banana', 'orange', 'tomato', 'onion', 'potato', 'carrot', 'lettuce', 'spinach', 'broccoli', 'cucumber', 'pepper', 'fruit', 'vegetable', 'fresh', 'organic'],
    subcategories: ['Fresh Fruits', 'Fresh Vegetables', 'Frozen Fruits', 'Frozen Vegetables', 'Canned Fruits', 'Canned Vegetables']
  },
  'Dairy & Eggs': {
    keywords: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'dairy', 'lactose', 'cow', 'goat', 'sheep'],
    subcategories: ['Milk & Cream', 'Cheese', 'Yogurt & Desserts', 'Butter & Spreads', 'Eggs']
  },
  'Meat & Seafood': {
    keywords: ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'tuna', 'meat', 'poultry', 'seafood', 'bacon', 'sausage', 'ham'],
    subcategories: ['Fresh Meat', 'Poultry', 'Seafood', 'Processed Meats', 'Frozen Meat']
  },
  'Bakery & Bread': {
    keywords: ['bread', 'roll', 'bagel', 'croissant', 'cake', 'pastry', 'muffin', 'biscuit', 'cookie', 'bakery', 'fresh', 'artisan'],
    subcategories: ['Fresh Bread', 'Pastries', 'Cakes & Desserts', 'Biscuits & Cookies', 'Frozen Bakery']
  },
  'Pantry Essentials': {
    keywords: ['rice', 'pasta', 'flour', 'sugar', 'salt', 'oil', 'vinegar', 'sauce', 'spice', 'herb', 'grain', 'cereal', 'oat', 'quinoa'],
    subcategories: ['Grains & Rice', 'Pasta & Noodles', 'Cooking Oils', 'Spices & Herbs', 'Sauces & Condiments']
  },
  'Snacks & Beverages': {
    keywords: ['chocolate', 'crisp', 'chip', 'nut', 'drink', 'juice', 'soda', 'water', 'tea', 'coffee', 'snack', 'biscuit', 'candy'],
    subcategories: ['Chocolate & Sweets', 'Crisps & Snacks', 'Soft Drinks', 'Juices', 'Tea & Coffee', 'Water']
  },
  'Frozen Foods': {
    keywords: ['frozen', 'ice cream', 'pizza', 'ready meal', 'frozen fruit', 'frozen vegetable', 'frozen meat'],
    subcategories: ['Frozen Meals', 'Ice Cream & Desserts', 'Frozen Fruits & Vegetables', 'Frozen Meat & Seafood']
  },
  'Household & Cleaning': {
    keywords: ['cleaning', 'detergent', 'soap', 'shampoo', 'toilet', 'paper', 'tissue', 'household', 'kitchen', 'bathroom'],
    subcategories: ['Cleaning Products', 'Personal Care', 'Paper Products', 'Kitchen Essentials']
  },
  'Health & Beauty': {
    keywords: ['vitamin', 'supplement', 'beauty', 'skincare', 'cosmetic', 'health', 'medicine', 'pharmacy'],
    subcategories: ['Vitamins & Supplements', 'Skincare', 'Cosmetics', 'Health Products']
  },
  'Baby & Kids': {
    keywords: ['baby', 'infant', 'child', 'toy', 'nappy', 'formula', 'kids', 'toddler'],
    subcategories: ['Baby Food', 'Baby Care', 'Kids Snacks', 'Toys & Games']
  }
};

// Function to categorize a product based on its name and description
function categorizeProduct(productName, productDescription = '') {
  const text = `${productName} ${productDescription}`.toLowerCase();
  
  for (const [category, config] of Object.entries(CATEGORIES)) {
    for (const keyword of config.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return {
          category,
          subcategory: config.subcategories[0], // Default to first subcategory
          confidence: 0.8
        };
      }
    }
  }
  
  return {
    category: 'Uncategorized',
    subcategory: 'General',
    confidence: 0.1
  };
}

// Function to normalize product data from different sources
function normalizeProduct(product, storeType) {
  let normalized = {
    id: product.id || product.uid || product.barcode || Math.random().toString(36).substr(2, 9),
    name: product.productName || product.name || product.title || 'Unknown Product',
    price: 0,
    currency: 'GBP',
    image: product.productPhoto || product.image || product.image_thumbnail || product.assets?.plp_image || '',
    description: product.productDescription || product.description || '',
    brand: product.brand || 'Unknown',
    category: 'Uncategorized',
    subcategory: 'General',
    inStock: true,
    lastUpdated: new Date().toISOString(),
    storeType: storeType
  };

  // Handle different price formats
  if (product.price) {
    normalized.price = typeof product.price === 'string' ? parseFloat(product.price.replace(/[£,]/g, '')) : product.price;
  } else if (product.retail_price?.price) {
    normalized.price = product.retail_price.price;
  } else if (product.unit_price?.price) {
    normalized.price = product.unit_price.price;
  }

  // Categorize the product
  const categorization = categorizeProduct(normalized.name, normalized.description);
  normalized.category = categorization.category;
  normalized.subcategory = categorization.subcategory;

  return normalized;
}

// Function to load products from JSON files
async function loadProducts() {
  const productsDir = path.join(__dirname, '../data/products');
  const products = {};

  // Load Tesco products
  try {
    const tescoData = JSON.parse(fs.readFileSync(path.join(productsDir, 'Tesco Products/tesco-final-products.json'), 'utf8'));
    products.tesco = tescoData.products || tescoData;
    console.log(`Loaded ${products.tesco.length} Tesco products`);
  } catch (error) {
    console.error('Error loading Tesco products:', error.message);
    products.tesco = [];
  }

  // Load Sainsbury's products
  try {
    const sainsburyData = JSON.parse(fs.readFileSync(path.join(productsDir, 'Sainsbury\'s Products/sainsbury-final-products.json'), 'utf8'));
    products.sainsbury = sainsburyData.products || sainsburyData;
    console.log(`Loaded ${products.sainsbury.length} Sainsbury's products`);
  } catch (error) {
    console.error('Error loading Sainsbury\'s products:', error.message);
    products.sainsbury = [];
  }

  // Load Aldi products
  try {
    const aldiData = JSON.parse(fs.readFileSync(path.join(productsDir, 'Aldi Products/aldi-products.json'), 'utf8'));
    products.aldi = aldiData.products || aldiData;
    console.log(`Loaded ${products.aldi.length} Aldi products`);
  } catch (error) {
    console.error('Error loading Aldi products:', error.message);
    products.aldi = [];
  }

  // Load Lidl products
  try {
    const lidlData = JSON.parse(fs.readFileSync(path.join(productsDir, 'Lidl products/lidl-openfoodfacts-products.json'), 'utf8'));
    products.lidl = lidlData;
    console.log(`Loaded ${products.lidl.length} Lidl products`);
  } catch (error) {
    console.error('Error loading Lidl products:', error.message);
    products.lidl = [];
  }

  return products;
}

// Function to categorize and organize products
async function categorizeProducts() {
  try {
    console.log('Starting product categorization...');
    
    // Load all products
    const allProducts = await loadProducts();
    
    const categorizedData = {
      timestamp: new Date().toISOString(),
      stores: {},
      summary: {
        totalProducts: 0,
        totalStores: 0,
        categories: {}
      }
    };

    // Process Tesco products
    if (allProducts.tesco && allProducts.tesco.length > 0) {
      const tescoProducts = allProducts.tesco.map(product => normalizeProduct(product, 'tesco'));
      categorizedData.stores.tesco_uxbridge = {
        ...STORES.tesco_uxbridge,
        products: tescoProducts,
        productCount: tescoProducts.length,
        categories: {}
      };
      
      // Group by categories
      tescoProducts.forEach(product => {
        if (!categorizedData.stores.tesco_uxbridge.categories[product.category]) {
          categorizedData.stores.tesco_uxbridge.categories[product.category] = [];
        }
        categorizedData.stores.tesco_uxbridge.categories[product.category].push(product);
      });
      
      console.log(`✅ Categorized ${tescoProducts.length} Tesco products`);
    }

    // Process Sainsbury's products
    if (allProducts.sainsbury && allProducts.sainsbury.length > 0) {
      const sainsburyProducts = allProducts.sainsbury.map(product => normalizeProduct(product, 'sainsbury'));
      categorizedData.stores.sainsbury_uxbridge = {
        ...STORES.sainsbury_uxbridge,
        products: sainsburyProducts,
        productCount: sainsburyProducts.length,
        categories: {}
      };
      
      // Group by categories
      sainsburyProducts.forEach(product => {
        if (!categorizedData.stores.sainsbury_uxbridge.categories[product.category]) {
          categorizedData.stores.sainsbury_uxbridge.categories[product.category] = [];
        }
        categorizedData.stores.sainsbury_uxbridge.categories[product.category].push(product);
      });
      
      console.log(`✅ Categorized ${sainsburyProducts.length} Sainsbury's products`);
    }

    // Process Aldi products
    if (allProducts.aldi && allProducts.aldi.length > 0) {
      const aldiProducts = allProducts.aldi.map(product => normalizeProduct(product, 'aldi'));
      categorizedData.stores.aldi_west_drayton = {
        ...STORES.aldi_west_drayton,
        products: aldiProducts,
        productCount: aldiProducts.length,
        categories: {}
      };
      
      // Group by categories
      aldiProducts.forEach(product => {
        if (!categorizedData.stores.aldi_west_drayton.categories[product.category]) {
          categorizedData.stores.aldi_west_drayton.categories[product.category] = [];
        }
        categorizedData.stores.aldi_west_drayton.categories[product.category].push(product);
      });
      
      console.log(`✅ Categorized ${aldiProducts.length} Aldi products`);
    }

    // Process Lidl products (same for both stores)
    if (allProducts.lidl && allProducts.lidl.length > 0) {
      const lidlProducts = allProducts.lidl.map(product => normalizeProduct(product, 'lidl'));
      
      // Create both Lidl stores with same products
      [categorizedData.stores.lidl_uxbridge_cowley, categorizedData.stores.lidl_uxbridge_high_st] = 
        ['lidl_uxbridge_cowley', 'lidl_uxbridge_high_st'].map(storeId => {
          const storeData = {
            ...STORES[storeId],
            products: lidlProducts,
            productCount: lidlProducts.length,
            categories: {}
          };
          
          // Group by categories
          lidlProducts.forEach(product => {
            if (!storeData.categories[product.category]) {
              storeData.categories[product.category] = [];
            }
            storeData.categories[product.category].push(product);
          });
          
          return storeData;
        });
      
      console.log(`✅ Categorized ${lidlProducts.length} Lidl products for both stores`);
    }

    // Calculate summary
    categorizedData.summary.totalStores = Object.keys(categorizedData.stores).length;
    Object.values(categorizedData.stores).forEach(store => {
      categorizedData.summary.totalProducts += store.productCount;
      
      Object.keys(store.categories).forEach(category => {
        if (!categorizedData.summary.categories[category]) {
          categorizedData.summary.categories[category] = 0;
        }
        categorizedData.summary.categories[category] += store.categories[category].length;
      });
    });

    // Save categorized data
    const outputPath = path.join(__dirname, '../data/categorized-products.json');
    fs.writeFileSync(outputPath, JSON.stringify(categorizedData, null, 2));
    
    console.log('\n🎉 Product categorization completed successfully!');
    console.log(`📊 Total products: ${categorizedData.summary.totalProducts}`);
    console.log(`🏪 Total stores: ${categorizedData.summary.totalStores}`);
    console.log(`📁 Output saved to: ${outputPath}`);
    
    // Print category breakdown
    console.log('\n📋 Category breakdown:');
    Object.entries(categorizedData.summary.categories)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count} products`);
      });

    return categorizedData;
    
  } catch (error) {
    console.error('Error categorizing products:', error);
  }
}

// Run the categorization
if (require.main === module) {
  categorizeProducts()
    .then(() => {
      console.log('Categorization completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Categorization failed:', error);
      process.exit(1);
    });
}

module.exports = {
  categorizeProducts,
  categorizeProduct,
  normalizeProduct,
  CATEGORIES,
  STORES
};






