/**
 * Product Categorization Service
 * Categorizes products according to store categories and extracts own-brand products
 */

const logger = require('../utils/logger');

class ProductCategorizationService {
  constructor() {
    this.storeCategories = this.initializeStoreCategories();
    this.ownBrands = this.initializeOwnBrands();
  }

  /**
   * Initialize store categories based on the provided structure
   */
  initializeStoreCategories() {
    return {
      'Vegetables & Fruit': {
        keywords: [
          'vegetable', 'fruit', 'produce', 'fresh', 'organic',
          'carrot', 'potato', 'onion', 'tomato', 'lettuce', 'spinach',
          'apple', 'banana', 'orange', 'grape', 'strawberry', 'berry',
          'pepper', 'cucumber', 'broccoli', 'cauliflower', 'cabbage',
          'citrus', 'stone fruit', 'root vegetable', 'leafy green'
        ],
        subcategories: [
          'Fresh Vegetables', 'Fresh Fruits', 'Organic Produce', 
          'Pre-packaged Salads', 'Stir-fry Kits', 'Frozen Vegetables',
          'Frozen Fruits', 'Dried Fruits', 'Nuts'
        ]
      },
      'Dairy': {
        keywords: [
          'milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream',
          'dairy', 'lactose', 'milk alternative', 'almond milk', 'soy milk',
          'oat milk', 'coconut milk', 'cheddar', 'mozzarella', 'feta',
          'greek yogurt', 'natural yogurt', 'flavored yogurt'
        ],
        subcategories: [
          'Milk & Cream', 'Cheese', 'Yogurt & Desserts', 'Butter & Spreads',
          'Milk Alternatives', 'Deli Cheese', 'Specialty Dairy'
        ]
      },
      'Meat & Poultry': {
        keywords: [
          'meat', 'poultry', 'chicken', 'beef', 'pork', 'lamb', 'turkey',
          'sausage', 'bacon', 'ham', 'mince', 'steak', 'chop', 'breast',
          'thigh', 'drumstick', 'ground', 'fresh meat', 'pre-packaged meat'
        ],
        subcategories: [
          'Fresh Meat', 'Poultry', 'Processed Meats', 'Deli Meats',
          'Frozen Meat', 'Specialty Cuts', 'Organic Meat'
        ]
      },
      'Bakery Items': {
        keywords: [
          'bread', 'roll', 'pastry', 'cake', 'muffin', 'croissant',
          'doughnut', 'baguette', 'sourdough', 'bloomer', 'ciabatta',
          'pita', 'naan', 'tortilla', 'biscuit', 'cookie', 'scone',
          'fresh baked', 'artisan', 'wholemeal', 'white bread'
        ],
        subcategories: [
          'Fresh Bread', 'Pastries', 'Cakes & Desserts', 'Specialty Breads',
          'Frozen Bakery', 'Gluten-Free', 'Artisan Products'
        ]
      },
      'Breakfast Items': {
        keywords: [
          'cereal', 'porridge', 'oats', 'granola', 'muesli', 'breakfast',
          'toast', 'pancake', 'waffle', 'breakfast bar', 'energy bar',
          'breakfast drink', 'smoothie', 'juice', 'coffee', 'tea'
        ],
        subcategories: [
          'Cereals', 'Oats & Porridge', 'Breakfast Bars', 'Breakfast Drinks',
          'Pancakes & Waffles', 'Specialty Breakfast'
        ]
      },
      'Spices & World Foods': {
        keywords: [
          'spice', 'herb', 'seasoning', 'sauce', 'paste', 'condiment',
          'world food', 'international', 'asian', 'indian', 'mexican',
          'mediterranean', 'european', 'curry', 'chili', 'garlic', 'ginger',
          'cumin', 'paprika', 'oregano', 'basil', 'thyme', 'rosemary'
        ],
        subcategories: [
          'Spices & Herbs', 'Sauces & Pastes', 'Asian Foods', 'Indian Foods',
          'Mexican Foods', 'Mediterranean Foods', 'European Foods'
        ]
      },
      'Frozen Food Products': {
        keywords: [
          'frozen', 'ice cream', 'frozen meal', 'frozen pizza', 'frozen vegetable',
          'frozen fruit', 'frozen fish', 'frozen meat', 'frozen dessert',
          'ready meal', 'frozen snack', 'frozen party food'
        ],
        subcategories: [
          'Frozen Meals', 'Frozen Vegetables', 'Frozen Fruits', 'Ice Cream',
          'Frozen Pizza', 'Frozen Snacks', 'Frozen Party Food'
        ]
      },
      'Essentials': {
        keywords: [
          'cleaning', 'laundry', 'toilet paper', 'tissue', 'toiletry',
          'household', 'paper product', 'detergent', 'soap', 'shampoo',
          'toothpaste', 'deodorant', 'health', 'beauty', 'personal care'
        ],
        subcategories: [
          'Cleaning Products', 'Laundry', 'Paper Products', 'Toiletries',
          'Health & Beauty', 'Household Essentials'
        ]
      },
      'Snacks & Beverages': {
        keywords: [
          'snack', 'crisp', 'chip', 'biscuit', 'cookie', 'chocolate',
          'sweet', 'candy', 'beverage', 'drink', 'juice', 'soda',
          'soft drink', 'alcohol', 'wine', 'beer', 'spirit', 'cocktail'
        ],
        subcategories: [
          'Crisps & Snacks', 'Biscuits & Cookies', 'Chocolate & Sweets',
          'Soft Drinks', 'Juices', 'Alcoholic Beverages', 'Hot Drinks'
        ]
      }
    };
  }

