# Sainsbury's Apify Integration Scraper

This scraper uses the Apify API to scrape Sainsbury's products with generic search terms, avoiding brand-specific searches to find similar products across different stores.

## Features

- **Generic Product Search**: Searches for product types rather than specific brands
- **Apify Integration**: Uses the official Sainsbury's scraper from Apify
- **Comprehensive Categories**: Covers dairy, meat, oils, bakery, and fresh produce
- **Automatic Categorization**: Organizes products by type
- **Data Export**: Saves results to JSON files

## Product Categories Searched

### Dairy & Yogurt
- Greek yogurt
- Natural yogurt  
- Vanilla yogurt
- Plain yogurt
- Greek style yogurt

### Meat & Halal
- Fresh chicken
- Halal chicken
- Halal meat
- Chicken breast
- Chicken thigh

### Cooking Oils
- Cooking oil
- Olive oil
- Vegetable oil
- Sunflower oil
- Rapeseed oil

### Bakery
- Tortillas
- White bread
- Wholemeal bread
- Sliced bread
- Pita bread

### Fresh Produce
- Onions
- Spring onions
- Red onions
- White onions

### Dairy & Milk
- Whole milk
- Semi skimmed milk
- Skimmed milk
- Organic milk

## Usage

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the scraper:**
   ```bash
   npm run test-sainsburys
   ```

3. **Results will be saved to:**
   - `scraped-data/sainsburys-apify-results.json`

The scraper reads your Apify API token from the `APIFY_TOKEN` environment variable configured in your `.env` file.

Actor ID: `zGhd4ucc2ffvbsw2k` (Sainsbury's scraper)

## Output Format

```json
{
  "products": [...],
  "categories": {
    "Dairy & Yogurt": [...],
    "Meat & Halal": [...],
    "Cooking Oils": [...],
    "Bakery": [...],
    "Fresh Produce": [...],
    "Dairy & Milk": [...],
    "Other": [...]
  },
  "summary": {
    "total": 150,
    "byCategory": [
      {"category": "Dairy & Yogurt", "count": 25},
      {"category": "Meat & Halal", "count": 20},
      ...
    ]
  }
}
```

## Key Benefits

1. **Brand Agnostic**: Finds products from all brands (Sainsbury's own, Stamford Street, etc.)
2. **Comprehensive Coverage**: Searches multiple product categories
3. **Structured Data**: Well-organized output with categorization
4. **Scalable**: Easy to add new search terms or categories
5. **Reliable**: Uses Apify's robust scraping infrastructure


