const fs = require('fs');
const path = require('path');

// Enhanced category mapping based on product names and descriptions
const categoryMapping = {
  // Cooking Oils and Fats
  'oil': { category: 'Cooking Essentials', subcategory: 'Oils & Fats' },
  'sunflower oil': { category: 'Cooking Essentials', subcategory: 'Oils & Fats' },
  'vegetable oil': { category: 'Cooking Essentials', subcategory: 'Oils & Fats' },
  'rapeseed oil': { category: 'Cooking Essentials', subcategory: 'Oils & Fats' },
  'olive oil': { category: 'Cooking Essentials', subcategory: 'Oils & Fats' },
  'coconut oil': { category: 'Cooking Essentials', subcategory: 'Oils & Fats' },
  'butter': { category: 'Dairy & Eggs', subcategory: 'Butter & Spreads' },
  'margarine': { category: 'Dairy & Eggs', subcategory: 'Butter & Spreads' },
  'lard': { category: 'Cooking Essentials', subcategory: 'Oils & Fats' },
  
  // Seasonings and Spices
  'salt': { category: 'Cooking Essentials', subcategory: 'Seasonings & Spices' },
  'pepper': { category: 'Cooking Essentials', subcategory: 'Seasonings & Spices' },
  'garlic': { category: 'Cooking Essentials', subcategory: 'Seasonings & Spices' },
  'onion': { category: 'Fresh Produce', subcategory: 'Vegetables' },
  'herbs': { category: 'Cooking Essentials', subcategory: 'Seasonings & Spices' },
  'spices': { category: 'Cooking Essentials', subcategory: 'Seasonings & Spices' },
  'seasoning': { category: 'Cooking Essentials', subcategory: 'Seasonings & Spices' },
  'paprika': { category: 'Cooking Essentials', subcategory: 'Seasonings & Spices' },
  'cumin': { category: 'Cooking Essentials', subcategory: 'Seasonings & Spices' },
  'oregano': { category: 'Cooking Essentials', subcategory: 'Seasonings & Spices' },
  'basil': { category: 'Cooking Essentials', subcategory: 'Seasonings & Spices' },
  'thyme': { category: 'Cooking Essentials', subcategory: 'Seasonings & Spices' },
  'rosemary': { category: 'Cooking Essentials', subcategory: 'Seasonings & Spices' },
  
  // Grains and Rice
  'rice': { category: 'Pantry Essentials', subcategory: 'Grains & Rice' },
  'pasta': { category: 'Pantry Essentials', subcategory: 'Grains & Rice' },
  'noodles': { category: 'Pantry Essentials', subcategory: 'Grains & Rice' },
  'quinoa': { category: 'Pantry Essentials', subcategory: 'Grains & Rice' },
  'barley': { category: 'Pantry Essentials', subcategory: 'Grains & Rice' },
  'oats': { category: 'Pantry Essentials', subcategory: 'Grains & Rice' },
  'wheat': { category: 'Pantry Essentials', subcategory: 'Grains & Rice' },
  'flour': { category: 'Pantry Essentials', subcategory: 'Baking Essentials' },
  'bread': { category: 'Bakery', subcategory: 'Bread & Rolls' },
  
  // Canned and Preserved Foods
  'tomato': { category: 'Canned & Preserved', subcategory: 'Canned Vegetables' },
  'beans': { category: 'Canned & Preserved', subcategory: 'Canned Vegetables' },
  'corn': { category: 'Canned & Preserved', subcategory: 'Canned Vegetables' },
  'peas': { category: 'Canned & Preserved', subcategory: 'Canned Vegetables' },
  'soup': { category: 'Canned & Preserved', subcategory: 'Soups' },
  'sauce': { category: 'Canned & Preserved', subcategory: 'Sauces & Condiments' },
  'paste': { category: 'Canned & Preserved', subcategory: 'Sauces & Condiments' },
  
  // Dairy Products
  'milk': { category: 'Dairy & Eggs', subcategory: 'Milk & Cream' },
  'cheese': { category: 'Dairy & Eggs', subcategory: 'Cheese' },
  'yogurt': { category: 'Dairy & Eggs', subcategory: 'Yogurt' },
  'cream': { category: 'Dairy & Eggs', subcategory: 'Milk & Cream' },
  'eggs': { category: 'Dairy & Eggs', subcategory: 'Eggs' },
  
  // Household Essentials (check before fresh produce to avoid conflicts)
  'washing up': { category: 'Household Essentials', subcategory: 'Cleaning' },
  'dish soap': { category: 'Household Essentials', subcategory: 'Cleaning' },
  'detergent': { category: 'Household Essentials', subcategory: 'Cleaning' },
  'cleaning': { category: 'Household Essentials', subcategory: 'Cleaning' },
  'fairy': { category: 'Household Essentials', subcategory: 'Cleaning' },
  'washing liquid': { category: 'Household Essentials', subcategory: 'Cleaning' },
  'soap': { category: 'Household Essentials', subcategory: 'Cleaning' },
  'shampoo': { category: 'Household Essentials', subcategory: 'Cleaning' },
  'toilet paper': { category: 'Household Essentials', subcategory: 'Bathroom' },
  'tissue': { category: 'Household Essentials', subcategory: 'Bathroom' },
  'kitchen roll': { category: 'Household Essentials', subcategory: 'Cleaning' },
  'bin bags': { category: 'Household Essentials', subcategory: 'Cleaning' },
  
  // Fresh Produce
  'apple': { category: 'Fresh Produce', subcategory: 'Fruits' },
  'banana': { category: 'Fresh Produce', subcategory: 'Fruits' },
  'orange': { category: 'Fresh Produce', subcategory: 'Fruits' },
  'lemon': { category: 'Fresh Produce', subcategory: 'Fruits' },
  'lime': { category: 'Fresh Produce', subcategory: 'Fruits' },
  'carrot': { category: 'Fresh Produce', subcategory: 'Vegetables' },
  'potato': { category: 'Fresh Produce', subcategory: 'Vegetables' },
  'lettuce': { category: 'Fresh Produce', subcategory: 'Vegetables' },
  'spinach': { category: 'Fresh Produce', subcategory: 'Vegetables' },
  'broccoli': { category: 'Fresh Produce', subcategory: 'Vegetables' },
  'cauliflower': { category: 'Fresh Produce', subcategory: 'Vegetables' },
  'cucumber': { category: 'Fresh Produce', subcategory: 'Vegetables' },
  'pepper': { category: 'Fresh Produce', subcategory: 'Vegetables' },
  'mushroom': { category: 'Fresh Produce', subcategory: 'Vegetables' },
  
  // Meat and Protein
  'chicken': { category: 'Meat & Seafood', subcategory: 'Poultry' },
  'beef': { category: 'Meat & Seafood', subcategory: 'Red Meat' },
  'pork': { category: 'Meat & Seafood', subcategory: 'Red Meat' },
  'lamb': { category: 'Meat & Seafood', subcategory: 'Red Meat' },
  'fish': { category: 'Meat & Seafood', subcategory: 'Seafood' },
  'salmon': { category: 'Meat & Seafood', subcategory: 'Seafood' },
  'tuna': { category: 'Meat & Seafood', subcategory: 'Seafood' },
  'bacon': { category: 'Meat & Seafood', subcategory: 'Processed Meat' },
  'sausage': { category: 'Meat & Seafood', subcategory: 'Processed Meat' },
  'ham': { category: 'Meat & Seafood', subcategory: 'Processed Meat' },
  
  // Frozen Foods
  'frozen': { category: 'Frozen Foods', subcategory: 'Frozen Meals' },
  'ice cream': { category: 'Frozen Foods', subcategory: 'Frozen Desserts' },
  'frozen chicken': { category: 'Frozen Foods', subcategory: 'Frozen Meat' },
  'frozen beef': { category: 'Frozen Foods', subcategory: 'Frozen Meat' },
  'frozen vegetables': { category: 'Frozen Foods', subcategory: 'Frozen Vegetables' },
  'frozen fruits': { category: 'Frozen Foods', subcategory: 'Frozen Fruits' },
  
  // Snacks and Confectionery
  'chocolate': { category: 'Snacks & Confectionery', subcategory: 'Chocolate' },
  'biscuits': { category: 'Snacks & Confectionery', subcategory: 'Biscuits & Cookies' },
  'crisps': { category: 'Snacks & Confectionery', subcategory: 'Crisps & Snacks' },
  'nuts': { category: 'Snacks & Confectionery', subcategory: 'Nuts & Seeds' },
  'sweets': { category: 'Snacks & Confectionery', subcategory: 'Sweets & Candy' },
  'candy': { category: 'Snacks & Confectionery', subcategory: 'Sweets & Candy' },
  
  // Beverages
  'juice': { category: 'Beverages', subcategory: 'Juices' },
  'soda': { category: 'Beverages', subcategory: 'Soft Drinks' },
  'water': { category: 'Beverages', subcategory: 'Water' },
  'tea': { category: 'Beverages', subcategory: 'Hot Beverages' },
  'coffee': { category: 'Beverages', subcategory: 'Hot Beverages' },
  'beer': { category: 'Beverages', subcategory: 'Alcoholic Drinks' },
  'wine': { category: 'Beverages', subcategory: 'Alcoholic Drinks' },
  
  // Household Essentials
  'toilet paper': { category: 'Household Essentials', subcategory: 'Bathroom' },
  'tissue': { category: 'Household Essentials', subcategory: 'Bathroom' },
  'soap': { category: 'Household Essentials', subcategory: 'Bathroom' },
  'shampoo': { category: 'Household Essentials', subcategory: 'Bathroom' },
  'toothpaste': { category: 'Household Essentials', subcategory: 'Bathroom' },
  'detergent': { category: 'Household Essentials', subcategory: 'Cleaning' },
  'cleaning': { category: 'Household Essentials', subcategory: 'Cleaning' },
  'kitchen roll': { category: 'Household Essentials', subcategory: 'Cleaning' },
  'bin bags': { category: 'Household Essentials', subcategory: 'Cleaning' },
  
  // Baby Care
  'nappies': { category: 'Baby Care', subcategory: 'Diapers & Wipes' },
  'baby food': { category: 'Baby Care', subcategory: 'Baby Food' },
  'formula': { category: 'Baby Care', subcategory: 'Baby Food' },
  
  // Health & Beauty
  'vitamins': { category: 'Health & Beauty', subcategory: 'Vitamins & Supplements' },
  'medicine': { category: 'Health & Beauty', subcategory: 'Health Care' },
  'bandage': { category: 'Health & Beauty', subcategory: 'Health Care' },
  'sanitary': { category: 'Health & Beauty', subcategory: 'Feminine Care' },
  'tampons': { category: 'Health & Beauty', subcategory: 'Feminine Care' },
  'pads': { category: 'Health & Beauty', subcategory: 'Feminine Care' },
  
  // Pet Care
  'pet food': { category: 'Pet Care', subcategory: 'Pet Food' },
  'dog food': { category: 'Pet Care', subcategory: 'Pet Food' },
  'cat food': { category: 'Pet Care', subcategory: 'Pet Food' },
  'litter': { category: 'Pet Care', subcategory: 'Pet Supplies' }
};

