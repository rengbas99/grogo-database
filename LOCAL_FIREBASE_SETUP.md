# 🏠 Local Storage + Firebase Backup Setup

This guide shows you how to set up local JSON storage with Firebase backup for your UK supermarket scraper.

## 🎯 What You Get

- **Local JSON Storage**: All data saved locally in `./data/` directory
- **Firebase Backup**: Optional real-time backup to Firebase
- **Multiple Apps**: Connect multiple applications to the same Firebase project
- **Data Sync**: Two-way sync between local and Firebase
- **Search & Export**: Local search and CSV export capabilities

## 📁 Local Storage Structure

```
./data/
├── products.json              # Main products database
├── products/                  # Individual store-category files
│   ├── tesco_cooking_essentials_2024-01-01_12-00-00.json
│   ├── asda_dairy_protein_2024-01-01_12-05-00.json
│   └── ...
├── sessions/                  # Scraping session metadata
│   ├── session-id-1.json
│   └── ...
└── backups/                   # Timestamped backups
    ├── products_backup_2024-01-01_12-00-00.json
    └── ...
```

## 🚀 Quick Start

### 1. **Local-Only Setup** (No Firebase)
```bash
# Setup project
./quick-start.sh

# Add your Apify token to .env
# APIFY_TOKEN=your_token_here

# Start scraping (saves locally only)
node src/index.js scrape-all
```

### 2. **Local + Firebase Setup** (Recommended)

#### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project"
3. Enter project name: `grogo-database` (or your choice)
4. Enable Google Analytics (optional)
5. Click "Create project"

#### Step 2: Enable Firestore Database
1. In your Firebase project, click "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location (choose closest to you)
5. Click "Enable"

#### Step 3: Get Firebase Configuration
1. Click the gear icon → "Project settings"
2. Scroll down to "Your apps" section
3. Click "Web app" icon (`</>`)
4. Enter app name: `grogo-database`
5. Click "Register app"
6. Copy the config object

#### Step 4: Update Your .env File
```bash
# Required
APIFY_TOKEN=your_apify_token_here

# Firebase (paste your config here)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef
```

#### Step 5: Test the Setup
```bash
# Test local storage
node src/index.js setup

# Test Firebase connection
node src/index.js backup

# Start scraping (saves locally + Firebase backup)
node src/index.js scrape-all
```

## 🔥 Firebase Configuration for Multiple Apps

You can connect multiple applications to the same Firebase project:

### Option 1: Same Firebase Project, Different Collections
```javascript
// App 1: Grogo Database
const products = collection(db, 'grogo_products');

// App 2: Price Tracker
const products = collection(db, 'price_tracker_products');

// App 3: Inventory Manager
const products = collection(db, 'inventory_products');
```

### Option 2: Same Firebase Project, Different Documents
```javascript
// App 1: Grogo Database
const products = collection(db, 'products');
const app1Doc = doc(products, 'grogo_database');

// App 2: Price Tracker
const app2Doc = doc(products, 'price_tracker');
```

### Option 3: Use App-Specific Fields
```javascript
// All apps use same collection but different appId
const product = {
  id: 'product-123',
  name: 'Milk',
  price: 2.50,
  appId: 'grogo-database',  // or 'price-tracker', etc.
  // ... other fields
};
```

## 📊 Available Commands

### Local Storage Commands
```bash
# View statistics
node src/index.js stats

# Search products
node src/index.js search "milk"

# Export to CSV
node src/index.js export

# List categories
node src/index.js list-categories

# List stores
node src/index.js list-stores
```

### Firebase Commands
```bash
# Backup local data to Firebase
node src/index.js backup

# Sync with Firebase (two-way)
node src/index.js sync

# Compare local vs Firebase data
node src/index.js compare
```

### Scraping Commands
```bash
# Scrape all stores
node src/index.js scrape-all

# Scrape specific stores
node src/index.js scrape-stores tesco,asda

# Scrape specific category
node src/index.js scrape-category COOKING_ESSENTIALS
```

## 🔄 Data Flow

### Scraping Process
1. **Scrape** → Raw product data from Apify
2. **Normalize** → Standardize data format
3. **Save Local** → Store in `./data/products.json`
4. **Backup Firebase** → Upload to Firebase (if configured)
5. **Create Backup** → Timestamped backup file

### Sync Process
1. **Compare** → Local vs Firebase data
2. **Upload** → New local products to Firebase
3. **Download** → New Firebase products to local
4. **Merge** → Combine and deduplicate data

## 📈 Data Structure

### Local JSON Format
```json
{
  "id": "unique-product-id",
  "store": "tesco",
  "category": "cooking_essentials",
  "name": "Product Name",
  "price": 2.50,
  "originalPrice": 3.00,
  "currency": "GBP",
  "image": "https://...",
  "brand": "Brand Name",
  "sku": "123456789",
  "availability": "in_stock",
  "rating": 4.5,
  "reviewCount": 25,
  "offers": [...],
  "nutrition": {...},
  "scrapedAt": "2024-01-01T12:00:00.000Z",
  "addedAt": "2024-01-01T12:00:00.000Z",
  "sessionId": "session-uuid"
}
```

### Firebase Collections
```
products/
├── product-id-1/
│   ├── name: "Product Name"
│   ├── price: 2.50
│   ├── store: "tesco"
│   ├── category: "cooking_essentials"
│   ├── lastBackedUp: "2024-01-01T12:00:00.000Z"
│   └── source: "local_backup"
└── product-id-2/
    └── ...
```

## 🛠️ Advanced Configuration

### Custom Storage Paths
```bash
# In .env file
OUTPUT_DIRECTORY=./my-custom-data
```

### Firebase Security Rules
```javascript
// Firestore rules (for production)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{productId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Backup Schedule
```bash
# Create a cron job for daily backups
# Add to crontab: crontab -e
0 2 * * * cd /path/to/grogo-database && node src/index.js backup
```

## 🔍 Troubleshooting

### Local Storage Issues
```bash
# Check data directory
ls -la ./data/

# Check main products file
cat ./data/products.json | jq '. | length'

# Check storage info
node -e "
import('./src/storage/storage-manager.js').then(async (m) => {
  const sm = new m.StorageManager();
  await sm.initialize();
  const info = await sm.getStorageInfo();
  console.log(JSON.stringify(info, null, 2));
});
"
```

### Firebase Issues
```bash
# Test Firebase connection
node -e "
import('./src/storage/firebase-backup.js').then(async (m) => {
  const fb = new m.FirebaseBackup();
  const success = await fb.initialize();
  console.log('Firebase available:', success);
});
"
```

### Data Sync Issues
```bash
# Compare local vs Firebase
node src/index.js compare

# Force sync
node src/index.js sync
```

## 💡 Best Practices

### 1. **Regular Backups**
- Run `node src/index.js backup` after each scraping session
- Set up automated backups with cron jobs

### 2. **Data Cleanup**
- Keep only last 10 backups: `node src/index.js cleanup`
- Monitor disk usage with `node src/index.js stats`

### 3. **Firebase Usage**
- Use Firebase for real-time access across multiple apps
- Keep local storage as primary source of truth
- Sync regularly to keep data consistent

### 4. **Multiple Apps**
- Use different collection names for different apps
- Add app-specific metadata to products
- Implement proper Firebase security rules

## 🎉 Success!

You now have:
- ✅ **Local JSON storage** for all your product data
- ✅ **Firebase backup** for real-time access and multiple apps
- ✅ **Search and export** capabilities
- ✅ **Data sync** between local and Firebase
- ✅ **Multiple app support** on the same Firebase project

**Happy scraping! 🛒✨**

