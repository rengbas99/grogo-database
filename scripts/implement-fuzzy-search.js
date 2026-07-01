#!/usr/bin/env node

/**
 * Implement Fuzzy Search
 * Add fuzzy search functionality to the product API
 */

const admin = require('firebase-admin');

class FuzzySearchImplementation {
  constructor() {
    this.db = null;
  }

  async implementFuzzySearch() {
    try {
      console.log('🔍 Implementing Fuzzy Search...');
      console.log('=' .repeat(50));

      // Initialize Firebase
      await this.initializeFirebase();

      // Test fuzzy search functionality
      await this.testFuzzySearch();

    } catch (error) {
      console.error('❌ Error implementing fuzzy search:', error);
    }
  }

  async initializeFirebase() {
    if (!admin.apps.length) {
      const serviceAccount = require('../config/firebase-service-account.json');
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    }
    this.db = admin.firestore();
    console.log('✅ Firebase connected');
  }

  // Levenshtein distance algorithm for fuzzy matching
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Calculate similarity score (0-1, higher is more similar)
  calculateSimilarity(str1, str2) {
    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
  }

  // Fuzzy search function
  fuzzySearch(products, query, threshold = 0.6) {
    const queryLower = query.toLowerCase();
    
    return products.map(product => {
      const name = product.name || '';
      const brand = product.brand || '';
      const description = product.description || '';
      const category = product.category || '';
      
      // Calculate similarity scores for different fields
      const nameScore = this.calculateSimilarity(name, queryLower);
      const brandScore = this.calculateSimilarity(brand, queryLower);
      const descriptionScore = this.calculateSimilarity(description, queryLower);
      const categoryScore = this.calculateSimilarity(category, queryLower);
      
      // Weighted score (name is most important)
      const weightedScore = (nameScore * 0.5) + (brandScore * 0.3) + (descriptionScore * 0.1) + (categoryScore * 0.1);
      
      // Check for exact matches (boost score)
      const exactNameMatch = name.toLowerCase().includes(queryLower);
      const exactBrandMatch = brand.toLowerCase().includes(queryLower);
      
      let finalScore = weightedScore;
      if (exactNameMatch) finalScore += 0.3;
      if (exactBrandMatch) finalScore += 0.2;
      
      return {
        ...product,
        relevanceScore: finalScore,
        matchType: exactNameMatch ? 'exact_name' : exactBrandMatch ? 'exact_brand' : 'fuzzy'
      };
    })
    .filter(product => product.relevanceScore >= threshold)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  async testFuzzySearch() {
    console.log('\n🧪 Testing Fuzzy Search...');
    
    // Get some sample products
    const storeRef = this.db.collection('stores').doc('tesco_uxbridge');
    const categoriesSnapshot = await storeRef.collection('categories').get();
    
    let allProducts = [];
    for (const categoryDoc of categoriesSnapshot.docs) {
      const productsSnapshot = await categoryDoc.ref.collection('products').limit(20).get();
      const products = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      allProducts = allProducts.concat(products);
    }
    
    console.log(`📦 Loaded ${allProducts.length} sample products for testing`);
    
    // Test different search queries
    const testQueries = [
      'milk',
      'chicken',
      'bread',
      'yogurt',
      'chocolate',
      'apple',
      'beef',
      'cheese'
    ];
    
    for (const query of testQueries) {
      console.log(`\n🔍 Searching for: "${query}"`);
      const results = this.fuzzySearch(allProducts, query, 0.4);
      
      console.log(`   Found ${results.length} results:`);
      results.slice(0, 5).forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name} (${product.brand}) - Score: ${product.relevanceScore.toFixed(3)}`);
      });
    }
  }
}

// Main execution
async function main() {
  const fuzzySearch = new FuzzySearchImplementation();
  await fuzzySearch.implementFuzzySearch();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = FuzzySearchImplementation;

