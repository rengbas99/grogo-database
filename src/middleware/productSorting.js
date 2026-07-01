/**
 * Product Sorting and Filtering Middleware
 * Handles dynamic sorting and filtering of products from Firebase
 */

const admin = require('firebase-admin');
const { fuzzySearch, getSearchSuggestions } = require('../utils/fuzzySearch');

// Simple in-memory cache for product data
const productCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100; // Maximum number of cached entries

// Sorting options
const SORT_OPTIONS = {
  PRICE_LOW_TO_HIGH: 'price_asc',
  PRICE_HIGH_TO_LOW: 'price_desc',
  NAME_A_TO_Z: 'name_asc',
  NAME_Z_TO_A: 'name_desc',
  CATEGORY: 'category',
  BRAND: 'brand',
  NEWEST: 'newest',
  OLDEST: 'oldest'
};

// Filter options
const FILTER_OPTIONS = {
  CATEGORY: 'category',
  SUBCATEGORY: 'subcategory',
  BRAND: 'brand',
  PRICE_RANGE: 'priceRange',
  IN_STOCK: 'inStock',
  SEARCH: 'search'
};

/**
 * Sort products based on the provided sort option
 * @param {Array} products - Array of products to sort
 * @param {string} sortBy - Sort option from SORT_OPTIONS
 * @returns {Array} Sorted products array
 */
function sortProducts(products, sortBy = SORT_OPTIONS.NAME_A_TO_Z) {
  if (!Array.isArray(products) || products.length === 0) {
    return products;
  }

  const sortedProducts = [...products];

  switch (sortBy) {
    case SORT_OPTIONS.PRICE_LOW_TO_HIGH:
      return sortedProducts.sort((a, b) => (a.price || 0) - (b.price || 0));
    
    case SORT_OPTIONS.PRICE_HIGH_TO_LOW:
      return sortedProducts.sort((a, b) => (b.price || 0) - (a.price || 0));
    
    case SORT_OPTIONS.NAME_A_TO_Z:
      return sortedProducts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    case SORT_OPTIONS.NAME_Z_TO_A:
      return sortedProducts.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    
    case SORT_OPTIONS.CATEGORY:
      return sortedProducts.sort((a, b) => {
        const categoryCompare = (a.category || '').localeCompare(b.category || '');
        if (categoryCompare !== 0) return categoryCompare;
        return (a.name || '').localeCompare(b.name || '');
      });
    
    case SORT_OPTIONS.BRAND:
      return sortedProducts.sort((a, b) => {
        const brandCompare = (a.brand || '').localeCompare(b.brand || '');
        if (brandCompare !== 0) return brandCompare;
        return (a.name || '').localeCompare(b.name || '');
      });
    
    case SORT_OPTIONS.NEWEST:
      return sortedProducts.sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0));
    
    case SORT_OPTIONS.OLDEST:
      return sortedProducts.sort((a, b) => new Date(a.lastUpdated || 0) - new Date(b.lastUpdated || 0));
    
    default:
      return sortedProducts;
  }
}

/**
 * Filter products based on the provided filters
 * @param {Array} products - Array of products to filter
 * @param {Object} filters - Filter options
 * @returns {Array} Filtered products array
 */
