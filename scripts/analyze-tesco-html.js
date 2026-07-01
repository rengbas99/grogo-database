/**
 * Analyze Tesco HTML Structure
 * Inspect what's actually on the page to find correct selectors
 */

const puppeteer = require('puppeteer');

class TescoHTMLAnalyzer {
  constructor() {
    this.baseUrl = 'https://www.tesco.com/groceries/en-GB/search';
  }

  async analyzePage(searchTerm) {
    console.log(`\n🔍 Analyzing Tesco HTML for: "${searchTerm}"`);
    
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

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Get page title and URL
      const pageTitle = await page.title();
      const currentUrl = page.url();
      console.log(`📄 Page title: ${pageTitle}`);
      console.log(`🔗 Current URL: ${currentUrl}`);

      // Check for blocking
      if (pageTitle.includes('Access Denied') || pageTitle.includes('Blocked')) {
        console.log(`🚫 Page blocked`);
        await browser.close();
        return;
      }

      // Get all elements that might contain products
      console.log(`\n🔍 Analyzing page structure...`);
      
      const analysis = await page.evaluate(() => {
        const results = {
          totalElements: document.querySelectorAll('*').length,
          possibleProductContainers: [],
          allDataTestAttributes: [],
          allClassNames: [],
          textContent: document.body.innerText.substring(0, 1000)
        };

        // Look for elements with data-test attributes
        const dataTestElements = document.querySelectorAll('[data-test]');
        dataTestElements.forEach(el => {
          const testValue = el.getAttribute('data-test');
          const tagName = el.tagName;
          const className = el.className;
          const textContent = el.textContent?.substring(0, 100) || '';
          
          results.allDataTestAttributes.push({
            testValue,
            tagName,
            className,
            textContent
          });
        });

        // Look for common product-related class names
        const productClassElements = document.querySelectorAll('[class*="product"], [class*="item"], [class*="tile"], [class*="card"]');
        productClassElements.forEach(el => {
          const className = el.className;
          const tagName = el.tagName;
          const textContent = el.textContent?.substring(0, 100) || '';
          
          results.allClassNames.push({
            className,
            tagName,
            textContent
          });
        });

        // Look for elements that might be product containers
        const possibleContainers = [
          'section',
          'div',
          'article',
          'li'
        ];

        possibleContainers.forEach(tag => {
          const elements = document.querySelectorAll(tag);
          elements.forEach(el => {
            const text = el.textContent?.toLowerCase() || '';
            const className = el.className?.toLowerCase() || '';
            const dataTest = el.getAttribute('data-test')?.toLowerCase() || '';
            
            // Check if this element might contain product info
            if (text.includes('£') || text.includes('price') || 
                className.includes('product') || className.includes('item') ||
                dataTest.includes('product') || dataTest.includes('item')) {
              
              results.possibleProductContainers.push({
                tagName: el.tagName,
                className: el.className,
                dataTest: el.getAttribute('data-test'),
                textContent: el.textContent?.substring(0, 200) || '',
                innerHTML: el.innerHTML?.substring(0, 300) || ''
              });
            }
          });
        });

        return results;
      });

      console.log(`\n📊 Page Analysis Results:`);
      console.log(`  Total elements: ${analysis.totalElements}`);
      console.log(`  Possible product containers: ${analysis.possibleProductContainers.length}`);
      console.log(`  Data-test attributes found: ${analysis.allDataTestAttributes.length}`);
      console.log(`  Product-related classes: ${analysis.allClassNames.length}`);

      // Show data-test attributes
      if (analysis.allDataTestAttributes.length > 0) {
        console.log(`\n🏷️  Data-test attributes found:`);
        analysis.allDataTestAttributes.slice(0, 10).forEach(attr => {
          console.log(`  - ${attr.tagName}[data-test="${attr.testValue}"] (${attr.className})`);
        });
      }

      // Show product-related classes
      if (analysis.allClassNames.length > 0) {
        console.log(`\n🎨 Product-related classes found:`);
        analysis.allClassNames.slice(0, 10).forEach(cls => {
          console.log(`  - ${cls.tagName}.${cls.className.split(' ').join('.')}`);
        });
      }

      // Show possible product containers
      if (analysis.possibleProductContainers.length > 0) {
        console.log(`\n📦 Possible product containers:`);
        analysis.possibleProductContainers.slice(0, 5).forEach(container => {
          console.log(`  - ${container.tagName}${container.className ? '.' + container.className.split(' ').join('.') : ''}${container.dataTest ? '[data-test="' + container.dataTest + '"]' : ''}`);
          console.log(`    Text: ${container.textContent.substring(0, 100)}...`);
        });
      }

      // Show page text content
      console.log(`\n📝 Page text content (first 500 chars):`);
      console.log(analysis.textContent);

      await browser.close();

    } catch (error) {
      console.error(`❌ Error analyzing page:`, error.message);
      await browser.close();
    }
  }

  async analyzeAllTerms() {
    const testTerms = ['apple', 'milk'];
    
    for (const term of testTerms) {
      await this.analyzePage(term);
      console.log(`\n${'='.repeat(60)}`);
    }
  }
}

// Main execution
async function main() {
  const analyzer = new TescoHTMLAnalyzer();
  
  try {
    await analyzer.analyzeAllTerms();
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = TescoHTMLAnalyzer;
