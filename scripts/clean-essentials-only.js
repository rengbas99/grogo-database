/**
 * Clean Database - Keep Only Essential Products
 * Removes non-essential products and keeps only the 7 essential categories
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

class EssentialsCleaner {
  constructor() {
    this.essentialCategories = [
      'Cooking Essentials',
      'Staples', 
      'Dairy/Protein',
      'Snacks',
      'Fruits',
      'Household Essentials',
      'Sanitary & Personal Care'
    ];
    
    this.removedCount = 0;
    this.keptCount = 0;
    this.errors = [];
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

  async cleanDatabase() {
    console.log('🧹 Starting database cleanup - keeping only essential products...\n');
    
    const firebaseReady = await this.initializeFirebase();
    if (!firebaseReady) {
      console.log('❌ Cannot proceed without Firebase');
      return;
    }

    const db = admin.firestore();
    
    try {
      // Get all products
      const snapshot = await db.collection('products').get();
      console.log(`📊 Found ${snapshot.size} total products in database`);
      
      const batch = db.batch();
      let batchCount = 0;
      
      snapshot.forEach(doc => {
        const product = doc.data();
        const category = product.category || 'Unknown';
        
        if (this.essentialCategories.includes(category)) {
          this.keptCount++;
          console.log(`✅ Keeping: ${product.name} (${category})`);
        } else {
          this.removedCount++;
          console.log(`🗑️ Removing: ${product.name} (${category})`);
          
          // Add to batch for deletion
          batch.delete(doc.ref);
          batchCount++;
          
          // Commit batch if it reaches 500 operations (Firestore limit)
          if (batchCount >= 500) {
            batch.commit();
            batchCount = 0;
          }
        }
      });
      
      // Commit remaining deletions
      if (batchCount > 0) {
        await batch.commit();
      }
      
      console.log(`\n📊 Cleanup Summary:`);
      console.log(`   Products kept: ${this.keptCount} ✅`);
      console.log(`   Products removed: ${this.removedCount} 🗑️`);
      console.log(`   Essential categories: ${this.essentialCategories.join(', ')}`);
      
      // Generate cleanup report
      await this.generateCleanupReport();
      
    } catch (error) {
      console.error('❌ Error during cleanup:', error.message);
      this.errors.push(error.message);
    }
  }

  async generateCleanupReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        productsKept: this.keptCount,
        productsRemoved: this.removedCount,
        essentialCategories: this.essentialCategories
      },
      errors: this.errors,
      cleanupDetails: {
        purpose: 'Keep only essential products in 7 defined categories',
        categoriesKept: this.essentialCategories,
        categoriesRemoved: 'All other categories not in essential list'
      }
    };
    
    const reportPath = path.join(__dirname, '../data/essentials-cleanup-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📝 Cleanup report saved to: ${reportPath}`);
  }

  printFinalSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 ESSENTIALS DATABASE CLEANUP SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\n📈 Cleanup Results:`);
    console.log(`   Products Kept: ${this.keptCount} ✅`);
    console.log(`   Products Removed: ${this.removedCount} 🗑️`);
    console.log(`   Cleanup Success Rate: ${Math.round((this.keptCount / (this.keptCount + this.removedCount)) * 100)}%`);
    
    console.log(`\n🎯 Essential Categories Kept:`);
    this.essentialCategories.forEach((category, i) => {
      console.log(`   ${i + 1}. ${category}`);
    });
    
    if (this.errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      this.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
    }
    
    console.log(`\n✅ Database cleanup complete!`);
    console.log(`📁 Report saved: data/essentials-cleanup-report.json`);
  }
}

// Run the cleaner
const cleaner = new EssentialsCleaner();
cleaner.cleanDatabase().then(() => {
  cleaner.printFinalSummary();
  process.exit(0);
}).catch(error => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
});
