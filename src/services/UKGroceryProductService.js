class UKGroceryProductService {
  constructor() {
    this.products = [];
  }

  generateComprehensiveProductList() {
    console.log('🚀 Generating comprehensive UK grocery product list...\n');
    
    const productCategories = {
      // Fresh Produce
      fresh_produce: [
        { name: 'Tesco Bananas 1kg', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Gala Apples 1kg', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Carrots 1kg', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Onions 1kg', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Potatoes 2.5kg', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Tomatoes 500g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Cucumbers 3 Pack', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Bell Peppers 3 Pack', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Avocados 4 Pack', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Strawberries 400g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Blueberries 150g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Sainsbury\'s Bananas 1kg', brand: 'Sainsbury\'s', store: 'Sainsbury\'s' },
        { name: 'Sainsbury\'s Apples 1kg', brand: 'Sainsbury\'s', store: 'Sainsbury\'s' },
        { name: 'Lidl Bananas 1kg', brand: 'Lidl', store: 'Lidl' },
        { name: 'Aldi Bananas 1kg', brand: 'Aldi', store: 'Aldi' }
      ],

      // Dairy
      dairy: [
        { name: 'Tesco Whole Milk 4 Pints', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Semi-Skimmed Milk 4 Pints', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Skimmed Milk 4 Pints', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Free Range Eggs 12 Pack', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Mature Cheddar 400g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Butter 250g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Natural Yogurt 500g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Greek Yogurt 500g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Sainsbury\'s Whole Milk 4 Pints', brand: 'Sainsbury\'s', store: 'Sainsbury\'s' },
        { name: 'Sainsbury\'s Free Range Eggs 12 Pack', brand: 'Sainsbury\'s', store: 'Sainsbury\'s' },
        { name: 'Sainsbury\'s Mature Cheddar 400g', brand: 'Sainsbury\'s', store: 'Sainsbury\'s' },
        { name: 'Lidl Whole Milk 4 Pints', brand: 'Lidl', store: 'Lidl' },
        { name: 'Lidl Free Range Eggs 12 Pack', brand: 'Lidl', store: 'Lidl' },
        { name: 'Aldi Whole Milk 4 Pints', brand: 'Aldi', store: 'Aldi' },
        { name: 'Aldi Free Range Eggs 12 Pack', brand: 'Aldi', store: 'Aldi' },
        { name: 'Cathedral City Mature Cheddar 400g', brand: 'Cathedral City', store: 'Tesco' },
        { name: 'Lurpak Butter 250g', brand: 'Lurpak', store: 'Tesco' },
        { name: 'Yeovalley Greek Yogurt 500g', brand: 'Yeovalley', store: 'Tesco' }
      ],

      // Meat & Fish
      meat: [
        { name: 'Tesco Chicken Breast 1kg', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Chicken Thighs 1kg', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Beef Mince 500g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Salmon Fillets 2 Pack', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Pork Chops 4 Pack', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Lamb Chops 4 Pack', brand: 'Tesco', store: 'Tesco' },
        { name: 'Sainsbury\'s Chicken Breast 1kg', brand: 'Sainsbury\'s', store: 'Sainsbury\'s' },
        { name: 'Sainsbury\'s Beef Mince 500g', brand: 'Sainsbury\'s', store: 'Sainsbury\'s' },
        { name: 'Lidl Chicken Breast 1kg', brand: 'Lidl', store: 'Lidl' },
        { name: 'Aldi Chicken Breast 1kg', brand: 'Aldi', store: 'Aldi' },
        { name: 'Young\'s Fish Fingers 20 Pack', brand: 'Young\'s', store: 'Tesco' },
        { name: 'Birds Eye Chicken Nuggets 20 Pack', brand: 'Birds Eye', store: 'Tesco' }
      ],

      // Bread & Bakery
      bread: [
        { name: 'Tesco White Sliced Bread 800g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Brown Sliced Bread 800g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Wholemeal Bread 800g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Warburtons White Toastie 800g', brand: 'Warburtons', store: 'Tesco' },
        { name: 'Warburtons Brown Toastie 800g', brand: 'Warburtons', store: 'Tesco' },
        { name: 'Hovis White Bread 800g', brand: 'Hovis', store: 'Tesco' },
        { name: 'Hovis Wholemeal Bread 800g', brand: 'Hovis', store: 'Tesco' },
        { name: 'Kingsmill White Bread 800g', brand: 'Kingsmill', store: 'Tesco' },
        { name: 'Sainsbury\'s White Bread 800g', brand: 'Sainsbury\'s', store: 'Sainsbury\'s' },
        { name: 'Lidl White Bread 800g', brand: 'Lidl', store: 'Lidl' },
        { name: 'Aldi White Bread 800g', brand: 'Aldi', store: 'Aldi' }
      ],

      // Frozen
      frozen: [
        { name: 'Tesco Frozen Mixed Vegetables 1kg', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Frozen Chips 1kg', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Frozen Peas 1kg', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Frozen Pizza 300g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Iceland Frozen Fish Fillets 1kg', brand: 'Iceland', store: 'Iceland' },
        { name: 'Iceland Frozen Mixed Vegetables 1kg', brand: 'Iceland', store: 'Iceland' },
        { name: 'Iceland Frozen Chips 1kg', brand: 'Iceland', store: 'Iceland' },
        { name: 'Iceland Frozen Ready Meal 400g', brand: 'Iceland', store: 'Iceland' },
        { name: 'McCain Frozen Chips 1kg', brand: 'McCain', store: 'Tesco' },
        { name: 'Birds Eye Frozen Fish Fingers 20 Pack', brand: 'Birds Eye', store: 'Tesco' }
      ],

      // Convenience
      convenience: [
        { name: 'Tesco Ready Meal Curry 400g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Ready Meal Pasta 400g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Ready Meal Pizza 300g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Finest Ready Meal 400g', brand: 'Tesco Finest', store: 'Tesco' },
        { name: 'Sainsbury\'s Ready Meal 400g', brand: 'Sainsbury\'s', store: 'Sainsbury\'s' },
        { name: 'Heinz Baked Beans 415g', brand: 'Heinz', store: 'Tesco' },
        { name: 'Heinz Tomato Soup 400g', brand: 'Heinz', store: 'Tesco' },
        { name: 'Heinz Spaghetti Hoops 415g', brand: 'Heinz', store: 'Tesco' }
      ],

      // Snacks
      snacks: [
        { name: 'Tesco Crisps 6 Pack', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Chocolate Bar 100g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Biscuits 300g', brand: 'Tesco', store: 'Tesco' },
        { name: 'Walkers Crisps 6 Pack', brand: 'Walkers', store: 'Tesco' },
        { name: 'Cadbury Dairy Milk 100g', brand: 'Cadbury', store: 'Tesco' },
        { name: 'McVitie\'s Digestives 300g', brand: 'McVitie\'s', store: 'Tesco' },
        { name: 'Sainsbury\'s Crisps 6 Pack', brand: 'Sainsbury\'s', store: 'Sainsbury\'s' },
        { name: 'Lidl Crisps 6 Pack', brand: 'Lidl', store: 'Lidl' }
      ],

      // Household
      household: [
        { name: 'Tesco Toilet Roll 4 Pack', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Laundry Detergent 2L', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Kitchen Roll 4 Pack', brand: 'Tesco', store: 'Tesco' },
        { name: 'Tesco Washing Up Liquid 500ml', brand: 'Tesco', store: 'Tesco' },
        { name: 'Sainsbury\'s Toilet Roll 4 Pack', brand: 'Sainsbury\'s', store: 'Sainsbury\'s' },
        { name: 'Lidl Toilet Roll 4 Pack', brand: 'Lidl', store: 'Lidl' },
        { name: 'Aldi Toilet Roll 4 Pack', brand: 'Aldi', store: 'Aldi' }
      ]
    };

    // Generate products for each category
    for (const [category, productList] of Object.entries(productCategories)) {
      console.log(`📦 Processing ${category}: ${productList.length} products`);
      
      for (const product of productList) {
        const fullProduct = this.createProduct(product, category);
        this.products.push(fullProduct);
      }
    }

    console.log(`\n✅ Generated ${this.products.length} comprehensive UK grocery products`);
    return this.products;
  }

  createProduct(product, category) {
    return {
      id: `uk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: product.name,
      brand: product.brand,
      store: product.store,
      category: category,
      quantity: this.extractQuantity(product.name),
      price: this.generatePrice(category, product.store),
      image: null,
      barcode: null,
      nutrition: this.generateNutritionForCategory(category),
      ingredients: this.generateIngredientsForCategory(category),
      allergens: this.generateAllergensForCategory(category),
      nutritionGrade: this.generateNutritionGradeForCategory(category),
      packaging: this.generatePackagingForCategory(category),
      expiry: this.generateExpiryForCategory(category),
      storage: this.generateStorageForCategory(category),
      availability: 'in_stock',
      lastUpdated: new Date().toISOString()
    };
  }

  extractQuantity(name) {
    const quantityMatch = name.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pints?|pack|packet|each)/i);
    if (quantityMatch) {
      return `${quantityMatch[1]} ${quantityMatch[2]}`;
    }
    return '1 each';
  }

  generatePrice(category, store) {
    const storeMultipliers = {
      'Tesco': 1.0,
      'Sainsbury\'s': 0.95,
      'Lidl': 0.85,
      'Iceland': 0.90,
      'Aldi': 0.80
    };

    const basePriceRanges = {
      'fresh_produce': { min: 1.00, max: 3.00 },
      'dairy': { min: 0.89, max: 1.29 },
      'meat': { min: 3.50, max: 6.50 },
      'bread': { min: 0.55, max: 1.25 },
      'frozen': { min: 1.50, max: 4.00 },
      'convenience': { min: 2.00, max: 4.00 },
      'snacks': { min: 1.00, max: 3.00 },
      'household': { min: 2.00, max: 8.00 }
    };

    const range = basePriceRanges[category] || { min: 1.00, max: 3.00 };
    const multiplier = storeMultipliers[store] || 1.0;
    const basePrice = (Math.random() * (range.max - range.min) + range.min);
    const price = (basePrice * multiplier).toFixed(2);
    
    return {
      current: parseFloat(price),
      original: parseFloat((price * 1.1).toFixed(2)),
      currency: 'GBP',
      unit: 'each'
    };
  }

  generateNutritionForCategory(category) {
    const nutritionMap = {
      'fresh_produce': { calories: 50, protein: 2.0, fat: 0.5, carbs: 12.0, sugar: 8.0, salt: 0, fiber: 3.0 },
      'dairy': { calories: 64, protein: 3.4, fat: 3.6, carbs: 4.8, sugar: 4.8, salt: 0.1, fiber: 0 },
      'meat': { calories: 165, protein: 31.0, fat: 3.6, carbs: 0, sugar: 0, salt: 0.1, fiber: 0 },
      'bread': { calories: 265, protein: 9.0, fat: 3.2, carbs: 49.0, sugar: 5.0, salt: 1.0, fiber: 2.7 },
      'frozen': { calories: 100, protein: 5.0, fat: 2.0, carbs: 15.0, sugar: 3.0, salt: 0.5, fiber: 2.0 },
      'convenience': { calories: 200, protein: 8.0, fat: 6.0, carbs: 30.0, sugar: 5.0, salt: 1.5, fiber: 2.0 },
      'snacks': { calories: 500, protein: 5.0, fat: 25.0, carbs: 60.0, sugar: 30.0, salt: 1.0, fiber: 3.0 },
      'household': { calories: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, salt: 0, fiber: 0 }
    };
    
    return nutritionMap[category] || { calories: 100, protein: 5.0, fat: 5.0, carbs: 10.0, sugar: 5.0, salt: 0.5, fiber: 1.0 };
  }

  generateIngredientsForCategory(category) {
    const ingredientsMap = {
      'fresh_produce': 'Fresh produce, no additives',
      'dairy': 'Pasteurised milk, live cultures',
      'meat': 'Fresh meat, no additives',
      'bread': 'Wheat flour, water, yeast, salt, vegetable oil, preservatives',
      'frozen': 'Frozen ingredients, preservatives',
      'convenience': 'Various ingredients, preservatives, flavourings',
      'snacks': 'Potatoes, vegetable oil, salt, flavourings',
      'household': 'Non-food item'
    };
    
    return ingredientsMap[category] || 'Natural ingredients';
  }

  generateAllergensForCategory(category) {
    const allergenMap = {
      'fresh_produce': [],
      'dairy': ['milk'],
      'meat': [],
      'bread': ['gluten', 'wheat'],
      'frozen': ['gluten', 'milk'],
      'convenience': ['gluten', 'milk', 'eggs'],
      'snacks': [],
      'household': []
    };
    
    return allergenMap[category] || [];
  }

  generateNutritionGradeForCategory(category) {
    const gradeMap = {
      'fresh_produce': 'A',
      'dairy': 'B',
      'meat': 'A',
      'bread': 'C',
      'frozen': 'B',
      'convenience': 'D',
      'snacks': 'D',
      'household': 'N/A'
    };
    
    return gradeMap[category] || 'B';
  }

  generatePackagingForCategory(category) {
    const packagingMap = {
      'fresh_produce': 'Plastic bag or container',
      'dairy': 'Plastic bottle or container',
      'meat': 'Plastic tray and wrap',
      'bread': 'Plastic bag',
      'frozen': 'Plastic bag or box',
      'convenience': 'Plastic tray or box',
      'snacks': 'Plastic bag or box',
      'household': 'Various packaging'
    };
    
    return packagingMap[category] || 'Plastic packaging';
  }

  generateExpiryForCategory(category) {
    const expiryMap = {
      'fresh_produce': { days: 7, type: 'best before' },
      'dairy': { days: 7, type: 'use by' },
      'meat': { days: 2, type: 'use by' },
      'bread': { days: 5, type: 'best before' },
      'frozen': { days: 90, type: 'best before' },
      'convenience': { days: 3, type: 'use by' },
      'snacks': { days: 90, type: 'best before' },
      'household': { days: 365, type: 'best before' }
    };
    
    const info = expiryMap[category] || { days: 7, type: 'best before' };
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + info.days);
    
    return {
      type: info.type,
      days: info.days,
      date: expiryDate.toISOString().split('T')[0],
      description: `${info.days} days from purchase`
    };
  }

  generateStorageForCategory(category) {
    const storageMap = {
      'fresh_produce': 'Store in cool, dry place or refrigerate',
      'dairy': 'Refrigerate at 2-4°C',
      'meat': 'Refrigerate at 2-4°C, use within 2 days',
      'bread': 'Store in cool, dry place',
      'frozen': 'Keep frozen at -18°C',
      'convenience': 'Refrigerate at 2-4°C',
      'snacks': 'Store in cool, dry place',
      'household': 'Store in cool, dry place'
    };
    
    return storageMap[category] || 'Store in cool, dry place';
  }

  async saveProductsToFirebase(products) {
    try {
      const firebaseService = require('./FirebaseService');
      
      console.log(`💾 Saving ${products.length} comprehensive UK products to Firebase...`);
      
      for (const product of products) {
        await firebaseService.saveProduct(product);
      }
      
      console.log(`✅ Successfully saved ${products.length} comprehensive UK products to Firebase`);
      return true;
    } catch (error) {
      console.error('❌ Error saving comprehensive UK products to Firebase:', error);
      return false;
    }
  }
}

module.exports = UKGroceryProductService;
