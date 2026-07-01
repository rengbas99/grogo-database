import { ApifyClient } from 'apify-client';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

// Create local storage directories
const dataDir = './data';
const productsDir = path.join(dataDir, 'products');
const categoriesDir = path.join(dataDir, 'categories');
const imagesDir = path.join(dataDir, 'images');

// Ensure directories exist
await fs.ensureDir(dataDir);
await fs.ensureDir(productsDir);
await fs.ensureDir(categoriesDir);
await fs.ensureDir(imagesDir);

// Specific product searches - 5 products each
const productSearches = [
    // Fruits
    { category: 'fresh-food', searchTerm: 'apple', count: 5 },
    { category: 'fresh-food', searchTerm: 'banana', count: 5 },
    { category: 'fresh-food', searchTerm: 'orange', count: 5 },
    { category: 'fresh-food', searchTerm: 'grapes', count: 5 },
    { category: 'fresh-food', searchTerm: 'strawberries', count: 5 },
    { category: 'fresh-food', searchTerm: 'blueberries', count: 5 },
    { category: 'fresh-food', searchTerm: 'raspberries', count: 5 },
    { category: 'fresh-food', searchTerm: 'blackberries', count: 5 },
    { category: 'fresh-food', searchTerm: 'cranberries', count: 5 },
    { category: 'fresh-food', searchTerm: 'gooseberries', count: 5 },
    
    // Vegetables
    { category: 'fresh-food', searchTerm: 'garlic', count: 5 },
    { category: 'fresh-food', searchTerm: 'onion', count: 5 },
    { category: 'fresh-food', searchTerm: 'tomato', count: 5 },
    
    // Meat
    { category: 'fresh-food', searchTerm: 'chicken', count: 5 },
    { category: 'fresh-food', searchTerm: 'beef', count: 5 },
    { category: 'fresh-food', searchTerm: 'pork', count: 5 },
    { category: 'fresh-food', searchTerm: 'lamb', count: 5 },
    
    // Dairy
    { category: 'fresh-food', searchTerm: 'milk', count: 5 },
    { category: 'fresh-food', searchTerm: 'cheese', count: 5 },
    { category: 'fresh-food', searchTerm: 'eggs', count: 5 },
    { category: 'fresh-food', searchTerm: 'yogurt', count: 5 },
    { category: 'fresh-food', searchTerm: 'butter', count: 5 },
    
    // Bakery
    { category: 'bakery', searchTerm: 'bread', count: 5 },
    { category: 'bakery', searchTerm: 'pasta', count: 5 },
    { category: 'bakery', searchTerm: 'cereal', count: 5 },
    { category: 'bakery', searchTerm: 'flour', count: 5 },
    { category: 'bakery', searchTerm: 'biscuits', count: 5 },
    
    // Treats & Snacks
    { category: 'treats-and-snacks', searchTerm: 'chocolate', count: 5 },
    { category: 'treats-and-snacks', searchTerm: 'crisps', count: 5 },
    { category: 'treats-and-snacks', searchTerm: 'nuts', count: 5 },
    
    // Food Cupboard
    { category: 'food-cupboard', searchTerm: 'oil', count: 5 },
    { category: 'food-cupboard', searchTerm: 'salt', count: 5 },
    { category: 'food-cupboard', searchTerm: 'pepper', count: 5 },
    { category: 'food-cupboard', searchTerm: 'herbs', count: 5 },
    { category: 'food-cupboard', searchTerm: 'spices', count: 5 },
    { category: 'food-cupboard', searchTerm: 'rice', count: 5 },
    { category: 'food-cupboard', searchTerm: 'ginger garlic paste', count: 5 },
    { category: 'food-cupboard', searchTerm: 'sugar', count: 5 },
    
    // Health & Beauty
    { category: 'health-and-beauty', searchTerm: 'soap', count: 5 },
    { category: 'health-and-beauty', searchTerm: 'shampoo', count: 5 },
    { category: 'health-and-beauty', searchTerm: 'toothpaste', count: 5 },
    { category: 'health-and-beauty', searchTerm: 'room spray', count: 5 },
    { category: 'health-and-beauty', searchTerm: 'shower gel', count: 5 },
    { category: 'health-and-beauty', searchTerm: 'deodorant', count: 5 },
    { category: 'health-and-beauty', searchTerm: 'conditioner', count: 5 },
    { category: 'health-and-beauty', searchTerm: 'medicines', count: 5 },
    
    // Household
    { category: 'household', searchTerm: 'toilet paper', count: 5 },
    { category: 'household', searchTerm: 'cleaning', count: 5 },
    { category: 'household', searchTerm: 'laundry', count: 5 },
    
    // Baby
    { category: 'baby', searchTerm: 'sanitary pads', count: 5 },
    { category: 'baby', searchTerm: 'tampons', count: 5 }
];

