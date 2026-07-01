import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';

// Normalize product data from different supermarkets
export const normalizeProductData = (rawProduct, storeName, category) => {
  const productId = uuidv4();
  const timestamp = moment().toISOString();

  return {
    id: productId,
    store: storeName.toLowerCase(),
    category: category.toLowerCase(),
    name: rawProduct.name || rawProduct.title || rawProduct.productName || 'Unknown Product',
    description: rawProduct.description || rawProduct.details || '',
    price: parseFloat(rawProduct.price || rawProduct.currentPrice || 0),
    originalPrice: parseFloat(rawProduct.originalPrice || rawProduct.regularPrice || rawProduct.price || 0),
    currency: rawProduct.currency || 'GBP',
    image: rawProduct.image || rawProduct.imageUrl || rawProduct.images?.[0] || '',
    images: Array.isArray(rawProduct.images) ? rawProduct.images : [rawProduct.image || ''],
    brand: rawProduct.brand || rawProduct.manufacturer || '',
    sku: rawProduct.sku || rawProduct.upc || rawProduct.gtin || rawProduct.ean || '',
    availability: rawProduct.availability || rawProduct.inStock !== false ? 'in_stock' : 'out_of_stock',
    rating: parseFloat(rawProduct.rating || rawProduct.averageRating || 0),
    reviewCount: parseInt(rawProduct.reviewCount || rawProduct.numReviews || 0),
    offers: normalizeOffers(rawProduct.offers || rawProduct.promotions || []),
    nutrition: normalizeNutrition(rawProduct.nutrition || rawProduct.nutritionalInfo || {}),
    weight: rawProduct.weight || rawProduct.size || '',
    unit: rawProduct.unit || rawProduct.measurement || '',
    url: rawProduct.url || rawProduct.productUrl || '',
    scrapedAt: timestamp,
    rawData: rawProduct // Keep original data for reference
  };
};

// Normalize offers/promotions data
const normalizeOffers = (offers) => {
  if (!Array.isArray(offers)) return [];
  
  return offers.map(offer => ({
    type: offer.type || offer.promotionType || 'discount',
    description: offer.description || offer.text || '',
    discount: offer.discount || offer.savings || 0,
    validUntil: offer.validUntil || offer.expiryDate || '',
    isClubcard: offer.isClubcard || offer.clubcard || false,
    isMultiBuy: offer.isMultiBuy || offer.multiBuy || false
  }));
};

// Normalize nutrition information
const normalizeNutrition = (nutrition) => {
  if (!nutrition || typeof nutrition !== 'object') return {};
  
  return {
    calories: parseFloat(nutrition.calories || nutrition.energy || 0),
    protein: parseFloat(nutrition.protein || 0),
    carbohydrates: parseFloat(nutrition.carbohydrates || nutrition.carbs || 0),
    fat: parseFloat(nutrition.fat || nutrition.totalFat || 0),
    saturatedFat: parseFloat(nutrition.saturatedFat || 0),
    sugar: parseFloat(nutrition.sugar || 0),
    salt: parseFloat(nutrition.salt || nutrition.sodium || 0),
    fiber: parseFloat(nutrition.fiber || nutrition.fibre || 0),
    per100g: nutrition.per100g || false,
    allergens: Array.isArray(nutrition.allergens) ? nutrition.allergens : [],
    ingredients: nutrition.ingredients || ''
  };
};

// Process and save scraped data
export const processScrapedData = async (scrapedData, storeName, category, outputDir) => {
  const processedData = scrapedData.map(product => 
    normalizeProductData(product, storeName, category)
  );

  // Create output directory if it doesn't exist
  await fs.ensureDir(outputDir);

  // Save individual store-category data
  const filename = `${storeName.toLowerCase()}_${category.toLowerCase()}_${moment().format('YYYY-MM-DD_HH-mm-ss')}.json`;
  const filepath = path.join(outputDir, filename);
  
  await fs.writeJson(filepath, processedData, { spaces: 2 });
  
  console.log(`✅ Processed ${processedData.length} products from ${storeName} - ${category}`);
  console.log(`📁 Saved to: ${filepath}`);
  
  return processedData;
};

// Merge data from multiple stores/categories
export const mergeProductData = async (allProcessedData, outputDir) => {
  const mergedData = allProcessedData.flat();
  
  // Remove duplicates based on name and store
  const uniqueProducts = mergedData.filter((product, index, self) => 
    index === self.findIndex(p => p.name === product.name && p.store === product.store)
  );

  // Save merged data
  const mergedFilename = `all_products_${moment().format('YYYY-MM-DD_HH-mm-ss')}.json`;
  const mergedFilepath = path.join(outputDir, mergedFilename);
  
  await fs.writeJson(mergedFilepath, uniqueProducts, { spaces: 2 });
  
  // Generate summary statistics
  const summary = generateSummary(uniqueProducts);
  const summaryFilename = `scraping_summary_${moment().format('YYYY-MM-DD_HH-mm-ss')}.json`;
  const summaryFilepath = path.join(outputDir, summaryFilename);
  
  await fs.writeJson(summaryFilepath, summary, { spaces: 2 });
  
  console.log(`✅ Merged ${uniqueProducts.length} unique products`);
  console.log(`📁 Merged data saved to: ${mergedFilepath}`);
  console.log(`📊 Summary saved to: ${summaryFilepath}`);
  
  return { mergedData: uniqueProducts, summary };
};

// Generate summary statistics
const generateSummary = (products) => {
  const storeCounts = {};
  const categoryCounts = {};
  const totalValue = products.reduce((sum, product) => sum + (product.price || 0), 0);
  const averagePrice = totalValue / products.length;
  
  products.forEach(product => {
    storeCounts[product.store] = (storeCounts[product.store] || 0) + 1;
    categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
  });

  return {
    totalProducts: products.length,
    totalValue: Math.round(totalValue * 100) / 100,
    averagePrice: Math.round(averagePrice * 100) / 100,
    storeBreakdown: storeCounts,
    categoryBreakdown: categoryCounts,
    scrapedAt: moment().toISOString(),
    stores: Object.keys(storeCounts),
    categories: Object.keys(categoryCounts)
  };
};

// Export data to CSV
export const exportToCSV = async (products, outputDir) => {
  const csvData = products.map(product => ({
    id: product.id,
    store: product.store,
    category: product.category,
    name: product.name,
    description: product.description,
    price: product.price,
    originalPrice: product.originalPrice,
    currency: product.currency,
    image: product.image,
    brand: product.brand,
    sku: product.sku,
    availability: product.availability,
    rating: product.rating,
    reviewCount: product.reviewCount,
    weight: product.weight,
    unit: product.unit,
    url: product.url,
    scrapedAt: product.scrapedAt
  }));

  const csvFilename = `products_${moment().format('YYYY-MM-DD_HH-mm-ss')}.csv`;
  const csvFilepath = path.join(outputDir, csvFilename);
  
  // Simple CSV generation
  const headers = Object.keys(csvData[0] || {});
  const csvContent = [
    headers.join(','),
    ...csvData.map(row => headers.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  await fs.writeFile(csvFilepath, csvContent);
  
  console.log(`📊 CSV exported to: ${csvFilepath}`);
  return csvFilepath;
};