function filterProducts(products, filters = {}) {
  if (!Array.isArray(products) || products.length === 0) {
    return products;
  }

  return products.filter(product => {
    // Category filter
    if (filters.category && product.category !== filters.category) {
      return false;
    }

    // Subcategory filter
    if (filters.subcategory && product.subcategory !== filters.subcategory) {
      return false;
    }

    // Brand filter
    if (filters.brand && product.brand !== filters.brand) {
      return false;
    }

    // Price range filter
    if (filters.priceRange) {
      const { min, max } = filters.priceRange;
      const price = product.price || 0;
      if (min !== undefined && price < min) return false;
      if (max !== undefined && price > max) return false;
    }

    // In stock filter
    if (filters.inStock !== undefined && product.inStock !== filters.inStock) {
      return false;
    }

    // Search filter (searches in name, description, and brand)
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const searchableText = [
        product.name || '',
        product.description || '',
        product.brand || '',
        product.category || ''
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(searchTerm)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Paginate products array
 * @param {Array} products - Array of products to paginate
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Number of products per page
 * @returns {Object} Paginated result with products, pagination info
 */
function paginateProducts(products, page = 1, limit = 20) {
  if (!Array.isArray(products)) {
    return {
      products: [],
      pagination: {
        page: 1,
        limit: limit,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      }
    };
  }

  const total = products.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  
  const paginatedProducts = products.slice(offset, offset + limit);

  return {
    products: paginatedProducts,
    pagination: {
      page: page,
      limit: limit,
      total: total,
      totalPages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

/**
 * Calculate data completeness score for a product
 * @param {Object} product - Product object
 * @returns {number} Completeness score (higher = more complete)
 */
function calculateDataCompleteness(product) {
  let score = 0;
  
  // Basic fields (1 point each)
  if (product.name) score += 1;
  if (product.price && product.price > 0) score += 1;
  if (product.brand) score += 1;
  if (product.category) score += 1;
  if (product.inStock !== undefined) score += 1;
  
  // Enhanced fields (2 points each)
  if (product.image && product.image !== 'placeholder') score += 2;
  if (product.description && product.description.trim()) score += 2;
  if (product.subcategory) score += 2;
  if (product.currency) score += 2;
  
  // Premium fields (3 points each)
  if (product.ingredients) score += 3;
  if (product.nutrition) score += 3;
  if (product.allergens) score += 3;
  
  return score;
}

/**
 * Levenshtein distance algorithm for fuzzy matching
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Distance between strings
 */
function levenshteinDistance(str1, str2) {
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
 * Calculate similarity score (0-1, higher is more similar)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score
 */
function calculateSimilarity(str1, str2) {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
}

/**
 * Apply fuzzy search to products
 * @param {Array} products - Array of products
 * @param {string} searchTerm - Search term
 * @param {number} threshold - Minimum similarity threshold (0-1)
 * @returns {Array} Filtered and scored products
 */
function applyFuzzySearch(products, searchTerm, threshold = 0.6) {
  if (!searchTerm || searchTerm.trim() === '') {
    return products;
  }

  const queryLower = searchTerm.toLowerCase();
  
  return products.map(product => {
    const name = product.name || '';
    const brand = product.brand || '';
    const description = product.description || '';
    const category = product.category || '';
    
    // Calculate similarity scores for different fields
    const nameScore = calculateSimilarity(name, queryLower);
    const brandScore = calculateSimilarity(brand, queryLower);
    const descriptionScore = calculateSimilarity(description, queryLower);
    const categoryScore = calculateSimilarity(category, queryLower);
    
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

/**
 * Get products from Firebase with sorting, filtering, and pagination
 * @param {string} storeId - Store ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Products with pagination info
 */
async function getProductsFromFirebase(storeId, options = {}) {
  try {
    const {
      category = null,
      subcategory = null,
      sortBy = SORT_OPTIONS.NAME_A_TO_Z,
      filters = {},
      page = 1,
      limit = 20,
      search = null
    } = options;

    // Create cache key
    const cacheKey = `${storeId}_${JSON.stringify({ category, subcategory, sortBy, filters, page, limit, search })}`;
    
    // Check cache first
    if (productCache.has(cacheKey)) {
      const cached = productCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`Cache hit for ${storeId}`);
        return cached.data;
      } else {
        productCache.delete(cacheKey);
      }
    }

    const db = admin.firestore();
    const storeRef = db.collection('stores').doc(storeId);
    
    let products = [];

    if (category) {
      // Get products from specific category with pagination
      const categoryRef = storeRef.collection('categories').doc(category);
      let query = categoryRef.collection('products');
      
      // Apply basic filters at query level for better performance
      if (filters.inStock !== undefined) {
        query = query.where('inStock', '==', filters.inStock);
      }
      if (filters.brand) {
        query = query.where('brand', '==', filters.brand);
      }
      if (filters.priceRange) {
        if (filters.priceRange.min !== undefined) {
          query = query.where('price', '>=', filters.priceRange.min);
        }
        if (filters.priceRange.max !== undefined) {
          query = query.where('price', '<=', filters.priceRange.max);
        }
      }
      
      // Apply pagination at query level
      const startAfter = (page - 1) * limit;
      query = query.limit(limit * 2); // Get more than needed for better filtering
      
      const productsSnapshot = await query.get();
      
      products = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } else {
      // Optimized: Get products from all categories with parallel queries
      const categoriesSnapshot = await storeRef.collection('categories').limit(10).get();
      const productPromises = categoriesSnapshot.docs.map(async (categoryDoc) => {
        let query = categoryDoc.ref.collection('products');
        
        // Apply basic filters at query level
        if (filters.inStock !== undefined) {
          query = query.where('inStock', '==', filters.inStock);
        }
        if (filters.brand) {
          query = query.where('brand', '==', filters.brand);
        }
        if (filters.priceRange) {
          if (filters.priceRange.min !== undefined) {
            query = query.where('price', '>=', filters.priceRange.min);
          }
          if (filters.priceRange.max !== undefined) {
            query = query.where('price', '<=', filters.priceRange.max);
          }
        }
        
        // Limit per category to avoid overwhelming queries
        query = query.limit(50);
        
        const productsSnapshot = await query.get();
        return productsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          category: categoryDoc.id
        }));
      });
      
      // Execute all category queries in parallel
      const categoryResults = await Promise.all(productPromises);
      const allProducts = categoryResults.flat();
      
      // Simple deduplication by ID (keep first occurrence)
      const productMap = new Map();
      allProducts.forEach(product => {
        if (!productMap.has(product.id)) {
          productMap.set(product.id, product);
        }
      });
      
      products = Array.from(productMap.values());
    }

    // Apply filters
    const appliedFilters = { ...filters };
    if (subcategory) appliedFilters.subcategory = subcategory;

    let filteredProducts = filterProducts(products, appliedFilters);

    // Apply fuzzy search if search term provided
    if (search) {
      console.log(`Applying fuzzy search for: "${search}"`);
      filteredProducts = applyFuzzySearch(filteredProducts, search, 0.4);
      console.log(`Found ${filteredProducts.length} matches (exact + fuzzy)`);
    }

    // Apply sorting
    const sortedProducts = sortProducts(filteredProducts, sortBy);

    // Apply pagination
    const result = paginateProducts(sortedProducts, page, limit);

    const response = {
      success: true,
      data: result,
      meta: {
        storeId,
        category,
        subcategory,
        sortBy,
        filters: appliedFilters
      }
    };

    // Cache the result
    if (productCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entries when cache is full
      const oldestKey = productCache.keys().next().value;
      productCache.delete(oldestKey);
    }
    productCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });

    return response;

  } catch (error) {
    console.error('Error fetching products from Firebase:', error);
    return {
      success: false,
      error: error.message,
      data: {
        products: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      }
    };
  }
}

/**
 * Get available categories for a store
 * @param {string} storeId - Store ID
 * @returns {Promise<Array>} Array of categories with product counts
 */
async function getStoreCategories(storeId) {
  try {
    const db = admin.firestore();
    const storeRef = db.collection('stores').doc(storeId);
    const categoriesSnapshot = await storeRef.collection('categories').get();
    
    const categories = categoriesSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      productCount: doc.data().productCount,
      lastUpdated: doc.data().lastUpdated
    }));

    return {
      success: true,
      data: categories
    };
  } catch (error) {
    console.error('Error fetching store categories:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
}

/**
 * Get available brands for a store
 * @param {string} storeId - Store ID
 * @param {string} category - Optional category filter
 * @returns {Promise<Array>} Array of brands with product counts
 */
async function getStoreBrands(storeId, category = null) {
  try {
    const db = admin.firestore();
    const storeRef = db.collection('stores').doc(storeId);
    
    let products = [];

    if (category) {
      const categoryRef = storeRef.collection('categories').doc(category);
      const productsSnapshot = await categoryRef.collection('products').get();
      products = productsSnapshot.docs.map(doc => doc.data());
    } else {
      const categoriesSnapshot = await storeRef.collection('categories').get();
      
      for (const categoryDoc of categoriesSnapshot.docs) {
        const productsSnapshot = await categoryDoc.ref.collection('products').get();
        const categoryProducts = productsSnapshot.docs.map(doc => doc.data());
        products = products.concat(categoryProducts);
      }
    }

    // Count brands
    const brandCounts = {};
    products.forEach(product => {
      const brand = product.brand || 'Unknown';
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    });

    const brands = Object.entries(brandCounts).map(([brand, count]) => ({
      name: brand,
      productCount: count
    })).sort((a, b) => b.productCount - a.productCount);

    return {
      success: true,
      data: brands
    };
  } catch (error) {
    console.error('Error fetching store brands:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
}

module.exports = {
  sortProducts,
  filterProducts,
  paginateProducts,
  getProductsFromFirebase,
  getStoreCategories,
  getStoreBrands,
  SORT_OPTIONS,
  FILTER_OPTIONS
};