// Function to extract essential data using correct field names
function extractEssentialData(item, searchTerm) {
    return {
        id: item.product_id,
        searchTerm: searchTerm,
        productName: item.name,
        productPhoto: item.image_url,
        productDescription: item.description,
        nutritionalFacts: item.nutrition,
        price: item.price,
        currency: item.currency,
        unitPrice: item.unit_price,
        unitQuantity: item.unit_quantity,
        brand: item.brand_name,
        category: item.main_category,
        subcategory: item.sub_category,
        productCategory: item.product_category,
        productType: item.product_type,
        availability: item.in_stock ? 'in_stock' : 'out_of_stock',
        url: item.url,
        ingredients: item.ingredients,
        allergens: item.allergens,
        storageInstructions: item.storage_instructions,
        marketingText: item.marketing_text,
        manufacturer: item.manufacturer,
        scrapedAt: new Date().toISOString()
    };
}

// Function to save data locally
async function saveDataLocally(products, searchTerm, category) {
    const timestamp = new Date().toISOString().split('T')[0];
    
    // Save individual search results
    const searchFile = path.join(productsDir, `${searchTerm.replace(/\s+/g, '-')}-${timestamp}.json`);
    await fs.writeJson(searchFile, products, { spaces: 2 });
    console.log(`💾 Saved ${products.length} ${searchTerm} products to: ${searchFile}`);
    
    // Save by category
    const categoryFile = path.join(categoriesDir, `${category}-${timestamp}.json`);
    let categoryData = [];
    if (await fs.pathExists(categoryFile)) {
        categoryData = await fs.readJson(categoryFile);
    }
    categoryData.push(...products);
    await fs.writeJson(categoryFile, categoryData, { spaces: 2 });
    
    return searchFile;
}

// Function to save images locally
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
                
                // Note: In a real implementation, you'd download the image
                // For now, we'll just save the URL
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

async function searchSpecificProduct(category, searchTerm, count) {
    console.log(`\n🔍 Searching: ${searchTerm} in ${category} (${count} products)`);
    
    // Create search URL for Tesco
    const searchUrl = `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(searchTerm)}&inputType=free+text`;
    console.log(`🔗 Using URL: ${searchUrl}`);
    
    const input = {
        "query": [searchUrl],
        "limit": count
    };

    try {
        const run = await client.actor("1qp9Bpg05Nyi51ieE").call(input);
        const runInfo = await client.run(run.id).waitForFinish();
        
        if (runInfo.status === 'SUCCEEDED') {
            const { items } = await client.dataset(runInfo.defaultDatasetId).listItems();
            
            console.log(`✅ ${searchTerm}: Found ${items.length} products`);
            
            // Extract essential data using the correct field names for search results
            const extractedProducts = items.map(item => ({
                id: item.product_id || item.id,
                searchTerm: searchTerm,
                productName: item.name || item.title,
                productPhoto: item.defaultImageUrl || item.image || item.image_url,
                productDescription: item.description,
                nutritionalFacts: item.nutrition,
                price: item.price?.actual || item.price || item.currentPrice,
                currency: item.currency || 'GBP',
                unitPrice: item.unitPrice,
                unitQuantity: item.unitQuantity,
                brand: item.brand || item.brand_name,
                category: category,
                subcategory: item.category,
                productCategory: item.productCategory,
                productType: item.productType,
                availability: item.inStock ? 'in_stock' : 'out_of_stock',
                url: item.url || item.productUrl,
                ingredients: item.ingredients,
                allergens: item.allergens,
                storageInstructions: item.storageInstructions,
                marketingText: item.marketingText,
                manufacturer: item.manufacturer,
                scrapedAt: new Date().toISOString()
            }));
            
            // Save data locally
            if (extractedProducts.length > 0) {
                await saveDataLocally(extractedProducts, searchTerm, category);
                await saveImagesLocally(extractedProducts, searchTerm);
                
                // Show sample
                console.log(`📦 Sample ${searchTerm} products:`);
                extractedProducts.slice(0, 2).forEach((product, index) => {
                    console.log(`  ${index + 1}. ${product.productName}`);
                    console.log(`     Price: £${product.price}`);
                    console.log(`     Brand: ${product.brand}`);
                });
            }
            
            return extractedProducts;
            
        } else {
            console.log(`❌ ${searchTerm}: Failed - ${runInfo.status}`);
            return [];
        }
        
    } catch (error) {
        console.log(`❌ ${searchTerm}: Error - ${error.message}`);
        return [];
    }
}

