const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccount = require('../grogo-mvp-firebase-adminsdk-fbsvc-9caddcb9d0.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'grogo-mvp'
});

const db = admin.firestore();

// Store opening hours data
const storeHours = {
  iceland_uxbridge: {
    name: "Iceland Uxbridge",
    address: "27 Grainge's Yard, Uxbridge UB8 1LH",
    coordinates: { latitude: 51.5458, longitude: -0.4775 },
    openingHours: {
      sunday: "11:00-17:00",
      monday: "08:00-19:00",
      tuesday: "08:00-19:00",
      wednesday: "08:00-19:00",
      thursday: "08:00-19:00",
      friday: "08:00-19:00",
      saturday: "08:00-19:00"
    }
  },
  tesco_uxbridge: {
    name: "Tesco Uxbridge",
    address: "62 High St, Uxbridge UB8 1ND",
    coordinates: { latitude: 51.5462, longitude: -0.4776 },
    openingHours: {
      sunday: "12:00-18:00",
      monday: "07:00-22:00",
      tuesday: "07:00-22:00",
      wednesday: "07:00-22:00",
      thursday: "07:00-22:00",
      friday: "07:00-22:00",
      saturday: "07:00-22:00"
    }
  },
  sainsbury_uxbridge: {
    name: "Sainsbury's Uxbridge",
    address: "York Rd, Uxbridge UB8 1QW",
    coordinates: { latitude: 51.5455, longitude: -0.4780 },
    openingHours: {
      sunday: "10:00-16:00",
      monday: "07:00-23:00",
      tuesday: "07:00-23:00",
      wednesday: "07:00-23:00",
      thursday: "07:00-23:00",
      friday: "07:00-23:00",
      saturday: "07:00-23:00"
    }
  },
  aldi_west_drayton: {
    name: "Aldi West Drayton",
    address: "High St, West Drayton UB7 7QN",
    coordinates: { latitude: 51.5045, longitude: -0.4665 },
    openingHours: {
      sunday: "10:00-16:00",
      monday: "08:00-22:00",
      tuesday: "08:00-22:00",
      wednesday: "08:00-22:00",
      thursday: "08:00-22:00",
      friday: "08:00-22:00",
      saturday: "08:00-22:00"
    }
  },
  lidl_uxbridge_high_st: {
    name: "Lidl Uxbridge High St",
    address: "High St, Uxbridge UB8 1LA",
    coordinates: { latitude: 51.5460, longitude: -0.4770 },
    openingHours: {
      sunday: "11:00-17:00",
      monday: "07:00-21:00",
      tuesday: "07:00-21:00",
      wednesday: "07:00-21:00",
      thursday: "07:00-21:00",
      friday: "09:00-19:00",
      saturday: "09:00-19:00"
    }
  },
  lidl_uxbridge_cowley: {
    name: "Lidl Uxbridge Cowley",
    address: "137 Cowley Rd, Uxbridge, London UB8 2AG",
    coordinates: { latitude: 51.5480, longitude: -0.4750 },
    openingHours: {
      sunday: "11:00-17:00",
      monday: "08:00-22:00",
      tuesday: "08:00-22:00",
      wednesday: "08:00-22:00",
      thursday: "08:00-22:00",
      friday: "08:00-22:00",
      saturday: "08:00-22:00"
    }
  }
};

// Product categorization function
function categorizeProduct(productName, brand) {
  const name = productName.toLowerCase();
  const brandName = brand ? brand.toLowerCase() : '';

  // Fruits & Vegetables
  if (name.includes('apple') || name.includes('banana') || name.includes('orange') || 
      name.includes('carrot') || name.includes('potato') || name.includes('onion') ||
      name.includes('tomato') || name.includes('lettuce') || name.includes('cucumber') ||
      name.includes('pepper') || name.includes('broccoli') || name.includes('spinach') ||
      name.includes('mushroom') || name.includes('lemon') || name.includes('lime') ||
      name.includes('garlic') || name.includes('ginger') || name.includes('avocado')) {
    return 'Fruits & Vegetables';
  }

  // Dairy & Eggs
  if (name.includes('milk') || name.includes('cheese') || name.includes('yogurt') ||
      name.includes('butter') || name.includes('cream') || name.includes('egg') ||
      name.includes('dairy') || name.includes('cheddar') || name.includes('mozzarella') ||
      name.includes('feta') || name.includes('parmesan') || name.includes('brie')) {
    return 'Dairy & Eggs';
  }

  // Meat & Seafood
  if (name.includes('chicken') || name.includes('beef') || name.includes('pork') ||
      name.includes('lamb') || name.includes('fish') || name.includes('salmon') ||
      name.includes('tuna') || name.includes('prawn') || name.includes('sausage') ||
      name.includes('bacon') || name.includes('ham') || name.includes('turkey') ||
      name.includes('meat') || name.includes('seafood')) {
    return 'Meat & Seafood';
  }

  // Frozen Foods
  if (name.includes('frozen') || name.includes('ice cream') || name.includes('pizza') ||
      name.includes('fries') || name.includes('chips') || name.includes('nuggets') ||
      name.includes('fish fingers') || name.includes('ready meal') || name.includes('frozen meal')) {
    return 'Frozen Foods';
  }

  // Pantry Essentials
  if (name.includes('rice') || name.includes('pasta') || name.includes('bread') ||
      name.includes('flour') || name.includes('sugar') || name.includes('salt') ||
      name.includes('oil') || name.includes('vinegar') || name.includes('sauce') ||
      name.includes('spice') || name.includes('herb') || name.includes('cereal') ||
      name.includes('oat') || name.includes('bean') || name.includes('lentil') ||
      name.includes('grain') || name.includes('nut') || name.includes('seed')) {
    return 'Pantry Essentials';
  }

  // Snacks & Beverages
  if (name.includes('crisp') || name.includes('chocolate') || name.includes('biscuit') ||
      name.includes('cake') || name.includes('sweet') || name.includes('drink') ||
      name.includes('juice') || name.includes('soda') || name.includes('water') ||
      name.includes('tea') || name.includes('coffee') || name.includes('energy drink') ||
      name.includes('snack') || name.includes('candy') || name.includes('cookie')) {
    return 'Snacks & Beverages';
  }

  // Bakery & Bread
  if (name.includes('bread') || name.includes('roll') || name.includes('bagel') ||
      name.includes('croissant') || name.includes('muffin') || name.includes('cake') ||
      name.includes('pastry') || name.includes('bun') || name.includes('loaf')) {
    return 'Bakery & Bread';
  }

  // Household & Cleaning
  if (name.includes('cleaner') || name.includes('detergent') || name.includes('soap') ||
      name.includes('tissue') || name.includes('toilet') || name.includes('kitchen') ||
      name.includes('bathroom') || name.includes('laundry') || name.includes('bleach') ||
      name.includes('sponge') || name.includes('brush') || name.includes('household')) {
    return 'Household & Cleaning';
  }

  // Health & Beauty
  if (name.includes('shampoo') || name.includes('conditioner') || name.includes('soap') ||
      name.includes('toothpaste') || name.includes('deodorant') || name.includes('vitamin') ||
      name.includes('supplement') || name.includes('beauty') || name.includes('health') ||
      name.includes('skincare') || name.includes('cosmetic')) {
    return 'Health & Beauty';
  }

  // Baby & Kids
  if (name.includes('baby') || name.includes('infant') || name.includes('toddler') ||
      name.includes('nappy') || name.includes('formula') || name.includes('kids') ||
      name.includes('child') || name.includes('toy') || name.includes('diaper')) {
    return 'Baby & Kids';
  }

  return 'Uncategorized';
}

