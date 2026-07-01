import { ApifyClient } from 'apify-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Apify client
const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

// Actor IDs (same as hybrid-scraper.js)
const SEARCH_ACTOR = '1qp9Bpg05Nyi51ieE'; // Fast search - gets product IDs
const DETAIL_ACTOR = 'radeance/tesco-scraper'; // Detailed scraper - gets comprehensive info

// Read existing summary data
const summaryPath = path.join(__dirname, 'scraped-data', 'scraping-summary.json');
let existingData = { products: [], totalProducts: 0, totalCategories: 0, categories: [] };

if (fs.existsSync(summaryPath)) {
    existingData = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
}

// Step 1: Search pages to extract product IDs
const searchPages = [
    {
        searchTerm: 'banana',
        url: 'https://www.tesco.com/groceries/en-GB/shop/fresh-food/fresh-fruit/bananas',
        maxItems: 10,
        type: 'category_page'
    },
    {
        searchTerm: 'biscuits',
        url: 'https://www.tesco.com/groceries/en-GB/search?query=tesco+biscuits&inputType=free+text',
        maxItems: 7,
        type: 'search_page',
        targetTypes: ['bourbon', 'digestive', 'dark chocolate digestive', 'custard cream', 'rich tea', 'chocolate chip']
    },
    {
        searchTerm: 'pringles',
        url: 'https://www.tesco.com/groceries/en-GB/search?query=pringles&inputType=free+text',
        maxItems: 5,
        type: 'search_page'
    },
    {
        searchTerm: 'cleaning',
        url: 'https://www.tesco.com/groceries/en-GB/search?query=washing+up+&inputType=free+text',
        maxItems: 10,
        type: 'search_page',
        targetBrands: ['tesco', 'fairy']
    }
];

// Step 2: Individual product IDs (direct scraping)
const individualProducts = [
    // Biscuits (3 specific)
    { productId: '290329100', searchTerm: 'biscuits' },
    { productId: '254921258', searchTerm: 'biscuits' },
    { productId: '254924572', searchTerm: 'biscuits' },
    
    // Bread (4 products)
    { productId: '299425748', searchTerm: 'bread' },
    { productId: '299389116', searchTerm: 'bread' },
    { productId: '299425783', searchTerm: 'bread' },
    { productId: '254944283', searchTerm: 'bread' },
    
    // Toothpaste (2 products)
    { productId: '313367133', searchTerm: 'toothpaste' },
    { productId: '313960093', searchTerm: 'toothpaste' },
    
    // Paneer (3 products)
    { productId: '299685318', searchTerm: 'paneer' },
    { productId: '254909625', searchTerm: 'paneer' },
    { productId: '254908718', searchTerm: 'paneer' },
    
    // Chicken (9 products)
    { productId: '292284222', searchTerm: 'chicken' },
    { productId: '304410539', searchTerm: 'chicken' },
    { productId: '317311429', searchTerm: 'chicken' },
    { productId: '288661225', searchTerm: 'chicken' },
    { productId: '285210396', searchTerm: 'chicken' },
    { productId: '304380429', searchTerm: 'chicken' },
    { productId: '285210344', searchTerm: 'chicken' },
    { productId: '285210436', searchTerm: 'chicken' },
    { productId: '276054144', searchTerm: 'chicken' },
    
    // Rice cake (1 product)
    { productId: '308828886', searchTerm: 'rice_cake' },
    
    // Cleaning products (13 products)
    { productId: '258237209', searchTerm: 'cleaning' },
    { productId: '255284946', searchTerm: 'cleaning' },
    { productId: '267318786', searchTerm: 'cleaning' },
    { productId: '263403403', searchTerm: 'cleaning' },
    { productId: '304789586', searchTerm: 'cleaning' },
    { productId: '284982972', searchTerm: 'cleaning' },
    { productId: '314430857', searchTerm: 'cleaning' },
    { productId: '250191211', searchTerm: 'cleaning' },
    { productId: '305962039', searchTerm: 'cleaning' },
    { productId: '301691734', searchTerm: 'cleaning' },
    { productId: '257841394', searchTerm: 'cleaning' },
    { productId: '285021487', searchTerm: 'cleaning' },
    { productId: '257259605', searchTerm: 'cleaning' },
    
    // Paratha (1 product)
    { productId: '302036513', searchTerm: 'paratha' },
    
    // Chapathi (1 product)
    { productId: '293467552', searchTerm: 'chapathi' },
    
    // Vegetables (18 products)
    { productId: '296056918', searchTerm: 'vegetables' },
    { productId: '254757959', searchTerm: 'vegetables' },
    { productId: '299768716', searchTerm: 'vegetables' },
    { productId: '292686490', searchTerm: 'vegetables' },
    { productId: '252474219', searchTerm: 'vegetables' },
    { productId: '259095864', searchTerm: 'vegetables' },
    { productId: '314098829', searchTerm: 'vegetables' },
    { productId: '253194105', searchTerm: 'vegetables' },
    { productId: '260298456', searchTerm: 'vegetables' },
    { productId: '260298462', searchTerm: 'vegetables' },
    { productId: '250802613', searchTerm: 'vegetables' },
    { productId: '252207537', searchTerm: 'vegetables' },
    { productId: '254656543', searchTerm: 'vegetables' },
    { productId: '321236185', searchTerm: 'vegetables' },
    { productId: '314830925', searchTerm: 'vegetables' },
    { productId: '295014849', searchTerm: 'vegetables' },
    { productId: '291970788', searchTerm: 'vegetables' },
    { productId: '321114093', searchTerm: 'vegetables' }
];

