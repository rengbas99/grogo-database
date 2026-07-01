/**
 * Smart Pantry Service
 * Handles GPS-based store detection, QR code scanning, and expiry notifications
 */

const firebaseService = require('./FirebaseService');
const logger = require('../utils/logger');
const dayjs = require('dayjs');
const cron = require('node-cron');
const { getStoresNearby } = require('../data/realStores');

class SmartPantryService {
  constructor() {
    this.firebaseService = firebaseService;
    this.notificationQueue = [];
    this.storeLocations = new Map();
    this.userLocations = new Map();
  }

  async init() {
    try {
      await this.firebaseService.initialize();
      await this.loadStoreLocations();
      this.startExpiryNotificationCron();
      logger.info('Smart Pantry Service initialized');
    } catch (error) {
      logger.error('Failed to initialize Smart Pantry Service:', error);
      throw error;
    }
  }

  async loadStoreLocations() {
    try {
      const storesSnapshot = await this.firebaseService.db.collection('stores').get();
      
      storesSnapshot.forEach(doc => {
        const store = doc.data();
        this.storeLocations.set(doc.id, {
          id: doc.id,
          name: store.name,
          latitude: store.latitude,
          longitude: store.longitude,
          radius: store.radius || 1000, // 1km default radius
          brand: store.brand,
          address: store.address
        });
      });

      logger.info(`Loaded ${this.storeLocations.size} store locations`);
    } catch (error) {
      logger.error('Failed to load store locations:', error);
    }
  }

  // GPS-based store detection
  async detectNearbyStores(userLatitude, userLongitude, maxDistance = 5000) {
    try {
      // Use real stores data instead of Firebase
      const nearbyStores = getStoresNearby(userLatitude, userLongitude, maxDistance);
      
      logger.info(`Found ${nearbyStores.length} real stores within ${maxDistance}m`);
      return nearbyStores;
    } catch (error) {
      logger.error('Failed to detect nearby stores:', error);
      return [];
    }
  }

