/**
 * Image Search Service
 * Searches for product images when OpenFoodFacts doesn't have them
 */

const axios = require('axios');
const logger = require('../utils/logger');

class ImageSearchService {
  constructor() {
    this.unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
    this.pixabayApiKey = process.env.PIXABAY_API_KEY;
    this.rateLimitDelay = 1000; // 1 second between requests
    this.lastRequestTime = 0;
  }

  /**
   * Add rate limiting
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
   * Search for product images using multiple sources
   */
  async searchProductImages(productName, category = null, brand = null) {
    try {
      const searchQuery = this.buildSearchQuery(productName, category, brand);
      
      // Try multiple image sources
      const imageSources = [
        () => this.searchUnsplash(searchQuery),
        () => this.searchPixabay(searchQuery),
        () => this.searchGenericImages(searchQuery)
      ];

      for (const source of imageSources) {
        try {
          const images = await source();
          if (images && images.length > 0) {
            return {
              images: images,
              source: 'external_search',
              query: searchQuery
            };
          }
        } catch (error) {
          logger.warn('Image source failed:', error.message);
          continue;
        }
      }

      return {
        images: [],
        source: 'none',
        query: searchQuery
      };
    } catch (error) {
      logger.error('Image search failed:', error);
      return {
        images: [],
        source: 'error',
        query: searchQuery
      };
    }
  }

  /**
   * Build search query for image search
   */
  buildSearchQuery(productName, category, brand) {
    let query = productName;
    
    // Add category context if available
    if (category) {
      const categoryKeywords = this.getCategoryKeywords(category);
      query += ` ${categoryKeywords}`;
    }
    
    // Add brand context if available
    if (brand && brand !== 'Unknown Brand') {
      query += ` ${brand}`;
    }
    
    // Clean up query
    query = query
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    return query;
  }

  /**
   * Get category-specific keywords for better image search
   */
  getCategoryKeywords(category) {
    const categoryKeywords = {
      'Vegetables & Fruit': 'fresh produce food',
      'Dairy': 'dairy milk cheese food',
      'Meat & Poultry': 'meat chicken beef food',
      'Bakery Items': 'bread pastry baked food',
      'Breakfast Items': 'breakfast cereal food',
      'Spices & World Foods': 'spices herbs food',
      'Frozen Food Products': 'frozen food',
      'Essentials': 'household cleaning',
      'Snacks & Beverages': 'snacks drinks food'
    };
    
    return categoryKeywords[category] || 'food product';
  }

  /**
   * Search Unsplash for images
   */
  async searchUnsplash(query) {
    if (!this.unsplashAccessKey) {
      throw new Error('Unsplash API key not configured');
    }

    await this.rateLimit();

    const response = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query: query,
        per_page: 5,
        orientation: 'landscape'
      },
      headers: {
        'Authorization': `Client-ID ${this.unsplashAccessKey}`
      }
    });

    return response.data.results.map(photo => ({
      url: photo.urls.regular,
      thumbnail: photo.urls.thumb,
      alt: photo.alt_description || query,
      source: 'unsplash',
      photographer: photo.user.name,
      photographerUrl: photo.user.links.html
    }));
  }

  /**
   * Search Pixabay for images
   */
  async searchPixabay(query) {
    if (!this.pixabayApiKey) {
      throw new Error('Pixabay API key not configured');
    }

    await this.rateLimit();

    const response = await axios.get('https://pixabay.com/api/', {
      params: {
        key: this.pixabayApiKey,
        q: query,
        image_type: 'photo',
        category: 'food',
        per_page: 5,
        safesearch: true
      }
    });

    return response.data.hits.map(hit => ({
      url: hit.largeImageURL,
      thumbnail: hit.previewURL,
      alt: hit.tags,
      source: 'pixabay',
      photographer: hit.user,
      photographerUrl: `https://pixabay.com/users/${hit.user}-${hit.user_id}/`
    }));
  }

  /**
   * Generic image search (fallback)
   */
  async searchGenericImages(query) {
    // This would be a generic image search implementation
    // For now, return empty array as fallback
    return [];
  }

  /**
   * Get the best image from search results
   */
  getBestImage(searchResults) {
    if (!searchResults || !searchResults.images || searchResults.images.length === 0) {
      return null;
    }

    // Score images based on relevance
    const scoredImages = searchResults.images.map(image => ({
      ...image,
      score: this.scoreImage(image, searchResults.query)
    }));

    // Sort by score and return the best one
    scoredImages.sort((a, b) => b.score - a.score);
    return scoredImages[0];
  }

  /**
   * Score image based on relevance
   */
  scoreImage(image, query) {
    let score = 0;
    const queryWords = query.toLowerCase().split(/\s+/);
    const altWords = (image.alt || '').toLowerCase().split(/\s+/);
    
    // Count matching words
    queryWords.forEach(word => {
      if (altWords.some(altWord => altWord.includes(word) || word.includes(altWord))) {
        score += 1;
      }
    });
    
    // Bonus for exact matches
    if (image.alt && image.alt.toLowerCase().includes(query.toLowerCase())) {
      score += 2;
    }
    
    return score;
  }

  /**
   * Process product with image search
   */
  async processProductWithImages(product) {
    try {
      // Check if product already has images
      if (product.imageUrl) {
        return {
          ...product,
          imageSearch: {
            hasImage: true,
            source: 'openfoodfacts',
            imageUrl: product.imageUrl
          }
        };
      }

      // Search for images
      const searchResults = await this.searchProductImages(
        product.name,
        product.categorization?.category,
        product.brand
      );

      const bestImage = this.getBestImage(searchResults);

      return {
        ...product,
        imageUrl: bestImage?.url || null,
        imageSearch: {
          hasImage: !!bestImage,
          source: bestImage?.source || 'none',
          searchResults: searchResults,
          bestImage: bestImage
        }
      };
    } catch (error) {
      logger.error('Image processing failed for product:', product.name, error);
      return {
        ...product,
        imageSearch: {
          hasImage: false,
          source: 'error',
          error: error.message
        }
      };
    }
  }

  /**
   * Process multiple products with image search
   */
  async processProductsWithImages(products) {
    const processedProducts = [];
    
    for (const product of products) {
      try {
        const processedProduct = await this.processProductWithImages(product);
        processedProducts.push(processedProduct);
        
        // Add delay between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        logger.error('Failed to process product with images:', product.name, error);
        processedProducts.push({
          ...product,
          imageSearch: {
            hasImage: false,
            source: 'error',
            error: error.message
          }
        });
      }
    }
    
    return processedProducts;
  }
}

module.exports = ImageSearchService;
