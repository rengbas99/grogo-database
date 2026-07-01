/**
 * Scraper configurations for UK grocery stores
 */

const SCRAPER_CONFIGS = {
  tesco: {
    name: 'Tesco',
    baseUrl: 'https://www.tesco.com',
    searchUrl: 'https://www.tesco.com/groceries/en-GB/search',
    productUrl: 'https://www.tesco.com/groceries/en-GB/products',
    sitemapUrl: 'https://www.tesco.com/sitemap.xml',
    selectors: {
      productList: '.product-list .product-tile',
      productName: '.product-title a',
      productPrice: '.price-per-sellable-unit .value',
      productImage: '.product-image img',
      productLink: '.product-title a',
      offerText: '.offer-text',
      availability: '.product-availability',
      pagination: '.pagination',
      nextPage: '.pagination .next'
    },
    categories: [
      'dairy-eggs',
      'fresh-food',
      'bakery',
      'meat-fish',
      'frozen-food',
      'food-cupboard',
      'drinks',
      'health-beauty',
      'household',
      'baby-toddler',
      'pet-supplies'
    ],
    rateLimit: {
      requestsPerMinute: 30,
      delayBetweenRequests: 2000
    },
    userAgents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  },

  sainsburys: {
    name: 'Sainsbury\'s',
    baseUrl: 'https://www.sainsburys.co.uk',
    searchUrl: 'https://www.sainsburys.co.uk/shop/gb/groceries',
    productUrl: 'https://www.sainsburys.co.uk/shop/gb/groceries',
    sitemapUrl: 'https://www.sainsburys.co.uk/sitemap.xml',
    selectors: {
      productList: '.product',
      productName: '.productNameAndPromotions a',
      productPrice: '.pricePerUnit',
      productImage: '.productImg img',
      productLink: '.productNameAndPromotions a',
      offerText: '.promotion',
      availability: '.availability',
      pagination: '.pagination',
      nextPage: '.pagination .next'
    },
    categories: [
      'fresh-food',
      'bakery',
      'meat-fish',
      'dairy-eggs',
      'frozen-food',
      'food-cupboard',
      'drinks',
      'health-beauty',
      'household',
      'baby-toddler',
      'pet-supplies'
    ],
    rateLimit: {
      requestsPerMinute: 25,
      delayBetweenRequests: 2400
    },
    userAgents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  },

  aldi: {
    name: 'Aldi',
    baseUrl: 'https://www.aldi.co.uk',
    searchUrl: 'https://www.aldi.co.uk/c/groceries',
    productUrl: 'https://www.aldi.co.uk/c/groceries',
    sitemapUrl: 'https://www.aldi.co.uk/sitemap.xml',
    selectors: {
      productList: '.product-tile',
      productName: '.product-title a',
      productPrice: '.price',
      productImage: '.product-image img',
      productLink: '.product-title a',
      offerText: '.offer-badge',
      availability: '.availability',
      pagination: '.pagination',
      nextPage: '.pagination .next'
    },
    categories: [
      'fresh-food',
      'bakery',
      'meat-fish',
      'dairy-eggs',
      'frozen-food',
      'food-cupboard',
      'drinks',
      'health-beauty',
      'household',
      'baby-toddler',
      'pet-supplies'
    ],
    rateLimit: {
      requestsPerMinute: 20,
      delayBetweenRequests: 3000
    },
    userAgents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  },

  lidl: {
    name: 'Lidl',
    baseUrl: 'https://www.lidl.co.uk',
    searchUrl: 'https://www.lidl.co.uk/c/groceries',
    productUrl: 'https://www.lidl.co.uk/c/groceries',
    sitemapUrl: 'https://www.lidl.co.uk/sitemap.xml',
    selectors: {
      productList: '.product-tile',
      productName: '.product-title a',
      productPrice: '.price',
      productImage: '.product-image img',
      productLink: '.product-title a',
      offerText: '.offer-badge',
      availability: '.availability',
      pagination: '.pagination',
      nextPage: '.pagination .next'
    },
    categories: [
      'fresh-food',
      'bakery',
      'meat-fish',
      'dairy-eggs',
      'frozen-food',
      'food-cupboard',
      'drinks',
      'health-beauty',
      'household',
      'baby-toddler',
      'pet-supplies'
    ],
    rateLimit: {
      requestsPerMinute: 20,
      delayBetweenRequests: 3000
    },
    userAgents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  },

  iceland: {
    name: 'Iceland',
    baseUrl: 'https://www.iceland.co.uk',
    searchUrl: 'https://www.iceland.co.uk/groceries',
    productUrl: 'https://www.iceland.co.uk/groceries',
    sitemapUrl: 'https://www.iceland.co.uk/sitemap.xml',
    selectors: {
      productList: '.product-item',
      productName: '.product-name a',
      productPrice: '.price',
      productImage: '.product-image img',
      productLink: '.product-name a',
      offerText: '.offer-text',
      availability: '.availability',
      pagination: '.pagination',
      nextPage: '.pagination .next'
    },
    categories: [
      'frozen-food',
      'fresh-food',
      'bakery',
      'meat-fish',
      'dairy-eggs',
      'food-cupboard',
      'drinks',
      'health-beauty',
      'household',
      'baby-toddler',
      'pet-supplies'
    ],
    rateLimit: {
      requestsPerMinute: 15,
      delayBetweenRequests: 4000
    },
    userAgents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  }
};

module.exports = {
  SCRAPER_CONFIGS,
  getConfig: (store) => SCRAPER_CONFIGS[store],
  getAllStores: () => Object.keys(SCRAPER_CONFIGS),
  getStoreNames: () => Object.values(SCRAPER_CONFIGS).map(config => config.name)
};

