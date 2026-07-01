import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import dotenv from 'dotenv';

dotenv.config();

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
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Collections
export const COLLECTIONS = {
  PRODUCTS: 'products',
  SCRAPING_SESSIONS: 'scraping_sessions',
  STORE_STATS: 'store_stats',
  CATEGORY_STATS: 'category_stats'
};

// Initialize Firebase Auth
export const initializeFirebase = async () => {
  try {
    await signInAnonymously(auth);
    console.log('✅ Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    return false;
  }
};

// Save products to Firebase
export const saveProductsToFirebase = async (products, sessionId) => {
  try {
    console.log(`💾 Saving ${products.length} products to Firebase...`);
    
    const batch = [];
    const timestamp = new Date().toISOString();
    
    for (const product of products) {
      const productRef = doc(db, COLLECTIONS.PRODUCTS, product.id);
      const productData = {
        ...product,
        sessionId,
        savedAt: timestamp,
        updatedAt: timestamp
      };
      
      batch.push(setDoc(productRef, productData, { merge: true }));
    }
    
    // Execute batch write
    await Promise.all(batch);
    
    console.log(`✅ Successfully saved ${products.length} products to Firebase`);
    return true;
    
  } catch (error) {
    console.error('❌ Error saving products to Firebase:', error.message);
    throw error;
  }
};

// Save scraping session metadata
export const saveScrapingSession = async (sessionData) => {
  try {
    const sessionRef = doc(db, COLLECTIONS.SCRAPING_SESSIONS, sessionData.id);
    await setDoc(sessionRef, {
      ...sessionData,
      createdAt: new Date().toISOString()
    });
    
    console.log(`✅ Scraping session saved: ${sessionData.id}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error saving scraping session:', error.message);
    throw error;
  }
};

// Get products by store
export const getProductsByStore = async (storeName, limitCount = 100) => {
  try {
    const q = query(
      collection(db, COLLECTIONS.PRODUCTS),
      where('store', '==', storeName.toLowerCase()),
      orderBy('scrapedAt', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const products = querySnapshot.docs.map(doc => doc.data());
    
    console.log(`📦 Retrieved ${products.length} products for ${storeName}`);
    return products;
    
  } catch (error) {
    console.error(`❌ Error getting products for ${storeName}:`, error.message);
    throw error;
  }
};

// Get products by category
export const getProductsByCategory = async (category, limitCount = 100) => {
  try {
    const q = query(
      collection(db, COLLECTIONS.PRODUCTS),
      where('category', '==', category.toLowerCase()),
      orderBy('scrapedAt', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const products = querySnapshot.docs.map(doc => doc.data());
    
    console.log(`📦 Retrieved ${products.length} products for category ${category}`);
    return products;
    
  } catch (error) {
    console.error(`❌ Error getting products for category ${category}:`, error.message);
    throw error;
  }
};

// Get all products with filters
export const getProducts = async (filters = {}, limitCount = 1000) => {
  try {
    let q = collection(db, COLLECTIONS.PRODUCTS);
    
    // Apply filters
    if (filters.store) {
      q = query(q, where('store', '==', filters.store.toLowerCase()));
    }
    if (filters.category) {
      q = query(q, where('category', '==', filters.category.toLowerCase()));
    }
    if (filters.minPrice) {
      q = query(q, where('price', '>=', filters.minPrice));
    }
    if (filters.maxPrice) {
      q = query(q, where('price', '<=', filters.maxPrice));
    }
    
    q = query(q, orderBy('scrapedAt', 'desc'), limit(limitCount));
    
    const querySnapshot = await getDocs(q);
    const products = querySnapshot.docs.map(doc => doc.data());
    
    console.log(`📦 Retrieved ${products.length} products with filters:`, filters);
    return products;
    
  } catch (error) {
    console.error('❌ Error getting products:', error.message);
    throw error;
  }
};

// Get scraping statistics
export const getScrapingStats = async () => {
  try {
    const productsSnapshot = await getDocs(collection(db, COLLECTIONS.PRODUCTS));
    const sessionsSnapshot = await getDocs(collection(db, COLLECTIONS.SCRAPING_SESSIONS));
    
    const products = productsSnapshot.docs.map(doc => doc.data());
    const sessions = sessionsSnapshot.docs.map(doc => doc.data());
    
    // Calculate statistics
    const storeCounts = {};
    const categoryCounts = {};
    const totalValue = products.reduce((sum, product) => sum + (product.price || 0), 0);
    
    products.forEach(product => {
      storeCounts[product.store] = (storeCounts[product.store] || 0) + 1;
      categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
    });
    
    const stats = {
      totalProducts: products.length,
      totalSessions: sessions.length,
      totalValue: Math.round(totalValue * 100) / 100,
      averagePrice: products.length > 0 ? Math.round((totalValue / products.length) * 100) / 100 : 0,
      storeBreakdown: storeCounts,
      categoryBreakdown: categoryCounts,
      lastUpdated: new Date().toISOString()
    };
    
    console.log('📊 Firebase statistics retrieved');
    return stats;
    
  } catch (error) {
    console.error('❌ Error getting scraping stats:', error.message);
    throw error;
  }
};

