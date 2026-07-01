const axios = require('axios');
const cheerio = require('cheerio');
const admin = require('firebase-admin');

class ProductImageService {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    this.delay = 2000; // 2 seconds delay between requests
  }

  async delayRequest(ms = this.delay) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async searchGoogleImages(query, store = '') {
    try {
      console.log(`🔍 Searching Google Images for: ${query} ${store}`);
      
      // Construct search query
      const searchQuery = `${query} ${store} product image`.replace(/\s+/g, '+');
      const url = `https://www.google.com/search?q=${searchQuery}&tbm=isch&tbs=isz:m`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const imageUrls = [];

      // Extract image URLs from Google Images
      $('img').each((index, element) => {
        const src = $(element).attr('src');
        if (src && src.startsWith('http') && !src.includes('google.com') && !src.includes('gstatic.com')) {
          imageUrls.push(src);
        }
      });

      // Also try to extract from data attributes
      $('[data-src]').each((index, element) => {
        const src = $(element).attr('data-src');
        if (src && src.startsWith('http') && !src.includes('google.com') && !src.includes('gstatic.com')) {
          imageUrls.push(src);
        }
      });

      return imageUrls.slice(0, 5); // Return top 5 images
    } catch (error) {
      console.error(`❌ Error searching Google Images for ${query}:`, error.message);
      return [];
    }
  }

  async searchOpenFoodFactsImages(barcode) {
    try {
      if (!barcode) return null;
      
      console.log(`🔍 Searching OpenFoodFacts for barcode: ${barcode}`);
      
      const response = await axios.get(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
        headers: {
          'User-Agent': 'GrogoMVP/1.0 (renganatharaam@gmail.com)'
        },
        timeout: 5000
      });

      if (response.data && response.data.product) {
        const product = response.data.product;
        if (product.image_front_url) {
          return product.image_front_url;
        }
        if (product.image_url) {
          return product.image_url;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error searching OpenFoodFacts for barcode ${barcode}:`, error.message);
      return null;
    }
  }

  async searchTescoImages(productName, brand = '') {
    try {
      console.log(`🔍 Searching Tesco for: ${productName} ${brand}`);
      
      const searchQuery = `${productName} ${brand}`.replace(/\s+/g, '+');
      const url = `https://www.tesco.com/groceries/en-GB/search?query=${searchQuery}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const imageUrls = [];

      // Look for product images in Tesco's structure
      $('img[src*="tesco.com"], img[data-src*="tesco.com"]').each((index, element) => {
        const src = $(element).attr('src') || $(element).attr('data-src');
        if (src && src.includes('tesco.com') && src.includes('product')) {
          imageUrls.push(src);
        }
      });

      return imageUrls.slice(0, 3);
    } catch (error) {
      console.error(`❌ Error searching Tesco for ${productName}:`, error.message);
      return [];
    }
  }

  async searchSainsburysImages(productName, brand = '') {
    try {
      console.log(`🔍 Searching Sainsbury's for: ${productName} ${brand}`);
      
      const searchQuery = `${productName} ${brand}`.replace(/\s+/g, '+');
      const url = `https://www.sainsburys.co.uk/gol-ui/SearchDisplay?searchTerm=${searchQuery}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const imageUrls = [];

      // Look for product images in Sainsbury's structure
      $('img[src*="sainsburys.co.uk"], img[data-src*="sainsburys.co.uk"]').each((index, element) => {
        const src = $(element).attr('src') || $(element).attr('data-src');
        if (src && src.includes('sainsburys.co.uk') && src.includes('product')) {
          imageUrls.push(src);
        }
      });

      return imageUrls.slice(0, 3);
    } catch (error) {
      console.error(`❌ Error searching Sainsbury's for ${productName}:`, error.message);
      return [];
    }
  }

  getGenericImageUrl(category, productName) {
    // Generic image URLs for common product categories
    const genericImages = {
      'vegetables_fruit': [
        'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop'
      ],
      'dairy': [
        'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop'
      ],
      'meat_poultry': [
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=400&fit=crop'
      ],
      'bakery': [
        'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop'
      ],
      'frozen': [
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop'
      ],
      'snacks_beverages': [
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop'
      ],
      'breakfast': [
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop'
      ],
      'spices_world_foods': [
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop'
      ],
      'essentials': [
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop'
      ]
    };

    const categoryImages = genericImages[category] || genericImages['vegetables_fruit'];
    const randomIndex = Math.floor(Math.random() * categoryImages.length);
    return categoryImages[randomIndex];
  }

  async findBestImage(product) {
    try {
      const { name, brand, store, barcode, category } = product;
      let imageUrl = null;

      // Strategy 1: Try OpenFoodFacts first if barcode exists
      if (barcode) {
        imageUrl = await this.searchOpenFoodFactsImages(barcode);
        if (imageUrl) {
          console.log(`✅ Found OpenFoodFacts image for ${name}`);
          return imageUrl;
        }
      }

      // Strategy 2: Try OpenFoodFacts with product name search (no barcode)
      try {
        const searchQuery = `${name} ${brand || ''}`.trim();
        const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchQuery)}&search_simple=1&action=process&json=1&page_size=5`;
        
        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'GrogoMVP/1.0 (renganatharaam@gmail.com)'
          },
          timeout: 5000
        });

        if (response.data && response.data.products && response.data.products.length > 0) {
          const firstProduct = response.data.products[0];
          if (firstProduct.image_front_url) {
            imageUrl = firstProduct.image_front_url;
            console.log(`✅ Found OpenFoodFacts search image for ${name}`);
            return imageUrl;
          }
        }
      } catch (error) {
        console.log(`   OpenFoodFacts search failed for ${name}`);
      }

      // Strategy 3: Try Google Images with exact product search
      const exactQuery = `${brand || ''} ${name} ${store || ''}`.trim();
      const googleImages = await this.searchGoogleImages(exactQuery);
      if (googleImages.length > 0) {
        imageUrl = googleImages[0];
        console.log(`✅ Found Google Images for ${name}`);
        return imageUrl;
      }

      // Strategy 4: Try Google Images with generic product name
      const genericQuery = `${name} product`;
      const genericGoogleImages = await this.searchGoogleImages(genericQuery);
      if (genericGoogleImages.length > 0) {
        imageUrl = genericGoogleImages[0];
        console.log(`✅ Found generic Google Images for ${name}`);
        return imageUrl;
      }

      // Final fallback: Use generic category image
      imageUrl = this.getGenericImageUrl(category, name);
      console.log(`🖼️  Using generic ${category} image for ${name}`);
      return imageUrl;
      
    } catch (error) {
      console.error(`❌ Error finding image for ${product.name}:`, error.message);
      // Return generic image as final fallback
      return this.getGenericImageUrl(product.category, product.name);
    }
  }

  async updateProductImages(limit = 50) {
    try {
      console.log('🖼️  Starting product image update process...\n');
      
      // Get products from Firebase
      const db = admin.firestore();
      const productsSnapshot = await db.collection('products').limit(limit).get();
      const products = [];
      
      productsSnapshot.forEach(doc => {
        products.push({ id: doc.id, ...doc.data() });
      });

      console.log(`📊 Found ${products.length} products to update\n`);

      let updatedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        
        try {
          console.log(`\n[${i + 1}/${products.length}] Processing: ${product.name}`);
          
          // Skip if already has image
          if (product.image) {
            console.log(`⏭️  Skipping - already has image`);
            continue;
          }

          const imageUrl = await this.findBestImage(product);
          
          if (imageUrl) {
            // Update product in Firebase
            await db.collection('products').doc(product.id).update({
              image: imageUrl,
              lastUpdated: new Date().toISOString()
            });
            
            console.log(`✅ Updated with image: ${imageUrl}`);
            updatedCount++;
          } else {
            console.log(`❌ No image found`);
            errorCount++;
          }

          // Delay between requests to avoid rate limiting
          await this.delayRequest();
          
        } catch (error) {
          console.error(`❌ Error processing ${product.name}:`, error.message);
          errorCount++;
        }
      }

      console.log(`\n🎯 IMAGE UPDATE SUMMARY:`);
      console.log(`✅ Successfully updated: ${updatedCount} products`);
      console.log(`❌ Failed to find images: ${errorCount} products`);
      console.log(`📊 Total processed: ${products.length} products`);

    } catch (error) {
      console.error('❌ Error updating product images:', error);
    }
  }

  async updateAllProductImages() {
    try {
      console.log('🖼️  Starting complete product image update...\n');
      
      // Get all products from Firebase
      const db = admin.firestore();
      const productsSnapshot = await db.collection('products').get();
      const products = [];
      
      productsSnapshot.forEach(doc => {
        products.push({ id: doc.id, ...doc.data() });
      });

      console.log(`📊 Found ${products.length} total products\n`);

      let updatedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        
        try {
          console.log(`\n[${i + 1}/${products.length}] Processing: ${product.name}`);
          
          // Skip if already has image
          if (product.image) {
            console.log(`⏭️  Skipping - already has image`);
            continue;
          }

          const imageUrl = await this.findBestImage(product);
          
          if (imageUrl) {
            // Update product in Firebase
            await db.collection('products').doc(product.id).update({
              image: imageUrl,
              lastUpdated: new Date().toISOString()
            });
            
            console.log(`✅ Updated with image: ${imageUrl}`);
            updatedCount++;
          } else {
            console.log(`❌ No image found`);
            errorCount++;
          }

          // Delay between requests to avoid rate limiting
          await this.delayRequest();
          
        } catch (error) {
          console.error(`❌ Error processing ${product.name}:`, error.message);
          errorCount++;
        }
      }

      console.log(`\n🎯 COMPLETE IMAGE UPDATE SUMMARY:`);
      console.log(`✅ Successfully updated: ${updatedCount} products`);
      console.log(`❌ Failed to find images: ${errorCount} products`);
      console.log(`📊 Total processed: ${products.length} products`);

    } catch (error) {
      console.error('❌ Error updating all product images:', error);
    }
  }
}

module.exports = ProductImageService;
