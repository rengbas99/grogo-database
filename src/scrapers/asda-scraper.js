import { BaseScraper } from './base-scraper.js';

export class AsdaScraper extends BaseScraper {
  constructor() {
    super('Asda');
  }

  async scrapeWithSearchTerm(searchTerm) {
    const config = {
      actorId: 'jupri/asda-scraper',
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