  // Calculate distance between two coordinates (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // QR Code product scanning
  async scanProductQR(qrData, userId) {
    try {
      logger.info(`Processing QR scan for user ${userId}: ${qrData}`);
      
      // Parse QR code data (could be product ID, barcode, or custom format)
      const productInfo = await this.parseQRData(qrData);
      
      if (!productInfo) {
        throw new Error('Invalid QR code format');
      }

      // Find or create product
      let product = await this.findProductByBarcode(productInfo.barcode);
      
      if (!product) {
        // Create new product from QR data
        product = await this.createProductFromQR(productInfo);
      }

      // Add to user's pantry
      const pantryItem = await this.addToPantry(userId, product.id, {
        quantity: productInfo.quantity || 1,
        expiryDate: productInfo.expiryDate,
        purchaseDate: new Date(),
        storeId: productInfo.storeId,
        qrCode: qrData
      });

      // Update user location if store detected
      if (productInfo.storeId) {
        await this.updateUserLocation(userId, productInfo.storeId);
      }

      logger.info(`Successfully added ${product.name} to pantry`);
      return {
        success: true,
        product: product,
        pantryItem: pantryItem
      };
    } catch (error) {
      logger.error('Failed to scan product QR:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async parseQRData(qrData) {
    try {
      // Try different QR code formats
      if (qrData.startsWith('GROGO:')) {
        // Custom Grogo format: GROGO:productId:quantity:expiryDate:storeId
        const parts = qrData.split(':');
        return {
          productId: parts[1],
          quantity: parseInt(parts[2]) || 1,
          expiryDate: parts[3] ? new Date(parts[3]) : null,
          storeId: parts[4] || null,
          barcode: parts[1]
        };
      } else if (qrData.startsWith('EAN:')) {
        // EAN barcode format
        return {
          barcode: qrData.replace('EAN:', ''),
          quantity: 1
        };
      } else if (/^\d{8,14}$/.test(qrData)) {
        // Direct barcode number
        return {
          barcode: qrData,
          quantity: 1
        };
      } else {
        // Try to parse as JSON
        const parsed = JSON.parse(qrData);
        return {
          barcode: parsed.barcode || parsed.productId,
          quantity: parsed.quantity || 1,
          expiryDate: parsed.expiryDate ? new Date(parsed.expiryDate) : null,
          storeId: parsed.storeId || null
        };
      }
    } catch (error) {
      logger.error('Failed to parse QR data:', error);
      return null;
    }
  }

  async findProductByBarcode(barcode) {
    try {
      const snapshot = await this.firebaseService.db
        .collection('products')
        .where('barcode', '==', barcode)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      logger.error('Failed to find product by barcode:', error);
      return null;
    }
  }

  async createProductFromQR(productInfo) {
    try {
      // Create a basic product entry
      const productData = {
        name: `Product ${productInfo.barcode}`,
        barcode: productInfo.barcode,
        category: 'unknown',
        unit: 'item',
        createdAt: new Date(),
        updatedAt: new Date(),
        source: 'qr_scan'
      };

      const docRef = await this.firebaseService.db.collection('products').add(productData);
      return { id: docRef.id, ...productData };
    } catch (error) {
      logger.error('Failed to create product from QR:', error);
      throw error;
    }
  }

  async addToPantry(userId, productId, pantryData) {
    try {
      const pantryItem = {
        userId: userId,
        productId: productId,
        quantity: pantryData.quantity,
        expiryDate: pantryData.expiryDate,
        purchaseDate: pantryData.purchaseDate,
        storeId: pantryData.storeId,
        qrCode: pantryData.qrCode,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await this.firebaseService.db.collection('pantry_items').add(pantryItem);
      return { id: docRef.id, ...pantryItem };
    } catch (error) {
      logger.error('Failed to add item to pantry:', error);
      throw error;
    }
  }

  async updateUserLocation(userId, storeId) {
    try {
      const store = this.storeLocations.get(storeId);
      if (!store) return;

      this.userLocations.set(userId, {
        latitude: store.latitude,
        longitude: store.longitude,
        storeId: storeId,
        lastUpdated: new Date()
      });

      // Save to Firebase
      await this.firebaseService.db.collection('user_locations').doc(userId).set({
        latitude: store.latitude,
        longitude: store.longitude,
        storeId: storeId,
        lastUpdated: new Date()
      });

      logger.info(`Updated location for user ${userId} to store ${store.name}`);
    } catch (error) {
      logger.error('Failed to update user location:', error);
    }
  }

  // Expiry notification system
  startExpiryNotificationCron() {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
      await this.checkExpiryNotifications();
    });

    logger.info('Expiry notification cron job started');
  }

  async checkExpiryNotifications() {
    try {
      logger.info('Checking expiry notifications...');
      
      const now = dayjs();
      const tomorrow = now.add(1, 'day');
      const threeDays = now.add(3, 'days');
      const week = now.add(7, 'days');

      // Get all active pantry items
      const snapshot = await this.firebaseService.db
        .collection('pantry_items')
        .where('status', '==', 'active')
        .where('expiryDate', '!=', null)
        .get();

      const notifications = [];

      snapshot.forEach(doc => {
        const item = doc.data();
        const expiryDate = dayjs(item.expiryDate);
        
        if (expiryDate.isBefore(now)) {
          // Expired
          notifications.push({
            userId: item.userId,
            pantryItemId: doc.id,
            type: 'expired',
            message: `${item.productName || 'Item'} has expired`,
            priority: 'high',
            expiryDate: item.expiryDate
          });
        } else if (expiryDate.isBefore(tomorrow)) {
          // Expires today
          notifications.push({
            userId: item.userId,
            pantryItemId: doc.id,
            type: 'expires_today',
            message: `${item.productName || 'Item'} expires today`,
            priority: 'high',
            expiryDate: item.expiryDate
          });
        } else if (expiryDate.isBefore(threeDays)) {
          // Expires in 3 days
          notifications.push({
            userId: item.userId,
            pantryItemId: doc.id,
            type: 'expires_soon',
            message: `${item.productName || 'Item'} expires in ${expiryDate.diff(now, 'day')} days`,
            priority: 'medium',
            expiryDate: item.expiryDate
          });
        } else if (expiryDate.isBefore(week)) {
          // Expires in a week
          notifications.push({
            userId: item.userId,
            pantryItemId: doc.id,
            type: 'expires_week',
            message: `${item.productName || 'Item'} expires in ${expiryDate.diff(now, 'day')} days`,
            priority: 'low',
            expiryDate: item.expiryDate
          });
        }
      });

      // Send notifications
      for (const notification of notifications) {
        await this.sendNotification(notification);
      }

      logger.info(`Processed ${notifications.length} expiry notifications`);
    } catch (error) {
      logger.error('Failed to check expiry notifications:', error);
    }
  }

  async sendNotification(notification) {
    try {
      // Save notification to database
      await this.firebaseService.db.collection('notifications').add({
        ...notification,
        sentAt: new Date(),
        status: 'sent'
      });

      // Here you would integrate with push notification services
      // For now, just log
      logger.info(`Notification sent to user ${notification.userId}: ${notification.message}`);
    } catch (error) {
      logger.error('Failed to send notification:', error);
    }
  }

  // Get user's pantry with expiry information
  async getUserPantry(userId) {
    try {
      const snapshot = await this.firebaseService.db
        .collection('pantry_items')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .get();

      const pantryItems = [];
      
      for (const doc of snapshot.docs) {
        const item = doc.data();
        
        // Get product details
        const productDoc = await this.firebaseService.db
          .collection('products')
          .doc(item.productId)
          .get();
        
        if (productDoc.exists) {
          const product = productDoc.data();
          
          pantryItems.push({
            id: doc.id,
            ...item,
            product: product,
            daysUntilExpiry: item.expiryDate ? 
              dayjs(item.expiryDate).diff(dayjs(), 'day') : null,
            isExpired: item.expiryDate ? 
              dayjs(item.expiryDate).isBefore(dayjs()) : false
          });
        }
      }

      // Sort by expiry date
      pantryItems.sort((a, b) => {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate) - new Date(b.expiryDate);
      });

      return pantryItems;
    } catch (error) {
      logger.error('Failed to get user pantry:', error);
      return [];
    }
  }

