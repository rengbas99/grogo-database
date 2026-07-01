import { BaseScraper } from './base-scraper.js';

export class TescoScraper extends BaseScraper {
  constructor() {
    super('Tesco');
  }

  async scrapeWithSearchTerm(searchTerm) {
    const config = {
      actorId: 'radeance/tesco-scraper',
      input: {
        searchTerm,
        maxItems: 10,
        includeNutrition: true,
        includeImages: true,
        includeOffers: true,
        includeReviews: true,
        country: 'UK'
      }
    };
    
    return await this.runApifyActor(config);
  }
}

