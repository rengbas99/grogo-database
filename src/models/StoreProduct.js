/**
 * Store Product model for store-specific product data
 */

class StoreProduct {
  constructor(data = {}) {
    this.id = data.id || null;
    this.storeId = data.storeId || '';
    this.productId = data.productId || '';
    this.storeName = data.storeName || '';
    this.storeBrand = data.storeBrand || '';
    this.price = data.price || 0;
    this.originalPrice = data.originalPrice || null;
    this.isOnOffer = data.isOnOffer || false;
    this.offerText = data.offerText || '';
    this.availability = data.availability || 'unknown'; // in_stock, low_stock, out_of_stock, unknown
    this.stockLevel = data.stockLevel || null;
    this.lastChecked = data.lastChecked || new Date();
    this.url = data.url || '';
    this.scrapedAt = data.scrapedAt || new Date();
    this.isActive = data.isActive !== false; // Default to true
  }

  toFirestore() {
    return {
      storeId: this.storeId,
      productId: this.productId,
      storeName: this.storeName,
      storeBrand: this.storeBrand,
      price: this.price,
      originalPrice: this.originalPrice,
      isOnOffer: this.isOnOffer,
      offerText: this.offerText,
      availability: this.availability,
      stockLevel: this.stockLevel,
      lastChecked: this.lastChecked,
      url: this.url,
      scrapedAt: this.scrapedAt,
      isActive: this.isActive
    };
  }

  static fromFirestore(doc) {
    const data = doc.data();
    return new StoreProduct({
      id: doc.id,
      ...data
    });
  }

  // Calculate savings percentage
  getSavingsPercentage() {
    if (!this.originalPrice || this.originalPrice <= this.price) {
      return 0;
    }
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }

  // Check if product is in stock
  isInStock() {
    return this.availability === 'in_stock' || this.availability === 'low_stock';
  }

  // Get price per unit (if weight/volume available)
  getPricePerUnit() {
    // This would need product weight/volume data
    // For now, return the base price
    return this.price;
  }
}

module.exports = StoreProduct;

