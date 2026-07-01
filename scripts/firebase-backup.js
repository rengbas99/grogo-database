const admin = require('firebase-admin');
const serviceAccount = require('../config/firebase-service-account.json');
const fs = require('fs');
const path = require('path');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

async function backupFirebaseDatabase() {
  console.log('🚀 Starting Firebase database backup...');
  
  try {
    const backupData = {
      timestamp: new Date().toISOString(),
      projectId: serviceAccount.project_id,
      stores: {},
      pantryItems: {},
      shoppingLists: {},
      users: {}
    };

    // Backup stores and their products
    console.log('📦 Backing up stores and products...');
    const storesSnapshot = await db.collection('stores').get();
    
    for (const storeDoc of storesSnapshot.docs) {
      const storeId = storeDoc.id;
      const storeData = storeDoc.data();
      
      console.log(`  📍 Backing up store: ${storeId}`);
      
      // Get store categories
      const categoriesSnapshot = await storeDoc.ref.collection('categories').get();
      const categories = {};
      
      for (const categoryDoc of categoriesSnapshot.docs) {
        const categoryId = categoryDoc.id;
        const categoryData = categoryDoc.data();
        
        console.log(`    📂 Backing up category: ${categoryId}`);
        
        // Get products in this category
        const productsSnapshot = await categoryDoc.ref.collection('products').get();
        const products = {};
        
        productsSnapshot.docs.forEach(productDoc => {
          products[productDoc.id] = {
            id: productDoc.id,
            ...productDoc.data()
          };
        });
        
        categories[categoryId] = {
          ...categoryData,
          products
        };
        
        console.log(`      ✅ Backed up ${productsSnapshot.docs.length} products in ${categoryId}`);
      }
      
      backupData.stores[storeId] = {
        ...storeData,
        categories
      };
    }

    // Backup pantry items
    console.log('🏠 Backing up pantry items...');
    try {
      const pantrySnapshot = await db.collection('pantry_items').get();
      pantrySnapshot.docs.forEach(doc => {
        backupData.pantryItems[doc.id] = {
          id: doc.id,
          ...doc.data()
        };
      });
      console.log(`  ✅ Backed up ${pantrySnapshot.docs.length} pantry items`);
    } catch (error) {
      console.log(`  ⚠️ No pantry items found or error: ${error.message}`);
    }

    // Backup shopping lists
    console.log('🛒 Backing up shopping lists...');
    try {
      const shoppingListsSnapshot = await db.collection('shopping_lists').get();
      shoppingListsSnapshot.docs.forEach(doc => {
        backupData.shoppingLists[doc.id] = {
          id: doc.id,
          ...doc.data()
        };
      });
      console.log(`  ✅ Backed up ${shoppingListsSnapshot.docs.length} shopping lists`);
    } catch (error) {
      console.log(`  ⚠️ No shopping lists found or error: ${error.message}`);
    }

    // Backup users
    console.log('👥 Backing up users...');
    try {
      const usersSnapshot = await db.collection('users').get();
      usersSnapshot.docs.forEach(doc => {
        backupData.users[doc.id] = {
          id: doc.id,
          ...doc.data()
        };
      });
      console.log(`  ✅ Backed up ${usersSnapshot.docs.length} users`);
    } catch (error) {
      console.log(`  ⚠️ No users found or error: ${error.message}`);
    }

    // Create backup directory
    const backupDir = path.join(__dirname, '..', '..', '..', 'Documents', 'Firebase_Database_Backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Generate filename with timestamp
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const filename = `firebase-backup-${dateStr}-${timeStr}.json`;
    const filepath = path.join(backupDir, filename);

    // Save backup
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));

    // Generate summary
    const summary = {
      backupDate: now.toISOString(),
      projectId: serviceAccount.project_id,
      totalStores: Object.keys(backupData.stores).length,
      totalCategories: Object.values(backupData.stores).reduce((sum, store) => 
        sum + Object.keys(store.categories || {}).length, 0),
      totalProducts: Object.values(backupData.stores).reduce((sum, store) => 
        sum + Object.values(store.categories || {}).reduce((catSum, category) => 
          catSum + Object.keys(category.products || {}).length, 0), 0),
      totalPantryItems: Object.keys(backupData.pantryItems).length,
      totalShoppingLists: Object.keys(backupData.shoppingLists).length,
      totalUsers: Object.keys(backupData.users).length,
      fileSize: fs.statSync(filepath).size,
      filePath: filepath
    };

    // Save summary
    const summaryFilename = `backup-summary-${dateStr}-${timeStr}.json`;
    const summaryFilepath = path.join(backupDir, summaryFilename);
    fs.writeFileSync(summaryFilepath, JSON.stringify(summary, null, 2));

    console.log('\n🎉 Firebase database backup completed successfully!');
    console.log('📊 Backup Summary:');
    console.log(`  📅 Date: ${summary.backupDate}`);
    console.log(`  🏪 Stores: ${summary.totalStores}`);
    console.log(`  📂 Categories: ${summary.totalCategories}`);
    console.log(`  📦 Products: ${summary.totalProducts}`);
    console.log(`  🏠 Pantry Items: ${summary.totalPantryItems}`);
    console.log(`  🛒 Shopping Lists: ${summary.totalShoppingLists}`);
    console.log(`  👥 Users: ${summary.totalUsers}`);
    console.log(`  💾 File Size: ${(summary.fileSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  📁 Backup File: ${filepath}`);
    console.log(`  📋 Summary File: ${summaryFilepath}`);

    return {
      success: true,
      summary,
      filepath,
      summaryFilepath
    };

  } catch (error) {
    console.error('❌ Error during Firebase backup:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run backup
backupFirebaseDatabase()
  .then(result => {
    if (result.success) {
      console.log('\n✅ Backup process completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Backup process failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Backup process crashed:', error);
    process.exit(1);
  });