  /**
   * Initialize own-brand mappings for each store
   */
  initializeOwnBrands() {
    return {
      'Tesco': {
        'Bakery': ['H.W. Nevill\'s', 'The Cake Stall'],
        'Meat & Fish': ['Boswell Farms', 'Willow Farms', 'Woodside Farms', 'The Fishmonger'],
        'Produce': ['Redmere Farms', 'Rosedene Farms', 'Suntrail Farms'],
        'Dairy': ['Creamfields'],
        'Pantry & Groceries': ['Hearty Food Co.', 'Stockwell & Co.', 'The Grower\'s Harvest'],
        'Premium': ['Tesco Finest'],
        'Value': ['Tesco Value'],
        'Standard': ['Tesco']
      },
      'Sainsbury\'s': {
        'Fresh': ['By Sainsbury\'s'],
        'Premium': ['Taste the Difference'],
        'Snacks & Confectionery': ['Lovett\'s Family Favourites', 'Just Snax'],
        'Meat & Fish': ['J James & Family', 'Fish Said Fred'],
        'Organic': ['SO Organic']
      },
      'Lidl': {
        'Bakery': ['Freshly Baked'],
        'Meat & Fish': ['Riverway', 'Ocean Sea'],
        'Dairy & Deli': ['Milbona', 'Dulano'],
        'Pantry & International': ['Bellarom', 'Eridanous', 'Baresa'],
        'Non-Food': ['Cien', 'W5']
      },
      'Aldi': {
        'Bakery': ['The Village Bakery'],
        'Meat & Fish': ['Ashfields', 'The Fishmonger'],
        'Dairy': ['Cowbelle', 'Dairyfine'],
        'Pantry': ['Harvest Morn', 'Specially Selected'],
        'Snacks': ['Snackrite', 'Moser Roth']
      },
      'Iceland': {
        'Frozen': ['Iceland'],
        'Exclusive Partnerships': ['Greggs', 'TGI Friday\'s', 'Slimming World'],
        'Dairy & Chilled': ['Iceland Dairy']
      }
    };
  }

