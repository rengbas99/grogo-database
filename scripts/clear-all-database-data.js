#!/usr/bin/env node

/**
 * Clear All Database Data Script
 * Safely removes all data from Firebase collections to start fresh
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../config/firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

class DatabaseClearer {
  constructor() {
    this.stats = {
      collectionsProcessed: 0,
      documentsDeleted: 0,
      errors: [],
      startTime: new Date()
    };
    
    this.collections = [
      'products',
      'store_products', 
      'stores',
      'shopping_lists',
      'pantry_items',
      'households',
      'users'
    ];
  }

  async clearAllData() {
    console.log('🗑️ CLEARING ALL DATABASE DATA');
    console.log('=' .repeat(50));
    console.log('⚠️  WARNING: This will permanently delete ALL data from your Firebase database!');
    console.log('📋 Collections to be cleared:', this.collections.join(', '));
    console.log('');

    try {
      // Clear each collection
      for (const collectionName of this.collections) {
        await this.clearCollection(collectionName);
        this.stats.collectionsProcessed++;
      }
      
      // Generate cleanup report
      await this.generateClearReport();
      
      console.log('\n🎉 Database clearing completed successfully!');
      this.printStats();
      
    } catch (error) {
      console.error('❌ Error during database clearing:', error);
      this.stats.errors.push(error.message);
      throw error;
    }
  }

  async clearCollection(collectionName) {
    console.log(`🧹 Clearing collection: ${collectionName}`);
    
    try {
      const collectionRef = db.collection(collectionName);
      const snapshot = await collectionRef.get();
      
      if (snapshot.empty) {
        console.log(`  ✅ ${collectionName} is already empty`);
        return;
      }
      
      console.log(`  📊 Found ${snapshot.size} documents in ${collectionName}`);
      
      // Delete in batches to avoid Firestore limits
      const batchSize = 500;
      let deletedCount = 0;
      
      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = db.batch();
        const batchDocs = snapshot.docs.slice(i, i + batchSize);
        
        batchDocs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        deletedCount += batchDocs.length;
        
        console.log(`    🗑️ Deleted ${deletedCount}/${snapshot.size} documents...`);
      }
      
      this.stats.documentsDeleted += deletedCount;
      console.log(`  ✅ ${collectionName}: ${deletedCount} documents deleted`);
      
    } catch (error) {
      console.error(`  ❌ Error clearing ${collectionName}:`, error.message);
      this.stats.errors.push(`${collectionName}: ${error.message}`);
    }
  }

  async generateClearReport() {
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      summary: {
        collectionsProcessed: this.stats.collectionsProcessed,
        totalDocumentsDeleted: this.stats.documentsDeleted,
        errorCount: this.stats.errors.length,
        duration: Date.now() - this.stats.startTime.getTime()
      },
      collections: this.collections,
      nextSteps: [
        {
          action: 'Run new scraping strategy',
          reason: 'Database is now clean and ready for fresh data',
          priority: 'High'
        },
        {
          action: 'Test mobile app',
          reason: 'Verify app works with empty database',
          priority: 'Medium'
        },
        {
          action: 'Set up data validation',
          reason: 'Prevent future data quality issues',
          priority: 'Medium'
        }
      ]
    };

    const reportPath = path.join(__dirname, '../data/database-clear-report.json');
    require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📊 Clear report saved to: ${reportPath}`);
  }

  printStats() {
    console.log('\n📊 CLEARING STATISTICS');
    console.log('=' .repeat(40));
    console.log(`Collections processed: ${this.stats.collectionsProcessed}`);
    console.log(`Total documents deleted: ${this.stats.documentsDeleted}`);
    console.log(`Errors encountered: ${this.stats.errors.length}`);
    
    const duration = Date.now() - this.stats.startTime.getTime();
    console.log(`Total duration: ${(duration / 1000).toFixed(2)} seconds`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Run the new unified scraping strategy');
    console.log('2. Test your mobile app with the clean database');
    console.log('3. Monitor data quality as you add new products');
  }
}

// Run the database clearer
async function main() {
  const clearer = new DatabaseClearer();
  
  try {
    await clearer.clearAllData();
    process.exit(0);
  } catch (error) {
    console.error('Database clearing failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DatabaseClearer;







