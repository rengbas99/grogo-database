class ComprehensiveUKProductService {
  constructor() {
    this.products = [];
  }

  generateComprehensiveProductList() {
    console.log('🚀 Generating comprehensive UK grocery product database...\n');
    
    const productCategories = {
      // TESCO PRODUCTS
      tesco_vegetables_fruit: [
        { name: 'Tesco Carrots 1kg', brand: 'Tesco', store: 'Tesco', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Tesco Potatoes 2.5kg', brand: 'Tesco', store: 'Tesco', category: 'fresh_produce', quantity: '2.5kg' },
        { name: 'Tesco Bananas 1kg', brand: 'Tesco', store: 'Tesco', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Tesco Gala Apples 1kg', brand: 'Tesco', store: 'Tesco', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Tesco Onions 1kg', brand: 'Tesco', store: 'Tesco', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Tesco Tomatoes 500g', brand: 'Tesco', store: 'Tesco', category: 'fresh_produce', quantity: '500g' },
        { name: 'Tesco Cucumbers 3 Pack', brand: 'Tesco', store: 'Tesco', category: 'fresh_produce', quantity: '3 Pack' },
        { name: 'Tesco Bell Peppers 3 Pack', brand: 'Tesco', store: 'Tesco', category: 'fresh_produce', quantity: '3 Pack' },
        { name: 'Tesco Avocados 4 Pack', brand: 'Tesco', store: 'Tesco', category: 'fresh_produce', quantity: '4 Pack' },
        { name: 'Tesco Strawberries 400g', brand: 'Tesco', store: 'Tesco', category: 'fresh_produce', quantity: '400g' },
        { name: 'Tesco Blueberries 150g', brand: 'Tesco', store: 'Tesco', category: 'fresh_produce', quantity: '150g' },
        { name: 'Tesco Finest Organic Carrots 1kg', brand: 'Tesco Finest', store: 'Tesco', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Tesco Finest Organic Apples 1kg', brand: 'Tesco Finest', store: 'Tesco', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Tesco Value Carrots 1kg', brand: 'Tesco Value', store: 'Tesco', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Tesco Value Potatoes 2.5kg', brand: 'Tesco Value', store: 'Tesco', category: 'fresh_produce', quantity: '2.5kg' },
        { name: 'Redmere Farms Carrots 1kg', brand: 'Redmere Farms', store: 'Tesco', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Rosedene Farms Apples 1kg', brand: 'Rosedene Farms', store: 'Tesco', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Suntrail Farms Oranges 1kg', brand: 'Suntrail Farms', store: 'Tesco', category: 'fresh_produce', quantity: '1kg' }
      ],

      tesco_dairy: [
        { name: 'Tesco Whole Milk 4 Pints', brand: 'Tesco', store: 'Tesco', category: 'dairy', quantity: '4 Pints' },
        { name: 'Tesco Semi-Skimmed Milk 4 Pints', brand: 'Tesco', store: 'Tesco', category: 'dairy', quantity: '4 Pints' },
        { name: 'Tesco Skimmed Milk 4 Pints', brand: 'Tesco', store: 'Tesco', category: 'dairy', quantity: '4 Pints' },
        { name: 'Tesco Free Range Eggs 12 Pack', brand: 'Tesco', store: 'Tesco', category: 'dairy', quantity: '12 Pack' },
        { name: 'Tesco Mature Cheddar 400g', brand: 'Tesco', store: 'Tesco', category: 'dairy', quantity: '400g' },
        { name: 'Tesco Butter 250g', brand: 'Tesco', store: 'Tesco', category: 'dairy', quantity: '250g' },
        { name: 'Tesco Natural Yogurt 500g', brand: 'Tesco', store: 'Tesco', category: 'dairy', quantity: '500g' },
        { name: 'Tesco Greek Yogurt 500g', brand: 'Tesco', store: 'Tesco', category: 'dairy', quantity: '500g' },
        { name: 'Tesco Finest Mature Cheddar 400g', brand: 'Tesco Finest', store: 'Tesco', category: 'dairy', quantity: '400g' },
        { name: 'Tesco Finest Organic Milk 4 Pints', brand: 'Tesco Finest', store: 'Tesco', category: 'dairy', quantity: '4 Pints' },
        { name: 'Creamfields Whole Milk 4 Pints', brand: 'Creamfields', store: 'Tesco', category: 'dairy', quantity: '4 Pints' },
        { name: 'Creamfields Mature Cheddar 400g', brand: 'Creamfields', store: 'Tesco', category: 'dairy', quantity: '400g' }
      ],

      tesco_meat_poultry: [
        { name: 'Tesco Chicken Breast 1kg', brand: 'Tesco', store: 'Tesco', category: 'meat', quantity: '1kg' },
        { name: 'Tesco Chicken Thighs 1kg', brand: 'Tesco', store: 'Tesco', category: 'meat', quantity: '1kg' },
        { name: 'Tesco Beef Mince 500g', brand: 'Tesco', store: 'Tesco', category: 'meat', quantity: '500g' },
        { name: 'Tesco Salmon Fillets 2 Pack', brand: 'Tesco', store: 'Tesco', category: 'meat', quantity: '2 Pack' },
        { name: 'Tesco Pork Chops 4 Pack', brand: 'Tesco', store: 'Tesco', category: 'meat', quantity: '4 Pack' },
        { name: 'Tesco Lamb Chops 4 Pack', brand: 'Tesco', store: 'Tesco', category: 'meat', quantity: '4 Pack' },
        { name: 'Tesco Finest Chicken Breast 1kg', brand: 'Tesco Finest', store: 'Tesco', category: 'meat', quantity: '1kg' },
        { name: 'Tesco Finest Beef Mince 500g', brand: 'Tesco Finest', store: 'Tesco', category: 'meat', quantity: '500g' },
        { name: 'Butcher\'s Choice Chicken Breast 1kg', brand: 'Butcher\'s Choice', store: 'Tesco', category: 'meat', quantity: '1kg' },
        { name: 'Boswell Farms Beef Mince 500g', brand: 'Boswell Farms', store: 'Tesco', category: 'meat', quantity: '500g' },
        { name: 'Willow Farms Chicken Thighs 1kg', brand: 'Willow Farms', store: 'Tesco', category: 'meat', quantity: '1kg' },
        { name: 'Woodside Farms Pork Chops 4 Pack', brand: 'Woodside Farms', store: 'Tesco', category: 'meat', quantity: '4 Pack' }
      ],

      tesco_bakery: [
        { name: 'Tesco White Sliced Bread 800g', brand: 'Tesco', store: 'Tesco', category: 'bread', quantity: '800g' },
        { name: 'Tesco Brown Sliced Bread 800g', brand: 'Tesco', store: 'Tesco', category: 'bread', quantity: '800g' },
        { name: 'Tesco Wholemeal Bread 800g', brand: 'Tesco', store: 'Tesco', category: 'bread', quantity: '800g' },
        { name: 'Tesco Baguette', brand: 'Tesco', store: 'Tesco', category: 'bread', quantity: '1 each' },
        { name: 'Tesco Croissants 4 Pack', brand: 'Tesco', store: 'Tesco', category: 'bread', quantity: '4 Pack' },
        { name: 'Tesco Finest Sourdough Bread 800g', brand: 'Tesco Finest', store: 'Tesco', category: 'bread', quantity: '800g' },
        { name: 'H.W. Nevill\'s White Bread 800g', brand: 'H.W. Nevill\'s', store: 'Tesco', category: 'bread', quantity: '800g' },
        { name: 'H.W. Nevill\'s Brown Bread 800g', brand: 'H.W. Nevill\'s', store: 'Tesco', category: 'bread', quantity: '800g' }
      ],

      tesco_breakfast: [
        { name: 'Tesco Corn Flakes 500g', brand: 'Tesco', store: 'Tesco', category: 'breakfast', quantity: '500g' },
        { name: 'Tesco Porridge Oats 1kg', brand: 'Tesco', store: 'Tesco', category: 'breakfast', quantity: '1kg' },
        { name: 'Tesco Muesli 750g', brand: 'Tesco', store: 'Tesco', category: 'breakfast', quantity: '750g' },
        { name: 'Tesco Breakfast Bars 6 Pack', brand: 'Tesco', store: 'Tesco', category: 'breakfast', quantity: '6 Pack' },
        { name: 'The Grower\'s Harvest Porridge Oats 1kg', brand: 'The Grower\'s Harvest', store: 'Tesco', category: 'breakfast', quantity: '1kg' }
      ],

      tesco_frozen: [
        { name: 'Tesco Frozen Mixed Vegetables 1kg', brand: 'Tesco', store: 'Tesco', category: 'frozen', quantity: '1kg' },
        { name: 'Tesco Frozen Chips 1kg', brand: 'Tesco', store: 'Tesco', category: 'frozen', quantity: '1kg' },
        { name: 'Tesco Frozen Peas 1kg', brand: 'Tesco', store: 'Tesco', category: 'frozen', quantity: '1kg' },
        { name: 'Tesco Frozen Pizza 300g', brand: 'Tesco', store: 'Tesco', category: 'frozen', quantity: '300g' },
        { name: 'Tesco Frozen Fish Fingers 20 Pack', brand: 'Tesco', store: 'Tesco', category: 'frozen', quantity: '20 Pack' },
        { name: 'Tesco Frozen Ready Meal 400g', brand: 'Tesco', store: 'Tesco', category: 'frozen', quantity: '400g' },
        { name: 'Tesco Free From Frozen Pizza 300g', brand: 'Tesco Free From', store: 'Tesco', category: 'frozen', quantity: '300g' },
        { name: 'Tesco Plant Chef Frozen Burger 4 Pack', brand: 'Tesco Plant Chef', store: 'Tesco', category: 'frozen', quantity: '4 Pack' }
      ],

      tesco_snacks: [
        { name: 'Tesco Crisps 6 Pack', brand: 'Tesco', store: 'Tesco', category: 'snacks', quantity: '6 Pack' },
        { name: 'Tesco Chocolate Bar 100g', brand: 'Tesco', store: 'Tesco', category: 'snacks', quantity: '100g' },
        { name: 'Tesco Biscuits 300g', brand: 'Tesco', store: 'Tesco', category: 'snacks', quantity: '300g' },
        { name: 'Ms Molly\'s Chocolate Cake', brand: 'Ms Molly\'s', store: 'Tesco', category: 'snacks', quantity: '1 each' },
        { name: 'Ms Molly\'s Digestive Biscuits 300g', brand: 'Ms Molly\'s', store: 'Tesco', category: 'snacks', quantity: '300g' }
      ],

      tesco_household: [
        { name: 'Tesco Toilet Roll 4 Pack', brand: 'Tesco', store: 'Tesco', category: 'household', quantity: '4 Pack' },
        { name: 'Tesco Laundry Detergent 2L', brand: 'Tesco', store: 'Tesco', category: 'household', quantity: '2L' },
        { name: 'Tesco Kitchen Roll 4 Pack', brand: 'Tesco', store: 'Tesco', category: 'household', quantity: '4 Pack' },
        { name: 'Tesco Washing Up Liquid 500ml', brand: 'Tesco', store: 'Tesco', category: 'household', quantity: '500ml' },
        { name: 'Stockwell & Co. Toilet Roll 4 Pack', brand: 'Stockwell & Co.', store: 'Tesco', category: 'household', quantity: '4 Pack' }
      ],

      // SAINSBURY'S PRODUCTS
      sainsburys_vegetables_fruit: [
        { name: 'Sainsbury\'s Bananas 1kg', brand: 'Sainsbury\'s', store: 'Sainsbury\'s', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Sainsbury\'s Apples 1kg', brand: 'Sainsbury\'s', store: 'Sainsbury\'s', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Sainsbury\'s Carrots 1kg', brand: 'Sainsbury\'s', store: 'Sainsbury\'s', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Sainsbury\'s Potatoes 2.5kg', brand: 'Sainsbury\'s', store: 'Sainsbury\'s', category: 'fresh_produce', quantity: '2.5kg' },
        { name: 'Sainsbury\'s Taste the Difference Organic Carrots 1kg', brand: 'Taste the Difference', store: 'Sainsbury\'s', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Sainsbury\'s SO Organic Apples 1kg', brand: 'SO Organic', store: 'Sainsbury\'s', category: 'fresh_produce', quantity: '1kg' }
      ],

      sainsburys_dairy: [
        { name: 'Sainsbury\'s Whole Milk 4 Pints', brand: 'Sainsbury\'s', store: 'Sainsbury\'s', category: 'dairy', quantity: '4 Pints' },
        { name: 'Sainsbury\'s Free Range Eggs 12 Pack', brand: 'Sainsbury\'s', store: 'Sainsbury\'s', category: 'dairy', quantity: '12 Pack' },
        { name: 'Sainsbury\'s Mature Cheddar 400g', brand: 'Sainsbury\'s', store: 'Sainsbury\'s', category: 'dairy', quantity: '400g' },
        { name: 'Sainsbury\'s Taste the Difference Mature Cheddar 400g', brand: 'Taste the Difference', store: 'Sainsbury\'s', category: 'dairy', quantity: '400g' },
        { name: 'Mary Ann\'s Dairy Cheddar 400g', brand: 'Mary Ann\'s Dairy', store: 'Sainsbury\'s', category: 'dairy', quantity: '400g' },
        { name: 'Mary Ann\'s Dairy Greek Yogurt 500g', brand: 'Mary Ann\'s Dairy', store: 'Sainsbury\'s', category: 'dairy', quantity: '500g' }
      ],

      sainsburys_meat_poultry: [
        { name: 'Sainsbury\'s Chicken Breast 1kg', brand: 'Sainsbury\'s', store: 'Sainsbury\'s', category: 'meat', quantity: '1kg' },
        { name: 'Sainsbury\'s Beef Mince 500g', brand: 'Sainsbury\'s', store: 'Sainsbury\'s', category: 'meat', quantity: '500g' },
        { name: 'Sainsbury\'s Taste the Difference Chicken Breast 1kg', brand: 'Taste the Difference', store: 'Sainsbury\'s', category: 'meat', quantity: '1kg' },
        { name: 'J James & Family Beef Mince 500g', brand: 'J James & Family', store: 'Sainsbury\'s', category: 'meat', quantity: '500g' }
      ],

      sainsburys_bakery: [
        { name: 'Sainsbury\'s White Bread 800g', brand: 'Sainsbury\'s', store: 'Sainsbury\'s', category: 'bread', quantity: '800g' },
        { name: 'Sainsbury\'s Olive Bread 800g', brand: 'Sainsbury\'s', store: 'Sainsbury\'s', category: 'bread', quantity: '800g' },
        { name: 'Sainsbury\'s Rye Bread 800g', brand: 'Sainsbury\'s', store: 'Sainsbury\'s', category: 'bread', quantity: '800g' }
      ],

      sainsburys_snacks: [
        { name: 'Sainsbury\'s Crisps 6 Pack', brand: 'Sainsbury\'s', store: 'Sainsbury\'s', category: 'snacks', quantity: '6 Pack' },
        { name: 'Lovett\'s Family Favourites Biscuits 300g', brand: 'Lovett\'s Family Favourites', store: 'Sainsbury\'s', category: 'snacks', quantity: '300g' },
        { name: 'Just Snax Crisps 6 Pack', brand: 'Just Snax', store: 'Sainsbury\'s', category: 'snacks', quantity: '6 Pack' }
      ],

      // LIDL PRODUCTS
      lidl_vegetables_fruit: [
        { name: 'Lidl Bananas 1kg', brand: 'Lidl', store: 'Lidl', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Lidl Apples 1kg', brand: 'Lidl', store: 'Lidl', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Lidl Carrots 1kg', brand: 'Lidl', store: 'Lidl', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Lidl Potatoes 2.5kg', brand: 'Lidl', store: 'Lidl', category: 'fresh_produce', quantity: '2.5kg' }
      ],

      lidl_dairy: [
        { name: 'Lidl Whole Milk 4 Pints', brand: 'Lidl', store: 'Lidl', category: 'dairy', quantity: '4 Pints' },
        { name: 'Lidl Free Range Eggs 12 Pack', brand: 'Lidl', store: 'Lidl', category: 'dairy', quantity: '12 Pack' },
        { name: 'Milbona Greek Yogurt 500g', brand: 'Milbona', store: 'Lidl', category: 'dairy', quantity: '500g' },
        { name: 'Milbona Mature Cheddar 400g', brand: 'Milbona', store: 'Lidl', category: 'dairy', quantity: '400g' }
      ],

      lidl_meat_poultry: [
        { name: 'Lidl Chicken Breast 1kg', brand: 'Lidl', store: 'Lidl', category: 'meat', quantity: '1kg' },
        { name: 'Riverway Beef Mince 500g', brand: 'Riverway', store: 'Lidl', category: 'meat', quantity: '500g' },
        { name: 'Ocean Sea Salmon Fillets 2 Pack', brand: 'Ocean Sea', store: 'Lidl', category: 'meat', quantity: '2 Pack' }
      ],

      lidl_bakery: [
        { name: 'Lidl White Bread 800g', brand: 'Lidl', store: 'Lidl', category: 'bread', quantity: '800g' },
        { name: 'Lidl Croissants 4 Pack', brand: 'Lidl', store: 'Lidl', category: 'bread', quantity: '4 Pack' }
      ],

      lidl_snacks: [
        { name: 'Lidl Crisps 6 Pack', brand: 'Lidl', store: 'Lidl', category: 'snacks', quantity: '6 Pack' },
        { name: 'Bellarom Coffee 200g', brand: 'Bellarom', store: 'Lidl', category: 'snacks', quantity: '200g' },
        { name: 'Bellarom Chocolate 100g', brand: 'Bellarom', store: 'Lidl', category: 'snacks', quantity: '100g' }
      ],

      // ALDI PRODUCTS
      aldi_vegetables_fruit: [
        { name: 'Aldi Bananas 1kg', brand: 'Aldi', store: 'Aldi', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Aldi Apples 1kg', brand: 'Aldi', store: 'Aldi', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Aldi Carrots 1kg', brand: 'Aldi', store: 'Aldi', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Aldi Potatoes 2.5kg', brand: 'Aldi', store: 'Aldi', category: 'fresh_produce', quantity: '2.5kg' }
      ],

      aldi_dairy: [
        { name: 'Aldi Whole Milk 4 Pints', brand: 'Aldi', store: 'Aldi', category: 'dairy', quantity: '4 Pints' },
        { name: 'Aldi Free Range Eggs 12 Pack', brand: 'Aldi', store: 'Aldi', category: 'dairy', quantity: '12 Pack' },
        { name: 'Aldi Mature Cheddar 400g', brand: 'Aldi', store: 'Aldi', category: 'dairy', quantity: '400g' }
      ],

      aldi_meat_poultry: [
        { name: 'Aldi Chicken Breast 1kg', brand: 'Aldi', store: 'Aldi', category: 'meat', quantity: '1kg' },
        { name: 'Ashfields Beef Mince 500g', brand: 'Ashfields', store: 'Aldi', category: 'meat', quantity: '500g' },
        { name: 'The Fishmonger Salmon Fillets 2 Pack', brand: 'The Fishmonger', store: 'Aldi', category: 'meat', quantity: '2 Pack' }
      ],

      aldi_bakery: [
        { name: 'Aldi White Bread 800g', brand: 'Aldi', store: 'Aldi', category: 'bread', quantity: '800g' },
        { name: 'The Village Bakery White Bread 800g', brand: 'The Village Bakery', store: 'Aldi', category: 'bread', quantity: '800g' }
      ],

      aldi_snacks: [
        { name: 'Aldi Crisps 6 Pack', brand: 'Aldi', store: 'Aldi', category: 'snacks', quantity: '6 Pack' },
        { name: 'Snackrite Crisps 6 Pack', brand: 'Snackrite', store: 'Aldi', category: 'snacks', quantity: '6 Pack' },
        { name: 'Elevation Protein Bars 6 Pack', brand: 'Elevation', store: 'Aldi', category: 'snacks', quantity: '6 Pack' }
      ],

      // ICELAND PRODUCTS
      iceland_frozen: [
        { name: 'Iceland Frozen Mixed Vegetables 1kg', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '1kg' },
        { name: 'Iceland Frozen Chips 1kg', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '1kg' },
        { name: 'Iceland Frozen Fish Fillets 1kg', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '1kg' },
        { name: 'Iceland Frozen Ready Meal 400g', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '400g' },
        { name: 'Greggs Frozen Sausage Rolls 6 Pack', brand: 'Greggs', store: 'Iceland', category: 'frozen', quantity: '6 Pack' },
        { name: 'Greggs Frozen Steak Bakes 4 Pack', brand: 'Greggs', store: 'Iceland', category: 'frozen', quantity: '4 Pack' },
        { name: 'TGI Friday\'s Frozen Ready Meal 400g', brand: 'TGI Friday\'s', store: 'Iceland', category: 'frozen', quantity: '400g' },
        { name: 'Slimming World Frozen Ready Meal 400g', brand: 'Slimming World', store: 'Iceland', category: 'frozen', quantity: '400g' }
      ],

      iceland_fresh: [
        { name: 'Iceland Bananas 1kg', brand: 'Iceland', store: 'Iceland', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Iceland Apples 1kg', brand: 'Iceland', store: 'Iceland', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Iceland Whole Milk 4 Pints', brand: 'Iceland', store: 'Iceland', category: 'dairy', quantity: '4 Pints' }
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

    console.log(`\n✅ Generated ${this.products.length} comprehensive UK grocery products`);
    return this.products;
  }

  createProduct(product, category) {
    return {
      id: `comprehensive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      'fresh_produce': { min: 1.00, max: 3.00 },
      'dairy': { min: 0.89, max: 1.29 },
      'meat': { min: 3.50, max: 6.50 },
      'bread': { min: 0.55, max: 1.25 },
      'frozen': { min: 1.50, max: 4.00 },
      'breakfast': { min: 1.00, max: 3.00 },
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
      'breakfast': { calories: 200, protein: 8.0, fat: 6.0, carbs: 30.0, sugar: 5.0, salt: 1.5, fiber: 2.0 },
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
      'breakfast': 'Cereals, sugar, salt, vitamins, minerals',
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
      'breakfast': ['gluten', 'milk'],
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
      'breakfast': 'C',
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
      'breakfast': 'Cardboard box',
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
      'breakfast': { days: 365, type: 'best before' },
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
      'breakfast': 'Store in cool, dry place',
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

module.exports = ComprehensiveUKProductService;
