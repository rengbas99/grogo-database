/**
 * Data Validation Service
 * Ensures data quality and consistency before saving to database
 */

class DataValidationService {
  constructor() {
    this.validationRules = {
      product: {
        name: { required: true, minLength: 2, maxLength: 255 },
        brand: { required: true, minLength: 1, maxLength: 100 },
        category: { required: true, allowedValues: [
          'Fruits', 'Vegetables', 'Dairy/Protein', 'Staples', 'Cooking Essentials',
          'Household Essentials', 'Sanitary & Personal Care', 'Snacks', 'Beverages',
          'meat_fish', 'bakery', 'frozen_foods', 'Uncategorized'
        ]},
        price: { required: true, min: 0.01, max: 1000 },
        imageUrl: { required: false, pattern: /^https?:\/\/.+/ },
        availability: { required: true, allowedValues: ['in_stock', 'low_stock', 'out_of_stock', 'unknown'] }
      },
      storeProduct: {
        productId: { required: true, pattern: /^[a-zA-Z0-9_-]+$/ },
        storeId: { required: true, pattern: /^[a-zA-Z0-9_-]+$/ },
        storeName: { required: true, minLength: 2, maxLength: 100 },
        price: { required: true, min: 0.01, max: 1000 },
        availability: { required: true, allowedValues: ['in_stock', 'low_stock', 'out_of_stock', 'unknown'] }
      }
    };
    
    this.validStores = ['Tesco', 'Sainsburys', 'Aldi', 'Lidl', 'Iceland', 'Asda', 'Morrisons'];
  }

