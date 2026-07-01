import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';

dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

// Your complete list of items
const items = [
    "oil", "salt", "pepper", "garlic", "onion", "tomato", "herbs", "spices", "rice", "ginger garlic paste",
    "bread", "pasta", "cereal", "flour", "sugar", "milk", "cheese", "eggs", "chicken", "beef", "pork", "lamb", "yogurt", "butter",
    "chocolate", "biscuits", "crisps", "nuts", "apple", "banana", "orange", "grapes", "strawberries",
    "blueberries", "raspberries", "blackberries", "cranberries", "gooseberries",
    "toilet paper", "cleaning", "laundry", "soap", "shampoo", "toothpaste", "room spray", "shower gel",
    "sanitary pads", "tampons", "deodorant", "conditioner", "medicines"
];

// Convert items to Tesco search URLs
const searchUrls = items.map(item => 
    `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(item)}&inputType=free+text`
);

// Prepare Actor input
const input = {
    "query": searchUrls,
    "limit": 10  // Get first 10 products under each search
};

// Function to extract data correctly
function extractProductData(item) {
    return {
        id: item.id || item.tpnc,
        name: item.title,
        description: Array.isArray(item.description) ? item.description.join(' ') : item.description,
        price: item.price?.actual || 0,
        unitPrice: item.price?.unitPrice || 0,
        unitOfMeasure: item.price?.unitOfMeasure || '',
        originalPrice: item.price?.original || item.price?.actual,
        currency: 'GBP',
        brand: item.brandName,
        sku: item.gtin || item.tpnb,
        category: item.categoryLvl0,
        subcategory: item.categoryLvl1,
        subcategory2: item.categoryLvl2,
        subcategory3: item.categoryLvl3,
        image: item.defaultImageUrl,
        images: [item.defaultImageUrl],
        availability: item.status === 'AvailableForSale' ? 'in_stock' : 'out_of_stock',
        rating: item.reviews?.stats?.overallRating || 0,
        reviewCount: item.reviews?.stats?.noOfReviews || 0,
        weight: item.averageWeight || 0,
        isNew: item.isNew,
        isForSale: item.isForSale,
        promotions: item.promotions || [],
        restrictions: item.restrictions || [],
        url: `https://www.tesco.com/groceries/en-GB/products/${item.tpnc}`,
        scrapedAt: new Date().toISOString(),
        rawData: item // Keep original data for reference
    };
}

(async () => {
    try {
        console.log('🛒 Tesco Scraper - Complete Product Data with Images');
        console.log(`📦 Scraping ${items.length} items`);
        console.log(`🔍 Each search will return up to 10 products`);
        
        // Run the Actor and wait for it to finish
        console.log('\n🚀 Starting actor...');
        const run = await client.actor("1qp9Bpg05Nyi51ieE").call(input);
        
        console.log('⏳ Waiting for completion... (This may take several minutes)');
        const runInfo = await client.run(run.id).waitForFinish();
        
        if (runInfo.status === 'SUCCEEDED') {
            console.log('✅ Actor completed successfully');
            
            const { items: results } = await client.dataset(runInfo.defaultDatasetId).listItems();
            console.log(`\n🎉 Found ${results.length} total products`);
            
            // Extract and normalize data
            const normalizedProducts = results.map(extractProductData);
            
            // Group by search term (approximate)
            const groupedResults = {};
            normalizedProducts.forEach(product => {
                // Try to extract search term from raw data or use a default
                const searchTerm = 'Unknown';
                if (!groupedResults[searchTerm]) {
                    groupedResults[searchTerm] = [];
                }
                groupedResults[searchTerm].push(product);
            });
            
            // Display sample results
            console.log('\n📊 Sample Products:');
            normalizedProducts.slice(0, 5).forEach((product, index) => {
                console.log(`\n${index + 1}. ${product.name}`);
                console.log(`   Price: £${product.price} (${product.unitPrice} per ${product.unitOfMeasure})`);
                console.log(`   Brand: ${product.brand}`);
                console.log(`   Category: ${product.category} > ${product.subcategory}`);
                console.log(`   Rating: ${product.rating}/5 (${product.reviewCount} reviews)`);
                console.log(`   Image: ${product.image}`);
                console.log(`   Availability: ${product.availability}`);
                console.log(`   URL: ${product.url}`);
            });
            
            // Save results
            const fs = await import('fs');
            const filename = `tesco-complete-products-${new Date().toISOString().split('T')[0]}.json`;
            fs.writeFileSync(filename, JSON.stringify(normalizedProducts, null, 2));
            console.log(`\n💾 Complete results saved to: ${filename}`);
            
            // Summary
            console.log('\n📈 Summary:');
            console.log(`   Total Products: ${normalizedProducts.length}`);
            console.log(`   With Images: ${normalizedProducts.filter(p => p.image).length}`);
            console.log(`   In Stock: ${normalizedProducts.filter(p => p.availability === 'in_stock').length}`);
            console.log(`   With Reviews: ${normalizedProducts.filter(p => p.reviewCount > 0).length}`);
            
            console.log('\n✅ Complete scraping with images and all data successful!');
            
        } else {
            console.log(`❌ Actor failed with status: ${runInfo.status}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
})();