  // Get nearby stores for user
  async getNearbyStores(userId, maxDistance = 5000) {
    try {
      const userLocation = this.userLocations.get(userId);
      
      if (!userLocation) {
        // Return all stores if no user location
        return Array.from(this.storeLocations.values());
      }

      return await this.detectNearbyStores(
        userLocation.latitude,
        userLocation.longitude,
        maxDistance
      );
    } catch (error) {
      logger.error('Failed to get nearby stores:', error);
      return [];
    }
  }

  // Update pantry item
  async updatePantryItem(pantryItemId, updates) {
    try {
      await this.firebaseService.db
        .collection('pantry_items')
        .doc(pantryItemId)
        .update({
          ...updates,
          updatedAt: new Date()
        });

      logger.info(`Updated pantry item ${pantryItemId}`);
    } catch (error) {
      logger.error('Failed to update pantry item:', error);
      throw error;
    }
  }

  // Remove item from pantry
  async removeFromPantry(pantryItemId) {
    try {
      await this.firebaseService.db
        .collection('pantry_items')
        .doc(pantryItemId)
        .update({
          status: 'removed',
          updatedAt: new Date()
        });

      logger.info(`Removed pantry item ${pantryItemId}`);
    } catch (error) {
      logger.error('Failed to remove pantry item:', error);
      throw error;
    }
  }
}

module.exports = SmartPantryService;