  /**
   * Validate a product object
   */
  validateProduct(product) {
    const errors = [];
    const warnings = [];
    
    // Validate required fields
    if (!product.name || product.name.trim().length < 2) {
      errors.push('Product name is required and must be at least 2 characters');
    }
    
    if (!product.brand || product.brand.trim().length < 1) {
      errors.push('Product brand is required');
    }
    
    if (!product.category || !this.validationRules.product.category.allowedValues.includes(product.category)) {
      errors.push('Product category is required and must be from allowed values');
    }
    
    if (!product.price || product.price <= 0) {
      errors.push('Product price is required and must be greater than 0');
    }
    
    // Validate price range
    if (product.price && (product.price < 0.01 || product.price > 1000)) {
      warnings.push('Product price is outside normal range (0.01 - 1000)');
    }
    
    // Validate image URL
    if (product.imageUrl && !this.validationRules.product.imageUrl.pattern.test(product.imageUrl)) {
      warnings.push('Product image URL format is invalid');
    }
    
    // Validate availability
    if (product.availability && !this.validationRules.product.availability.allowedValues.includes(product.availability)) {
      errors.push('Product availability must be from allowed values');
    }
    
    // Check for suspicious data
    if (product.name && product.name.length > 255) {
      errors.push('Product name is too long (max 255 characters)');
    }
    
    if (product.brand && product.brand.length > 100) {
      errors.push('Product brand is too long (max 100 characters)');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a store product object
   */
  validateStoreProduct(storeProduct) {
    const errors = [];
    const warnings = [];
    
    // Validate required fields
    if (!storeProduct.productId || !this.validationRules.storeProduct.productId.pattern.test(storeProduct.productId)) {
      errors.push('Store product ID is required and must be valid');
    }
    
    if (!storeProduct.storeId || !this.validationRules.storeProduct.storeId.pattern.test(storeProduct.storeId)) {
      errors.push('Store ID is required and must be valid');
    }
    
    if (!storeProduct.storeName || storeProduct.storeName.trim().length < 2) {
      errors.push('Store name is required and must be at least 2 characters');
    }
    
    if (!this.validStores.includes(storeProduct.storeName)) {
      warnings.push(`Store name '${storeProduct.storeName}' is not in the list of valid stores`);
    }
    
    if (!storeProduct.price || storeProduct.price <= 0) {
      errors.push('Store product price is required and must be greater than 0');
    }
    
    // Validate price range
    if (storeProduct.price && (storeProduct.price < 0.01 || storeProduct.price > 1000)) {
      warnings.push('Store product price is outside normal range (0.01 - 1000)');
    }
    
    // Validate availability
    if (storeProduct.availability && !this.validationRules.storeProduct.availability.allowedValues.includes(storeProduct.availability)) {
      errors.push('Store product availability must be from allowed values');
    }
    
    // Check for suspicious data
    if (storeProduct.storeName && storeProduct.storeName.length > 100) {
      errors.push('Store name is too long (max 100 characters)');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Clean and normalize product data
   */
  cleanProduct(product) {
    const cleaned = { ...product };
    
    // Clean name
    if (cleaned.name) {
      cleaned.name = cleaned.name.trim();
      // Remove extra whitespace
      cleaned.name = cleaned.name.replace(/\s+/g, ' ');
    }
    
    // Clean brand
    if (cleaned.brand) {
      cleaned.brand = cleaned.brand.trim();
    }
    
    // Clean category
    if (cleaned.category) {
      cleaned.category = cleaned.category.trim();
      // Ensure it's from allowed values
      if (!this.validationRules.product.category.allowedValues.includes(cleaned.category)) {
        cleaned.category = 'Uncategorized';
      }
    }
    
    // Clean price
    if (cleaned.price) {
      cleaned.price = parseFloat(cleaned.price);
      if (isNaN(cleaned.price) || cleaned.price < 0) {
        cleaned.price = 0;
      }
    }
    
    // Clean availability
    if (cleaned.availability) {
      cleaned.availability = cleaned.availability.toLowerCase();
      if (!this.validationRules.product.availability.allowedValues.includes(cleaned.availability)) {
        cleaned.availability = 'unknown';
      }
    }
    
    // Clean image URL
    if (cleaned.imageUrl) {
      cleaned.imageUrl = cleaned.imageUrl.trim();
      if (cleaned.imageUrl && !cleaned.imageUrl.startsWith('http')) {
        cleaned.imageUrl = '';
      }
    }
    
    return cleaned;
  }

  /**
   * Clean and normalize store product data
   */
  cleanStoreProduct(storeProduct) {
    const cleaned = { ...storeProduct };
    
    // Clean store name
    if (cleaned.storeName) {
      cleaned.storeName = cleaned.storeName.trim();
    }
    
    // Clean price
    if (cleaned.price) {
      cleaned.price = parseFloat(cleaned.price);
      if (isNaN(cleaned.price) || cleaned.price < 0) {
        cleaned.price = 0;
      }
    }
    
    // Clean availability
    if (cleaned.availability) {
      cleaned.availability = cleaned.availability.toLowerCase();
      if (!this.validationRules.storeProduct.availability.allowedValues.includes(cleaned.availability)) {
        cleaned.availability = 'unknown';
      }
    }
    
    // Clean URL
    if (cleaned.url) {
      cleaned.url = cleaned.url.trim();
      if (cleaned.url && !cleaned.url.startsWith('http')) {
        cleaned.url = '';
      }
    }
    
    return cleaned;
  }

  /**
   * Validate and clean a product before saving
   */
  validateAndCleanProduct(product) {
    const cleaned = this.cleanProduct(product);
    const validation = this.validateProduct(cleaned);
    
    return {
      product: cleaned,
      validation
    };
  }

  /**
   * Validate and clean a store product before saving
   */
  validateAndCleanStoreProduct(storeProduct) {
    const cleaned = this.cleanStoreProduct(storeProduct);
    const validation = this.validateStoreProduct(cleaned);
    
    return {
      storeProduct: cleaned,
      validation
    };
  }

  /**
   * Check if a product is a duplicate
   */
  isDuplicateProduct(product, existingProducts) {
    const name = product.name.toLowerCase().trim();
    const brand = product.brand.toLowerCase().trim();
    
    return existingProducts.some(existing => {
      const existingName = existing.name.toLowerCase().trim();
      const existingBrand = existing.brand.toLowerCase().trim();
      
      // Check for exact match
      if (name === existingName && brand === existingBrand) {
        return true;
      }
      
      // Check for similar names (fuzzy matching)
      const similarity = this.calculateSimilarity(name, existingName);
      if (similarity > 0.8 && brand === existingBrand) {
        return true;
      }
      
      return false;
    });
  }

  /**
   * Calculate similarity between two strings
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
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

  /**
   * Generate validation report
   */
  generateValidationReport(products, storeProducts) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalProducts: products.length,
        totalStoreProducts: storeProducts.length,
        validProducts: 0,
        invalidProducts: 0,
        validStoreProducts: 0,
        invalidStoreProducts: 0,
        duplicates: 0
      },
      issues: {
        products: [],
        storeProducts: []
      },
      recommendations: []
    };
    
    // Validate products
    products.forEach((product, index) => {
      const validation = this.validateProduct(product);
      if (validation.isValid) {
        report.summary.validProducts++;
      } else {
        report.summary.invalidProducts++;
        report.issues.products.push({
          index,
          product: product.name,
          errors: validation.errors,
          warnings: validation.warnings
        });
      }
    });
    
    // Validate store products
    storeProducts.forEach((storeProduct, index) => {
      const validation = this.validateStoreProduct(storeProduct);
      if (validation.isValid) {
        report.summary.validStoreProducts++;
      } else {
        report.summary.invalidStoreProducts++;
        report.issues.storeProducts.push({
          index,
          storeProduct: `${storeProduct.storeName} - ${storeProduct.productId}`,
          errors: validation.errors,
          warnings: validation.warnings
        });
      }
    });
    
    // Generate recommendations
    if (report.summary.invalidProducts > 0) {
      report.recommendations.push({
        action: 'Fix invalid products',
        reason: `${report.summary.invalidProducts} products have validation errors`,
        priority: 'High'
      });
    }
    
    if (report.summary.invalidStoreProducts > 0) {
      report.recommendations.push({
        action: 'Fix invalid store products',
        reason: `${report.summary.invalidStoreProducts} store products have validation errors`,
        priority: 'High'
      });
    }
    
    return report;
  }
}

module.exports = DataValidationService;







