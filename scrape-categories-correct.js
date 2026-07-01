import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';

dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

// Map your items to Tesco categories
const categoryMapping = {
    'fresh-food': [
        'apple', 'banana', 'orange', 'grapes', 'strawberries', 'blueberries', 
        'raspberries', 'blackberries', 'cranberries', 'gooseberries',
        'garlic', 'onion', 'tomato', 'chicken', 'beef', 'pork', 'lamb',
        'milk', 'cheese', 'eggs', 'yogurt', 'butter'
    ],
    'bakery': [
        'bread', 'cereal', 'flour', 'biscuits'
    ],
    'treats-and-snacks': [
        'chocolate', 'crisps', 'nuts'
    ],
    'food-cupboard': [
        'oil', 'salt', 'pepper', 'herbs', 'spices', 'rice', 'ginger garlic paste',
        'pasta', 'sugar'
    ],
    'health-and-beauty': [
        'soap', 'shampoo', 'toothpaste', 'room spray', 'shower gel',
        'deodorant', 'conditioner', 'medicines'
    ],
    'household': [
        'toilet paper', 'cleaning', 'laundry'
    ],
    'baby': [
        'sanitary pads', 'tampons'
    ]
};

// Function to extract data correctly from category scraping
function extractProductData(item) {
    return {
        id: item.product_id,
        sku: item.sku,
        gtin: item.gtin,
        name: item.name,
        description: item.description,
        price: item.price,
        unitPrice: item.unit_price,
        unitQuantity: item.unit_quantity,
        currency: item.currency,
        brand: item.brand_name,
        category: item.main_category,
        subcategory: item.sub_category,
        productCategory: item.product_category,
        productType: item.product_type,
        image: item.image_url,
        images: [item.image_url],
        availability: item.in_stock ? 'in_stock' : 'out_of_stock',
        isNew: item.is_new,
        buyLimit: item.buy_limit,
        url: item.url,
        
        // Detailed information
        ingredients: item.ingredients,
        allergens: item.allergens,
        storageInstructions: item.storage_instructions,
        marketingText: item.marketing_text,
        
        // Nutrition information
        nutrition: item.nutrition,
        nutritionPerServing: item.nutrition_per_serving,
        
        // Manufacturer information
        manufacturer: item.manufacturer,
        
        // Promotions
        promotion: item.promotion,
        isLowPrice: item.isLowEverydayPricing,
        
        scrapedAt: new Date().toISOString(),
        rawData: item
    };
}

async function scrapeCategory(category, targetItems) {
    console.log(`\n🏪 Scraping category: ${category}`);
    console.log(`🎯 Looking for: ${targetItems.join(', ')}`);
    
    const input = {
        "category": category,
        "region": "UK",
        "include_product_details": true,
        "max_items": 100,  // Get up to 100 products per category
        "max_pages": 3,    // Scrape 3 pages per category
        "page_offset": 1,
        "stream_output": true
    };

    try {
        console.log(`🚀 Starting ${category} scraping...`);
        const run = await client.actor("pVHUOwMvyGUgT9Qff").call(input);
        
        console.log(`⏳ Waiting for ${category} completion...`);
        const runInfo = await client.run(run.id).waitForFinish();
        
        if (runInfo.status === 'SUCCEEDED') {
            const { items } = await client.dataset(runInfo.defaultDatasetId).listItems();
            console.log(`✅ ${category}: Found ${items.length} products`);
            
            // Filter results to match our target items
            const relevantProducts = items.filter(product => {
                const productName = (product.name || '').toLowerCase();
                return targetItems.some(item => productName.includes(item.toLowerCase()));
            });
            
            console.log(`🎯 ${category}: ${relevantProducts.length} relevant products found`);
            
            // Extract and normalize data
            const extractedProducts = relevantProducts.map(extractProductData);
            
            // Display sample results
            if (extractedProducts.length > 0) {
                console.log(`\n📦 Sample from ${category}:`);
                extractedProducts.slice(0, 2).forEach((product, index) => {
                    console.log(`  ${index + 1}. ${product.name}`);
                    console.log(`     Price: £${product.price} (${product.unitPrice} per ${product.unitQuantity}g)`);
                    console.log(`     Brand: ${product.brand}`);
                    console.log(`     Image: ${product.image}`);
                    console.log(`     Category: ${product.category} > ${product.subcategory}`);
                });
            }
            
            return extractedProducts;
            
        } else {
            console.log(`❌ ${category}: Failed with status ${runInfo.status}`);
            return [];
        }
        
    } catch (error) {
        console.log(`❌ ${category}: Error - ${error.message}`);
        return [];
    }
}

(async () => {
    try {
        console.log('🛒 Tesco Category Scraping - Complete Product Data');
        console.log(`📊 Will scrape ${Object.keys(categoryMapping).length} categories`);
        
        const allProducts = [];
        
        // Scrape each category
        for (const [category, targetItems] of Object.entries(categoryMapping)) {
            const products = await scrapeCategory(category, targetItems);
            allProducts.push(...products);
            
            // Small delay between categories
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        console.log(`\n🎉 Scraping completed!`);
        console.log(`📦 Total products found: ${allProducts.length}`);
        
        // Group by category
        const byCategory = {};
        allProducts.forEach(product => {
            if (!byCategory[product.category]) {
                byCategory[product.category] = [];
            }
            byCategory[product.category].push(product);
        });
        
        console.log('\n📊 Results by category:');
        Object.entries(byCategory).forEach(([category, products]) => {
            console.log(`  ${category}: ${products.length} products`);
        });
        
        // Save results
        const fs = await import('fs');
        const filename = `tesco-complete-products-${new Date().toISOString().split('T')[0]}.json`;
        fs.writeFileSync(filename, JSON.stringify(allProducts, null, 2));
        console.log(`\n💾 Complete results saved to: ${filename}`);
        
        // Summary statistics
        console.log('\n📈 Summary:');
        console.log(`   Total Products: ${allProducts.length}`);
        console.log(`   With Images: ${allProducts.filter(p => p.image).length}`);
        console.log(`   In Stock: ${allProducts.filter(p => p.availability === 'in_stock').length}`);
        console.log(`   With Nutrition: ${allProducts.filter(p => p.nutrition).length}`);
        console.log(`   With Ingredients: ${allProducts.filter(p => p.ingredients).length}`);
        
        console.log('\n✅ Complete scraping with images, nutrition, and all details successful!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
})();

