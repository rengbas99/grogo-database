const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

/**
 * GET /api/products/categorized
 * Get all products from the categorized products JSON file
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 1000, store } = req.query;
    
    // Read the categorized products file
    const filePath = path.join(__dirname, '../../data/categorized-products.json');
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Categorized products file not found'
      });
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    // Filter by store if specified
    let filteredData = data;
    if (store) {
      const storeKey = Object.keys(data.stores || {}).find(key => 
        key.toLowerCase().includes(store.toLowerCase())
      );
      
      if (storeKey) {
        filteredData = {
          ...data,
          stores: {
            [storeKey]: data.stores[storeKey]
          }
        };
      }
    }
    
    // Apply limit to products
    if (limit && data.stores) {
      Object.keys(filteredData.stores).forEach(storeId => {
        if (filteredData.stores[storeId].products) {
          filteredData.stores[storeId].products = filteredData.stores[storeId].products.slice(0, parseInt(limit));
        }
      });
    }
    
    res.json({
      success: true,
      data: filteredData,
      meta: {
        totalStores: Object.keys(filteredData.stores || {}).length,
        totalProducts: Object.values(filteredData.stores || {}).reduce((total, store) => 
          total + (store.products ? store.products.length : 0), 0
        ),
        timestamp: filteredData.timestamp,
        limit: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Error in categorized products route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/products/categorized/search
 * Search within categorized products
 */
router.get('/search', async (req, res) => {
  try {
    const { query, store, category, limit = 50 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }
    
    // Read the categorized products file
    const filePath = path.join(__dirname, '../../data/categorized-products.json');
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Categorized products file not found'
      });
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    let results = [];
    
    // Search through all stores
    Object.values(data.stores || {}).forEach(storeData => {
      if (store && !storeData.storeId?.toLowerCase().includes(store.toLowerCase())) {
        return;
      }
      
      if (storeData.products) {
        const matchingProducts = storeData.products.filter(product => {
          const matchesQuery = product.name?.toLowerCase().includes(query.toLowerCase()) ||
                             product.brand?.toLowerCase().includes(query.toLowerCase()) ||
                             product.category?.toLowerCase().includes(query.toLowerCase());
          
          const matchesCategory = !category || product.category?.toLowerCase().includes(category.toLowerCase());
          
          return matchesQuery && matchesCategory;
        });
        
        results.push(...matchingProducts.map(product => ({
          ...product,
          storeId: storeData.storeId,
          storeName: storeData.name
        })));
      }
    });
    
    // Sort by relevance (exact matches first)
    results.sort((a, b) => {
      const aExact = a.name?.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
      const bExact = b.name?.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
      return bExact - aExact;
    });
    
    // Apply limit
    results = results.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        products: results,
        query,
        totalResults: results.length
      },
      meta: {
        query,
        store,
        category,
        limit: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Error in categorized products search route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
