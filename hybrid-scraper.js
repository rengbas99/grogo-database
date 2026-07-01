#!/usr/bin/env node

import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';

dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

// Create data directory
const dataDir = './scraped-data';
const productsDir = path.join(dataDir, 'products');
const imagesDir = path.join(dataDir, 'images');
const logsDir = path.join(dataDir, 'logs');

await fs.ensureDir(productsDir);
await fs.ensureDir(imagesDir);
await fs.ensureDir(logsDir);

// Your specific product list
const PRODUCTS_TO_SCRAPE = [
    // Cooking Essentials
    'oil', 'salt', 'pepper', 'garlic', 'onion', 'tomato', 'herbs', 'spices', 'rice', 'ginger garlic paste',
    // Staples
    'bread', 'pasta', 'cereal', 'flour', 'sugar',
    // Dairy/Protein
    'milk', 'cheese', 'eggs', 'chicken', 'beef', 'pork', 'lamb', 'yogurt', 'butter',
    // Snacks
    'chocolate', 'biscuits', 'crisps', 'nuts',
    // Fruits
    'apple', 'banana', 'orange', 'grapes', 'strawberries',
    // Berries
    'blueberries', 'raspberries', 'blackberries', 'cranberries', 'gooseberries',
    // Household Essentials
    'toilet paper', 'cleaning', 'laundry', 'soap', 'shampoo', 'toothpaste', 'room spray', 'shower gel',
    // Sanitary & Personal Care
    'sanitary pads', 'tampons', 'deodorant', 'conditioner', 'medicines'
];

// Actor IDs
const SEARCH_ACTOR = '1qp9Bpg05Nyi51ieE'; // Fast search - gets product IDs
const DETAIL_ACTOR = 'pVHUOwMvyGUgT9Qff'; // Detailed scraper - gets comprehensive info

console.log('🚀 Hybrid Two-Actor Scraper');
console.log('📋 Step 1: Fast search for product IDs');
console.log('📋 Step 2: Detailed scraping for comprehensive data');
console.log(`📁 Data will be saved to: ${dataDir}\n`);

async function step1FastSearch(searchTerm, count = 5) {
    console.log(`🔍 Step 1: Fast search for "${searchTerm}" (${count} products)`);
    
    const searchUrl = `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(searchTerm)}&inputType=free+text`;
    console.log(`🔗 URL: ${searchUrl}`);
    
    const input = {
        "dev_dataset_clear": false,
        "dev_no_strip": false,
        "filters.new": false,
        "filters.offers": true,
        "filters.sort": "relevance",
        "limit": count,
        "query": [searchUrl]
    };

    try {
        const run = await client.actor(SEARCH_ACTOR).call(input);
        const runInfo = await client.run(run.id).waitForFinish();
        
        if (runInfo.status === 'SUCCEEDED') {
            const { items } = await client.dataset(runInfo.defaultDatasetId).listItems();
            
            console.log(`✅ Found ${items.length} products for "${searchTerm}"`);
            
            // Extract product IDs and basic info using correct field names
            const productIds = items.map(item => ({
                id: item.id, // This is the product ID from search results
                title: item.title,
                basicPrice: item.price?.actual,
                unitPrice: item.price?.unitPrice,
                unitOfMeasure: item.price?.unitOfMeasure,
                isForSale: item.isForSale
            }));
            
            return productIds;
            
        } else {
            console.log(`❌ Search failed: ${runInfo.status}`);
            return [];
        }
        
    } catch (error) {
        console.log(`❌ Search error: ${error.message}`);
        return [];
    }
}

