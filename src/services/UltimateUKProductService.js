class UltimateUKProductService {
  constructor() {
    this.products = [];
  }

  generateUltimateProductList() {
    console.log('🚀 Generating ULTIMATE UK grocery product database with all categories...\n');
    
    const productCategories = {
      // VEGETABLES & FRUIT - Fresh Produce
      vegetables_fruit: [
        { name: 'Organic Carrots 1kg', brand: 'Tesco Organic', store: 'Tesco', category: 'vegetables_fruit', quantity: '1kg' },
        { name: 'Finest Gala Apples 1kg', brand: 'Tesco Finest', store: 'Tesco', category: 'vegetables_fruit', quantity: '1kg' },
        { name: 'Organic Bananas 1kg', brand: 'Sainsbury\'s Organic', store: 'Sainsbury\'s', category: 'vegetables_fruit', quantity: '1kg' },
        { name: 'Taste the Difference Strawberries 400g', brand: 'Taste the Difference', store: 'Sainsbury\'s', category: 'vegetables_fruit', quantity: '400g' },
        { name: 'Fresh Spinach 200g', brand: 'Lidl', store: 'Lidl', category: 'vegetables_fruit', quantity: '200g' },
        { name: 'Organic Tomatoes 500g', brand: 'Aldi Organic', store: 'Aldi', category: 'vegetables_fruit', quantity: '500g' },
        { name: 'Avocados 4 Pack', brand: 'Iceland', store: 'Iceland', category: 'vegetables_fruit', quantity: '4 Pack' },
        { name: 'Mixed Bell Peppers 3 Pack', brand: 'Tesco', store: 'Tesco', category: 'vegetables_fruit', quantity: '3 Pack' },
        { name: 'Cucumber', brand: 'Sainsbury\'s', store: 'Sainsbury\'s', category: 'vegetables_fruit', quantity: '1 each' },
        { name: 'Lettuce', brand: 'Lidl', store: 'Lidl', category: 'vegetables_fruit', quantity: '1 each' }
      ],

      // DAIRY - Milk, Cheese, Yogurts, Butter, Cream
      dairy: [
        { name: 'Whole Milk 4 Pints', brand: 'Creamfields', store: 'Tesco', category: 'dairy', quantity: '4 Pints' },
        { name: 'Semi-Skimmed Milk 4 Pints', brand: 'By Sainsbury\'s', store: 'Sainsbury\'s', category: 'dairy', quantity: '4 Pints' },
        { name: 'Skimmed Milk 4 Pints', brand: 'Milbona', store: 'Lidl', category: 'dairy', quantity: '4 Pints' },
        { name: 'Mature Cheddar 400g', brand: 'Taste the Difference', store: 'Sainsbury\'s', category: 'dairy', quantity: '400g' },
        { name: 'Greek Yogurt 500g', brand: 'Milbona', store: 'Lidl', category: 'dairy', quantity: '500g' },
        { name: 'Natural Yogurt 500g', brand: 'Cowbelle', store: 'Aldi', category: 'dairy', quantity: '500g' },
        { name: 'Butter 250g', brand: 'Creamfields', store: 'Tesco', category: 'dairy', quantity: '250g' },
        { name: 'Double Cream 300ml', brand: 'By Sainsbury\'s', store: 'Sainsbury\'s', category: 'dairy', quantity: '300ml' },
        { name: 'Free Range Eggs 12 Pack', brand: 'Tesco', store: 'Tesco', category: 'dairy', quantity: '12 Pack' },
        { name: 'Cream Cheese 200g', brand: 'Milbona', store: 'Lidl', category: 'dairy', quantity: '200g' }
      ],

      // MEAT & POULTRY - Fresh and Pre-packaged
      meat_poultry: [
        { name: 'Beef Mince 500g', brand: 'Boswell Farms', store: 'Tesco', category: 'meat_poultry', quantity: '500g' },
        { name: 'Chicken Breast 1kg', brand: 'Willow Farms', store: 'Tesco', category: 'meat_poultry', quantity: '1kg' },
        { name: 'Pork Sausages 8 Pack', brand: 'Woodside Farms', store: 'Tesco', category: 'meat_poultry', quantity: '8 Pack' },
        { name: 'Bacon 200g', brand: 'J James & Family', store: 'Sainsbury\'s', category: 'meat_poultry', quantity: '200g' },
        { name: 'Lamb Chops 4 Pack', brand: 'Taste the Difference', store: 'Sainsbury\'s', category: 'meat_poultry', quantity: '4 Pack' },
        { name: 'Chicken Thighs 1kg', brand: 'Riverway', store: 'Lidl', category: 'meat_poultry', quantity: '1kg' },
        { name: 'Beef Steak 400g', brand: 'Ashfields', store: 'Aldi', category: 'meat_poultry', quantity: '400g' },
        { name: 'Salmon Fillets 2 Pack', brand: 'The Fishmonger', store: 'Tesco', category: 'meat_poultry', quantity: '2 Pack' },
        { name: 'Cod Fillets 2 Pack', brand: 'Fish Said Fred', store: 'Sainsbury\'s', category: 'meat_poultry', quantity: '2 Pack' },
        { name: 'Prawns 200g', brand: 'Ocean Sea', store: 'Lidl', category: 'meat_poultry', quantity: '200g' }
      ],

      // BAKERY ITEMS - Fresh Bread, Rolls, Pastries, Cakes
      bakery: [
        { name: 'White Sliced Bread 800g', brand: 'H.W. Nevill\'s', store: 'Tesco', category: 'bakery', quantity: '800g' },
        { name: 'Brown Sliced Bread 800g', brand: 'H.W. Nevill\'s', store: 'Tesco', category: 'bakery', quantity: '800g' },
        { name: 'Sourdough Bread 800g', brand: 'The Village Bakery', store: 'Aldi', category: 'bakery', quantity: '800g' },
        { name: 'Baguette', brand: 'Lidl Fresh', store: 'Lidl', category: 'bakery', quantity: '1 each' },
        { name: 'Croissants 4 Pack', brand: 'H.W. Nevill\'s', store: 'Tesco', category: 'bakery', quantity: '4 Pack' },
        { name: 'Danish Pastries 4 Pack', brand: 'Lidl Fresh', store: 'Lidl', category: 'bakery', quantity: '4 Pack' },
        { name: 'Victoria Sponge', brand: 'The Cake Stall', store: 'Tesco', category: 'bakery', quantity: '1 each' },
        { name: 'Chocolate Cake', brand: 'The Cake Stall', store: 'Tesco', category: 'bakery', quantity: '1 each' },
        { name: 'Muffins 4 Pack', brand: 'The Cake Stall', store: 'Tesco', category: 'bakery', quantity: '4 Pack' },
        { name: 'Artisan Bread 800g', brand: 'Taste the Difference', store: 'Sainsbury\'s', category: 'bakery', quantity: '800g' }
      ],

      // BREAKFAST ITEMS - Cereals, Porridge, Breakfast Bars
      breakfast: [
        { name: 'Corn Flakes 500g', brand: 'Harvest Morn', store: 'Aldi', category: 'breakfast', quantity: '500g' },
        { name: 'Muesli 750g', brand: 'Harvest Morn', store: 'Aldi', category: 'breakfast', quantity: '750g' },
        { name: 'Porridge Oats 1kg', brand: 'The Grower\'s Harvest', store: 'Tesco', category: 'breakfast', quantity: '1kg' },
        { name: 'Granola 500g', brand: 'Harvest Morn', store: 'Aldi', category: 'breakfast', quantity: '500g' },
        { name: 'Breakfast Bars 6 Pack', brand: 'Tesco', store: 'Tesco', category: 'breakfast', quantity: '6 Pack' },
        { name: 'Weetabix 24 Pack', brand: 'Tesco', store: 'Tesco', category: 'breakfast', quantity: '24 Pack' },
        { name: 'Coco Pops 500g', brand: 'Kellogg\'s', store: 'Sainsbury\'s', category: 'breakfast', quantity: '500g' },
        { name: 'Shredded Wheat 24 Pack', brand: 'Nestlé', store: 'Sainsbury\'s', category: 'breakfast', quantity: '24 Pack' }
      ],

      // SPICES & WORLD FOODS - International Cuisine
      spices_world_foods: [
        { name: 'Curry Powder 100g', brand: 'Tesco', store: 'Tesco', category: 'spices_world_foods', quantity: '100g' },
        { name: 'Cumin Seeds 50g', brand: 'Sainsbury\'s', store: 'Sainsbury\'s', category: 'spices_world_foods', quantity: '50g' },
        { name: 'Turmeric 100g', brand: 'Lidl', store: 'Lidl', category: 'spices_world_foods', quantity: '100g' },
        { name: 'Olive Oil 500ml', brand: 'Eridanous', store: 'Lidl', category: 'spices_world_foods', quantity: '500ml' },
        { name: 'Feta Cheese 200g', brand: 'Eridanous', store: 'Lidl', category: 'spices_world_foods', quantity: '200g' },
        { name: 'Pasta 500g', brand: 'Baresa', store: 'Lidl', category: 'spices_world_foods', quantity: '500g' },
        { name: 'Tomato Sauce 400g', brand: 'Baresa', store: 'Lidl', category: 'spices_world_foods', quantity: '400g' },
        { name: 'Basmati Rice 1kg', brand: 'Tesco', store: 'Tesco', category: 'spices_world_foods', quantity: '1kg' },
        { name: 'Coconut Milk 400ml', brand: 'Sainsbury\'s', store: 'Sainsbury\'s', category: 'spices_world_foods', quantity: '400ml' },
        { name: 'Soy Sauce 150ml', brand: 'Tesco', store: 'Tesco', category: 'spices_world_foods', quantity: '150ml' }
      ],

      // FROZEN FOOD PRODUCTS - Ready Meals, Pizzas, Vegetables, Ice Cream
      frozen: [
        { name: 'Frozen Mixed Vegetables 1kg', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '1kg' },
        { name: 'Frozen Pizza 300g', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '300g' },
        { name: 'Frozen Fish Fingers 20 Pack', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '20 Pack' },
        { name: 'Frozen Ready Meal 400g', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '400g' },
        { name: 'Frozen Ice Cream 1L', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '1L' },
        { name: 'Greggs Frozen Sausage Rolls 6 Pack', brand: 'Greggs', store: 'Iceland', category: 'frozen', quantity: '6 Pack' },
        { name: 'TGI Friday\'s Frozen Chicken Wings 400g', brand: 'TGI Friday\'s', store: 'Iceland', category: 'frozen', quantity: '400g' },
        { name: 'Slimming World Frozen Chicken Curry 400g', brand: 'Slimming World', store: 'Iceland', category: 'frozen', quantity: '400g' },
        { name: 'Frozen Chips 1kg', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '1kg' },
        { name: 'Frozen Peas 1kg', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '1kg' }
      ],

      // ESSENTIALS - Household Items, Cleaning, Toiletries
      essentials: [
        { name: 'Toilet Roll 4 Pack', brand: 'Tesco', store: 'Tesco', category: 'essentials', quantity: '4 Pack' },
        { name: 'Kitchen Roll 4 Pack', brand: 'Tesco', store: 'Tesco', category: 'essentials', quantity: '4 Pack' },
        { name: 'Laundry Detergent 2L', brand: 'Tesco', store: 'Tesco', category: 'essentials', quantity: '2L' },
        { name: 'Washing Up Liquid 500ml', brand: 'Tesco', store: 'Tesco', category: 'essentials', quantity: '500ml' },
        { name: 'Shampoo 400ml', brand: 'Cien', store: 'Lidl', category: 'essentials', quantity: '400ml' },
        { name: 'Body Wash 400ml', brand: 'Cien', store: 'Lidl', category: 'essentials', quantity: '400ml' },
        { name: 'All-Purpose Cleaner 750ml', brand: 'W5', store: 'Lidl', category: 'essentials', quantity: '750ml' },
        { name: 'Toothpaste 100ml', brand: 'Tesco', store: 'Tesco', category: 'essentials', quantity: '100ml' },
        { name: 'Dishwasher Tablets 30 Pack', brand: 'Tesco', store: 'Tesco', category: 'essentials', quantity: '30 Pack' },
        { name: 'Fabric Softener 1L', brand: 'Tesco', store: 'Tesco', category: 'essentials', quantity: '1L' }
      ],

      // SNACKS & BEVERAGES - Crisps, Nuts, Chocolate, Sweets, Soft Drinks
      snacks_beverages: [
        { name: 'Salt & Vinegar Crisps 6 Pack', brand: 'Just Snax', store: 'Sainsbury\'s', category: 'snacks_beverages', quantity: '6 Pack' },
        { name: 'Ready Salted Crisps 6 Pack', brand: 'Snackrite', store: 'Aldi', category: 'snacks_beverages', quantity: '6 Pack' },
        { name: 'Mixed Nuts 200g', brand: 'Just Snax', store: 'Sainsbury\'s', category: 'snacks_beverages', quantity: '200g' },
        { name: 'Dark Chocolate 100g', brand: 'Moser Roth', store: 'Aldi', category: 'snacks_beverages', quantity: '100g' },
        { name: 'Milk Chocolate 200g', brand: 'Dairyfine', store: 'Aldi', category: 'snacks_beverages', quantity: '200g' },
        { name: 'Digestives 300g', brand: 'Lovett\'s Family Favourites', store: 'Sainsbury\'s', category: 'snacks_beverages', quantity: '300g' },
        { name: 'Coca Cola 2L', brand: 'Coca Cola', store: 'Tesco', category: 'snacks_beverages', quantity: '2L' },
        { name: 'Orange Juice 1L', brand: 'Tesco', store: 'Tesco', category: 'snacks_beverages', quantity: '1L' },
        { name: 'Water 2L', brand: 'Tesco', store: 'Tesco', category: 'snacks_beverages', quantity: '2L' },
        { name: 'Tea Bags 80 Pack', brand: 'Tesco', store: 'Tesco', category: 'snacks_beverages', quantity: '80 Pack' },
        { name: 'Coffee 200g', brand: 'Bellarom', store: 'Lidl', category: 'snacks_beverages', quantity: '200g' },
        { name: 'Wine 750ml', brand: 'Tesco', store: 'Tesco', category: 'snacks_beverages', quantity: '750ml' }
      ]
    };

    // Generate products for each category
    for (const [category, productList] of Object.entries(productCategories)) {
      console.log(`📦 Processing ${category}: ${productList.length} products`);
      
      for (const product of productList) {
        const fullProduct = this.createProduct(product, product.category);
        this.products.push(fullProduct);
      }
    }

    console.log(`\n✅ Generated ${this.products.length} ULTIMATE UK grocery products with all categories`);
    return this.products;
  }

  createProduct(product, category) {
    return {
      id: `ultimate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: product.name,
      brand: product.brand,
      store: product.store,
      category: category,
      quantity: product.quantity,
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

  generatePrice(category, store) {
    const storeMultipliers = {
      'Tesco': 1.0,
      'Sainsbury\'s': 0.95,
      'Lidl': 0.85,
      'Iceland': 0.90,
      'Aldi': 0.80
    };

    const basePriceRanges = {
      'vegetables_fruit': { min: 1.00, max: 3.50 },
      'dairy': { min: 0.89, max: 2.50 },
      'meat_poultry': { min: 3.50, max: 8.00 },
      'bakery': { min: 0.55, max: 2.50 },
      'breakfast': { min: 1.50, max: 4.00 },
      'spices_world_foods': { min: 0.50, max: 3.00 },
      'frozen': { min: 1.50, max: 5.00 },
      'essentials': { min: 2.00, max: 8.00 },
      'snacks_beverages': { min: 1.00, max: 4.00 }
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
      'vegetables_fruit': { calories: 50, protein: 2.0, fat: 0.5, carbs: 12.0, sugar: 8.0, salt: 0, fiber: 3.0 },
      'dairy': { calories: 64, protein: 3.4, fat: 3.6, carbs: 4.8, sugar: 4.8, salt: 0.1, fiber: 0 },
      'meat_poultry': { calories: 165, protein: 31.0, fat: 3.6, carbs: 0, sugar: 0, salt: 0.1, fiber: 0 },
      'bakery': { calories: 265, protein: 9.0, fat: 3.2, carbs: 49.0, sugar: 5.0, salt: 1.0, fiber: 2.7 },
      'breakfast': { calories: 200, protein: 8.0, fat: 6.0, carbs: 30.0, sugar: 5.0, salt: 1.5, fiber: 2.0 },
      'spices_world_foods': { calories: 100, protein: 2.0, fat: 5.0, carbs: 15.0, sugar: 2.0, salt: 0.5, fiber: 1.0 },
      'frozen': { calories: 100, protein: 5.0, fat: 2.0, carbs: 15.0, sugar: 3.0, salt: 0.5, fiber: 2.0 },
      'essentials': { calories: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, salt: 0, fiber: 0 },
      'snacks_beverages': { calories: 400, protein: 5.0, fat: 20.0, carbs: 50.0, sugar: 25.0, salt: 1.0, fiber: 2.0 }
    };
    
    return nutritionMap[category] || { calories: 100, protein: 5.0, fat: 5.0, carbs: 10.0, sugar: 5.0, salt: 0.5, fiber: 1.0 };
  }

  generateIngredientsForCategory(category) {
    const ingredientsMap = {
      'vegetables_fruit': 'Fresh produce, no additives',
      'dairy': 'Pasteurised milk, live cultures',
      'meat_poultry': 'Fresh meat, no additives',
      'bakery': 'Wheat flour, water, yeast, salt, vegetable oil, preservatives',
      'breakfast': 'Cereals, sugar, salt, vitamins, minerals',
      'spices_world_foods': 'Natural ingredients, herbs, spices',
      'frozen': 'Frozen ingredients, preservatives',
      'essentials': 'Non-food item',
      'snacks_beverages': 'Various ingredients, flavourings, preservatives'
    };
    
    return ingredientsMap[category] || 'Natural ingredients';
  }

  generateAllergensForCategory(category) {
    const allergenMap = {
      'vegetables_fruit': [],
      'dairy': ['milk'],
      'meat_poultry': [],
      'bakery': ['gluten', 'wheat'],
      'breakfast': ['gluten', 'milk'],
      'spices_world_foods': [],
      'frozen': ['gluten', 'milk'],
      'essentials': [],
      'snacks_beverages': ['gluten', 'milk', 'nuts']
    };
    
    return allergenMap[category] || [];
  }

  generateNutritionGradeForCategory(category) {
    const gradeMap = {
      'vegetables_fruit': 'A',
      'dairy': 'B',
      'meat_poultry': 'A',
      'bakery': 'C',
      'breakfast': 'C',
      'spices_world_foods': 'A',
      'frozen': 'B',
      'essentials': 'N/A',
      'snacks_beverages': 'D'
    };
    
    return gradeMap[category] || 'B';
  }

  generatePackagingForCategory(category) {
    const packagingMap = {
      'vegetables_fruit': 'Plastic bag or container',
      'dairy': 'Plastic bottle or container',
      'meat_poultry': 'Plastic tray and wrap',
      'bakery': 'Plastic bag',
      'breakfast': 'Cardboard box',
      'spices_world_foods': 'Glass jar or plastic container',
      'frozen': 'Plastic bag or box',
      'essentials': 'Various packaging',
      'snacks_beverages': 'Plastic bag, bottle, or box'
    };
    
    return packagingMap[category] || 'Plastic packaging';
  }

  generateExpiryForCategory(category) {
    const expiryMap = {
      'vegetables_fruit': { days: 7, type: 'best before' },
      'dairy': { days: 7, type: 'use by' },
      'meat_poultry': { days: 2, type: 'use by' },
      'bakery': { days: 5, type: 'best before' },
      'breakfast': { days: 365, type: 'best before' },
      'spices_world_foods': { days: 730, type: 'best before' },
      'frozen': { days: 90, type: 'best before' },
      'essentials': { days: 365, type: 'best before' },
      'snacks_beverages': { days: 90, type: 'best before' }
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
      'vegetables_fruit': 'Store in cool, dry place or refrigerate',
      'dairy': 'Refrigerate at 2-4°C',
      'meat_poultry': 'Refrigerate at 2-4°C, use within 2 days',
      'bakery': 'Store in cool, dry place',
      'breakfast': 'Store in cool, dry place',
      'spices_world_foods': 'Store in cool, dry place',
      'frozen': 'Keep frozen at -18°C',
      'essentials': 'Store in cool, dry place',
      'snacks_beverages': 'Store in cool, dry place'
    };
    
    return storageMap[category] || 'Store in cool, dry place';
  }

  async saveProductsToFirebase(products) {
    try {
      const firebaseService = require('./FirebaseService');
      
      console.log(`💾 Saving ${products.length} ULTIMATE UK products to Firebase...`);
      
      for (const product of products) {
        await firebaseService.saveProduct(product);
      }
      
      console.log(`✅ Successfully saved ${products.length} ULTIMATE UK products to Firebase`);
      return true;
    } catch (error) {
      console.error('❌ Error saving ULTIMATE UK products to Firebase:', error);
      return false;
    }
  }
}

module.exports = UltimateUKProductService;
