/**
 * Replace with Category Images - Replace remaining placeholders with category-based images
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('../config/firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://grogo-mvp.firebaseio.com"
  });
}

const db = admin.firestore();

class CategoryImageReplacer {
  constructor() {
    this.results = {
      updated: 0,
      skipped: 0,
      errors: 0
    };
    this.batch = db.batch();
    this.batchCount = 0;
    this.maxBatchSize = 100;
  }

  // Category image mapping based on product names
  getCategoryImage(productName) {
    const name = productName.toLowerCase();
    
    // Fruits & Vegetables
    if (name.includes('apple') || name.includes('banana') || name.includes('orange') || 
        name.includes('lemon') || name.includes('lime') || name.includes('grape') ||
        name.includes('strawberry') || name.includes('blueberry') || name.includes('raspberry') ||
        name.includes('onion') || name.includes('garlic') || name.includes('tomato') ||
        name.includes('carrot') || name.includes('potato') || name.includes('lettuce') ||
        name.includes('cucumber') || name.includes('pepper') || name.includes('broccoli') ||
        name.includes('spinach') || name.includes('mushroom') || name.includes('avocado')) {
      return 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&h=400&fit=crop&crop=center';
    }
    
    // Dairy & Milk
    if (name.includes('milk') || name.includes('cheese') || name.includes('yogurt') || 
        name.includes('butter') || name.includes('cream') || name.includes('dairy')) {
      return 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&h=400&fit=crop&crop=center';
    }
    
    // Meat & Protein
    if (name.includes('chicken') || name.includes('beef') || name.includes('pork') || 
        name.includes('lamb') || name.includes('fish') || name.includes('salmon') ||
        name.includes('tuna') || name.includes('bacon') || name.includes('sausage') ||
        name.includes('ham') || name.includes('turkey') || name.includes('meat')) {
      return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop&crop=center';
    }
    
    // Bread & Bakery
    if (name.includes('bread') || name.includes('toast') || name.includes('roll') || 
        name.includes('bagel') || name.includes('croissant') || name.includes('muffin') ||
        name.includes('cake') || name.includes('biscuit') || name.includes('cookie') ||
        name.includes('pastry') || name.includes('doughnut') || name.includes('bun')) {
      return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop&crop=center';
    }
    
    // Cereals & Grains
    if (name.includes('cereal') || name.includes('rice') || name.includes('pasta') || 
        name.includes('noodle') || name.includes('quinoa') || name.includes('oats') ||
        name.includes('wheat') || name.includes('barley') || name.includes('flour')) {
      return 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop&crop=center';
    }
    
    // Snacks & Nuts
    if (name.includes('nut') || name.includes('almond') || name.includes('walnut') || 
        name.includes('peanut') || name.includes('cashew') || name.includes('pistachio') ||
        name.includes('crisp') || name.includes('chip') || name.includes('cracker') ||
        name.includes('popcorn') || name.includes('pretzel') || name.includes('snack')) {
      return 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop&crop=center';
    }
    
    // Chocolate & Sweets
    if (name.includes('chocolate') || name.includes('sweet') || name.includes('candy') || 
        name.includes('sugar') || name.includes('honey') || name.includes('syrup') ||
        name.includes('jam') || name.includes('jelly') || name.includes('marmalade') ||
        name.includes('chocolate') || name.includes('truffle') || name.includes('fudge')) {
      return 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=400&h=400&fit=crop&crop=center';
    }
    
    // Beverages
    if (name.includes('juice') || name.includes('soda') || name.includes('water') || 
        name.includes('tea') || name.includes('coffee') || name.includes('drink') ||
        name.includes('beer') || name.includes('wine') || name.includes('spirit') ||
        name.includes('alcohol') || name.includes('cocktail') || name.includes('smoothie')) {
      return 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=400&fit=crop&crop=center';
    }
    
    // Spices & Seasonings
    if (name.includes('salt') || name.includes('pepper') || name.includes('spice') || 
        name.includes('herb') || name.includes('seasoning') || name.includes('garlic') ||
        name.includes('ginger') || name.includes('cinnamon') || name.includes('paprika') ||
        name.includes('oregano') || name.includes('basil') || name.includes('thyme') ||
        name.includes('rosemary') || name.includes('parsley') || name.includes('cilantro')) {
      return 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&h=400&fit=crop&crop=center';
    }
    
    // Oils & Condiments
    if (name.includes('oil') || name.includes('vinegar') || name.includes('sauce') || 
        name.includes('ketchup') || name.includes('mustard') || name.includes('mayo') ||
        name.includes('dressing') || name.includes('condiment') || name.includes('spread')) {
      return 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&h=400&fit=crop&crop=center';
    }
    
    // Frozen Foods
    if (name.includes('frozen') || name.includes('ice cream') || name.includes('popsicle') || 
        name.includes('frozen') || name.includes('ice') || name.includes('sorbet')) {
      return 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=400&fit=crop&crop=center';
    }
    
    // Baby & Kids
    if (name.includes('baby') || name.includes('kids') || name.includes('child') || 
        name.includes('infant') || name.includes('toddler') || name.includes('nappy') ||
        name.includes('diaper') || name.includes('formula') || name.includes('baby food')) {
      return 'https://images.unsplash.com/photo-1544717297-f8c8c1303fda?w=400&h=400&fit=crop&crop=center';
    }
    
    // Health & Beauty
    if (name.includes('shampoo') || name.includes('soap') || name.includes('toothpaste') || 
        name.includes('deodorant') || name.includes('lotion') || name.includes('cream') ||
        name.includes('beauty') || name.includes('cosmetic') || name.includes('skincare')) {
      return 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=400&fit=crop&crop=center';
    }
    
    // Household & Cleaning
    if (name.includes('cleaner') || name.includes('detergent') || name.includes('soap') || 
        name.includes('tissue') || name.includes('toilet') || name.includes('paper') ||
        name.includes('household') || name.includes('cleaning') || name.includes('disinfectant')) {
      return 'https://images.unsplash.com/photo-1581578731548-c6a0c3f2f2c0?w=400&h=400&fit=crop&crop=center';
    }
    
    // Default grocery image
    return 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=400&fit=crop&crop=center';
  }

  // Add to batch for Firebase update
  async addToBatch(productId, imageUrl) {
    const productRef = db.collection('products').doc(productId);
    this.batch.update(productRef, {
      image: imageUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    this.batchCount++;
    
    if (this.batchCount >= this.maxBatchSize) {
      await this.commitBatch();
    }
  }

  // Commit batch to Firebase
  async commitBatch() {
    if (this.batchCount > 0) {
      try {
        await this.batch.commit();
        console.log(`✅ Committed batch of ${this.batchCount} updates`);
        this.batch = db.batch();
        this.batchCount = 0;
      } catch (error) {
        console.error('❌ Batch commit error:', error.message);
        this.results.errors += this.batchCount;
        this.batch = db.batch();
        this.batchCount = 0;
      }
    }
  }

  // Replace remaining placeholders with category images
  async replaceWithCategoryImages() {
    try {
      console.log('🎨 Starting category image replacement...\n');
      
      // Get all products
      const productsSnapshot = await db.collection('products').get();
      const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      console.log(`📦 Found ${products.length} products to check`);
      
      let processed = 0;
      
      for (const product of products) {
        processed++;
        
        // Skip if already has a good image (not placeholder or OpenFoodFacts)
        if (product.image && 
            !product.image.includes('picsum.photos') && 
            !product.image.includes('openfoodfacts.org') &&
            !product.image.includes('placeholder')) {
          this.results.skipped++;
          continue;
        }
        
        console.log(`\n🔄 [${processed}/${products.length}] Processing: ${product.name}`);
        
        // Get category-based image
        const categoryImage = this.getCategoryImage(product.name);
        
        console.log(`   🎨 Category image: ${categoryImage.substring(0, 80)}...`);
        
        // Add to batch
        await this.addToBatch(product.id, categoryImage);
        this.results.updated++;
        
        // Small delay to avoid overwhelming the system
        if (processed % 50 === 0) {
          console.log(`   ⏳ Processed ${processed} products...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Commit any remaining batch
      await this.commitBatch();
      
      // Final summary
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 CATEGORY IMAGE REPLACEMENT SUMMARY`);
      console.log(`${'='.repeat(60)}`);
      console.log(`✅ Products updated: ${this.results.updated}`);
      console.log(`⏭️  Products skipped: ${this.results.skipped}`);
      console.log(`❌ Errors: ${this.results.errors}`);
      console.log(`📊 Total processed: ${processed}`);
      
      return this.results;
      
    } catch (error) {
      console.error('❌ Replacement failed:', error);
      await this.commitBatch(); // Try to commit any pending batch
      return this.results;
    }
  }
}

// Run the category image replacement
const replacer = new CategoryImageReplacer();
replacer.replaceWithCategoryImages().catch(console.error);
