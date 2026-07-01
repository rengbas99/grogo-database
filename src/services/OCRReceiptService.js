/**
 * OCR Receipt Scanning Service
 * Processes receipt images and extracts product information
 */

const firebaseService = require('./FirebaseService');
const logger = require('../utils/logger');

class OCRReceiptService {
  constructor() {
    this.firebaseService = firebaseService;
  }

  async init() {
    try {
      await this.firebaseService.initialize();
      logger.info('OCR Receipt Service initialized');
    } catch (error) {
      logger.error('Failed to initialize OCR Receipt Service:', error);
      throw error;
    }
  }

  /**
   * Process receipt text (from OCR) and extract products
   */
  async processReceiptText(receiptText, storeId, userId) {
    try {
      logger.info('Processing receipt text', { storeId, userId });
      
      // Extract product lines from receipt
      const productLines = this.extractProductLines(receiptText);
      logger.info(`Found ${productLines.length} product lines`);
      
      const matchedProducts = [];
      
      for (const line of productLines) {
        try {
          // Try to match with database products
          const matchedProduct = await this.matchProductToDatabase(line, storeId);
          
          if (matchedProduct) {
            matchedProducts.push({
              ...matchedProduct,
              originalLine: line,
              confidence: matchedProduct.confidence || 0.8
            });
          }
        } catch (error) {
          logger.warn(`Failed to match product line: ${line}`, error.message);
        }
      }
      
      logger.info(`Matched ${matchedProducts.length} products from receipt`);
      return matchedProducts;
      
    } catch (error) {
      logger.error('Failed to process receipt text:', error);
      throw error;
    }
  }

  /**
   * Extract product lines from receipt text
   */
  extractProductLines(receiptText) {
    const lines = receiptText.split('\n');
    const productLines = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines, headers, totals, etc.
      if (this.isProductLine(trimmedLine)) {
        productLines.push(trimmedLine);
      }
    }
    
