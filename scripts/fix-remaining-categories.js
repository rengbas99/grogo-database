const fs = require('fs');
const path = require('path');

function fixRemainingCategories() {
  console.log('🔧 Fixing remaining category issues...');
  
  const categorizedPath = path.join(__dirname, '../data/categorized-products.json');
  const categorizedData = JSON.parse(fs.readFileSync(categorizedPath, 'utf8'));
  
  let fixedCount = 0;
  const fixes = [];
  
  // Process each store
  for (const [storeId, storeData] of Object.entries(categorizedData.stores)) {
    console.log(`\n📦 Processing store: ${storeData.name}`);
    
    for (const product of storeData.products) {
      const name = product.name.toLowerCase();
      const desc = (product.description && typeof product.description === 'string') ? product.description.toLowerCase() : '';
      
      let newCategory = null;
      let newSubcategory = null;
      
      // Fix oil products
      if (name.includes('oil') || desc.includes('oil')) {
        newCategory = 'Cooking Essentials';
        newSubcategory = 'Oils & Fats';
      }
      // Fix sugar products
      else if (name.includes('sugar') || desc.includes('sugar')) {
        newCategory = 'Pantry Essentials';
        newSubcategory = 'Baking Essentials';
      }
      // Fix chocolate products
      else if (name.includes('chocolate') || name.includes('aero') || name.includes('candy')) {
        newCategory = 'Snacks & Confectionery';
        newSubcategory = 'Chocolate';
      }
      // Fix salt products
      else if (name.includes('salt') || desc.includes('salt')) {
        newCategory = 'Cooking Essentials';
        newSubcategory = 'Seasonings & Spices';
      }
      // Fix spice products
      else if (name.includes('spice') || name.includes('herb') || name.includes('seasoning')) {
        newCategory = 'Cooking Essentials';
        newSubcategory = 'Seasonings & Spices';
      }
      // Fix dairy products
      else if (name.includes('milk') || name.includes('yogurt') || name.includes('cheese')) {
        newCategory = 'Dairy & Eggs';
        if (name.includes('milk')) newSubcategory = 'Milk & Cream';
        else if (name.includes('yogurt')) newSubcategory = 'Yogurt';
        else if (name.includes('cheese')) newSubcategory = 'Cheese';
      }
      // Fix meat products
      else if (name.includes('chicken') || name.includes('beef') || name.includes('pork') || name.includes('lamb')) {
        newCategory = 'Meat & Seafood';
        if (name.includes('chicken')) newSubcategory = 'Poultry';
        else newSubcategory = 'Red Meat';
      }
      // Fix cleaning products (check before fresh produce to avoid conflicts)
      else if (name.includes('washing up') || name.includes('dish soap') || name.includes('detergent') || 
               name.includes('cleaning') || name.includes('fairy') || name.includes('washing liquid') ||
               name.includes('soap') || name.includes('shampoo') || name.includes('toilet paper') ||
               name.includes('tissue') || name.includes('kitchen roll') || name.includes('bin bags')) {
        newCategory = 'Household Essentials';
        if (name.includes('washing up') || name.includes('dish soap') || name.includes('detergent') || name.includes('fairy')) {
          newSubcategory = 'Cleaning';
        } else if (name.includes('toilet paper') || name.includes('tissue')) {
          newSubcategory = 'Bathroom';
        } else {
          newSubcategory = 'Cleaning';
        }
      }
      // Fix fresh produce
      else if (name.includes('apple') || name.includes('banana') || name.includes('orange') || 
               name.includes('carrot') || name.includes('potato') || name.includes('lettuce')) {
        newCategory = 'Fresh Produce';
        if (name.includes('apple') || name.includes('banana') || name.includes('orange')) {
          newSubcategory = 'Fruits';
        } else {
          newSubcategory = 'Vegetables';
        }
      }
      
      // Update if we found a fix
      if (newCategory && (product.category !== newCategory || product.subcategory !== newSubcategory)) {
        const originalCategory = product.category;
        const originalSubcategory = product.subcategory;
        
        product.category = newCategory;
        product.subcategory = newSubcategory;
        product.lastUpdated = new Date().toISOString();
        
        fixes.push({
          store: storeData.name,
          product: product.name,
          original: { category: originalCategory, subcategory: originalSubcategory },
          fixed: { category: newCategory, subcategory: newSubcategory }
        });
        
        fixedCount++;
      }
    }
  }
  
  // Save the fixed data
  fs.writeFileSync(categorizedPath, JSON.stringify(categorizedData, null, 2));
  
  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    totalFixed: fixedCount,
    fixes: fixes.slice(0, 50), // Show first 50 fixes
    summary: {
      byStore: {},
      byCategory: {}
    }
  };
  
  // Generate summary
  for (const fix of fixes) {
    if (!report.summary.byStore[fix.store]) {
      report.summary.byStore[fix.store] = 0;
    }
    report.summary.byStore[fix.store]++;
    
    if (!report.summary.byCategory[fix.fixed.category]) {
      report.summary.byCategory[fix.fixed.category] = 0;
    }
    report.summary.byCategory[fix.fixed.category]++;
  }
  
  // Save report
  const reportPath = path.join(__dirname, '../data/category-fix-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n✅ Category fixes completed!`);
  console.log(`📊 Total products fixed: ${fixedCount}`);
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

// Run the fix
if (require.main === module) {
  fixRemainingCategories();
}

module.exports = { fixRemainingCategories };