async function step2DetailedScraping(productIds, searchTerm) {
    console.log(`\n🔬 Step 2: Detailed scraping for "${searchTerm}" (${productIds.length} products)`);
    
    const detailedProducts = [];
    
    for (const productId of productIds) {
        console.log(`  📦 Getting details for: ${productId.title} (ID: ${productId.id})`);
        
        try {
            // Use the detailed actor with product URL
            const input = {
                "urls": [`https://www.tesco.com/groceries/en-GB/products/${productId.id}`],
                "include_product_details": true,
                "max_items": 1
            };

            const run = await client.actor(DETAIL_ACTOR).call(input);
            const runInfo = await client.run(run.id).waitForFinish();
            
            if (runInfo.status === 'SUCCEEDED') {
                const { items } = await client.dataset(runInfo.defaultDatasetId).listItems();
                
                if (items.length > 0) {
                    const detailedItem = items[0];
                    
                    // Extract comprehensive data
                    const comprehensiveData = {
                        id: detailedItem.product_id || productId.id,
                        searchTerm: searchTerm,
                        productName: detailedItem.name || productId.name,
                        productPhoto: detailedItem.image_url || productId.image,
                        productDescription: detailedItem.description,
                        nutritionalFacts: detailedItem.nutrition,
                        price: detailedItem.price || productId.basicPrice,
                        currency: detailedItem.currency || 'GBP',
                        unitPrice: detailedItem.unit_price,
                        unitQuantity: detailedItem.unit_quantity,
                        brand: detailedItem.brand_name,
                        category: detailedItem.main_category,
                        subcategory: detailedItem.sub_category,
                        productCategory: detailedItem.product_category,
                        productType: detailedItem.product_type,
                        availability: detailedItem.in_stock ? 'in_stock' : 'out_of_stock',
                        url: detailedItem.url || productId.url,
                        ingredients: detailedItem.ingredients,
                        allergens: detailedItem.allergens,
                        storageInstructions: detailedItem.storage_instructions,
                        marketingText: detailedItem.marketing_text,
                        manufacturer: detailedItem.manufacturer,
                        scrapedAt: new Date().toISOString()
                    };
                    
                    detailedProducts.push(comprehensiveData);
                    console.log(`    ✅ Got details: ${comprehensiveData.productName}`);
                } else {
                    console.log(`    ⚠️  No detailed data found for ${productId.name}`);
                }
            } else {
                console.log(`    ❌ Detailed scraping failed: ${runInfo.status}`);
            }
            
        } catch (error) {
            console.log(`    ❌ Error getting details: ${error.message}`);
        }
        
        // Small delay between detailed requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return detailedProducts;
}

async function saveDataLocally(products, searchTerm) {
    const searchDir = path.join(productsDir, searchTerm.replace(/\s+/g, '-'));
    await fs.ensureDir(searchDir);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${searchTerm.replace(/\s+/g, '-')}-${timestamp}.json`;
    const filepath = path.join(searchDir, filename);
    
    await fs.writeJson(filepath, {
        searchTerm: searchTerm,
        totalProducts: products.length,
        scrapedAt: new Date().toISOString(),
        products: products
    }, { spaces: 2 });
    
    console.log(`💾 Saved ${products.length} products to: ${filepath}`);
}

async function saveImagesLocally(products, searchTerm) {
    const searchImagesDir = path.join(imagesDir, searchTerm.replace(/\s+/g, '-'));
    await fs.ensureDir(searchImagesDir);
    
    let savedImages = 0;
    for (const product of products) {
        if (product.productPhoto) {
            try {
                const imageUrl = product.productPhoto;
                const imageName = `${product.id}.jpg`;
                const imagePath = path.join(searchImagesDir, imageName);
                
                // Save image info (in real implementation, you'd download the image)
                const imageInfo = {
                    productId: product.id,
                    productName: product.productName,
                    imageUrl: imageUrl,
                    localPath: imagePath,
                    savedAt: new Date().toISOString()
                };
                
                const imageInfoFile = path.join(searchImagesDir, `${product.id}-info.json`);
                await fs.writeJson(imageInfoFile, imageInfo, { spaces: 2 });
                savedImages++;
            } catch (error) {
                console.log(`⚠️  Could not save image for ${product.productName}: ${error.message}`);
            }
        }
    }
    
    if (savedImages > 0) {
        console.log(`🖼️  Saved ${savedImages} image references to: ${searchImagesDir}`);
    }
}

async function scrapeProduct(searchTerm, count = 5) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🛒 SCRAPING: ${searchTerm.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);
    
    try {
        // Step 1: Fast search for product IDs
        const productIds = await step1FastSearch(searchTerm, count);
        
        if (productIds.length === 0) {
            console.log(`❌ No products found for "${searchTerm}"`);
            return [];
        }
        
        // Step 2: Detailed scraping for comprehensive data
        const detailedProducts = await step2DetailedScraping(productIds, searchTerm);
        
        if (detailedProducts.length > 0) {
            // Save data locally
            await saveDataLocally(detailedProducts, searchTerm);
            await saveImagesLocally(detailedProducts, searchTerm);
            
            // Show summary
            console.log(`\n📊 SUMMARY for "${searchTerm}":`);
            console.log(`  ✅ Products found: ${detailedProducts.length}`);
            console.log(`  💰 Price range: £${Math.min(...detailedProducts.map(p => p.price || 0))} - £${Math.max(...detailedProducts.map(p => p.price || 0))}`);
            console.log(`  🏷️  Brands: ${[...new Set(detailedProducts.map(p => p.brand).filter(Boolean))].join(', ')}`);
            
            // Show sample products
            console.log(`\n📦 Sample products:`);
            detailedProducts.slice(0, 3).forEach((product, index) => {
                console.log(`  ${index + 1}. ${product.productName}`);
                console.log(`     Price: £${product.price} (${product.unitPrice} per ${product.unitQuantity}g)`);
                console.log(`     Brand: ${product.brand}`);
                console.log(`     Category: ${product.category} > ${product.subcategory}`);
            });
        }
        
        return detailedProducts;
        
    } catch (error) {
        console.log(`❌ Error scraping "${searchTerm}": ${error.message}`);
        return [];
    }
}

// Main execution
(async () => {
    try {
        console.log('🚀 Starting Hybrid Two-Actor Scraper');
        console.log(`📋 Will scrape ${PRODUCTS_TO_SCRAPE.length} product categories`);
        console.log(`🎯 5 products per category = ${PRODUCTS_TO_SCRAPE.length * 5} total products expected\n`);
        
        const allProducts = [];
        const startTime = Date.now();
        
        for (let i = 0; i < PRODUCTS_TO_SCRAPE.length; i++) {
            const searchTerm = PRODUCTS_TO_SCRAPE[i];
            console.log(`\n📊 Progress: ${i + 1}/${PRODUCTS_TO_SCRAPE.length} (${Math.round((i + 1) / PRODUCTS_TO_SCRAPE.length * 100)}%)`);
            
            const products = await scrapeProduct(searchTerm, 5);
            allProducts.push(...products);
            
            // Delay between categories to avoid rate limiting
            if (i < PRODUCTS_TO_SCRAPE.length - 1) {
                console.log(`⏳ Waiting 3 seconds before next category...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🎉 SCRAPING COMPLETED!`);
        console.log(`${'='.repeat(60)}`);
        console.log(`📊 Total products scraped: ${allProducts.length}`);
        console.log(`⏱️  Total time: ${duration} seconds`);
        console.log(`📁 Data saved to: ${dataDir}`);
        console.log(`🖼️  Images saved to: ${imagesDir}`);
        
        // Save master summary
        const summaryFile = path.join(dataDir, 'scraping-summary.json');
        await fs.writeJson(summaryFile, {
            totalProducts: allProducts.length,
            totalCategories: PRODUCTS_TO_SCRAPE.length,
            duration: duration,
            completedAt: new Date().toISOString(),
            categories: PRODUCTS_TO_SCRAPE,
            products: allProducts
        }, { spaces: 2 });
        
        console.log(`📋 Master summary saved to: ${summaryFile}`);
        
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
    }
})();