    return productLines;
  }

  /**
   * Check if a line looks like a product line
   */
  isProductLine(line) {
    // Skip common non-product lines
    const skipPatterns = [
      /^total/i,
      /^subtotal/i,
      /^tax/i,
      /^vat/i,
      /^change/i,
      /^card/i,
      /^cash/i,
      /^receipt/i,
      /^thank you/i,
      /^store/i,
      /^address/i,
      /^phone/i,
      /^date/i,
      /^time/i,
      /^\d{2}\/\d{2}\/\d{4}/, // Date format
      /^\d{2}:\d{2}/, // Time format
      /^£?\d+\.\d{2}$/, // Just a price
      /^[A-Z\s]+$/, // All caps (likely headers)
      /^\s*$/, // Empty lines
      /^[-=]+$/, // Separators
      /^qty/i,
      /^item/i,
      /^description/i
    ];
    
    for (const pattern of skipPatterns) {
      if (pattern.test(line)) {
        return false;
      }
    }
    
    // Must contain some text and possibly a price
    return line.length > 3 && (
      line.includes('£') || 
      line.match(/\d+\.\d{2}/) || 
      line.match(/[a-zA-Z]/)
    );
  }

  /**
   * Match a product line to database products
   */
  async matchProductToDatabase(productLine, storeId) {
    try {
      // Extract product name and price from line
      const { name, price } = this.parseProductLine(productLine);
      
      if (!name) {
        return null;
      }
      
      // Search for similar products in database
      const searchResults = await this.firebaseService.searchProducts(name, 10);
      
      if (searchResults.length === 0) {
        // Try with partial name
        const partialName = name.split(' ')[0];
        const partialResults = await this.firebaseService.searchProducts(partialName, 5);
        
        if (partialResults.length === 0) {
          return null;
        }
        
        return this.selectBestMatch(partialResults, name, price, storeId);
      }
      
      return this.selectBestMatch(searchResults, name, price, storeId);
      
    } catch (error) {
      logger.error('Failed to match product to database:', error);
      return null;
    }
  }

  /**
   * Parse product line to extract name and price
   */
  parseProductLine(line) {
    // Common patterns for receipt lines
    const patterns = [
      // "Product Name £1.23"
      /^(.+?)\s+£?(\d+\.\d{2})$/,
      // "Product Name 1.23"
      /^(.+?)\s+(\d+\.\d{2})$/,
      // "Product Name x2 £2.46"
      /^(.+?)\s+x?\d+\s+£?(\d+\.\d{2})$/,
      // "Product Name 2x £2.46"
      /^(.+?)\s+\d+x\s+£?(\d+\.\d{2})$/
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          name: match[1].trim(),
          price: parseFloat(match[2])
        };
      }
    }
    
    // Fallback: try to extract price from end
    const priceMatch = line.match(/£?(\d+\.\d{2})$/);
    if (priceMatch) {
      return {
        name: line.replace(/£?\d+\.\d{2}$/, '').trim(),
        price: parseFloat(priceMatch[1])
      };
    }
    
    return { name: line, price: null };
  }

  /**
   * Select the best matching product
   */
  selectBestMatch(searchResults, originalName, originalPrice, storeId) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const product of searchResults) {
      const score = this.calculateMatchScore(product, originalName, originalPrice, storeId);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
    }
    
    if (bestMatch && bestScore > 0.3) { // Minimum confidence threshold
      return {
        ...bestMatch,
        confidence: bestScore,
        originalName,
        originalPrice
      };
    }
    
    return null;
  }

  /**
   * Calculate match score between product and receipt line
   */
  calculateMatchScore(product, originalName, originalPrice, storeId) {
    let score = 0;
    
    // Name similarity (most important)
    const nameSimilarity = this.calculateStringSimilarity(
      product.name.toLowerCase(),
      originalName.toLowerCase()
    );
    score += nameSimilarity * 0.6;
    
    // Price similarity (if available)
    if (originalPrice && product.price) {
      const priceDiff = Math.abs(product.price - originalPrice);
      const priceSimilarity = Math.max(0, 1 - (priceDiff / originalPrice));
      score += priceSimilarity * 0.3;
    }
    
    // Store match bonus
    if (product.storeId === storeId) {
      score += 0.1;
    }
    
    return score;
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
   */
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Add matched products to user's pantry
   */
  async addProductsToPantry(matchedProducts, userId) {
    try {
      const addedProducts = [];
      
      for (const product of matchedProducts) {
        try {
          // Add to pantry with expiry date
          const expiryDate = this.calculateExpiryDate(product.category);
          
          const pantryItem = {
            userId,
            productId: product.id,
            productName: product.name,
            brand: product.brand,
            category: product.category,
            quantity: 1,
            expiryDate: expiryDate,
            addedDate: new Date(),
            source: 'receipt_scan',
            confidence: product.confidence
          };
          
          // Save to pantry (you'll need to implement this in FirebaseService)
          const pantryId = await this.firebaseService.savePantryItem(pantryItem);
          
          addedProducts.push({
            ...pantryItem,
            id: pantryId
          });
          
        } catch (error) {
          logger.warn(`Failed to add product to pantry: ${product.name}`, error.message);
        }
      }
      
      logger.info(`Added ${addedProducts.length} products to pantry`);
      return addedProducts;
      
    } catch (error) {
      logger.error('Failed to add products to pantry:', error);
      throw error;
    }
  }

  /**
   * Calculate expiry date based on product category
   */
  calculateExpiryDate(category) {
    const now = new Date();
    const expiryDate = new Date(now);
    
    switch (category) {
      case 'fresh-produce':
        expiryDate.setDate(now.getDate() + 7); // 7 days
        break;
      case 'dairy':
        expiryDate.setDate(now.getDate() + 5); // 5 days
        break;
      case 'bakery':
        expiryDate.setDate(now.getDate() + 3); // 3 days
        break;
      case 'meat':
        expiryDate.setDate(now.getDate() + 2); // 2 days
        break;
      default:
        expiryDate.setDate(now.getDate() + 14); // 14 days default
    }
    
    return expiryDate;
  }
}

module.exports = OCRReceiptService;

