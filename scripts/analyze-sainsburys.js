/**
 * Analyze Sainsbury's Website Structure
 * Find the right selectors and methods for scraping products
 */

const puppeteer = require('puppeteer');

class SainsburysAnalyzer {
  constructor() {
    this.baseUrl = 'https://www.sainsburys.co.uk/gol-ui/groceries/search';
    this.postcode = 'UB8 1QW';
  }

  async analyzePage(searchTerm = 'apple') {
    console.log(`🔍 Analyzing Sainsbury's for: "${searchTerm}"`);
    
    const browser = await puppeteer.launch({ 
      headless: true, // Run headless for stability
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
      await this.handleCookieConsent(page);

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log(`\n📊 PAGE ANALYSIS:`);
      console.log(`Title: ${await page.title()}`);
      console.log(`URL: ${page.url()}`);

      // Check for common product selectors
      const selectors = [
        '[data-testid*="product"]',
        '[class*="product"]',
        '[class*="item"]',
        '[class*="card"]',
        'article',
        '.product',
        '.item',
        '.card',
        '.product-item',
        '.product-card',
        '[data-testid*="item"]',
        '[data-testid*="card"]',
        '.grocery-item',
        '.search-result',
        '.product-tile',
        '.product-listing'
      ];

      console.log(`\n🔍 TESTING SELECTORS:`);
      for (const selector of selectors) {
        const elements = await page.$$(selector);
        console.log(`${selector}: ${elements.length} elements`);
        
        if (elements.length > 0) {
          // Get sample text from first few elements
          const sampleTexts = await Promise.all(
            elements.slice(0, 3).map(el => el.evaluate(e => e.textContent?.trim().substring(0, 100) || ''))
          );
          console.log(`  Sample texts: ${sampleTexts.join(' | ')}`);
        }
      }

      // Look for price patterns
      console.log(`\n💰 PRICE ANALYSIS:`);
      const priceElements = await page.$$('*');
      const priceTexts = [];
      
      for (const element of priceElements.slice(0, 50)) { // Check first 50 elements
        const text = await element.evaluate(el => el.textContent?.trim() || '');
        if (text.match(/£\d+\.?\d*/)) {
          priceTexts.push(text.substring(0, 200));
        }
      }
      
      console.log(`Found ${priceTexts.length} elements with prices:`);
      priceTexts.slice(0, 10).forEach((text, i) => {
        console.log(`  ${i + 1}. ${text}`);
      });

      // Get all text content and analyze patterns
      console.log(`\n📝 TEXT CONTENT ANALYSIS:`);
      const pageText = await page.evaluate(() => document.body.innerText);
      const lines = pageText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      console.log(`Total lines: ${lines.length}`);
      
      // Look for lines that might be product names
      const potentialProducts = lines.filter(line => 
        line.length > 10 && 
        line.length < 100 && 
        !line.includes('Help Centre') &&
        !line.includes('Skip to') &&
        !line.includes('Log in') &&
        !line.includes('Register') &&
        !line.includes('Trolley') &&
        !line.includes('Store Locator') &&
        !line.includes('Filter') &&
        !line.includes('Sort') &&
        !line.includes('Results') &&
        !line.includes('Showing') &&
        (line.includes(searchTerm.toLowerCase()) || 
         line.match(/[A-Z][a-z]+.*[A-Z][a-z]+/) ||
         line.includes('ml') || line.includes('L') || 
         line.includes('kg') || line.includes('g') ||
         line.includes('pack') || line.includes('Pack'))
      );
      
      console.log(`\nPotential product names (${potentialProducts.length}):`);
      potentialProducts.slice(0, 15).forEach((product, i) => {
        console.log(`  ${i + 1}. ${product}`);
      });

      // Look for price patterns in context
      console.log(`\n💷 PRICE CONTEXT ANALYSIS:`);
      const priceLines = lines.filter(line => line.match(/£\d+\.?\d*/));
      console.log(`Lines with prices (${priceLines.length}):`);
      priceLines.slice(0, 10).forEach((line, i) => {
        console.log(`  ${i + 1}. ${line}`);
      });

      // Check for specific Sainsbury's patterns
      console.log(`\n🏪 SAINSBURY'S SPECIFIC ANALYSIS:`);
      
      // Look for data attributes
      const dataAttributes = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        const attrs = new Set();
        elements.forEach(el => {
          Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('data-')) {
              attrs.add(attr.name);
            }
          });
        });
        return Array.from(attrs).sort();
      });
      
      console.log(`Data attributes found: ${dataAttributes.slice(0, 20).join(', ')}`);

      // Look for class patterns
      const classPatterns = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        const classes = new Set();
        elements.forEach(el => {
          if (el.className && typeof el.className === 'string') {
            el.className.split(' ').forEach(cls => {
              if (cls.includes('product') || cls.includes('item') || cls.includes('card') || cls.includes('tile')) {
                classes.add(cls);
              }
            });
          }
        });
        return Array.from(classes).sort();
      });
      
      console.log(`Product-related classes: ${classPatterns.slice(0, 20).join(', ')}`);

      // Take a screenshot for analysis
      console.log(`\n📸 Taking screenshot for analysis...`);
      await page.screenshot({ path: 'sainsburys-analysis.png', fullPage: true });
      console.log(`Screenshot saved as sainsburys-analysis.png`);

      await browser.close();

    } catch (error) {
      console.error(`❌ Error analyzing Sainsbury's:`, error.message);
      await browser.close();
    }
  }

  async handleCookieConsent(page) {
    try {
      // Wait for cookie consent popup to appear
      await page.waitForSelector('[data-testid="consent-banner"], .cookie-banner, [class*="cookie"], [class*="consent"], .cookie-notice', { timeout: 5000 });
      console.log(`✅ Cookie consent popup found`);
      
      // Try to click "Accept All" button
      const acceptSelectors = [
        'button[data-testid="accept-all"]',
        'button:contains("Accept all")',
        'button:contains("Accept All")',
        'button:contains("Accept")',
        'button:contains("Allow")',
        '[data-testid="accept-all"]',
        '.cookie-accept',
        '.consent-accept',
        '.accept-all',
        '.cookie-allow'
      ];
      
      let accepted = false;
      for (const selector of acceptSelectors) {
        try {
          await page.click(selector);
          console.log(`✅ Clicked accept button with selector: ${selector}`);
          accepted = true;
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!accepted) {
        // Try to find and click any button that might accept cookies
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await button.evaluate(el => el.textContent?.toLowerCase() || '');
          if (text.includes('accept') || text.includes('allow') || text.includes('ok') || text.includes('continue')) {
            await button.click();
            console.log(`✅ Clicked accept button with text: ${text}`);
            accepted = true;
            break;
          }
        }
      }
      
      if (accepted) {
        // Wait for popup to disappear and page to reload
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
    } catch (e) {
      console.log(`ℹ️  No cookie consent popup found`);
    }
  }
}

// Main execution
async function main() {
  const analyzer = new SainsburysAnalyzer();
  
  try {
    await analyzer.analyzePage('apple');
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = SainsburysAnalyzer;
