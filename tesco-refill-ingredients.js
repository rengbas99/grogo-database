/**
 * tesco-refill-ingredients.js
 *
 * Re-scrapes ingredients + allergens for products whose fields are empty.
 * Reads from tesco-missing-ingredients.json, writes merged output to
 * tesco-final-products-updated.json.
 *
 * Flags:
 *   --test   Process first 3 products only; print raw page context for
 *            selector verification. Does NOT merge into the final file.
 */

const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const path = require('path');

puppeteerExtra.use(StealthPlugin());

// ── Paths ────────────────────────────────────────────────────────────────────

const ROOT = __dirname;
const MISSING_FILE    = path.join(ROOT, 'final-products/tesco/tesco-missing-ingredients.json');
const FINAL_FILE      = path.join(ROOT, 'final-products/tesco/tesco-final-products.json');
const PROGRESS_FILE   = path.join(ROOT, 'tesco-refill-progress.json');
const OUTPUT_FILE     = path.join(ROOT, 'final-products/tesco/tesco-final-products-updated.json');

// ── Config ───────────────────────────────────────────────────────────────────

const TEST_MODE        = process.argv.includes('--test');
const TEST_LIMIT       = 3;
const CHECKPOINT_EVERY = 10;

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomDelay() {
  return Math.round(3000 + Math.random() * 2000);
}

function loadProgress() {
  if (existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
    } catch (_) {}
  }
  return { completed: {}, errors: {} };
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function extractIngredients(page) {
  return await page.evaluate(() => {
    // Step 1: find exact "Ingredients" heading NOT in nav/breadcrumb
    const headings = [...document.querySelectorAll('h2, h3, h4, dt, strong, b')]
    const exactNames = ['Ingredients', 'Ingredient', 'INGREDIENTS']

    for (const heading of headings) {
      const text = heading.textContent.trim()
      if (!exactNames.includes(text)) continue
      if (heading.closest('nav, header, footer, [class*="breadcrumb" i]')) continue

      // Try siblings, stop at first that is <1000 chars and
      // does NOT look like a nutrition table
      const candidates = [
        heading.nextElementSibling
      ]
      for (const el of candidates) {
        if (!el) continue
        const t = el.textContent.trim()
        if (t.length > 10 && t.length < 1000 &&
            !el.querySelector('table') &&
            !t.match(/^energy|^calories|^fat|^carbo/i)) {
          return t
        }
      }
    }

    // Step 2: broader fallback — text starting with 100% or Ingredients:
    const allEls = [...document.querySelectorAll('p, div, dd, li, span')]
    for (const el of allEls) {
      if (el.closest('nav, header, footer, [class*="breadcrumb" i]')) continue
      const t = el.textContent.trim()
      if ((t.startsWith('100%') ||
           t.startsWith('Ingredients:') ||
           t.match(/^[A-Z][a-z]+ \(\d+%\)/)) &&
          t.length < 2000) {
        return t
      }
    }

    return null  // Step 3: no ingredients section found
  })
}

async function extractAllergens(page) {
  return await page.evaluate(() => {
    // Step 1: exact heading match
    const headings = [...document.querySelectorAll('h2, h3, h4, dt, strong, b')]
    const exactNames = [
      'Allergens', 'Allergen Information', 'ALLERGENS',
      'Allergy Information', 'Allergy Advice'
    ]

    for (const heading of headings) {
      const text = heading.textContent.trim()
      if (!exactNames.includes(text)) continue
      if (heading.closest('nav, header, footer, [class*="breadcrumb" i]')) continue

      const candidates = [
        heading.nextElementSibling,
        heading.parentElement?.nextElementSibling
      ]
      for (const el of candidates) {
        if (!el) continue
        const t = el.textContent.trim()
        if (t.length > 5 && t.length < 500) return t
      }
    }

    // Step 2: find "Contains:" or "May contain:" anywhere in page
    const allEls = [...document.querySelectorAll('p, div, dd, span, li')]
    for (const el of allEls) {
      if (el.closest('nav, header, footer')) continue
      const t = el.textContent.trim()
      if ((t.includes('Contains:') ||
           t.includes('May contain:') ||
           t.includes('Free from:')) &&
          t.length < 500) {
        return t
      }
    }

    return null
  })
}

