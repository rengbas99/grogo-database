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
    'frozen-food': [
        'frozen fruits', 'frozen vegetables'
    ],
    'drinks': [
        'juice', 'water', 'soft drinks'
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

// Available Tesco categories
const availableCategories = [
    'fresh-food',
    'bakery', 
    'treats-and-snacks',
    'food-cupboard',
    'frozen-food',
    'drinks',
    'baby',
    'health-and-beauty',
    'pets',
    'household',
    'home-and-living',
    'tesco-finest',
    'summer'
];

async function scrapeCategory(category, items) {
    console.log(`\n🏪 Scraping category: ${category}`);
    console.log(`📦 Items: ${items.join(', ')}`);
    
    const input = {
        "category": category,
        "region": "UK",
        "include_product_details": true,
        "max_items": 50,  // Get up to 50 products per category
        "max_pages": 3,   // Scrape 3 pages per category
        "page_offset": 1,
        "stream_output": true
    };

    try {
        console.log(`🚀 Starting ${category} scraping...`);
        const run = await client.actor("pVHUOwMvyGUgT9Qff").call(input);
        
        console.log(`⏳ Waiting for ${category} completion...`);
        const runInfo = await client.run(run.id).waitForFinish();
        
        if (runInfo.status === 'SUCCEEDED') {
            const { items: results } = await client.dataset(runInfo.defaultDatasetId).listItems();
            console.log(`✅ ${category}: Found ${results.length} products`);
            
            // Filter results to match our target items
            const relevantProducts = results.filter(product => {
                const productName = (product.title || '').toLowerCase();
                return items.some(item => productName.includes(item.toLowerCase()));
            });
            
            console.log(`🎯 ${category}: ${relevantProducts.length} relevant products found`);
            
            return relevantProducts.map(product => ({
                id: product.id || product.tpnc,
                name: product.title,
                price: product.price?.actual || 0,
                unitPrice: product.price?.unitPrice || 0,
                unitOfMeasure: product.price?.unitPrice ? `per ${product.price.unitOfMeasure}` : '',
                brand: product.brandName,
                category: category,
                subcategory: product.categoryLvl1,
                image: product.defaultImageUrl,
                availability: product.status === 'AvailableForSale' ? 'in_stock' : 'out_of_stock',
                rating: product.reviews?.stats?.overallRating || 0,
                reviewCount: product.reviews?.stats?.noOfReviews || 0,
                url: `https://www.tesco.com/groceries/en-GB/products/${product.tpnc}`,
                scrapedAt: new Date().toISOString()
            }));
            
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
        console.log('🛒 Tesco Category-Based Scraping Strategy');
        console.log(`📊 Will scrape ${Object.keys(categoryMapping).length} categories`);
        
        const allProducts = [];
        
        // Scrape each category
        for (const [category, items] of Object.entries(categoryMapping)) {
            const products = await scrapeCategory(category, items);
            allProducts.push(...products);
            
            // Small delay between categories
            await new Promise(resolve => setTimeout(resolve, 3000));
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
        const filename = `tesco-category-scraping-${new Date().toISOString().split('T')[0]}.json`;
        fs.writeFileSync(filename, JSON.stringify(allProducts, null, 2));
        console.log(`\n💾 Results saved to: ${filename}`);
        
        // Display sample results
        console.log('\n📦 Sample Products:');
        allProducts.slice(0, 5).forEach((product, index) => {
            console.log(`\n${index + 1}. ${product.name}`);
            console.log(`   Price: £${product.price} ${product.unitOfMeasure}`);
            console.log(`   Brand: ${product.brand}`);
            console.log(`   Category: ${product.category} > ${product.subcategory}`);
            console.log(`   Image: ${product.image}`);
            console.log(`   Rating: ${product.rating}/5 (${product.reviewCount} reviews)`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
})();

