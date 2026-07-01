/**
 * Product model for scraped grocery data
 */

class Product {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.brand = data.brand || '';
    this.category = data.category || '';
    this.description = data.description || '';
    this.imageUrl = data.imageUrl || '';
    this.barcode = data.barcode || '';
    this.nutrition = data.nutrition || {};
    this.allergens = data.allergens || [];
    this.ingredients = data.ingredients || [];
    this.unit = data.unit || 'item';
    this.size = data.size || '';
    this.weight = data.weight || '';
    this.volume = data.volume || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  toFirestore() {
    return {
      name: this.name,
      brand: this.brand,
      category: this.category,
      description: this.description,
      imageUrl: this.imageUrl,
      barcode: this.barcode,
      nutrition: this.nutrition,
      allergens: this.allergens,
      ingredients: this.ingredients,
      unit: this.unit,
      size: this.size,
      weight: this.weight,
      volume: this.volume,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromFirestore(doc) {
    const data = doc.data();
    return new Product({
      id: doc.id,
      ...data
    });
  }
}

module.exports = Product;