async function uploadIcelandProducts() {
  try {
    console.log('🛒 Starting Iceland products upload...');
    
    // Load Iceland products
    const icelandData = require('../data/products/Iceland Products/iceland-products.json');
    console.log(`📦 Found ${icelandData.totalProducts} Iceland products`);

    const storeId = 'iceland_uxbridge';
    const storeRef = db.collection('stores').doc(storeId);
    
    // Update store information with correct hours
    await storeRef.set({
      name: storeHours[storeId].name,
      address: storeHours[storeId].address,
      coordinates: storeHours[storeId].coordinates,
      openingHours: storeHours[storeId].openingHours,
      storeType: 'Iceland',
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`✅ Updated store information for ${storeHours[storeId].name}`);

    // Categorize and upload products
    const products = [];
    const categories = {};

    for (const [categoryName, categoryData] of Object.entries(icelandData.categories)) {
      if (!categories[categoryName]) {
        categories[categoryName] = 0;
      }

      for (const product of categoryData.products) {
        const categorizedCategory = categorizeProduct(product.name, product.brand);
        
        if (!categories[categorizedCategory]) {
          categories[categorizedCategory] = 0;
        }
        categories[categorizedCategory]++;

        const productData = {
          name: product.name,
          price: parseFloat(product.price.replace('£', '')),
          currency: 'GBP',
          image: product.image && product.image !== '✅' ? product.image : 'https://via.placeholder.com/300x300?text=Iceland+Product',
          description: `${product.brand} ${product.name}`,
          brand: product.brand || 'Iceland',
          category: categorizedCategory,
          subcategory: categoryName,
          inStock: true,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          storeId: storeId,
          storeType: 'Iceland'
        };

        products.push(productData);
      }
    }

    console.log(`📊 Product categorization summary:`);
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count} products`);
    });

    // Group products by category
    const productsByCategory = {};
    products.forEach(product => {
      if (!productsByCategory[product.category]) {
        productsByCategory[product.category] = [];
      }
      productsByCategory[product.category].push(product);
    });

    // Upload products by category
    const batchSize = 500;
    let uploadedCount = 0;

    for (const [category, categoryProducts] of Object.entries(productsByCategory)) {
      const categoryRef = storeRef.collection('categories').doc(category);
      
      // Create category document
      await categoryRef.set({
        name: category,
        productCount: categoryProducts.length,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Upload products in batches
      for (let i = 0; i < categoryProducts.length; i += batchSize) {
        const batch = db.batch();
        const batchProducts = categoryProducts.slice(i, i + batchSize);

        batchProducts.forEach(product => {
          const productRef = categoryRef.collection('products').doc();
          batch.set(productRef, product);
        });

        await batch.commit();
        uploadedCount += batchProducts.length;
        console.log(`📤 Uploaded ${category} batch: ${uploadedCount}/${products.length} products`);
      }
    }

    console.log(`✅ Successfully uploaded ${uploadedCount} Iceland products to ${storeId}`);

  } catch (error) {
    console.error('❌ Error uploading Iceland products:', error);
    throw error;
  }
}

async function updateAllStoreHours() {
  try {
    console.log('🕒 Updating all store opening hours...');

    for (const [storeId, storeData] of Object.entries(storeHours)) {
      const storeRef = db.collection('stores').doc(storeId);
      
      await storeRef.set({
        name: storeData.name,
        address: storeData.address,
        coordinates: storeData.coordinates,
        openingHours: storeData.openingHours,
        storeType: storeData.name.split(' ')[0], // Extract store type from name
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log(`✅ Updated hours for ${storeData.name}`);
    }

    console.log('✅ All store hours updated successfully');

  } catch (error) {
    console.error('❌ Error updating store hours:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting Iceland upload and store hours update...');
    
    await updateAllStoreHours();
    await uploadIcelandProducts();
    
    console.log('🎉 All operations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

main();
