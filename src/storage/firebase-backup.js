import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, query, where, orderBy, limit, writeBatch } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import dotenv from 'dotenv';
import { LocalStorage } from './local-storage.js';

dotenv.config();

export class FirebaseBackup {
  constructor() {
    this.localStorage = new LocalStorage();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return true;

    try {
      // Firebase configuration
      const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
      };

      // Initialize Firebase
      this.app = initializeApp(firebaseConfig);
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);

      // Sign in anonymously
      await signInAnonymously(this.auth);
      
      this.isInitialized = true;
      console.log('✅ Firebase backup initialized');
      return true;

    } catch (error) {
      console.warn('⚠️ Firebase backup not available:', error.message);
      console.log('   Make sure to set Firebase environment variables in .env');
      return false;
    }
  }

  // Backup all local products to Firebase
  async backupAllProducts() {
    if (!await this.initialize()) {
      console.log('⚠️ Firebase not available, skipping backup');
      return false;
    }

    try {
      const products = await this.localStorage.getAllProducts();
      
      if (products.length === 0) {
        console.log('⚠️ No products to backup');
        return false;
      }

      console.log(`🔄 Backing up ${products.length} products to Firebase...`);

      // Use batch writes for better performance
      const batch = writeBatch(this.db);
      const batchSize = 500; // Firestore batch limit
      let batchCount = 0;

      for (let i = 0; i < products.length; i += batchSize) {
        const batchProducts = products.slice(i, i + batchSize);
        
        for (const product of batchProducts) {
          const productRef = doc(this.db, 'products', product.id);
          batch.set(productRef, {
            ...product,
            lastBackedUp: new Date().toISOString(),
            source: 'local_backup'
          });
        }

        await batch.commit();
        batchCount++;
        console.log(`✅ Backed up batch ${batchCount} (${batchProducts.length} products)`);
      }

      console.log(`🎉 Successfully backed up ${products.length} products to Firebase`);
      return true;

    } catch (error) {
      console.error('❌ Firebase backup failed:', error.message);
      return false;
    }
  }

  // Backup specific products
  async backupProducts(products, sessionId) {
    if (!await this.initialize()) {
      return false;
    }

    try {
      console.log(`🔄 Backing up ${products.length} products from session ${sessionId}...`);

      const batch = writeBatch(this.db);
      
      for (const product of products) {
        const productRef = doc(this.db, 'products', product.id);
        batch.set(productRef, {
          ...product,
          sessionId,
          lastBackedUp: new Date().toISOString(),
          source: 'session_backup'
        });
      }

      await batch.commit();
      console.log(`✅ Session ${sessionId} backed up to Firebase`);
      return true;

    } catch (error) {
      console.error('❌ Session backup failed:', error.message);
      return false;
    }
  }

  // Sync local data with Firebase (two-way sync)
  async syncWithFirebase() {
    if (!await this.initialize()) {
      return false;
    }

    try {
      console.log('🔄 Syncing local data with Firebase...');

      // Get local products
      const localProducts = await this.localStorage.getAllProducts();
      
      // Get Firebase products
      const firebaseProducts = await this.getFirebaseProducts();
      
      // Create maps for comparison
      const localMap = new Map(localProducts.map(p => [p.id, p]));
      const firebaseMap = new Map(firebaseProducts.map(p => [p.id, p]));

      // Find products that need to be synced
      const toUpload = localProducts.filter(p => !firebaseMap.has(p.id));
      const toDownload = firebaseProducts.filter(p => !localMap.has(p.id));

      console.log(`📤 Uploading ${toUpload.length} new products to Firebase`);
      console.log(`📥 Downloading ${toDownload.length} products from Firebase`);

      // Upload new products to Firebase
      if (toUpload.length > 0) {
        await this.backupProducts(toUpload, 'sync_upload');
      }

      // Download new products from Firebase
      if (toDownload.length > 0) {
        await this.localStorage.updateMainProductsFile(toDownload, 'firebase_sync');
      }

      console.log('✅ Sync completed successfully');
      return true;

    } catch (error) {
      console.error('❌ Sync failed:', error.message);
      return false;
    }
  }

  // Get products from Firebase
  async getFirebaseProducts() {
    if (!await this.initialize()) {
      return [];
    }

    try {
      const productsSnapshot = await getDocs(collection(this.db, 'products'));
      return productsSnapshot.docs.map(doc => doc.data());

    } catch (error) {
      console.error('❌ Failed to get Firebase products:', error.message);
      return [];
    }
  }

  // Get products by store from Firebase
  async getFirebaseProductsByStore(storeName) {
    if (!await this.initialize()) {
      return [];
    }

    try {
      const q = query(
        collection(this.db, 'products'),
        where('store', '==', storeName.toLowerCase()),
        orderBy('scrapedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data());

    } catch (error) {
      console.error(`❌ Failed to get Firebase products for ${storeName}:`, error.message);
      return [];
    }
  }

  // Get products by category from Firebase
  async getFirebaseProductsByCategory(category) {
    if (!await this.initialize()) {
      return [];
    }

    try {
      const q = query(
        collection(this.db, 'products'),
        where('category', '==', category.toLowerCase()),
        orderBy('scrapedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data());

    } catch (error) {
      console.error(`❌ Failed to get Firebase products for category ${category}:`, error.message);
      return [];
    }
  }

  // Get Firebase statistics
  async getFirebaseStats() {
    if (!await this.initialize()) {
      return null;
    }

    try {
      const products = await this.getFirebaseProducts();
      
      if (products.length === 0) {
        return {
          totalProducts: 0,
          totalValue: 0,
          averagePrice: 0,
          storeBreakdown: {},
          categoryBreakdown: {},
          lastUpdated: null
        };
      }

      const storeCounts = {};
      const categoryCounts = {};
      const totalValue = products.reduce((sum, product) => sum + (product.price || 0), 0);
      
      products.forEach(product => {
        storeCounts[product.store] = (storeCounts[product.store] || 0) + 1;
        categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
      });

      return {
        totalProducts: products.length,
        totalValue: Math.round(totalValue * 100) / 100,
        averagePrice: Math.round((totalValue / products.length) * 100) / 100,
        storeBreakdown: storeCounts,
        categoryBreakdown: categoryCounts,
        lastUpdated: new Date().toISOString(),
        source: 'firebase'
      };

    } catch (error) {
      console.error('❌ Failed to get Firebase stats:', error.message);
      return null;
    }
  }

  // Compare local vs Firebase data
  async compareData() {
    const localStats = await this.localStorage.getStats();
    const firebaseStats = await this.getFirebaseStats();

    console.log('\n📊 Data Comparison:');
    console.log('='.repeat(40));
    console.log(`Local Products: ${localStats.totalProducts}`);
    console.log(`Firebase Products: ${firebaseStats?.totalProducts || 0}`);
    console.log(`Difference: ${localStats.totalProducts - (firebaseStats?.totalProducts || 0)}`);
    console.log('='.repeat(40));

    return {
      local: localStats,
      firebase: firebaseStats,
      difference: localStats.totalProducts - (firebaseStats?.totalProducts || 0)
    };
  }
}

