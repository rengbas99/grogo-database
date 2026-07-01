# 🚀 Quick Start Guide - Grogo Database

## ⚡ Get Started in 5 Minutes

### 1. **Get Your Apify Token** (2 minutes)
1. Go to [Apify.com](https://apify.com) and create an account
2. Navigate to [Account → Integrations](https://apify.com/account/integrations)
3. Copy your API token

### 2. **Setup the Project** (1 minute)
```bash
# Run the quick start script
./quick-start.sh

# Or manually:
npm install
cp env.example .env
# Edit .env and add your APIFY_TOKEN
```

### 3. **Test Everything Works** (1 minute)
```bash
# Validate your setup
node src/index.js setup

# Run a quick test
node src/index.js test
```

### 4. **Start Scraping** (1 minute)
```bash
# Scrape all stores and categories
node src/index.js scrape-all

# Or start with just Tesco and Asda
node src/index.js scrape-stores tesco,asda
```

## 🎯 Common Use Cases

### Scrape Everything
```bash
node src/index.js scrape-all
```
**Result**: ~400 products from all 5 stores across 8 categories

### Scrape Specific Stores
```bash
# Just Tesco and Asda
node src/index.js scrape-stores tesco,asda

# All stores except Iceland
node src/index.js scrape-stores tesco,asda,sainsburys,lidl
```

### Scrape Specific Categories
```bash
# Just cooking essentials from all stores
node src/index.js scrape-category COOKING_ESSENTIALS

# Dairy products from Tesco and Asda only
node src/index.js scrape-category DAIRY_PROTEIN tesco,asda
```

### Check Your Data
```bash
# See what you've scraped
node src/index.js stats

# List available categories
node src/index.js list-categories

# List available stores
node src/index.js list-stores
```

## 📊 What You'll Get

### Data Files (in `./data/` folder)
- `all_products_YYYY-MM-DD_HH-mm-ss.json` - Complete merged dataset
- `scraping_summary_YYYY-MM-DD_HH-mm-ss.json` - Statistics and breakdown
- `products_YYYY-MM-DD_HH-mm-ss.csv` - CSV export for Excel/Google Sheets
- Individual store files for each category

### Product Information
Each product includes:
- ✅ **Basic Info**: Name, description, price, brand, SKU
- ✅ **Images**: Product photos and thumbnails
- ✅ **Offers**: Clubcard discounts, multi-buy deals, promotions
- ✅ **Nutrition**: Calories, protein, carbs, fat, allergens
- ✅ **Reviews**: Ratings and review counts
- ✅ **Availability**: Stock status and store location

## 🔥 Firebase Integration (Optional)

If you want real-time data storage:

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create a new project
   - Enable Firestore Database

2. **Get Firebase Config**
   - Go to Project Settings → General
   - Scroll down to "Your apps" → Web app
   - Copy the config object

3. **Update .env file**
   ```bash
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_API_KEY=your-api-key
   FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=123456789
   FIREBASE_APP_ID=1:123456789:web:abcdef
   ```

4. **Use Firebase Features**
   ```javascript
   import { saveProductsToFirebase, getProductsByStore } from './src/database/firebase-config.js';
   
   // Save to Firebase
   await saveProductsToFirebase(products, sessionId);
   
   // Retrieve from Firebase
   const tescoProducts = await getProductsByStore('tesco');
   ```

## ⚙️ Configuration Options

### Environment Variables (.env file)
```bash
# Required
APIFY_TOKEN=your_apify_token_here

# Optional - Scraping behavior
MAX_PRODUCTS_PER_CATEGORY=10    # Products per category per store
MAX_PRODUCTS_PER_STORE=50       # Total products per store
SCRAPING_DELAY_MS=2000          # Delay between requests (ms)
MAX_CONCURRENT_SCRAPERS=3       # Parallel scrapers

# Optional - Output
OUTPUT_FORMAT=json              # json, csv, or both
OUTPUT_DIRECTORY=./data         # Where to save files

# Optional - Firebase
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_API_KEY=your_api_key
# ... other Firebase config
```

## 🚨 Troubleshooting

### "Invalid Apify token"
- Check your `.env` file has the correct `APIFY_TOKEN`
- Verify the token at [Apify Account](https://apify.com/account/integrations)

### "Actor run failed"
- Check your Apify account has sufficient credits
- Try running with fewer products: `MAX_PRODUCTS_PER_CATEGORY=5`

### "No products found"
- Try different search terms
- Check if the store's website structure changed
- Verify the Apify actor is working

### "Rate limit exceeded"
- Increase `SCRAPING_DELAY_MS` to 5000 or higher
- Run scrapers during off-peak hours

## 💰 Cost Estimation

### Apify Costs (approximate)
- **Tesco**: ~$0.10 per 10 products
- **Asda**: ~$0.08 per 10 products  
- **Sainsbury's**: ~$0.12 per 10 products
- **Lidl**: ~$0.06 per 10 products
- **Iceland**: ~$0.08 per 10 products

**Total for full scrape**: ~$2-4 for 400 products

### Firebase Costs (if used)
- **Free tier**: 1GB storage, 50K reads, 20K writes per day
- **Paid**: $0.18 per 100K reads, $0.18 per 100K writes

## 🎉 Success!

Once everything is working, you'll have:
- ✅ Complete product database from 5 UK supermarkets
- ✅ Normalized data ready for analysis
- ✅ Real-time updates capability (with Firebase)
- ✅ CSV exports for spreadsheet analysis
- ✅ Comprehensive product information including prices, offers, nutrition

**Happy scraping! 🛒✨**