  /**
   * Categorize a product based on its name, category, and brand
   */
  categorizeProduct(product) {
    const productName = (product.name || '').toLowerCase();
    const productCategory = (product.category || '').toLowerCase();
    const productBrand = (product.brand || '').toLowerCase();
    
    const combinedText = `${productName} ${productCategory} ${productBrand}`;
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const [categoryName, categoryData] of Object.entries(this.storeCategories)) {
      const score = this.calculateCategoryScore(combinedText, categoryData.keywords);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = categoryName;
      }
    }
    
    return {
      category: bestMatch || 'Uncategorized',
      confidence: bestScore,
      subcategory: this.getSubcategory(product, bestMatch)
    };
  }

  /**
   * Calculate category match score
   */
  calculateCategoryScore(text, keywords) {
    let score = 0;
    const words = text.split(/\s+/);
    
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }
    
    // Bonus for exact word matches
    for (const word of words) {
      if (keywords.includes(word)) {
        score += 2;
      }
    }
    
    return score;
  }

  /**
   * Get subcategory for a product
   */
  getSubcategory(product, mainCategory) {
    if (!mainCategory || !this.storeCategories[mainCategory]) {
      return 'General';
    }
    
    const subcategories = this.storeCategories[mainCategory].subcategories;
    const productName = (product.name || '').toLowerCase();
    
    // Simple matching for subcategories
    for (const subcategory of subcategories) {
      if (productName.includes(subcategory.toLowerCase().replace(/\s+/g, ' '))) {
        return subcategory;
      }
    }
    
    return subcategories[0] || 'General';
  }

  /**
   * Identify if a product is an own-brand
   */
  identifyOwnBrand(product, storeName) {
    if (!storeName || !this.ownBrands[storeName]) {
      return null;
    }
    
    const productBrand = (product.brand || '').toLowerCase();
    const productName = (product.name || '').toLowerCase();
    
    const storeBrands = this.ownBrands[storeName];
    
    for (const [category, brands] of Object.entries(storeBrands)) {
      for (const brand of brands) {
        const brandLower = brand.toLowerCase();
        
        if (productBrand.includes(brandLower) || 
            productName.includes(brandLower) ||
            this.isBrandMatch(productBrand, brandLower)) {
          return {
            isOwnBrand: true,
            brand: brand,
            category: category,
            store: storeName
          };
        }
      }
    }
    
    return {
      isOwnBrand: false,
      brand: product.brand,
      category: null,
      store: storeName
    };
  }

  /**
   * Check if brand names match (handles variations)
   */
  isBrandMatch(productBrand, brandName) {
    const brandWords = brandName.split(/\s+/);
    const productWords = productBrand.split(/\s+/);
    
    // Check if all brand words are in product words
    return brandWords.every(brandWord => 
      productWords.some(productWord => 
        productWord.includes(brandWord) || brandWord.includes(productWord)
      )
    );
  }

  /**
   * Extract generic product type (remove brand)
   */
  extractGenericProductType(product) {
    let productName = product.name || '';
    const brand = product.brand || '';
    
    // Remove brand name from product name
    if (brand && productName.toLowerCase().includes(brand.toLowerCase())) {
      productName = productName.replace(new RegExp(brand, 'gi'), '').trim();
    }
    
    // Remove common brand indicators
    const brandIndicators = [
      'brand', 'own brand', 'private label', 'store brand',
      'finest', 'value', 'premium', 'organic', 'free range'
    ];
    
    for (const indicator of brandIndicators) {
      productName = productName.replace(new RegExp(indicator, 'gi'), '').trim();
    }
    
    // Clean up extra spaces and punctuation
    productName = productName.replace(/\s+/g, ' ').replace(/^[,\-\s]+|[,\-\s]+$/g, '');
    
    return productName || product.name || 'Unknown Product';
  }

  /**
   * Process and categorize multiple products
   */
  processProducts(products, storeName = null) {
    return products.map(product => {
      const categorization = this.categorizeProduct(product);
      const ownBrandInfo = this.identifyOwnBrand(product, storeName);
      const genericType = this.extractGenericProductType(product);
      
      return {
        ...product,
        categorization: categorization,
        ownBrand: ownBrandInfo,
        genericType: genericType,
        processedAt: new Date()
      };
    });
  }

  /**
   * Get products by category
   */
  getProductsByCategory(products, category) {
    return products.filter(product => 
      product.categorization && product.categorization.category === category
    );
  }

  /**
   * Get own-brand products
   */
  getOwnBrandProducts(products, storeName = null) {
    return products.filter(product => 
      product.ownBrand && product.ownBrand.isOwnBrand
    );
  }

  /**
   * Get category statistics
   */
  getCategoryStats(products) {
    const stats = {};
    
    products.forEach(product => {
      if (product.categorization) {
        const category = product.categorization.category;
        stats[category] = (stats[category] || 0) + 1;
      }
    });
    
    return stats;
  }
}

module.exports = ProductCategorizationService;