/**
 * Dismisses the OneTrust cookie banner if present.
 */
async function acceptCookies(page) {
  const cookieSelectors = [
    '#onetrust-accept-btn-handler',
    'button[data-testid="accept-all-cookies"]',
    'button[id*="accept"]',
    'button[class*="accept-all"]',
  ];
  for (const sel of cookieSelectors) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await new Promise(r => setTimeout(r, 1200));
        return;
      }
    } catch (_) {}
  }
}

/**
 * Navigate to a product URL and extract ingredients + allergens.
 * Saves a screenshot as debug-{productId}.png.
 * In TEST_MODE also returns raw page-text context for manual verification.
 */
async function scrapePage(page, url, productId) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));

  await acceptCookies(page);
  await new Promise(r => setTimeout(r, 800));

  // Screenshot for debug (before extraction so we see the actual page state)
  const screenshotPath = path.join(ROOT, `debug-${productId}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  // Detect hard block / 404
  const blocked = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    return (
      text.includes('Access Denied') ||
      text.includes('403 Forbidden') ||
      document.title?.toLowerCase().includes('404') ||
      text.toLowerCase().includes('page not found') ||
      text.toLowerCase().includes('sorry, we couldn')
    );
  });

  if (blocked) return { blocked: true, screenshotPath };

  const ingredients = await extractIngredients(page);
  const allergens   = await extractAllergens(page);

  if (!TEST_MODE) return { ingredients, allergens, screenshotPath };

  // TEST MODE: capture surrounding lines for manual inspection
  const context = await page.evaluate(() => {
    const lines = (document.body?.innerText || '')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    const grab = (keyword) => {
      const idx = lines.findIndex(l => l.toLowerCase().includes(keyword.toLowerCase()));
      return idx >= 0 ? lines.slice(Math.max(0, idx - 1), idx + 6).join(' | ') : null;
    };

    return {
      ingredientsContext: grab('Ingredients'),
      allergensContext:   grab('Allergen'),
      pageTitle:          document.title,
    };
  });

  return { ingredients, allergens, screenshotPath, context };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const missingData = JSON.parse(readFileSync(MISSING_FILE, 'utf8'));
  let queue = missingData.products;

  if (TEST_MODE) {
    console.log(`\nTEST MODE — first ${TEST_LIMIT} products only. No merge will be written.\n`);
    queue = queue.slice(0, TEST_LIMIT);
  }

  // Test mode always runs fresh — no checkpoint so same 3 products are always re-scraped.
  // Production mode resumes from checkpoint if it exists.
  const progress  = TEST_MODE ? { completed: {}, errors: {} } : loadProgress();
  const completed = { ...progress.completed };   // { id -> result }
  const errors    = { ...progress.errors };       // { id -> { name, error } }

  if (!TEST_MODE && Object.keys(completed).length > 0) {
    console.log(`Resuming from checkpoint — ${Object.keys(completed).length} already done.\n`);
  }

  const browser = await puppeteerExtra.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1366, height: 768 });
  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Referer': 'https://www.tesco.com/groceries/en-GB/',
  });

  let newlyProcessed = 0;

  for (let i = 0; i < queue.length; i++) {
    const product = queue[i];

    if (completed[product.id]) {
      console.log(`[${i + 1}/${queue.length}] SKIP (checkpoint): ${product.name}`);
      continue;
    }

    console.log(`\n[${i + 1}/${queue.length}] ${product.name}`);
    console.log(`  URL: ${product.url}`);

    try {
      const result = await scrapePage(page, product.url, product.id);

      if (result.blocked) {
        console.log(`  STATUS: BLOCKED`);
        console.log(`  Screenshot: ${result.screenshotPath}`);
        errors[product.id] = { name: product.name, error: 'blocked' };
      } else {
        completed[product.id] = {
          name:        product.name,
          url:         product.url,
          ingredients: result.ingredients || '',
          allergens:   result.allergens   || '',
          scrapedAt:   new Date().toISOString(),
        };

        console.log(`  Screenshot   : ${result.screenshotPath}`);
        console.log(`  Ingredients  : ${result.ingredients?.slice(0, 140) || '(empty)'}`);
        console.log(`  Allergens    : ${result.allergens?.slice(0, 140)   || '(empty)'}`);

        if (TEST_MODE && result.context) {
          console.log(`\n  ── RAW PAGE CONTEXT ─────────────────────────────────`);
          console.log(`  Page title      : ${result.context.pageTitle}`);
          console.log(`  Ingredients ctx : ${result.context.ingredientsContext ?? '(keyword not found in page text)'}`);
          console.log(`  Allergens ctx   : ${result.context.allergensContext   ?? '(keyword not found in page text)'}`);
          console.log(`  ─────────────────────────────────────────────────────`);
        }
      }

      newlyProcessed++;

      if (!TEST_MODE && newlyProcessed % CHECKPOINT_EVERY === 0) {
        saveProgress({ completed, errors });
        console.log(`  [Checkpoint saved — ${newlyProcessed} newly processed this run]`);
      }

    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      errors[product.id] = { name: product.name, error: err.message };
    }

    if (i < queue.length - 1) {
      const delay = randomDelay();
      console.log(`  Waiting ${delay}ms before next request...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  try {
    await browser.close();
  } catch (_) {} // puppeteer-extra-plugin-user-data-dir rimraf compat bug — safe to ignore

  // Always persist final progress
  saveProgress({ completed, errors });
  console.log(`\nProgress saved to ${PROGRESS_FILE}`);

  if (TEST_MODE) {
    console.log('\nTest complete. Re-run without --test to process all 86 products.');
    process.exit(0);
  }

  // ── Merge into tesco-final-products.json ───────────────────────────────────

  console.log('\n── Merging into final products file ──');
  const finalData = JSON.parse(readFileSync(FINAL_FILE, 'utf8'));

  let ingredientsFilled = 0;
  let allergensFilled   = 0;
  const stillEmpty      = [];

  for (const p of missingData.products) {
    const scraped      = completed[p.id];
    const finalProduct = finalData.products.find(fp => fp.id === p.id);

    if (!finalProduct) continue;

    // Only fill if currently empty (never overwrite existing data)
    if (!finalProduct.ingredients && scraped?.ingredients) {
      finalProduct.ingredients = scraped.ingredients;
      ingredientsFilled++;
    }
    if (!finalProduct.allergens && scraped?.allergens) {
      finalProduct.allergens = scraped.allergens;
      allergensFilled++;
    }

    // Track what's still empty after the merge
    if (!finalProduct.ingredients) {
      stillEmpty.push(finalProduct.productName || p.name);
    }
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2));

  // ── Final report ───────────────────────────────────────────────────────────

  console.log('\n════════════════════════════════════════');
  console.log('  FINAL REPORT');
  console.log('════════════════════════════════════════');
  console.log(`  Ingredients filled : ${ingredientsFilled} / ${missingData.totalMissing}`);
  console.log(`  Allergens filled   : ${allergensFilled} / ${missingData.totalMissing}`);
  console.log(`  Still empty        : ${stillEmpty.length}`);
  if (stillEmpty.length > 0) {
    stillEmpty.forEach(n => console.log(`    - ${n}`));
  }
  console.log(`  Errors / blocked   : ${Object.keys(errors).length}`);
  console.log(`\n  Output written to  : ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