async function step1_extractProductIds() {
    console.log('🔍 STEP 1: Extracting Product IDs from Search Pages\n');
    const extractedIds = [];
    
    for (const page of searchPages) {
        console.log(`📄 Extracting IDs from ${page.searchTerm} (${page.type})...`);
        console.log(`   Target: ${page.searchTerm === 'banana' ? 5 : page.maxItems} products`);
        
        try {
            // Use the exact URL provided
            const searchUrl = page.url;
            console.log(`   🔗 URL: ${searchUrl}`);
            
            const input = {
                "dev_dataset_clear": false,
                "dev_no_strip": false,
                "filters.new": false,
                "filters.offers": true,
                "filters.sort": "relevance",
                "limit": page.maxItems,
                "query": [searchUrl]
            };

            const run = await client.actor(SEARCH_ACTOR).call(input);
            const runInfo = await client.run(run.id).waitForFinish();
            
            if (runInfo.status === 'SUCCEEDED') {
                const { items } = await client.dataset(runInfo.defaultDatasetId).listItems();
                
                console.log(`   📦 Retrieved ${items.length} items from search`);
                
                if (items.length > 0) {
                    let filteredResults = items;
                    
                    // Filter by specific types for biscuits
                    if (page.searchTerm === 'biscuits' && page.targetTypes) {
                        filteredResults = items.filter(item => {
                            const name = (item.title || '').toLowerCase();
                            return page.targetTypes.some(type => name.includes(type));
                        });
                        console.log(`   🍪 Filtered to ${filteredResults.length} biscuit types`);
                    }
                    
                    // Filter by specific brands for cleaning (check title since brand field is empty)
                    if (page.searchTerm === 'cleaning' && page.targetBrands) {
                        filteredResults = items.filter(item => {
                            const title = (item.title || '').toLowerCase();
                            return page.targetBrands.some(targetBrand => title.includes(targetBrand));
                        });
                        console.log(`   🧽 Filtered to ${filteredResults.length} cleaning brands`);
                    }
                    
                    let productIds = filteredResults.map(item => ({
                        productId: item.id,
                        searchTerm: page.searchTerm,
                        productName: item.title,
                        basicPrice: item.price?.actual,
                        unitPrice: item.price?.unitPrice,
                        unitOfMeasure: item.price?.unitOfMeasure,
                        isForSale: item.isForSale
                    })).filter(item => item.productId);
                    
                    // Limit banana to 5 products
                    if (page.searchTerm === 'banana') {
                        productIds = productIds.slice(0, 5);
                    }
                    
                    extractedIds.push(...productIds);
                    console.log(`   ✅ Extracted ${productIds.length} product IDs`);
                    productIds.forEach(item => {
                        console.log(`      - ${item.productId}: ${item.productName}`);
                    });
                    
                } else {
                    console.log(`   ⚠️  No products found`);
                }
                
            } else {
                console.log(`   ❌ Search failed: ${runInfo.status}`);
            }
            
        } catch (error) {
            console.error(`   ❌ Error extracting from ${page.searchTerm}:`, error.message);
        }
        
        console.log('');
    }
    
    return extractedIds;
}

