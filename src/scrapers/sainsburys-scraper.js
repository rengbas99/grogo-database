import { BaseScraper } from './base-scraper.js';

export class SainsburysScraper extends BaseScraper {
  constructor() {
    super('Sainsburys');
  }

  async scrapeWithSearchTerm(searchTerm) {
    const config = {
      actorId: 'natanielsantos/sainsbury-s-scraper',
      input: {
        searchTerm,
        maxItems: 10,
        includeNutrition: true,
        includeImages: true,
        includeOffers: true,
        includeReviews: true
      }
    };
    
    return await this.runApifyActor(config);
  }
}

