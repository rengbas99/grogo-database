import { BaseScraper } from './base-scraper.js';

export class IcelandScraper extends BaseScraper {
  constructor() {
    super('Iceland');
  }

  async scrapeWithSearchTerm(searchTerm) {
    const config = {
      actorId: 'jupri/iceland-scraper',
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

