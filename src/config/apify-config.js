import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';

dotenv.config();

// Apify Actor IDs for UK Supermarkets (Free actors)
export const APIFY_ACTORS = {
  TESCO: 'pVHUOwMvyGUgT9Qff', // tesco-scraper
  ASDA: '5wSOtEl8NoAuUlqvt',  // asda-scraper
  SAINSBURYS: 'zGhd4ucc2ffvbsw2k', // sainsbury-s-scraper
  LIDL: 'BXaTa8xfk2EE8z9Ew',  // lidl-product-scraper
  ICELAND: '0rDrI70FhzJ2L1vrC' // asda-product-details-scraper (using asda for iceland)
};

// Product Categories with Search Terms
export const PRODUCT_CATEGORIES = {
  COOKING_ESSENTIALS: {
    name: 'Cooking Essentials',
    searchTerms: ['oil', 'salt', 'pepper', 'garlic', 'onion', 'tomato', 'herbs', 'spices', 'rice', 'pasta sauce', 'cooking oil', 'olive oil', 'vegetable oil']
  },
  STAPLES: {
    name: 'Staples',
    searchTerms: ['bread', 'pasta', 'cereal', 'flour', 'sugar', 'rice', 'quinoa', 'oats', 'crackers', 'biscuits']
  },
  DAIRY_PROTEIN: {
    name: 'Dairy/Protein',
    searchTerms: ['milk', 'cheese', 'eggs', 'chicken', 'beef', 'pork', 'yogurt', 'butter', 'cream', 'yoghurt', 'protein', 'meat']
  },
  SNACKS: {
    name: 'Snacks',
    searchTerms: ['chocolate', 'biscuits', 'crisps', 'nuts', 'snacks', 'candy', 'sweets', 'crackers', 'popcorn', 'trail mix']
  },
  FRUITS: {
    name: 'Fruits',
    searchTerms: ['apples', 'bananas', 'oranges', 'grapes', 'strawberries', 'fruits', 'fresh fruit', 'citrus', 'tropical fruit']
  },
  BERRIES: {
    name: 'Berries',
    searchTerms: ['strawberries', 'blueberries', 'raspberries', 'blackberries', 'cranberries', 'gooseberries', 'berries', 'mixed berries']
  },
  HOUSEHOLD_ESSENTIALS: {
    name: 'Household Essentials',
    searchTerms: ['toilet paper', 'cleaning products', 'laundry', 'soap', 'shampoo', 'toothpaste', 'room spray', 'shower gel', 'detergent', 'kitchen roll']
  },
  SANITARY_PERSONAL_CARE: {
    name: 'Sanitary & Personal Care',
    searchTerms: ['sanitary pads', 'tampons', 'deodorant', 'conditioner', 'medicines', 'personal care', 'hygiene', 'feminine care', 'vitamins']
  }
};

// Scraping Configuration
export const SCRAPING_CONFIG = {
  MAX_PRODUCTS_PER_CATEGORY: parseInt(process.env.MAX_PRODUCTS_PER_CATEGORY) || 10,
  MAX_PRODUCTS_PER_STORE: parseInt(process.env.MAX_PRODUCTS_PER_STORE) || 50,
  SCRAPING_DELAY_MS: parseInt(process.env.SCRAPING_DELAY_MS) || 2000,
  MAX_CONCURRENT_SCRAPERS: parseInt(process.env.MAX_CONCURRENT_SCRAPERS) || 3,
  OUTPUT_FORMAT: process.env.OUTPUT_FORMAT || 'json',
  OUTPUT_DIRECTORY: process.env.OUTPUT_DIRECTORY || './data'
};

// Initialize Apify Client
export const apifyClient = new ApifyClient({
  token: process.env.APIFY_TOKEN
});

// Validate Apify Token
export const validateApifyToken = async () => {
  try {
    if (!process.env.APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN is not set in environment variables');
    }
    
    const user = await apifyClient.user().get();
    console.log(`✅ Apify token validated. Logged in as: ${user.username}`);
    return true;
  } catch (error) {
    console.error('❌ Apify token validation failed:', error.message);
    return false;
  }
};

// Get Actor Configuration
export const getActorConfig = (storeName, category, searchTerm) => {
  const actorId = APIFY_ACTORS[storeName.toUpperCase()];
  if (!actorId) {
    throw new Error(`Unknown store: ${storeName}`);
  }

  return {
    actorId,
    input: {
      searchTerm,
      maxItems: SCRAPING_CONFIG.MAX_PRODUCTS_PER_CATEGORY,
      includeNutrition: true,
      includeImages: true,
      includeOffers: true,
      includeReviews: true
    }
  };
};
