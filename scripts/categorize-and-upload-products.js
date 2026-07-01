const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load service account key
const serviceAccount = require('../grogo-66a50-firebase-adminsdk-fbsvc-a39e0229e2.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'grogo-66a50'
});

const db = admin.firestore();

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

// Function to upload products to Firebase
async function uploadProductsToFirebase() {
  try {
    console.log('Starting product upload to Firebase...');
    
    // Load all products
    const allProducts = await loadProducts();
    
    // Upload store information first
    for (const [storeId, storeInfo] of Object.entries(STORES)) {
      await db.collection('stores').doc(storeId).set({
        ...storeInfo,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Uploaded store info for ${storeInfo.name}`);
    }

    // Upload products for each store
    const uploadPromises = [];

    // Tesco Uxbridge
    if (allProducts.tesco && allProducts.tesco.length > 0) {
      const tescoProducts = allProducts.tesco.map(product => normalizeProduct(product, 'tesco'));
      uploadPromises.push(uploadStoreProducts('tesco_uxbridge', tescoProducts));
    }

    // Sainsbury Uxbridge
    if (allProducts.sainsbury && allProducts.sainsbury.length > 0) {
      const sainsburyProducts = allProducts.sainsbury.map(product => normalizeProduct(product, 'sainsbury'));
      uploadPromises.push(uploadStoreProducts('sainsbury_uxbridge', sainsburyProducts));
    }

    // Aldi West Drayton
    if (allProducts.aldi && allProducts.aldi.length > 0) {
      const aldiProducts = allProducts.aldi.map(product => normalizeProduct(product, 'aldi'));
      uploadPromises.push(uploadStoreProducts('aldi_west_drayton', aldiProducts));
    }

    // Lidl stores (same products for both)
    if (allProducts.lidl && allProducts.lidl.length > 0) {
      const lidlProducts = allProducts.lidl.map(product => normalizeProduct(product, 'lidl'));
      uploadPromises.push(uploadStoreProducts('lidl_uxbridge_cowley', lidlProducts));
      uploadPromises.push(uploadStoreProducts('lidl_uxbridge_high_st', lidlProducts));
    }

    // Wait for all uploads to complete
    await Promise.all(uploadPromises);
    
    console.log('All products uploaded successfully!');
    
    // Generate summary
    await generateUploadSummary();
    
  } catch (error) {
    console.error('Error uploading products:', error);
  }
}

// Function to upload products for a specific store
async function uploadStoreProducts(storeId, products) {
  const batch = db.batch();
  const storeRef = db.collection('stores').doc(storeId);
  
  // Group products by category for better organization
  const productsByCategory = {};
  products.forEach(product => {
    if (!productsByCategory[product.category]) {
      productsByCategory[product.category] = [];
    }
    productsByCategory[product.category].push(product);
  });

  // Upload each category as a subcollection
  for (const [category, categoryProducts] of Object.entries(productsByCategory)) {
    const categoryRef = storeRef.collection('categories').doc(category);
    
    // Upload category metadata
    batch.set(categoryRef, {
      name: category,
      productCount: categoryProducts.length,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    // Upload products in this category
    categoryProducts.forEach(product => {
      const productRef = categoryRef.collection('products').doc(product.id);
      batch.set(productRef, {
        ...product,
        storeId: storeId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    });
  }

  await batch.commit();
  console.log(`Uploaded ${products.length} products for ${storeId} in ${Object.keys(productsByCategory).length} categories`);
}

// Function to generate upload summary
async function generateUploadSummary() {
  const summary = {
    timestamp: new Date().toISOString(),
    stores: {},
    totalProducts: 0,
    categories: {}
  };

  for (const storeId of Object.keys(STORES)) {
    const storeRef = db.collection('stores').doc(storeId);
    const categoriesSnapshot = await storeRef.collection('categories').get();
    
    summary.stores[storeId] = {
      name: STORES[storeId].name,
      categories: categoriesSnapshot.size,
      products: 0
    };

    categoriesSnapshot.forEach(doc => {
      const categoryData = doc.data();
      summary.stores[storeId].products += categoryData.productCount;
      summary.totalProducts += categoryData.productCount;
      
      if (!summary.categories[doc.id]) {
        summary.categories[doc.id] = 0;
      }
      summary.categories[doc.id] += categoryData.productCount;
    });
  }

  // Save summary to file
  fs.writeFileSync(
    path.join(__dirname, '../data/upload-summary.json'),
    JSON.stringify(summary, null, 2)
  );

  console.log('Upload Summary:', JSON.stringify(summary, null, 2));
}

// Run the upload process
if (require.main === module) {
  uploadProductsToFirebase()
    .then(() => {
      console.log('Product upload completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Upload failed:', error);
      process.exit(1);
    });
}

module.exports = {
  uploadProductsToFirebase,
  categorizeProduct,
  normalizeProduct,
  CATEGORIES,
  STORES
};
