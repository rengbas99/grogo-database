/**
 * OpenFoodFacts API Service
 * Fetches product data, images, and nutritional information
 */

const axios = require('axios');
const logger = require('../utils/logger');

class OpenFoodFactsService {
  constructor() {
    this.baseURL = 'https://world.openfoodfacts.net/api/v2'; // Use staging for testing
    this.rateLimitDelay = 7000; // 7 seconds between requests (10 req/min limit)
    this.lastRequestTime = 0;
    this.userAgent = 'Grogo-MVP/1.0 (renganatharaam@gmail.com)';
    this.auth = {
      username: 'off',
      password: 'off'
    };
  }

  /**
   * Add rate limiting to prevent API abuse
   */
  async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => 
        setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Search products by query
   */
  async searchProducts(query, page = 1, pageSize = 20) {
    try {
      await this.rateLimit();
      
      const response = await axios.get(`${this.baseURL}/search`, {
        params: {
          search_terms: query,
          page_size: pageSize,
          page: page,
          fields: 'product_name,brands,categories,code,image_url,image_front_url,image_ingredients_url,image_nutrition_url,ingredients_text,allergens_tags,additives_tags,labels_tags,countries_tags,manufacturing_places,origins,nutriments,nova_group,ecoscore_grade,nutriscore_grade,last_modified_t,data_quality_tags'
        },
        headers: {
          'User-Agent': this.userAgent
        },
        auth: this.auth
      });

      return response.data;
    } catch (error) {
      logger.error('OpenFoodFacts search failed:', error);
      throw error;
    }
  }

  /**
   * Get product by barcode
   */
  async getProductByBarcode(barcode) {
    try {
      await this.rateLimit();
      
      const response = await axios.get(`${this.baseURL}/product/${barcode}.json`, {
        headers: {
          'User-Agent': this.userAgent
        },
        auth: this.auth
      });
      
      if (response.data.status === 0) {
        return null; // Product not found
      }
      
      return response.data;
    } catch (error) {
      logger.error('OpenFoodFacts barcode lookup failed:', error);
      return null;
    }
  }

  /**
   * Get product categories
   */
  async getCategories() {
    try {
      await this.rateLimit();
      
      const response = await axios.get(`${this.baseURL}/categories.json`, {
        headers: {
          'User-Agent': this.userAgent
        },
        auth: this.auth
      });
      return response.data;
    } catch (error) {
      logger.error('OpenFoodFacts categories fetch failed:', error);
      throw error;
    }
  }

  /**
   * Process product data from OpenFoodFacts
   */
  processProductData(productData) {
    if (!productData || !productData.product) {
      return null;
    }

    const product = productData.product;
    
    return {
      name: product.product_name || product.product_name_en || 'Unknown Product',
      brand: product.brands || 'Unknown Brand',
      barcode: product.code || null,
      category: product.categories || 'Unknown Category',
      imageUrl: this.getBestImageUrl(product),
      nutrition: this.extractNutrition(product),
      ingredients: this.extractIngredients(product),
      allergens: this.extractAllergens(product),
      packaging: this.extractPackaging(product),
      origin: this.extractOrigin(product),
      labels: this.extractLabels(product),
      additives: this.extractAdditives(product),
      novaGroup: product.nova_group || null,
      ecoscore: product.ecoscore_grade || null,
      nutriscore: product.nutriscore_grade || null,
      lastModified: product.last_modified_t || null,
      dataQuality: product.data_quality_tags || [],
      source: 'openfoodfacts'
    };
  }

  /**
   * Get the best available image URL
   */
  getBestImageUrl(product) {
    const imageFields = [
      'image_front_url',
      'image_ingredients_url', 
      'image_nutrition_url',
      'image_url'
    ];

    for (const field of imageFields) {
      if (product[field]) {
        return product[field];
      }
    }

    return null;
  }

  /**
   * Extract nutrition information
   */
  extractNutrition(product) {
    const nutrition = {};
    
    if (product.nutriments) {
      const nutriments = product.nutriments;
      
      // Macronutrients
      nutrition.energy = nutriments.energy_100g || nutriments.energy || null;
      nutrition.protein = nutriments.proteins_100g || nutriments.proteins || null;
      nutrition.carbohydrates = nutriments.carbohydrates_100g || nutriments.carbohydrates || null;
      nutrition.fat = nutriments.fat_100g || nutriments.fat || null;
      nutrition.saturatedFat = nutriments['saturated-fat_100g'] || nutriments['saturated-fat'] || null;
      nutrition.sugar = nutriments.sugars_100g || nutriments.sugars || null;
      nutrition.fiber = nutriments.fiber_100g || nutriments.fiber || null;
      nutrition.salt = nutriments.salt_100g || nutriments.salt || null;
      nutrition.sodium = nutriments.sodium_100g || nutriments.sodium || null;
      
      // Micronutrients
      nutrition.vitaminC = nutriments['vitamin-c_100g'] || nutriments['vitamin-c'] || null;
      nutrition.calcium = nutriments.calcium_100g || nutriments.calcium || null;
      nutrition.iron = nutriments.iron_100g || nutriments.iron || null;
    }

    return nutrition;
  }

