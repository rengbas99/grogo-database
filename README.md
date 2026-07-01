# Grogo Database

Backend data pipeline and Express API for Grogo — a UK grocery 
price comparison and smart pantry app.

Aggregates, normalises, and serves product data from five UK 
supermarkets: Tesco, Sainsbury's, Aldi, Lidl, and Iceland.

## What it does

- Scrapes product data via official APIs first, 
  falls back to Puppeteer/Playwright/Cheerio
- Normalises wildly different supermarket schemas 
  into one standard product format
- Extracts EU 14 allergens from ingredient text
- Syncs to Firebase Firestore with incremental enrichment
- Serves data via Express API with search, filtering, 
  and pagination
- Two-basket segregation: splits shopping lists by 
  nearest store availability
- Smart pantry: GPS store detection, QR scanning, 
  expiration tracking

## Architecture

Supermarket APIs / Web Scrapers
│
▼
Orchestrator (rate limited, concurrent, resumable)
│
▼
Storage Manager (local JSON → Firebase Firestore)
│
OpenFoodFacts / Nutritionix (fallback enrichment)
│
▼
Express API Server
│
▼
Client Applications (Grogo mobile app)

## Stack

Node.js · Express · Firebase Firestore · Puppeteer · 
Playwright · Cheerio · OpenFoodFacts API · Nutritionix API · 
Apify · JavaScript

## Setup

```bash
git clone https://github.com/rengbas99/grogo-database.git
cd grogo-database
npm install
cp env.example .env
# Fill in your credentials in .env
node src/index.js
```

## Environment variables

See `env.example` for all required variables.

| Variable | Description |
|---|---|
| APIFY_TOKEN | Apify API token for web scraping actors |
| FIREBASE_PROJECT_ID | Firebase project ID |
| FIREBASE_CLIENT_EMAIL | Firebase service account email |
| FIREBASE_PRIVATE_KEY | Firebase service account private key |
| NUTRITIONIX_APP_ID | Nutritionix API app ID |
| NUTRITIONIX_APP_KEY | Nutritionix API app key |

## CLI commands

```bash
# Run all scrapers
node src/index.js scrape

# Sync local data to Firebase
node src/index.js sync

# Search products locally
node src/index.js search "oat milk"

# Export to CSV
node src/index.js export

# Start API server
node src/server.js
```

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /products | Search and filter products |
| GET | /stores/nearby | Get nearby supermarkets by GPS |
| POST | /basket/split | Two-basket segregation |
| POST | /scan | QR code product lookup |

## Scraping guidelines

- Requests use 2–5 second random delays
- Official APIs always queried before scraping
- Progress saved every 50 products (safe to resume)
- Incremental enrichment only — never overwrites 
  existing non-empty fields
