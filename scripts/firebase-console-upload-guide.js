const fs = require('fs');
const path = require('path');

// Function to generate Firebase Console upload instructions
function generateUploadInstructions() {
  console.log('🔥 FIREBASE CONSOLE UPLOAD GUIDE');
  console.log('================================\n');
  
  console.log('Since the service account has connection issues, here\'s how to upload manually:\n');
  
  console.log('1. 📱 Go to Firebase Console: https://console.firebase.google.com/');
  console.log('2. 🏪 Select your project: "GrogoMVP" (grogo-66a50)');
  console.log('3. 🗄️ Go to Firestore Database');
  console.log('4. ➕ Click "Start collection"');
  console.log('5. 📝 Collection ID: "stores"\n');
  
  console.log('📋 STORE DOCUMENTS TO CREATE:');
  console.log('============================\n');
  
  const stores = [
    {
      id: 'tesco_uxbridge',
      name: 'Tesco Uxbridge',
      address: '62 High St, Uxbridge UB8 1ND'
    },
    {
      id: 'sainsbury_uxbridge', 
      name: 'Sainsbury Uxbridge',
      address: 'York Rd, Uxbridge UB8 1QW'
    },
    {
      id: 'aldi_west_drayton',
      name: 'Aldi West Drayton', 
      address: 'High St, West Drayton UB7 7QN'
    },
    {
      id: 'lidl_uxbridge_cowley',
      name: 'Lidl Uxbridge',
      address: '137 Cowley Rd, Uxbridge, London UB8 2AG'
    },
    {
      id: 'lidl_uxbridge_high_st',
      name: 'Lidl Uxbridge',
      address: 'High St, Uxbridge UB8 1LA'
    }
  ];
  
  stores.forEach((store, index) => {
    console.log(`${index + 1}. Document ID: "${store.id}"`);
    console.log(`   Fields:`);
    console.log(`   - name: "${store.name}"`);
    console.log(`   - address: "${store.address}"`);
    console.log(`   - storeId: "${store.id}"`);
    console.log(`   - productCount: [will be calculated]`);
    console.log(`   - createdAt: [timestamp]`);
    console.log(`   - lastUpdated: [timestamp]\n`);
  });
  
  console.log('📁 SUBCOLLECTIONS TO CREATE:');
  console.log('===========================\n');
  
  console.log('For each store document, create subcollections:');
  console.log('- categories/[category_name]/products/[product_id]');
  console.log('\nExample structure:');
  console.log('stores/tesco_uxbridge/categories/Fruits & Vegetables/products/[product_id]');
  console.log('stores/tesco_uxbridge/categories/Dairy & Eggs/products/[product_id]');
  console.log('... and so on\n');
  
  console.log('🔄 ALTERNATIVE: Use the API endpoints');
  console.log('====================================\n');
  
  console.log('Once the data is uploaded, you can use these API endpoints:');
  console.log('- GET /api/products/:storeId - Get products for a store');
  console.log('- GET /api/products/:storeId/categories - Get store categories');
  console.log('- GET /api/products/:storeId/brands - Get store brands');
  console.log('- GET /api/products/search/:storeId - Search products');
  console.log('\nThe middleware will handle sorting and filtering automatically!');
}

// Function to create a simplified JSON for manual upload
function createSimplifiedUploadData() {
  try {
    const categorizedDataPath = path.join(__dirname, '../data/categorized-products.json');
    const categorizedData = JSON.parse(fs.readFileSync(categorizedDataPath, 'utf8'));
    
    const simplifiedData = {
      stores: {}
    };
    
    // Create simplified store data
    Object.entries(categorizedData.stores).forEach(([storeId, storeData]) => {
      simplifiedData.stores[storeId] = {
        name: storeData.name,
        address: storeData.address,
        storeId: storeData.storeId,
        productCount: storeData.productCount,
        categories: {}
      };
      
      // Group products by category
      Object.entries(storeData.categories).forEach(([category, products]) => {
        simplifiedData.stores[storeId].categories[category] = {
          productCount: products.length,
          products: products.map(product => ({
            id: product.id,
            name: product.name,
            price: product.price,
            currency: product.currency,
            image: product.image,
            description: product.description,
            brand: product.brand,
            category: product.category,
            subcategory: product.subcategory,
            inStock: product.inStock
          }))
        };
      });
    });
    
    // Save simplified data
    const outputPath = path.join(__dirname, '../data/simplified-upload-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(simplifiedData, null, 2));
    
    console.log(`\n📄 Simplified data saved to: ${outputPath}`);
    console.log('This file contains the exact structure needed for Firebase Console upload.');
    
    return simplifiedData;
  } catch (error) {
    console.error('Error creating simplified data:', error);
    return null;
  }
}

// Run the guide generation
if (require.main === module) {
  generateUploadInstructions();
  createSimplifiedUploadData();
}

module.exports = {
  generateUploadInstructions,
  createSimplifiedUploadData
};






