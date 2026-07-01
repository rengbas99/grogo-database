/**
 * Setup App Data - Integrate Clean Firebase Data with Mobile App
 * This script sets up the app with real product data and creates store entries
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

class AppDataSetup {
  constructor() {
    this.stores = [
      {
        id: 'tesco_ub8_1nd',
        name: 'Tesco',
        brand: 'Tesco',
        address: 'Uxbridge Road, Uxbridge UB8 1ND',
        postcode: 'UB8 1ND',
        latitude: 51.5456,
        longitude: -0.4784,
        openingHours: {
          monday: '07:00 - 22:00',
          tuesday: '07:00 - 22:00',
          wednesday: '07:00 - 22:00',
          thursday: '07:00 - 22:00',
          friday: '07:00 - 22:00',
          saturday: '07:00 - 22:00',
          sunday: '10:00 - 16:00'
        },
        services: ['grocery', 'pharmacy', 'petrol', 'click_and_collect'],
        phone: '0345 677 9900'
      },
      {
        id: 'sainsburys_ub8_1qw',
        name: 'Sainsburys',
        brand: 'Sainsburys',
        address: 'High Street, Uxbridge UB8 1QW',
        postcode: 'UB8 1QW',
        latitude: 51.5456,
        longitude: -0.4784,
        openingHours: {
          monday: '07:00 - 22:00',
          tuesday: '07:00 - 22:00',
          wednesday: '07:00 - 22:00',
          thursday: '07:00 - 22:00',
          friday: '07:00 - 22:00',
          saturday: '07:00 - 22:00',
          sunday: '10:00 - 16:00'
        },
        services: ['grocery', 'pharmacy', 'click_and_collect'],
        phone: '0800 636 262'
      },
      {
        id: 'lidl_ub8_1nd',
        name: 'Lidl',
        brand: 'Lidl',
        address: 'Uxbridge Road, Uxbridge UB8 1ND',
        postcode: 'UB8 1ND',
        latitude: 51.5456,
        longitude: -0.4784,
        openingHours: {
          monday: '08:00 - 22:00',
          tuesday: '08:00 - 22:00',
          wednesday: '08:00 - 22:00',
          thursday: '08:00 - 22:00',
          friday: '08:00 - 22:00',
          saturday: '08:00 - 22:00',
          sunday: '10:00 - 16:00'
        },
        services: ['grocery', 'bakery'],
        phone: '0800 977 7766'
      },
      {
        id: 'iceland_ub8_1nd',
        name: 'Iceland',
        brand: 'Iceland',
        address: 'Uxbridge Road, Uxbridge UB8 1ND',
        postcode: 'UB8 1ND',
        latitude: 51.5456,
        longitude: -0.4784,
        openingHours: {
          monday: '08:00 - 20:00',
          tuesday: '08:00 - 20:00',
          wednesday: '08:00 - 20:00',
          thursday: '08:00 - 20:00',
          friday: '08:00 - 20:00',
          saturday: '08:00 - 20:00',
          sunday: '10:00 - 16:00'
        },
        services: ['grocery', 'frozen_foods'],
        phone: '0800 328 0800'
      },
      {
        id: 'aldi_ub8_1nd',
        name: 'Aldi',
        brand: 'Aldi',
        address: 'Uxbridge Road, Uxbridge UB8 1ND',
        postcode: 'UB8 1ND',
        latitude: 51.5456,
        longitude: -0.4784,
        openingHours: {
          monday: '08:00 - 22:00',
          tuesday: '08:00 - 22:00',
          wednesday: '08:00 - 22:00',
          thursday: '08:00 - 22:00',
          friday: '08:00 - 22:00',
          saturday: '08:00 - 22:00',
          sunday: '10:00 - 16:00'
        },
        services: ['grocery', 'bakery'],
        phone: '0800 042 0800'
      },
      {
        id: 'asda_ub8_1nd',
        name: 'Asda',
        brand: 'Asda',
        address: 'Uxbridge Road, Uxbridge UB8 1ND',
        postcode: 'UB8 1ND',
        latitude: 51.5456,
        longitude: -0.4784,
        openingHours: {
          monday: '07:00 - 23:00',
          tuesday: '07:00 - 23:00',
          wednesday: '07:00 - 23:00',
          thursday: '07:00 - 23:00',
          friday: '07:00 - 23:00',
          saturday: '07:00 - 23:00',
          sunday: '10:00 - 16:00'
        },
        services: ['grocery', 'pharmacy', 'petrol', 'click_and_collect'],
        phone: '0800 952 0101'
      }
    ];
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

  async setupStores() {
    console.log('🏪 Setting up stores...');
    const db = admin.firestore();
    
    for (const store of this.stores) {
      try {
        await db.collection('stores').doc(store.id).set({
          ...store,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Store created: ${store.name}`);
      } catch (error) {
        console.error(`❌ Error creating store ${store.name}:`, error.message);
      }
    }
  }

  async setupStoreProducts() {
    console.log('🛍️ Setting up store products...');
    const db = admin.firestore();
    
    // Get all products from Firebase
    const productsSnapshot = await db.collection('products').get();
    console.log(`📊 Found ${productsSnapshot.size} products to process`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    // Group products by store
    const productsByStore = {};
    for (const productDoc of productsSnapshot.docs) {
      const product = productDoc.data();
      const storeName = product.store;
      
      if (!productsByStore[storeName]) {
        productsByStore[storeName] = [];
      }
      productsByStore[storeName].push({ doc: productDoc, data: product });
    }
    
    // Process each store's products
    for (const [storeName, products] of Object.entries(productsByStore)) {
      console.log(`\n🏪 Processing ${storeName}: ${products.length} products`);
      
      // Find the corresponding store
      const store = this.stores.find(s => s.name === storeName);
      if (!store) {
        console.log(`⚠️ No store found for: ${storeName}`);
        continue;
      }
      
      // Process products for this store
      for (const { doc: productDoc, data: product } of products) {
        try {
          // Create store product entry
          const storeProductData = {
            storeId: store.id,
            productId: productDoc.id,
            price: product.price ? parseFloat(product.price.replace('£', '')) : 0,
            availability: this.determineAvailability(product),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          };
          
          await db.collection('store_products').add(storeProductData);
          processedCount++;
          
        } catch (error) {
          errorCount++;
          console.error(`❌ Error processing product ${product.name}:`, error.message);
        }
      }
      
      // Special case: Use Lidl items for Asda as well
      if (storeName === 'Lidl') {
        console.log(`🔄 Duplicating Lidl products for Asda...`);
        const asdaStore = this.stores.find(s => s.name === 'Asda');
        
        if (asdaStore) {
          for (const { doc: productDoc, data: product } of products) {
            try {
              // Create store product entry for Asda with Lidl products
              const storeProductData = {
                storeId: asdaStore.id,
                productId: productDoc.id,
                price: product.price ? parseFloat(product.price.replace('£', '')) : 0,
                availability: this.determineAvailability(product),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
              };
              
              await db.collection('store_products').add(storeProductData);
              processedCount++;
              
            } catch (error) {
              errorCount++;
              console.error(`❌ Error duplicating product ${product.name} for Asda:`, error.message);
            }
          }
          console.log(`✅ Duplicated ${products.length} Lidl products for Asda`);
        }
      }
      
      if (processedCount % 50 === 0) {
        console.log(`📈 Processed ${processedCount} products...`);
      }
    }
    
    console.log(`\n✅ Store products setup complete: ${processedCount} processed, ${errorCount} errors`);
  }

  determineAvailability(product) {
    // Simple availability logic based on product data
    if (product.price && product.price !== 'N/A' && product.price !== '') {
      return 'in_stock';
    }
    return 'out_of_stock';
  }

  async createSampleHousehold() {
    console.log('🏠 Creating sample household...');
    const db = admin.firestore();
    
    const householdData = {
      name: 'Demo Household',
      members: ['demo_user'],
      qrCode: 'DEMO_HOUSEHOLD_123',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    try {
      await db.collection('households').doc('demo_household').set(householdData);
      console.log('✅ Sample household created');
    } catch (error) {
      console.error('❌ Error creating household:', error.message);
    }
  }

  async createSampleShoppingList() {
    console.log('🛒 Creating sample shopping list...');
    const db = admin.firestore();
    
    const shoppingListData = {
      items: [
        {
          id: 'item_1',
          text: 'Milk',
          notes: 'Semi-skimmed',
          isChecked: false,
          quantity: 2,
          unit: 'litres',
          createdBy: 'demo_user',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'item_2',
          text: 'Bread',
          notes: 'Wholemeal',
          isChecked: false,
          quantity: 1,
          unit: 'loaf',
          createdBy: 'demo_user',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'item_3',
          text: 'Bananas',
          notes: 'Ripe',
          isChecked: true,
          quantity: 6,
          unit: 'pieces',
          createdBy: 'demo_user',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'demo_user'
    };
    
    try {
      await db.collection('shopping_lists').doc('demo_household').set(shoppingListData);
      console.log('✅ Sample shopping list created');
    } catch (error) {
      console.error('❌ Error creating shopping list:', error.message);
    }
  }

  async generateAppConfig() {
    console.log('⚙️ Generating app configuration...');
    
    const config = {
      stores: this.stores.map(store => ({
        id: store.id,
        name: store.name,
        postcode: store.postcode
      })),
      categories: [
        'Cooking Essentials',
        'Staples',
        'Dairy/Protein',
        'Snacks',
        'Fruits',
        'Household Essentials',
        'Sanitary & Personal Care'
      ],
      setupDate: new Date().toISOString(),
      totalProducts: 0, // Will be updated after setup
      totalStores: this.stores.length
    };
    
    // Get product count
    const db = admin.firestore();
    const productsSnapshot = await db.collection('products').get();
    config.totalProducts = productsSnapshot.size;
    
    const configPath = path.join(__dirname, '../data/app-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`✅ App config saved to: ${configPath}`);
  }

  async run() {
    console.log('🚀 Starting App Data Setup...\n');
    
    const firebaseReady = await this.initializeFirebase();
    if (!firebaseReady) {
      console.log('❌ Cannot proceed without Firebase');
      return;
    }

    try {
      // Step 1: Setup stores
      await this.setupStores();
      
      // Step 2: Setup store products
      await this.setupStoreProducts();
      
      // Step 3: Create sample data
      await this.createSampleHousehold();
      await this.createSampleShoppingList();
      
      // Step 4: Generate app config
      await this.generateAppConfig();
      
      console.log('\n' + '='.repeat(80));
      console.log('🎉 APP DATA SETUP COMPLETE!');
      console.log('='.repeat(80));
      
      console.log('\n📊 Setup Summary:');
      console.log(`   Stores Created: ${this.stores.length}`);
      console.log(`   Products Processed: Check Firebase for count`);
      console.log(`   Sample Data: Household & Shopping List`);
      console.log(`   App Config: Generated`);
      
      console.log('\n🚀 Next Steps:');
      console.log('   1. Start your mobile app: cd mobile-app && npm start');
      console.log('   2. Test Firebase connection in the app');
      console.log('   3. Browse products by store');
      console.log('   4. Test shopping list functionality');
      
      console.log('\n✅ Your app is ready to go live!');
      
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
    }
  }
}

// Run the setup
const setup = new AppDataSetup();
setup.run().then(() => {
  console.log('\n🎉 App setup completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('❌ App setup failed:', error);
  process.exit(1);
});