  /**
   * Extract ingredients list
   */
  extractIngredients(product) {
    if (product.ingredients_text) {
      return product.ingredients_text.split(',').map(ingredient => 
        ingredient.trim()
      );
    }
    return [];
  }

  /**
   * Extract allergens
   */
  extractAllergens(product) {
    if (product.allergens_tags) {
      return product.allergens_tags.map(tag => 
        tag.replace('en:', '').replace(/-/g, ' ')
      );
    }
    return [];
  }

  /**
   * Extract packaging information
   */
  extractPackaging(product) {
    if (product.packaging_tags) {
      return product.packaging_tags.map(tag => 
        tag.replace('en:', '').replace(/-/g, ' ')
      );
    }
    return [];
  }

  /**
   * Extract origin information
   */
  extractOrigin(product) {
    return {
      countries: product.countries || null,
      countriesTags: product.countries_tags || [],
      manufacturingPlaces: product.manufacturing_places || null,
      origins: product.origins || null
    };
  }

  /**
   * Extract labels and certifications
   */
  extractLabels(product) {
    if (product.labels_tags) {
      return product.labels_tags.map(tag => 
        tag.replace('en:', '').replace(/-/g, ' ')
      );
    }
    return [];
  }

  /**
   * Extract additives
   */
  extractAdditives(product) {
    if (product.additives_tags) {
      return product.additives_tags.map(tag => 
        tag.replace('en:', '').replace(/-/g, ' ')
      );
    }
    return [];
  }

  /**
   * Search for products by category
   */
  async searchByCategory(category, page = 1, pageSize = 20) {
    try {
      await this.rateLimit();
      
      const response = await axios.get(`${this.baseURL}/search`, {
        params: {
          categories_tags_en: category,
          page_size: pageSize,
          page: page,
          fields: 'product_name,brands,categories,code,image_url,image_front_url,image_ingredients_url,image_nutrition_url,ingredients_text,allergens_tags,additives_tags,labels_tags,countries_tags,manufacturing_places,origins,nutriments,nova_group,ecoscore_grade,nutriscore_grade,last_modified_t,data_quality_tags'
        },
        headers: {
          'User-Agent': this.userAgent
        },
        auth: this.auth
      });

      return response.data;
    } catch (error) {
      logger.error('OpenFoodFacts category search failed:', error);
      throw error;
    }
  }

  /**
   * Search products by brand
   */
  async searchByBrand(brand, page = 1, pageSize = 20) {
    try {
      await this.rateLimit();
      
      const response = await axios.get(`${this.baseURL}/search`, {
        params: {
          brands_tags: brand,
          page_size: pageSize,
          page: page,
          fields: 'product_name,brands,categories,code,image_url,image_front_url,image_ingredients_url,image_nutrition_url,ingredients_text,allergens_tags,additives_tags,labels_tags,countries_tags,manufacturing_places,origins,nutriments,nova_group,ecoscore_grade,nutriscore_grade,last_modified_t,data_quality_tags'
        },
        headers: {
          'User-Agent': this.userAgent
        },
        auth: this.auth
      });

      return response.data;
    } catch (error) {
      logger.error('OpenFoodFacts brand search failed:', error);
      throw error;
    }
  }

  /**
   * Search products by ingredients
   */
  async searchByIngredients(ingredients, page = 1, pageSize = 20) {
    try {
      await this.rateLimit();
      
      const response = await axios.get(`${this.baseURL}/search`, {
        params: {
          ingredients_tags: ingredients,
          page_size: pageSize,
          page: page,
          fields: 'product_name,brands,categories,code,image_url,image_front_url,image_ingredients_url,image_nutrition_url,ingredients_text,allergens_tags,additives_tags,labels_tags,countries_tags,manufacturing_places,origins,nutriments,nova_group,ecoscore_grade,nutriscore_grade,last_modified_t,data_quality_tags'
        },
        headers: {
          'User-Agent': this.userAgent
        },
        auth: this.auth
      });

      return response.data;
    } catch (error) {
      logger.error('OpenFoodFacts ingredients search failed:', error);
      throw error;
    }
  }

  /**
   * Get products with images
   */
  async searchProductsWithImages(query, page = 1, pageSize = 20) {
    try {
      const data = await this.searchProducts(query, page, pageSize);
      
      if (!data.products) {
        return { products: [], count: 0 };
      }

      const productsWithImages = data.products.filter(product => 
        product.image_front_url || 
        product.image_ingredients_url || 
        product.image_nutrition_url ||
        product.image_url
      );

      return {
        products: productsWithImages.map(product => this.processProductData({ product })),
        count: productsWithImages.length,
        total: data.count
      };
    } catch (error) {
      logger.error('OpenFoodFacts image search failed:', error);
      throw error;
    }
  }
}

module.exports = OpenFoodFactsService;