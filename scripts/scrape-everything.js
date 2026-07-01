/**
 * Scrape Everything - Get all elements on the page
 * Debug what's actually on Tesco's page
 */

const puppeteer = require('puppeteer');

class ScrapeEverything {
  constructor() {
    this.baseUrl = 'https://www.tesco.com/groceries/en-GB/search';
  }

  async scrapeEverything(searchTerm) {
    console.log(`\n🔍 Scraping EVERYTHING on Tesco page for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();

    // Set realistic User-Agent and viewport
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set extra headers to avoid bot detection
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });

    try {
      const url = `${this.baseUrl}?query=${encodeURIComponent(searchTerm)}`;
      console.log(`🌐 Navigating to: ${url}`);
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Handle cookie consent
      try {
        await page.waitForSelector('[data-testid="consent-banner"], .cookie-banner, [class*="cookie"], [class*="consent"]', { timeout: 5000 });
        console.log(`✅ Cookie consent popup found`);
        
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await button.evaluate(el => el.textContent?.toLowerCase() || '');
          if (text.includes('accept') || text.includes('allow')) {
            await button.click();
            console.log(`✅ Clicked accept button`);
            break;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (e) {
        console.log(`ℹ️  No cookie consent popup found`);
      }

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log(`🔍 Scraping ALL elements on the page...`);

      // Get ALL elements that might contain product information
      const allElements = await page.evaluate((searchTerm) => {
        const results = {
          totalElements: document.querySelectorAll('*').length,
          elementsWithText: [],
          elementsWithPrices: [],
          elementsWithImages: [],
          elementsWithLinks: [],
          allTextContent: document.body.innerText
        };

        // Get all elements
        const allEls = document.querySelectorAll('*');
        
        allEls.forEach((el, index) => {
          const text = el.textContent?.trim() || '';
          const tagName = el.tagName;
          const className = el.className;
          const id = el.id;
          
          // Skip if no text or very short text
          if (text.length < 3) return;
          
          // Check if element contains search term
          if (text.toLowerCase().includes(searchTerm.toLowerCase())) {
            results.elementsWithText.push({
              index,
              tagName,
              className,
              id,
              text: text.substring(0, 200),
              innerHTML: el.innerHTML?.substring(0, 300) || ''
            });
          }
          
          // Check if element contains price (£)
          if (text.includes('£') || text.includes('price') || text.includes('cost')) {
            results.elementsWithPrices.push({
              index,
              tagName,
              className,
              id,
              text: text.substring(0, 200)
            });
          }
          
          // Check if element has images
          const images = el.querySelectorAll('img');
          if (images.length > 0) {
            results.elementsWithImages.push({
              index,
              tagName,
              className,
              id,
              text: text.substring(0, 100),
              imageCount: images.length,
              imageSrcs: Array.from(images).map(img => img.src).slice(0, 3)
            });
          }
          
          // Check if element has links
          const links = el.querySelectorAll('a');
          if (links.length > 0) {
            results.elementsWithLinks.push({
              index,
              tagName,
              className,
              id,
              text: text.substring(0, 100),
              linkCount: links.length,
              linkHrefs: Array.from(links).map(a => a.href).slice(0, 3)
            });
          }
        });

        return results;
      }, searchTerm);

      console.log(`\n📊 PAGE ANALYSIS RESULTS:`);
      console.log(`  Total elements: ${allElements.totalElements}`);
      console.log(`  Elements containing "${searchTerm}": ${allElements.elementsWithText.length}`);
      console.log(`  Elements with prices: ${allElements.elementsWithPrices.length}`);
      console.log(`  Elements with images: ${allElements.elementsWithImages.length}`);
      console.log(`  Elements with links: ${allElements.elementsWithLinks.length}`);

      // Show elements containing search term
      if (allElements.elementsWithText.length > 0) {
        console.log(`\n🔍 Elements containing "${searchTerm}":`);
        allElements.elementsWithText.slice(0, 10).forEach((el, i) => {
          console.log(`  ${i + 1}. ${el.tagName}${el.className ? '.' + el.className.split(' ').join('.') : ''}${el.id ? '#' + el.id : ''}`);
          console.log(`     Text: ${el.text}`);
        });
      }

      // Show elements with prices
      if (allElements.elementsWithPrices.length > 0) {
        console.log(`\n💰 Elements with prices:`);
        allElements.elementsWithPrices.slice(0, 10).forEach((el, i) => {
          console.log(`  ${i + 1}. ${el.tagName}${el.className ? '.' + el.className.split(' ').join('.') : ''}${el.id ? '#' + el.id : ''}`);
          console.log(`     Text: ${el.text}`);
        });
      }

      // Show elements with images
      if (allElements.elementsWithImages.length > 0) {
        console.log(`\n🖼️  Elements with images:`);
        allElements.elementsWithImages.slice(0, 10).forEach((el, i) => {
          console.log(`  ${i + 1}. ${el.tagName}${el.className ? '.' + el.className.split(' ').join('.') : ''}${el.id ? '#' + el.id : ''}`);
          console.log(`     Text: ${el.text}`);
          console.log(`     Images: ${el.imageCount} (${el.imageSrcs.join(', ')})`);
        });
      }

      // Show elements with links
      if (allElements.elementsWithLinks.length > 0) {
        console.log(`\n🔗 Elements with links:`);
        allElements.elementsWithLinks.slice(0, 10).forEach((el, i) => {
          console.log(`  ${i + 1}. ${el.tagName}${el.className ? '.' + el.className.split(' ').join('.') : ''}${el.id ? '#' + el.id : ''}`);
          console.log(`     Text: ${el.text}`);
          console.log(`     Links: ${el.linkCount} (${el.linkHrefs.join(', ')})`);
        });
      }

      // Try to extract products from the data
      console.log(`\n🛒 Attempting to extract products...`);
      
      const products = await page.evaluate((searchTerm) => {
        const productElements = [];
        
        // Look for elements that might be product containers
        const allEls = document.querySelectorAll('*');
        
        allEls.forEach((el) => {
          const text = el.textContent?.trim() || '';
          
          // Skip if no meaningful text
          if (text.length < 10) return;
          
          // Check if this looks like a product (has price and some text)
          const hasPrice = text.includes('£') || text.includes('price');
          const hasImage = el.querySelector('img') !== null;
          const hasLink = el.querySelector('a') !== null;
          const hasProductText = text.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                text.length > 20; // Generic product text
          
          if ((hasPrice || hasImage || hasLink) && hasProductText) {
            const name = el.querySelector('h1, h2, h3, h4, .title, .name, a')?.textContent?.trim() || 
                        text.substring(0, 100);
            const price = el.querySelector('[class*="price"], [data-test*="price"]')?.textContent?.trim() || 
                        (text.match(/£[\d.]+/) ? text.match(/£[\d.]+/)[0] : '');
            const image = el.querySelector('img')?.src || '';
            const link = el.querySelector('a')?.href || '';

            productElements.push({
              name: name.substring(0, 200),
              price: price || 'Unavailable',
              image,
              link,
              fullText: text.substring(0, 300),
              tagName: el.tagName,
              className: el.className,
              id: el.id
            });
          }
        });

        return productElements;
      }, searchTerm);

      console.log(`\n📦 EXTRACTED PRODUCTS: ${products.length}`);
      
      if (products.length > 0) {
        products.slice(0, 5).forEach((product, i) => {
          console.log(`\n  ${i + 1}. ${product.name}`);
          console.log(`     Price: ${product.price}`);
          console.log(`     Image: ${product.image ? 'Yes' : 'No'}`);
          console.log(`     Link: ${product.link ? 'Yes' : 'No'}`);
          console.log(`     Element: ${product.tagName}${product.className ? '.' + product.className.split(' ').join('.') : ''}`);
          console.log(`     Text: ${product.fullText.substring(0, 100)}...`);
        });
      }

      // Take a screenshot
      await page.screenshot({ path: `everything-${searchTerm}.png` });
      console.log(`\n📸 Screenshot saved as everything-${searchTerm}.png`);

      await browser.close();
      return products;

    } catch (error) {
      console.error(`❌ Error:`, error.message);
      await browser.close();
      return [];
    }
  }

  async testAllTerms() {
    console.log('🚀 Starting comprehensive page scraping...\n');
    
    const testTerms = ['apple', 'milk'];
    
    for (const term of testTerms) {
      try {
        const products = await this.scrapeEverything(term);
        console.log(`\n✅ "${term}": Found ${products.length} potential products`);
      } catch (error) {
        console.error(`❌ Error testing "${term}":`, error.message);
      }
      
      // Delay between searches
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

// Main execution
async function main() {
  const scraper = new ScrapeEverything();
  
  try {
    await scraper.testAllTerms();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ScrapeEverything;
