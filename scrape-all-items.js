import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the ApifyClient with API token
const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

// Your complete list of items
const items = [
    "oil",
    "salt", 
    "pepper",
    "garlic",
    "onion",
    "tomato",
    "herbs",
    "spices",
    "rice",
    "ginger garlic paste",
    "bread",
    "pasta",
    "cereal",
    "flour",
    "sugar",
    "milk",
    "cheese",
    "eggs",
    "chicken",
    "beef",
    "pork",
    "lamb",
    "yogurt",
    "butter",
    "chocolate",
    "biscuits",
    "crisps",
    "nuts",
    "apple",
    "banana",
    "orange",
    "grapes",
    "strawberries",
    "blueberries",
    "raspberries",
    "blackberries",
    "cranberries",
    "gooseberries",
    "toilet paper",
    "cleaning",
    "laundry",
    "soap",
    "shampoo",
    "toothpaste",
    "room spray",
    "shower gel",
    "sanitary pads",
    "tampons",
    "deodorant",
    "conditioner",
    "medicines"
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

(async () => {
    try {
        console.log('🛒 Starting Full Tesco Scraping with All Items');
        console.log(`📦 Scraping ${items.length} items`);
        console.log(`🔍 Each search will return up to 10 products`);
        console.log(`💰 Estimated total products: ${items.length * 10}`);
        
        // Run the Actor and wait for it to finish
        console.log('\n🚀 Starting actor...');
        const run = await client.actor("1qp9Bpg05Nyi51ieE").call(input);
        
        console.log('⏳ Waiting for completion... (This may take several minutes)');
        const runInfo = await client.run(run.id).waitForFinish();
        
        if (runInfo.status === 'SUCCEEDED') {
            console.log('✅ Actor completed successfully');
            
            // Fetch and print Actor results from the run's dataset
            console.log('📦 Fetching results...');
            const { items: results } = await client.dataset(runInfo.defaultDatasetId).listItems();
            
            console.log(`\n🎉 SUCCESS! Found ${results.length} total products`);
            
            // Group results by search term
            const groupedResults = {};
            results.forEach(item => {
                const searchTerm = item.searchQuery || item.query || 'Unknown';
                if (!groupedResults[searchTerm]) {
                    groupedResults[searchTerm] = [];
                }
                groupedResults[searchTerm].push(item);
            });
            
            // Display summary
            console.log('\n📊 Summary by Search Term:');
            Object.entries(groupedResults).forEach(([searchTerm, products]) => {
                console.log(`  ${searchTerm}: ${products.length} products`);
            });
            
            // Save results to file
            const fs = await import('fs');
            const filename = `tesco-products-${new Date().toISOString().split('T')[0]}.json`;
            fs.writeFileSync(filename, JSON.stringify(results, null, 2));
            console.log(`\n💾 Results saved to: ${filename}`);
            
            console.log('\n✅ Full scraping completed successfully!');
            
        } else {
            console.log(`❌ Actor failed with status: ${runInfo.status}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
})();

