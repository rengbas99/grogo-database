const express = require('express');
const router = express.Router();
const {
  getProductsFromFirebase,
  getStoreCategories,
  getStoreBrands,
  SORT_OPTIONS,
  FILTER_OPTIONS
} = require('../middleware/productSorting');

/**
 * GET /api/products/:storeId
 * Get products for a specific store with optional filtering, sorting, and pagination
 */
router.get('/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const {
      category,
      subcategory,
      sortBy = SORT_OPTIONS.NAME_A_TO_Z,
      page = 1,
      limit = 20,
      search,
      brand,
      priceMin,
      priceMax,
      inStock
    } = req.query;

    // Build filters object
    const filters = {};
    if (brand) filters.brand = brand;
    if (priceMin || priceMax) {
      filters.priceRange = {};
      if (priceMin) filters.priceRange.min = parseFloat(priceMin);
      if (priceMax) filters.priceRange.max = parseFloat(priceMax);
    }
    if (inStock !== undefined) filters.inStock = inStock === 'true';

    const options = {
      category,
      subcategory,
      sortBy,
      filters,
      page: parseInt(page),
      limit: parseInt(limit),
      search
    };

    const result = await getProductsFromFirebase(storeId, options);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        meta: result.meta
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error in products route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/products/:storeId/categories
 * Get available categories for a store
 */
router.get('/:storeId/categories', async (req, res) => {
  try {
    const { storeId } = req.params;
    const result = await getStoreCategories(storeId);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error in categories route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/products/:storeId/brands
 * Get available brands for a store
 */
router.get('/:storeId/brands', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { category } = req.query;
    const result = await getStoreBrands(storeId, category);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error in brands route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/products/search/:storeId
 * Search products across all categories
 */
router.get('/search/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { q, sortBy = SORT_OPTIONS.NAME_A_TO_Z, page = 1, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const options = {
      search: q,
      sortBy,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const result = await getProductsFromFirebase(storeId, options);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        meta: {
          ...result.meta,
          searchQuery: q
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error in search route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/products/options/sort
 * Get available sort options
 */
router.get('/options/sort', (req, res) => {
  res.json({
    success: true,
    data: Object.entries(SORT_OPTIONS).map(([key, value]) => ({
      key,
      value,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }))
  });
});

/**
 * GET /api/products/options/filter
 * Get available filter options
 */
router.get('/options/filter', (req, res) => {
  res.json({
    success: true,
    data: Object.entries(FILTER_OPTIONS).map(([key, value]) => ({
      key,
      value,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }))
  });
});

/**
 * GET /api/products/suggestions/:storeId
 * Get search suggestions for a store
 */
router.get('/suggestions/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { q, limit = 5 } = req.query;

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Get all products for suggestions
    const result = await getProductsFromFirebase(storeId, { limit: 1000 });
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    const { getSearchSuggestions } = require('../utils/fuzzySearch');
    const suggestions = getSearchSuggestions(q, result.data.products, parseInt(limit));

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('Error in suggestions route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
