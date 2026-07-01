class EnhancedUKProductService {
  constructor() {
    this.products = [];
  }

  generateEnhancedProductList() {
    console.log('🚀 Generating enhanced UK grocery product database with specific brand categories...\n');
    
    const productCategories = {
      // TESCO BAKERY - H.W. Nevill's & The Cake Stall
      tesco_bakery: [
        { name: 'H.W. Nevill\'s White Sliced Bread 800g', brand: 'H.W. Nevill\'s', store: 'Tesco', category: 'bread', quantity: '800g' },
        { name: 'H.W. Nevill\'s Brown Sliced Bread 800g', brand: 'H.W. Nevill\'s', store: 'Tesco', category: 'bread', quantity: '800g' },
        { name: 'H.W. Nevill\'s Wholemeal Bread 800g', brand: 'H.W. Nevill\'s', store: 'Tesco', category: 'bread', quantity: '800g' },
        { name: 'H.W. Nevill\'s Baguette', brand: 'H.W. Nevill\'s', store: 'Tesco', category: 'bread', quantity: '1 each' },
        { name: 'H.W. Nevill\'s Croissants 4 Pack', brand: 'H.W. Nevill\'s', store: 'Tesco', category: 'bread', quantity: '4 Pack' },
        { name: 'H.W. Nevill\'s Sourdough Bread 800g', brand: 'H.W. Nevill\'s', store: 'Tesco', category: 'bread', quantity: '800g' },
        { name: 'The Cake Stall Victoria Sponge', brand: 'The Cake Stall', store: 'Tesco', category: 'snacks', quantity: '1 each' },
        { name: 'The Cake Stall Chocolate Cake', brand: 'The Cake Stall', store: 'Tesco', category: 'snacks', quantity: '1 each' },
        { name: 'The Cake Stall Muffins 4 Pack', brand: 'The Cake Stall', store: 'Tesco', category: 'snacks', quantity: '4 Pack' }
      ],

      // TESCO MEAT & FISH - Farm Brands
      tesco_meat_fish: [
        { name: 'Boswell Farms Beef Mince 500g', brand: 'Boswell Farms', store: 'Tesco', category: 'meat', quantity: '500g' },
        { name: 'Boswell Farms Beef Steak 400g', brand: 'Boswell Farms', store: 'Tesco', category: 'meat', quantity: '400g' },
        { name: 'Boswell Farms Beef Roast 1kg', brand: 'Boswell Farms', store: 'Tesco', category: 'meat', quantity: '1kg' },
        { name: 'Willow Farms Chicken Breast 1kg', brand: 'Willow Farms', store: 'Tesco', category: 'meat', quantity: '1kg' },
        { name: 'Willow Farms Chicken Thighs 1kg', brand: 'Willow Farms', store: 'Tesco', category: 'meat', quantity: '1kg' },
        { name: 'Willow Farms Whole Chicken 1.5kg', brand: 'Willow Farms', store: 'Tesco', category: 'meat', quantity: '1.5kg' },
        { name: 'Woodside Farms Pork Chops 4 Pack', brand: 'Woodside Farms', store: 'Tesco', category: 'meat', quantity: '4 Pack' },
        { name: 'Woodside Farms Pork Sausages 8 Pack', brand: 'Woodside Farms', store: 'Tesco', category: 'meat', quantity: '8 Pack' },
        { name: 'Woodside Farms Bacon 200g', brand: 'Woodside Farms', store: 'Tesco', category: 'meat', quantity: '200g' },
        { name: 'The Fishmonger Salmon Fillets 2 Pack', brand: 'The Fishmonger', store: 'Tesco', category: 'meat', quantity: '2 Pack' },
        { name: 'The Fishmonger Cod Fillets 2 Pack', brand: 'The Fishmonger', store: 'Tesco', category: 'meat', quantity: '2 Pack' },
        { name: 'The Fishmonger Prawns 200g', brand: 'The Fishmonger', store: 'Tesco', category: 'meat', quantity: '200g' }
      ],

      // TESCO PRODUCE - Farm Brands
      tesco_produce: [
        { name: 'Redmere Farms Carrots 1kg', brand: 'Redmere Farms', store: 'Tesco', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Redmere Farms Potatoes 2.5kg', brand: 'Redmere Farms', store: 'Tesco', category: 'fresh_produce', quantity: '2.5kg' },
        { name: 'Redmere Farms Onions 1kg', brand: 'Redmere Farms', store: 'Tesco', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Redmere Farms Tomatoes 500g', brand: 'Redmere Farms', store: 'Tesco', category: 'fresh_produce', quantity: '500g' },
        { name: 'Rosedene Farms Apples 1kg', brand: 'Rosedene Farms', store: 'Tesco', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Rosedene Farms Pears 1kg', brand: 'Rosedene Farms', store: 'Tesco', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Rosedene Farms Strawberries 400g', brand: 'Rosedene Farms', store: 'Tesco', category: 'fresh_produce', quantity: '400g' },
        { name: 'Suntrail Farms Oranges 1kg', brand: 'Suntrail Farms', store: 'Tesco', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Suntrail Farms Lemons 4 Pack', brand: 'Suntrail Farms', store: 'Tesco', category: 'fresh_produce', quantity: '4 Pack' },
        { name: 'Suntrail Farms Limes 4 Pack', brand: 'Suntrail Farms', store: 'Tesco', category: 'fresh_produce', quantity: '4 Pack' }
      ],

      // TESCO DAIRY - Creamfields
      tesco_dairy: [
        { name: 'Creamfields Whole Milk 4 Pints', brand: 'Creamfields', store: 'Tesco', category: 'dairy', quantity: '4 Pints' },
        { name: 'Creamfields Semi-Skimmed Milk 4 Pints', brand: 'Creamfields', store: 'Tesco', category: 'dairy', quantity: '4 Pints' },
        { name: 'Creamfields Skimmed Milk 4 Pints', brand: 'Creamfields', store: 'Tesco', category: 'dairy', quantity: '4 Pints' },
        { name: 'Creamfields Mature Cheddar 400g', brand: 'Creamfields', store: 'Tesco', category: 'dairy', quantity: '400g' },
        { name: 'Creamfields Mild Cheddar 400g', brand: 'Creamfields', store: 'Tesco', category: 'dairy', quantity: '400g' },
        { name: 'Creamfields Butter 250g', brand: 'Creamfields', store: 'Tesco', category: 'dairy', quantity: '250g' },
        { name: 'Creamfields Greek Yogurt 500g', brand: 'Creamfields', store: 'Tesco', category: 'dairy', quantity: '500g' }
      ],

      // TESCO PANTRY - Value Brands
      tesco_pantry: [
        { name: 'Hearty Food Co. Lasagne 400g', brand: 'Hearty Food Co.', store: 'Tesco', category: 'convenience', quantity: '400g' },
        { name: 'Hearty Food Co. Pizza 300g', brand: 'Hearty Food Co.', store: 'Tesco', category: 'convenience', quantity: '300g' },
        { name: 'Hearty Food Co. Pasta 500g', brand: 'Hearty Food Co.', store: 'Tesco', category: 'pantry', quantity: '500g' },
        { name: 'Stockwell & Co. Baked Beans 415g', brand: 'Stockwell & Co.', store: 'Tesco', category: 'pantry', quantity: '415g' },
        { name: 'Stockwell & Co. Tomatoes 400g', brand: 'Stockwell & Co.', store: 'Tesco', category: 'pantry', quantity: '400g' },
        { name: 'Stockwell & Co. Soup 400g', brand: 'Stockwell & Co.', store: 'Tesco', category: 'pantry', quantity: '400g' },
        { name: 'The Grower\'s Harvest Sweetcorn 340g', brand: 'The Grower\'s Harvest', store: 'Tesco', category: 'pantry', quantity: '340g' },
        { name: 'The Grower\'s Harvest Peas 300g', brand: 'The Grower\'s Harvest', store: 'Tesco', category: 'pantry', quantity: '300g' },
        { name: 'The Grower\'s Harvest Porridge Oats 1kg', brand: 'The Grower\'s Harvest', store: 'Tesco', category: 'breakfast', quantity: '1kg' }
      ],

      // SAINSBURY'S FRESH - By Sainsbury's
      sainsburys_fresh: [
        { name: 'By Sainsbury\'s Bananas 1kg', brand: 'By Sainsbury\'s', store: 'Sainsbury\'s', category: 'fresh_produce', quantity: '1kg' },
        { name: 'By Sainsbury\'s Apples 1kg', brand: 'By Sainsbury\'s', store: 'Sainsbury\'s', category: 'fresh_produce', quantity: '1kg' },
        { name: 'By Sainsbury\'s Carrots 1kg', brand: 'By Sainsbury\'s', store: 'Sainsbury\'s', category: 'fresh_produce', quantity: '1kg' },
        { name: 'By Sainsbury\'s Chicken Breast 1kg', brand: 'By Sainsbury\'s', store: 'Sainsbury\'s', category: 'meat', quantity: '1kg' },
        { name: 'By Sainsbury\'s Whole Milk 4 Pints', brand: 'By Sainsbury\'s', store: 'Sainsbury\'s', category: 'dairy', quantity: '4 Pints' },
        { name: 'By Sainsbury\'s Free Range Eggs 12 Pack', brand: 'By Sainsbury\'s', store: 'Sainsbury\'s', category: 'dairy', quantity: '12 Pack' }
      ],

      // SAINSBURY'S PREMIUM - Taste the Difference
      sainsburys_premium: [
        { name: 'Taste the Difference Organic Carrots 1kg', brand: 'Taste the Difference', store: 'Sainsbury\'s', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Taste the Difference Organic Apples 1kg', brand: 'Taste the Difference', store: 'Sainsbury\'s', category: 'fresh_produce', quantity: '1kg' },
        { name: 'Taste the Difference Chicken Breast 1kg', brand: 'Taste the Difference', store: 'Sainsbury\'s', category: 'meat', quantity: '1kg' },
        { name: 'Taste the Difference Mature Cheddar 400g', brand: 'Taste the Difference', store: 'Sainsbury\'s', category: 'dairy', quantity: '400g' },
        { name: 'Taste the Difference Artisan Bread 800g', brand: 'Taste the Difference', store: 'Sainsbury\'s', category: 'bread', quantity: '800g' },
        { name: 'Taste the Difference Gourmet Ready Meal 400g', brand: 'Taste the Difference', store: 'Sainsbury\'s', category: 'convenience', quantity: '400g' }
      ],

      // SAINSBURY'S SNACKS & CONFECTIONERY
      sainsburys_snacks: [
        { name: 'Lovett\'s Family Favourites Digestives 300g', brand: 'Lovett\'s Family Favourites', store: 'Sainsbury\'s', category: 'snacks', quantity: '300g' },
        { name: 'Lovett\'s Family Favourites Chocolate Biscuits 300g', brand: 'Lovett\'s Family Favourites', store: 'Sainsbury\'s', category: 'snacks', quantity: '300g' },
        { name: 'Just Snax Salt & Vinegar Crisps 6 Pack', brand: 'Just Snax', store: 'Sainsbury\'s', category: 'snacks', quantity: '6 Pack' },
        { name: 'Just Snax Ready Salted Crisps 6 Pack', brand: 'Just Snax', store: 'Sainsbury\'s', category: 'snacks', quantity: '6 Pack' },
        { name: 'Just Snax Mixed Nuts 200g', brand: 'Just Snax', store: 'Sainsbury\'s', category: 'snacks', quantity: '200g' }
      ],

      // SAINSBURY'S MEAT & FISH
      sainsburys_meat_fish: [
        { name: 'J James & Family Beef Mince 500g', brand: 'J James & Family', store: 'Sainsbury\'s', category: 'meat', quantity: '500g' },
        { name: 'J James & Family Beef Steak 400g', brand: 'J James & Family', store: 'Sainsbury\'s', category: 'meat', quantity: '400g' },
        { name: 'Fish Said Fred Salmon Fillets 2 Pack', brand: 'Fish Said Fred', store: 'Sainsbury\'s', category: 'meat', quantity: '2 Pack' },
        { name: 'Fish Said Fred Cod Fillets 2 Pack', brand: 'Fish Said Fred', store: 'Sainsbury\'s', category: 'meat', quantity: '2 Pack' }
      ],

      // LIDL BAKERY - Fresh In-Store
      lidl_bakery: [
        { name: 'Lidl Fresh White Bread 800g', brand: 'Lidl', store: 'Lidl', category: 'bread', quantity: '800g' },
        { name: 'Lidl Fresh Brown Bread 800g', brand: 'Lidl', store: 'Lidl', category: 'bread', quantity: '800g' },
        { name: 'Lidl Fresh Croissants 4 Pack', brand: 'Lidl', store: 'Lidl', category: 'bread', quantity: '4 Pack' },
        { name: 'Lidl Fresh Baguette', brand: 'Lidl', store: 'Lidl', category: 'bread', quantity: '1 each' },
        { name: 'Lidl Fresh Danish Pastries 4 Pack', brand: 'Lidl', store: 'Lidl', category: 'bread', quantity: '4 Pack' }
      ],

      // LIDL MEAT & FISH
      lidl_meat_fish: [
        { name: 'Riverway Chicken Breast 1kg', brand: 'Riverway', store: 'Lidl', category: 'meat', quantity: '1kg' },
        { name: 'Riverway Beef Mince 500g', brand: 'Riverway', store: 'Lidl', category: 'meat', quantity: '500g' },
        { name: 'Ocean Sea Salmon Fillets 2 Pack', brand: 'Ocean Sea', store: 'Lidl', category: 'meat', quantity: '2 Pack' },
        { name: 'Ocean Sea Cod Fillets 2 Pack', brand: 'Ocean Sea', store: 'Lidl', category: 'meat', quantity: '2 Pack' }
      ],

      // LIDL DAIRY & DELI
      lidl_dairy_deli: [
        { name: 'Milbona Whole Milk 4 Pints', brand: 'Milbona', store: 'Lidl', category: 'dairy', quantity: '4 Pints' },
        { name: 'Milbona Greek Yogurt 500g', brand: 'Milbona', store: 'Lidl', category: 'dairy', quantity: '500g' },
        { name: 'Milbona Mature Cheddar 400g', brand: 'Milbona', store: 'Lidl', category: 'dairy', quantity: '400g' },
        { name: 'Dulano Salami 100g', brand: 'Dulano', store: 'Lidl', category: 'meat', quantity: '100g' },
        { name: 'Dulano Ham 100g', brand: 'Dulano', store: 'Lidl', category: 'meat', quantity: '100g' },
        { name: 'Dulano Chorizo 100g', brand: 'Dulano', store: 'Lidl', category: 'meat', quantity: '100g' }
      ],

      // LIDL PANTRY & INTERNATIONAL
      lidl_pantry: [
        { name: 'Bellarom Coffee 200g', brand: 'Bellarom', store: 'Lidl', category: 'snacks', quantity: '200g' },
        { name: 'Bellarom Chocolate 100g', brand: 'Bellarom', store: 'Lidl', category: 'snacks', quantity: '100g' },
        { name: 'Eridanous Olive Oil 500ml', brand: 'Eridanous', store: 'Lidl', category: 'pantry', quantity: '500ml' },
        { name: 'Eridanous Feta Cheese 200g', brand: 'Eridanous', store: 'Lidl', category: 'dairy', quantity: '200g' },
        { name: 'Baresa Pasta 500g', brand: 'Baresa', store: 'Lidl', category: 'pantry', quantity: '500g' },
        { name: 'Baresa Tomato Sauce 400g', brand: 'Baresa', store: 'Lidl', category: 'pantry', quantity: '400g' }
      ],

      // LIDL NON-FOOD
      lidl_non_food: [
        { name: 'Cien Shampoo 400ml', brand: 'Cien', store: 'Lidl', category: 'household', quantity: '400ml' },
        { name: 'Cien Body Wash 400ml', brand: 'Cien', store: 'Lidl', category: 'household', quantity: '400ml' },
        { name: 'W5 Laundry Detergent 2L', brand: 'W5', store: 'Lidl', category: 'household', quantity: '2L' },
        { name: 'W5 All-Purpose Cleaner 750ml', brand: 'W5', store: 'Lidl', category: 'household', quantity: '750ml' }
      ],

      // ALDI BAKERY - The Village Bakery
      aldi_bakery: [
        { name: 'The Village Bakery White Bread 800g', brand: 'The Village Bakery', store: 'Aldi', category: 'bread', quantity: '800g' },
        { name: 'The Village Bakery Brown Bread 800g', brand: 'The Village Bakery', store: 'Aldi', category: 'bread', quantity: '800g' },
        { name: 'The Village Bakery Wholemeal Bread 800g', brand: 'The Village Bakery', store: 'Aldi', category: 'bread', quantity: '800g' },
        { name: 'The Village Bakery Baguette', brand: 'The Village Bakery', store: 'Aldi', category: 'bread', quantity: '1 each' }
      ],

      // ALDI MEAT & FISH
      aldi_meat_fish: [
        { name: 'Ashfields Chicken Breast 1kg', brand: 'Ashfields', store: 'Aldi', category: 'meat', quantity: '1kg' },
        { name: 'Ashfields Beef Mince 500g', brand: 'Ashfields', store: 'Aldi', category: 'meat', quantity: '500g' },
        { name: 'The Fishmonger Salmon Fillets 2 Pack', brand: 'The Fishmonger', store: 'Aldi', category: 'meat', quantity: '2 Pack' },
        { name: 'The Fishmonger Cod Fillets 2 Pack', brand: 'The Fishmonger', store: 'Aldi', category: 'meat', quantity: '2 Pack' }
      ],

      // ALDI DAIRY
      aldi_dairy: [
        { name: 'Cowbelle Whole Milk 4 Pints', brand: 'Cowbelle', store: 'Aldi', category: 'dairy', quantity: '4 Pints' },
        { name: 'Cowbelle Semi-Skimmed Milk 4 Pints', brand: 'Cowbelle', store: 'Aldi', category: 'dairy', quantity: '4 Pints' },
        { name: 'Dairyfine Chocolate Bar 100g', brand: 'Dairyfine', store: 'Aldi', category: 'snacks', quantity: '100g' },
        { name: 'Dairyfine Milk Chocolate 200g', brand: 'Dairyfine', store: 'Aldi', category: 'snacks', quantity: '200g' }
      ],

      // ALDI PANTRY
      aldi_pantry: [
        { name: 'Harvest Morn Corn Flakes 500g', brand: 'Harvest Morn', store: 'Aldi', category: 'breakfast', quantity: '500g' },
        { name: 'Harvest Morn Muesli 750g', brand: 'Harvest Morn', store: 'Aldi', category: 'breakfast', quantity: '750g' },
        { name: 'Harvest Morn Granola 500g', brand: 'Harvest Morn', store: 'Aldi', category: 'breakfast', quantity: '500g' },
        { name: 'Specially Selected Cured Ham 100g', brand: 'Specially Selected', store: 'Aldi', category: 'meat', quantity: '100g' },
        { name: 'Specially Selected Aged Cheddar 400g', brand: 'Specially Selected', store: 'Aldi', category: 'dairy', quantity: '400g' }
      ],

      // ALDI SNACKS
      aldi_snacks: [
        { name: 'Snackrite Salt & Vinegar Crisps 6 Pack', brand: 'Snackrite', store: 'Aldi', category: 'snacks', quantity: '6 Pack' },
        { name: 'Snackrite Ready Salted Crisps 6 Pack', brand: 'Snackrite', store: 'Aldi', category: 'snacks', quantity: '6 Pack' },
        { name: 'Moser Roth Dark Chocolate 100g', brand: 'Moser Roth', store: 'Aldi', category: 'snacks', quantity: '100g' },
        { name: 'Moser Roth Milk Chocolate 100g', brand: 'Moser Roth', store: 'Aldi', category: 'snacks', quantity: '100g' }
      ],

      // ICELAND FROZEN - Main Brand
      iceland_frozen: [
        { name: 'Iceland Frozen Mixed Vegetables 1kg', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '1kg' },
        { name: 'Iceland Frozen Chips 1kg', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '1kg' },
        { name: 'Iceland Frozen Peas 1kg', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '1kg' },
        { name: 'Iceland Frozen Pizza 300g', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '300g' },
        { name: 'Iceland Frozen Fish Fingers 20 Pack', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '20 Pack' },
        { name: 'Iceland Frozen Ready Meal 400g', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '400g' },
        { name: 'Iceland Frozen Ice Cream 1L', brand: 'Iceland', store: 'Iceland', category: 'frozen', quantity: '1L' }
      ],

      // ICELAND EXCLUSIVE PARTNERSHIPS
      iceland_exclusive: [
        { name: 'Greggs Frozen Sausage Rolls 6 Pack', brand: 'Greggs', store: 'Iceland', category: 'frozen', quantity: '6 Pack' },
        { name: 'Greggs Frozen Steak Bakes 4 Pack', brand: 'Greggs', store: 'Iceland', category: 'frozen', quantity: '4 Pack' },
        { name: 'Greggs Frozen Yum Yums 4 Pack', brand: 'Greggs', store: 'Iceland', category: 'frozen', quantity: '4 Pack' },
        { name: 'TGI Friday\'s Frozen Chicken Wings 400g', brand: 'TGI Friday\'s', store: 'Iceland', category: 'frozen', quantity: '400g' },
        { name: 'TGI Friday\'s Frozen Party Food 500g', brand: 'TGI Friday\'s', store: 'Iceland', category: 'frozen', quantity: '500g' },
        { name: 'Slimming World Frozen Chicken Curry 400g', brand: 'Slimming World', store: 'Iceland', category: 'frozen', quantity: '400g' },
        { name: 'Slimming World Frozen Spaghetti Bolognese 400g', brand: 'Slimming World', store: 'Iceland', category: 'frozen', quantity: '400g' }
      ],

      // ICELAND DAIRY & CHILLED
      iceland_dairy: [
        { name: 'Iceland Whole Milk 4 Pints', brand: 'Iceland', store: 'Iceland', category: 'dairy', quantity: '4 Pints' },
        { name: 'Iceland Semi-Skimmed Milk 4 Pints', brand: 'Iceland', store: 'Iceland', category: 'dairy', quantity: '4 Pints' },
        { name: 'Iceland Mature Cheddar 400g', brand: 'Iceland', store: 'Iceland', category: 'dairy', quantity: '400g' },
        { name: 'Iceland Greek Yogurt 500g', brand: 'Iceland', store: 'Iceland', category: 'dairy', quantity: '500g' }
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

    console.log(`\n✅ Generated ${this.products.length} enhanced UK grocery products with specific brand categories`);
    return this.products;
  }

  createProduct(product, category) {
    return {
      id: `enhanced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      'household': { min: 2.00, max: 8.00 },
      'pantry': { min: 0.50, max: 2.50 },
      'convenience': { min: 1.50, max: 4.00 }
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
      'household': { calories: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, salt: 0, fiber: 0 },
      'pantry': { calories: 150, protein: 5.0, fat: 2.0, carbs: 25.0, sugar: 5.0, salt: 0.5, fiber: 2.0 },
      'convenience': { calories: 200, protein: 8.0, fat: 6.0, carbs: 30.0, sugar: 5.0, salt: 1.5, fiber: 2.0 }
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
      'household': 'Non-food item',
      'pantry': 'Natural ingredients, preservatives',
      'convenience': 'Various ingredients, preservatives, flavourings'
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
      'household': [],
      'pantry': ['gluten'],
      'convenience': ['gluten', 'milk', 'eggs']
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
      'household': 'N/A',
      'pantry': 'B',
      'convenience': 'D'
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
      'household': 'Various packaging',
      'pantry': 'Tin or jar',
      'convenience': 'Plastic tray or box'
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
      'household': { days: 365, type: 'best before' },
      'pantry': { days: 730, type: 'best before' },
      'convenience': { days: 3, type: 'use by' }
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
      'household': 'Store in cool, dry place',
      'pantry': 'Store in cool, dry place',
      'convenience': 'Refrigerate at 2-4°C'
    };
    
    return storageMap[category] || 'Store in cool, dry place';
  }

  async saveProductsToFirebase(products) {
    try {
      const firebaseService = require('./FirebaseService');
      
      console.log(`💾 Saving ${products.length} enhanced UK products to Firebase...`);
      
      for (const product of products) {
        await firebaseService.saveProduct(product);
      }
      
      console.log(`✅ Successfully saved ${products.length} enhanced UK products to Firebase`);
      return true;
    } catch (error) {
      console.error('❌ Error saving enhanced UK products to Firebase:', error);
      return false;
    }
  }
}

module.exports = EnhancedUKProductService;