(async () => {
    try {
        console.log('🛒 Tesco Scraper with Local Storage');
        console.log(`📁 Data will be saved to: ${dataDir}`);
        console.log(`📊 Total searches: ${productSearches.length}`);
        console.log(`🎯 5 products per search term`);
        console.log(`💰 Estimated cost: ~$${(productSearches.length * 0.01).toFixed(2)}`);
        
        const allProducts = [];
        const savedFiles = [];
        
        // Process each search
        for (let i = 0; i < productSearches.length; i++) {
            const { category, searchTerm, count } = productSearches[i];
            
            console.log(`\n[${i + 1}/${productSearches.length}] Processing: ${searchTerm}`);
            
            const products = await searchSpecificProduct(category, searchTerm, count);
            allProducts.push(...products);
            
            // Small delay between searches
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Save complete dataset
        const timestamp = new Date().toISOString().split('T')[0];
        const completeFile = path.join(dataDir, `complete-dataset-${timestamp}.json`);
        await fs.writeJson(completeFile, allProducts, { spaces: 2 });
        
        // Save summary
        const summary = {
            totalProducts: allProducts.length,
            totalSearches: productSearches.length,
            scrapedAt: new Date().toISOString(),
            categories: [...new Set(allProducts.map(p => p.category))],
            searchTerms: [...new Set(allProducts.map(p => p.searchTerm))],
            files: {
                completeDataset: completeFile,
                productsDirectory: productsDir,
                categoriesDirectory: categoriesDir,
                imagesDirectory: imagesDir
            }
        };
        
        const summaryFile = path.join(dataDir, `scraping-summary-${timestamp}.json`);
        await fs.writeJson(summaryFile, summary, { spaces: 2 });
        
        console.log(`\n🎉 Scraping completed!`);
        console.log(`📦 Total products found: ${allProducts.length}`);
        console.log(`\n📁 Local Storage Structure:`);
        console.log(`  📄 Complete dataset: ${completeFile}`);
        console.log(`  📄 Summary: ${summaryFile}`);
        console.log(`  📁 Individual products: ${productsDir}`);
        console.log(`  📁 By category: ${categoriesDir}`);
        console.log(`  📁 Image references: ${imagesDir}`);
        
        // Group by search term
        const bySearchTerm = {};
        allProducts.forEach(product => {
            if (!bySearchTerm[product.searchTerm]) {
                bySearchTerm[product.searchTerm] = [];
            }
            bySearchTerm[product.searchTerm].push(product);
        });
        
        console.log('\n📊 Results by search term:');
        Object.entries(bySearchTerm).forEach(([searchTerm, products]) => {
            console.log(`  ${searchTerm}: ${products.length} products`);
        });
        
        console.log('\n✅ All data saved locally to your computer!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
})();