async function step2_scrapeProducts(allProductIds) {
    console.log('📦 STEP 2: Scraping Individual Products\n');
    const allProducts = [];
    
    // Group products by search term for better organization
    const productsByCategory = {};
    allProductIds.forEach(item => {
        if (!productsByCategory[item.searchTerm]) {
            productsByCategory[item.searchTerm] = [];
        }
        productsByCategory[item.searchTerm].push(item);
    });
    
    for (const [searchTerm, products] of Object.entries(productsByCategory)) {
        console.log(`📄 Scraping ${searchTerm} products (${products.length} items)...`);
        
        for (const product of products) {
            try {
                console.log(`  📦 Getting details for: ${product.productName} (ID: ${product.productId})`);
                
                // Use detailed actor (same as hybrid-scraper.js)
                const input = {
                    "urls": [`https://www.tesco.com/groceries/en-GB/products/${product.productId}`],
                    "include_product_details": true,
                    "max_items": 1
                };

                const run = await client.actor(DETAIL_ACTOR).call(input);
                const runInfo = await client.run(run.id).waitForFinish();
                
                if (runInfo.status === 'SUCCEEDED') {
                    const { items } = await client.dataset(runInfo.defaultDatasetId).listItems();
                    
                    if (items.length > 0) {
                        const detailedItem = items[0];
                        
                        // Extract comprehensive data (same structure as hybrid-scraper.js)
                        const processedProduct = {
                            id: detailedItem.product_id || product.productId,
                            searchTerm: searchTerm,
                            productName: detailedItem.name || product.productName,
                            productPhoto: detailedItem.image_url || product.image,
                            productDescription: detailedItem.description,
                            nutritionalFacts: detailedItem.nutrition || {},
                            price: parseFloat(detailedItem.price || product.basicPrice) || 0,
                            currency: detailedItem.currency || 'GBP',
                            unitPrice: parseFloat(detailedItem.unit_price) || 0,
                            unitQuantity: detailedItem.unit_quantity || '',
                            brand: detailedItem.brand_name || 'Unknown',
                            category: detailedItem.main_category || 'Fresh Food',
                            subcategory: detailedItem.sub_category || '',
                            productCategory: detailedItem.product_category || '',
                            productType: detailedItem.product_type || '',
                            availability: detailedItem.in_stock ? 'in_stock' : 'out_of_stock',
                            url: detailedItem.url || `https://www.tesco.com/groceries/en-GB/products/${product.productId}`,
                            ingredients: detailedItem.ingredients || '',
                            allergens: detailedItem.allergens || null,
                            storageInstructions: detailedItem.storage_instructions || [],
                            marketingText: detailedItem.marketing_text || [],
                            manufacturer: detailedItem.manufacturer || { name: null, address: null, email: null },
                            scrapedAt: new Date().toISOString(),
                            source: 'two_step_scraping'
                        };
                        
                        allProducts.push(processedProduct);
                        console.log(`    ✅ Got details: ${processedProduct.productName}`);
                    } else {
                        console.log(`    ⚠️  No detailed data found for ${product.productName}`);
                    }
                } else {
                    console.log(`    ❌ Detailed scraping failed: ${runInfo.status}`);
                }
                
                // Small delay between detailed requests
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`   ❌ Error scraping ${product.productName || product.productId}:`, error.message);
            }
        }
        
        console.log('');
    }
    
    return allProducts;
}

async function main() {
    console.log('🚀 Starting Two-Step Scraping Process\n');
    
    try {
        // Step 1: Extract product IDs from search pages
        const extractedIds = await step1_extractProductIds();
        
        // Combine extracted IDs with individual product IDs
        const allProductIds = [...extractedIds, ...individualProducts];
        
        console.log(`📊 Total product IDs to scrape: ${allProductIds.length}`);
        console.log(`   - Extracted from search: ${extractedIds.length}`);
        console.log(`   - Individual products: ${individualProducts.length}\n`);
        
        // Step 2: Scrape all products
        const allProducts = await step2_scrapeProducts(allProductIds);
        
        // Add to existing data
        existingData.products = [...existingData.products, ...allProducts];
        existingData.totalProducts = existingData.products.length;
        
        // Update categories
        const newCategories = [...new Set(allProducts.map(p => p.searchTerm))];
        existingData.categories = [...new Set([...existingData.categories, ...newCategories])];
        existingData.totalCategories = existingData.categories.length;
        
        // Update completion info
        existingData.completedAt = new Date().toISOString();
        existingData.twoStepScraping = {
            completedAt: new Date().toISOString(),
            newProductsAdded: allProducts.length,
            extractedFromSearch: extractedIds.length,
            individualProducts: individualProducts.length,
            categoriesAdded: newCategories
        };
        
        // Save updated data
        fs.writeFileSync(summaryPath, JSON.stringify(existingData, null, 2));
        
        console.log('✅ Two-Step Scraping Completed!\n');
        console.log('📊 FINAL SUMMARY:');
        console.log(`Total products: ${existingData.totalProducts}`);
        console.log(`Total categories: ${existingData.totalCategories}`);
        console.log(`New products added: ${allProducts.length}`);
        console.log(`Extracted from search: ${extractedIds.length}`);
        console.log(`Individual products: ${individualProducts.length}`);
        
        // Show summary by category
        console.log('\n📋 Products by category:');
        const categoryCounts = {};
        allProducts.forEach(product => {
            categoryCounts[product.searchTerm] = (categoryCounts[product.searchTerm] || 0) + 1;
        });
        
        Object.entries(categoryCounts).sort().forEach(([category, count]) => {
            console.log(`  ${category}: ${count} products`);
        });
        
    } catch (error) {
        console.error('❌ Two-step scraping failed:', error);
    }
}

// Run the scraper
main().catch(console.error);
