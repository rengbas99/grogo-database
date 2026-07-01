import { BaseScraper } from './base-scraper.js';

export class LidlScraper extends BaseScraper {
  constructor() {
    super('Lidl');
  }

  async scrapeWithSearchTerm(searchTerm) {
    const config = {
      actorId: 'easyapi/lidl-product-scraper',
      input: {
        searchTerm,
        maxItems: 10,
        includeImages: true,
        includeOffers: true,
        includeNutrition: true
      }
    };
    
    return await this.runApifyActor(config);
  }
}