function categorizeProduct(productName, description = '') {
  const name = productName.toLowerCase();
  const desc = (description && typeof description === 'string') ? description.toLowerCase() : '';
  const combined = `${name} ${desc}`;
  
  // Check for exact matches first
  for (const [keyword, category] of Object.entries(categoryMapping)) {
    if (name.includes(keyword) || desc.includes(keyword)) {
      return category;
    }
  }
  
  // Check for partial matches
  for (const [keyword, category] of Object.entries(categoryMapping)) {
    if (combined.includes(keyword)) {
      return category;
    }
  }
  
  // Default fallback
  return { category: 'Pantry Essentials', subcategory: 'Other' };
}

function refineCategories() {
  console.log('🔄 Starting category refinement process...');
  
  // Read the categorized products file
  const categorizedPath = path.join(__dirname, '../data/categorized-products.json');
  const categorizedData = JSON.parse(fs.readFileSync(categorizedPath, 'utf8'));
  
  let totalRefined = 0;
  let changes = [];
  
  // Process each store
  for (const [storeId, storeData] of Object.entries(categorizedData.stores)) {
    console.log(`\n📦 Processing store: ${storeData.name}`);
    
    for (const product of storeData.products) {
      const originalCategory = product.category;
      const originalSubcategory = product.subcategory;
      
      // Get refined categorization
      const refined = categorizeProduct(product.name, product.description || '');
      
      // Update if different
      if (originalCategory !== refined.category || originalSubcategory !== refined.subcategory) {
        product.category = refined.category;
        product.subcategory = refined.subcategory;
        product.lastUpdated = new Date().toISOString();
        
        changes.push({
          store: storeData.name,
          product: product.name,
          original: { category: originalCategory, subcategory: originalSubcategory },
          refined: { category: refined.category, subcategory: refined.subcategory }
        });
        
        totalRefined++;
      }
    }
  }
  
  // Save the refined data
  fs.writeFileSync(categorizedPath, JSON.stringify(categorizedData, null, 2));
  
  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    totalRefined,
    changes: changes.slice(0, 50), // Show first 50 changes
    summary: {
      byStore: {},
      byCategory: {}
    }
  };
  
  // Generate summary by store
  for (const change of changes) {
    if (!report.summary.byStore[change.store]) {
      report.summary.byStore[change.store] = 0;
    }
    report.summary.byStore[change.store]++;
    
    if (!report.summary.byCategory[change.refined.category]) {
      report.summary.byCategory[change.refined.category] = 0;
    }
    report.summary.byCategory[change.refined.category]++;
  }
  
  // Save report
  const reportPath = path.join(__dirname, '../data/category-refinement-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n✅ Category refinement completed!`);
  console.log(`📊 Total products refined: ${totalRefined}`);
  console.log(`📁 Report saved to: ${reportPath}`);
  
  // Display summary
  console.log('\n📈 Summary by Store:');
  for (const [store, count] of Object.entries(report.summary.byStore)) {
    console.log(`  ${store}: ${count} products`);
  }
  
  console.log('\n📈 Summary by New Category:');
  for (const [category, count] of Object.entries(report.summary.byCategory)) {
    console.log(`  ${category}: ${count} products`);
  }
  
  return report;
}

// Run the refinement
if (require.main === module) {
  refineCategories();
}

module.exports = { refineCategories, categorizeProduct, categoryMapping };
