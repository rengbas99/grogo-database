#!/usr/bin/env node

/**
 * Preview Database Clear Script
 * Shows what data will be deleted without actually deleting it
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../config/firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

class DatabasePreview {
  constructor() {
    this.stats = {
      collectionsAnalyzed: 0,
      totalDocuments: 0,
      collections: {}
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

  async previewDatabaseClear() {
    console.log('🔍 PREVIEWING DATABASE CLEAR');
    console.log('=' .repeat(50));
    console.log('This will show you what data will be deleted WITHOUT actually deleting it');
    console.log('');

    try {
      // Analyze each collection
      for (const collectionName of this.collections) {
        await this.analyzeCollection(collectionName);
        this.stats.collectionsAnalyzed++;
      }
      
      // Generate preview report
      await this.generatePreviewReport();
      
      console.log('\n📊 Database analysis completed!');
      this.printPreviewStats();
      
    } catch (error) {
      console.error('❌ Error during database analysis:', error);
      throw error;
    }
  }

  async analyzeCollection(collectionName) {
    console.log(`🔍 Analyzing collection: ${collectionName}`);
    
    try {
      const collectionRef = db.collection(collectionName);
      const snapshot = await collectionRef.get();
      
      const collectionStats = {
        documentCount: snapshot.size,
        sampleDocuments: [],
        hasData: snapshot.size > 0
      };
      
      if (snapshot.size > 0) {
        console.log(`  📊 Found ${snapshot.size} documents`);
        
        // Show sample documents (first 3)
        const sampleDocs = snapshot.docs.slice(0, 3);
        for (const doc of sampleDocs) {
          const data = doc.data();
          collectionStats.sampleDocuments.push({
            id: doc.id,
            name: data.name || data.title || data.email || 'Unknown',
            type: this.getDocumentType(data),
            createdAt: data.createdAt || data.timestamp || 'Unknown'
          });
        }
        
        // Show sample data
        console.log(`  📋 Sample documents:`);
        collectionStats.sampleDocuments.forEach((doc, index) => {
          console.log(`    ${index + 1}. ${doc.name} (${doc.type}) - Created: ${doc.createdAt}`);
        });
        
        if (snapshot.size > 3) {
          console.log(`    ... and ${snapshot.size - 3} more documents`);
        }
      } else {
        console.log(`  ✅ ${collectionName} is already empty`);
      }
      
      this.stats.collections[collectionName] = collectionStats;
      this.stats.totalDocuments += snapshot.size;
      
    } catch (error) {
      console.error(`  ❌ Error analyzing ${collectionName}:`, error.message);
    }
  }

  getDocumentType(data) {
    if (data.name && data.brand) return 'Product';
    if (data.storeName && data.price) return 'Store Product';
    if (data.name && data.address) return 'Store';
    if (data.title && data.items) return 'Shopping List';
    if (data.name && data.quantity) return 'Pantry Item';
    if (data.name && data.email) return 'User';
    if (data.members) return 'Household';
    return 'Unknown';
  }

  async generatePreviewReport() {
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      summary: {
        collectionsAnalyzed: this.stats.collectionsAnalyzed,
        totalDocuments: this.stats.totalDocuments,
        collectionsWithData: Object.values(this.stats.collections).filter(c => c.hasData).length,
        collectionsEmpty: Object.values(this.stats.collections).filter(c => !c.hasData).length
      },
      collections: this.stats.collections,
      warnings: this.generateWarnings(),
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(__dirname, '../data/database-preview-report.json');
    require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📊 Preview report saved to: ${reportPath}`);
  }

  generateWarnings() {
    const warnings = [];
    
    if (this.stats.totalDocuments > 1000) {
      warnings.push('Large amount of data will be deleted - consider backing up first');
    }
    
    if (this.stats.collections.users > 0) {
      warnings.push('User data will be deleted - ensure this is intentional');
    }
    
    if (this.stats.collections.shopping_lists > 0) {
      warnings.push('Shopping lists will be deleted - users will lose their lists');
    }
    
    if (this.stats.collections.pantry_items > 0) {
      warnings.push('Pantry items will be deleted - users will lose their pantry data');
    }
    
    return warnings;
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.stats.totalDocuments > 0) {
      recommendations.push({
        action: 'Backup data before clearing',
        reason: 'You have data that will be permanently deleted',
        priority: 'High'
      });
    }
    
    recommendations.push({
      action: 'Run unified scraping strategy after clearing',
      reason: 'Start fresh with clean, validated data',
      priority: 'High'
    });
    
    recommendations.push({
      action: 'Test mobile app with empty database',
      reason: 'Ensure app handles empty state gracefully',
      priority: 'Medium'
    });
    
    return recommendations;
  }

  printPreviewStats() {
    console.log('\n📊 PREVIEW STATISTICS');
    console.log('=' .repeat(40));
    console.log(`Collections analyzed: ${this.stats.collectionsAnalyzed}`);
    console.log(`Total documents: ${this.stats.totalDocuments}`);
    console.log(`Collections with data: ${Object.values(this.stats.collections).filter(c => c.hasData).length}`);
    console.log(`Empty collections: ${Object.values(this.stats.collections).filter(c => !c.hasData).length}`);
    
    console.log('\n📋 COLLECTION BREAKDOWN:');
    Object.entries(this.stats.collections).forEach(([name, stats]) => {
      const status = stats.hasData ? `📊 ${stats.documentCount} docs` : '✅ Empty';
      console.log(`  ${name}: ${status}`);
    });
    
    const warnings = this.generateWarnings();
    if (warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Review the preview report');
    console.log('2. If you want to proceed, run: node scripts/clear-all-database-data.js');
    console.log('3. Then run the new unified scraping strategy');
  }
}

// Run the preview
async function main() {
  const preview = new DatabasePreview();
  
  try {
    await preview.previewDatabaseClear();
    process.exit(0);
  } catch (error) {
    console.error('Database preview failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DatabasePreview;







