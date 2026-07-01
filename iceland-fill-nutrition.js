'use strict';

/**
 * iceland-fill-nutrition.js
 *
 * Enriches iceland-normalised.json for all products where nutrition === null.
 * Also fills ingredients where currently null, as a bonus pass.
 *
 * Fill-empty-only: never overwrites existing non-null nutrition or ingredients.
 * Resumable: reads iceland-enrich-checkpoint.json on startup.
 * Audit: appends every result to iceland-nutrition-audit.json.
 */

const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin  = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());

const fs   = require('fs');
const path = require('path');

// puppeteer-extra-plugin-user-data-dir calls rimraf() with the v3 API but the
// installed rimraf is v4+ (ESM default, not a callable function). The plugin
// throws synchronously inside the browser's disconnect event handler — it can't
// be caught with .catch(). Suppress it here so browser relaunches don't crash.
process.on('uncaughtException', err => {
  if (/rimraf|is not a function/i.test(err.message)) return;
  console.error('Uncaught exception:', err.message);
  process.exit(1);
});

// ── Paths ────────────────────────────────────────────────────────────────────
const BASE       = path.join(__dirname, 'final-products/iceland');
const DATA_FILE  = path.join(BASE, 'iceland-normalised.json');
const CKPT_FILE  = path.join(__dirname, 'iceland-enrich-checkpoint.json');
const AUDIT_FILE = path.join(BASE, 'iceland-nutrition-audit.json');

// ── Config ────────────────────────────────────────────────────────────────────
const RELAUNCH_EVERY  = 50;
const CHECKPOINT_EVERY = 10;
const PROGRESS_EVERY   = 25;

// ── Nutrition label → canonical key ──────────────────────────────────────────
const LABEL_MAP = {
  'energy kj':            'calories',
  'energy kcal':          'calories',
  'energy':               'calories',
  'fat':                  'fat',
  'total fat':            'fat',
  'saturated fat':        'saturates',
  'saturates':            'saturates',
  'of which saturates':   'saturates',
  'carbohydrate':         'carbs',
  'carbohydrates':        'carbs',
  'total carbohydrate':   'carbs',
  'of which sugars':      'sugars',
  'sugars':               'sugars',
  'of which: sugars':     'sugars',
  'protein':              'protein',
  'salt':                 'salt',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomDelay(min = 3000, max = 6000) {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

function parseNum(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s || s === '-') return null;
  if (/^trace$/i.test(s)) return 0;
  // "3408kJ/829kcal" → 829
  const kcal = s.match(/(\d+(?:\.\d+)?)\s*kcal/i);
  if (kcal) return parseFloat(kcal[1]);
  // "<0.1g", "92g", "0.00g"
  const m = s.match(/[<>≈~]?\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function parseNutritionTable(rows) {
  const result = {
    calories_per_100g: null, fat: null, saturates: null,
    carbs: null, sugars: null, protein: null, salt: null,
  };
  for (const { label, per100 } of rows) {
    // Strip wrapping parens: "(of which saturates)" → "of which saturates"
    const norm = label.toLowerCase().trim().replace(/^\(+|\)+$/g, '').trim();
    const key  = LABEL_MAP[norm];
    if (!key) continue;
    const field = key === 'calories' ? 'calories_per_100g' : key;
    if (result[field] !== null) continue; // first match wins
    result[field] = parseNum(per100);
  }
  return Object.values(result).some(v => v !== null) ? result : null;
}

// ── Checkpoint ────────────────────────────────────────────────────────────────

function loadCheckpoint() {
  if (fs.existsSync(CKPT_FILE)) {
    try { return JSON.parse(fs.readFileSync(CKPT_FILE, 'utf8')); } catch (_) {}
  }
  return { completed: {} };
}
function saveCheckpoint(cp) {
  fs.writeFileSync(CKPT_FILE, JSON.stringify(cp, null, 2));
}

// ── Audit (append-only) ───────────────────────────────────────────────────────

function flushAudit(pendingEntries) {
  if (!pendingEntries.length) return;
  let existing = [];
  if (fs.existsSync(AUDIT_FILE)) {
    try { existing = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8')); } catch (_) {}
  }
  fs.writeFileSync(AUDIT_FILE, JSON.stringify([...existing, ...pendingEntries], null, 2));
}

// ── Page scraper ──────────────────────────────────────────────────────────────

async function scrapePage(page, slug) {
  const url = `https://www.iceland.co.uk/p/${slug}`;
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });

  const httpStatus = resp.status();
  if (httpStatus >= 400) throw new Error(`HTTP ${httpStatus}`);

  // Guard: if page resolved to homepage or search (redirect = dead product)
  const resolvedUrl = page.url();
  const BASE_ICELAND = 'https://www.iceland.co.uk';
  if (resolvedUrl === BASE_ICELAND + '/' ||
      resolvedUrl === BASE_ICELAND ||
      /\/search\?|\/search$/i.test(resolvedUrl) ||
      !/\/p\//i.test(resolvedUrl)) {
    return { ingredients: null, nutrition: null, triggerResult: 'redirect-dead', rowCount: 0 };
  }

  await new Promise(r => setTimeout(r, 1500));

  // Ingredients — already in DOM, no click needed
  const ingredients = await page.evaluate(() => {
    const el = document.querySelector('[data-test-selector="ingredients-list"] p');
    return el ? el.innerText.trim() || null : null;
  });

  // Click "Show full nutritional table" if section exists
  const triggerResult = await page.evaluate(() => {
    const section = document.querySelector('[data-test-selector="nutrition-information"]');
    if (!section) return 'no-section';
    const trigger = [...section.querySelectorAll('p')]
      .find(p => /show full nutritional/i.test(p.textContent));
    if (!trigger) return 'no-trigger';
    trigger.click();
    return 'clicked';
  });

  let rawRows = [];
  if (triggerResult === 'clicked') {
    await new Promise(r => setTimeout(r, 2000));

    rawRows = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return [];

      // Find per-100 column (may be col 1 or col 2 depending on product)
      const headers = [...table.querySelectorAll('thead th')]
        .map(th => th.innerText.trim().toLowerCase());
      const per100Idx = headers.findIndex(h => /per\s*100/i.test(h));

      return [...table.querySelectorAll('tbody tr')].flatMap(tr => {
        const cells = [...tr.querySelectorAll('td')].map(td => td.innerText.trim());
        if (cells.length < 2) return [];
        const per100 = per100Idx >= 0
          ? (cells[per100Idx] ?? cells[cells.length - 1])
          : cells[cells.length - 1];
        return [{ label: cells[0], per100 }];
      });
    });
  }

  const nutrition = parseNutritionTable(rawRows);
  return { ingredients, nutrition, triggerResult, rowCount: rawRows.length };
}

// ── Browser factory ───────────────────────────────────────────────────────────

async function launchBrowser() {
  return puppeteerExtra.launch({
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });
}

async function makePage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1280, height: 900 });
  return page;
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const products  = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const cp        = loadCheckpoint();

  // Target: all products with null nutrition, not yet completed in checkpoint
  const toProcess = products
    .filter(p => p.nutrition === null)
    .filter(p => !cp.completed[p.barcode.value]);

  const totalTarget = products.filter(p => p.nutrition === null).length;
  const alreadyDone = totalTarget - toProcess.length;

  console.log(`Iceland nutrition enricher`);
  console.log(`Target (null nutrition): ${totalTarget}`);
  console.log(`Already done (checkpoint): ${alreadyDone}`);
  console.log(`Remaining this run: ${toProcess.length}`);
  console.log(`Relaunch browser every ${RELAUNCH_EVERY} | checkpoint every ${CHECKPOINT_EVERY}`);
  console.log();

  // Fast lookup: barcode.value → array index
  const idxMap = new Map(products.map((p, i) => [p.barcode.value, i]));

  let browser   = await launchBrowser();
  let pageCount = 0;

  let nutritionFilled   = 0;
  let ingredientsFilled = 0;
  let noSection         = 0;
  let errors            = 0;
  let processed         = 0;

  const pendingAudit = [];

  const flush = () => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
    saveCheckpoint(cp);
    flushAudit(pendingAudit.splice(0));
  };

  for (const product of toProcess) {
    const slug = product.barcode.value;
    const idx  = idxMap.get(slug);

    // Relaunch browser every RELAUNCH_EVERY pages to avoid memory leak
    if (pageCount > 0 && pageCount % RELAUNCH_EVERY === 0) {
      console.log(`  → relaunching browser at page ${pageCount}`);
      await browser.close().catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      browser = await launchBrowser();
    }

    const page = await makePage(browser);

    const audit = {
      barcode:          slug,
      product_name:     product.product_name,
      nutrition_filled: false,
      ingredients_filled: false,
      trigger_result:   null,
      rows_found:       0,
      error:            null,
      scraped_at:       new Date().toISOString(),
    };

    try {
      const result = await scrapePage(page, slug);
      audit.trigger_result = result.triggerResult;
      audit.rows_found     = result.rowCount;

      if (result.triggerResult === 'no-section') noSection++;

      // Fill nutrition (only if currently null)
      if (result.nutrition !== null && products[idx].nutrition === null) {
        products[idx].nutrition = result.nutrition;
        nutritionFilled++;
        audit.nutrition_filled = true;
      }

      // Fill ingredients (only if currently null/empty)
      if (result.ingredients && !products[idx].ingredients) {
        products[idx].ingredients = result.ingredients;
        ingredientsFilled++;
        audit.ingredients_filled = true;
      }

    } catch (err) {
      errors++;
      audit.error = err.message;
      console.log(`  ✗ [${product.product_name}]: ${err.message}`);
    } finally {
      await page.close().catch(() => {});
    }

    pendingAudit.push(audit);
    cp.completed[slug] = true;
    processed++;
    pageCount++;

    if (processed % CHECKPOINT_EVERY === 0) flush();

    if (processed % PROGRESS_EVERY === 0) {
      console.log(
        `[${processed}/${toProcess.length}] | ` +
        `nutrition filled: ${nutritionFilled} | ` +
        `ingredients filled: ${ingredientsFilled} | ` +
        `no-section: ${noSection} | errors: ${errors}`
      );
    }

    await randomDelay(3000, 6000);
  }

  // Final save
  flush();
  await browser.close().catch(() => {});

  console.log();
  console.log('══════════════════════════════════════════════');
  console.log('RUN COMPLETE');
  console.log(`Processed:           ${processed}`);
  console.log(`Nutrition filled:    ${nutritionFilled}`);
  console.log(`Ingredients filled:  ${ingredientsFilled}`);
  console.log(`No-section (correct): ${noSection}`);
  console.log(`Errors:              ${errors}`);

  // ── Disk verification ──────────────────────────────────────────────────────
  console.log();
  console.log('══════════════════════════════════════════════');
  console.log('DISK VERIFICATION (re-reading saved file)');

  const saved  = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const junkRe = /une eau min[eé]rale naturelle|acqua minerale|wasser|agua mineral/i;

  const vNutTotal  = saved.filter(p => p.nutrition !== null).length;
  const vIngTotal  = saved.filter(p => p.ingredients && String(p.ingredients).trim()).length;
  const vJunk      = saved.filter(p => p.ingredients && junkRe.test(p.ingredients)).length;
  const auditExists = fs.existsSync(AUDIT_FILE);
  const auditRows  = auditExists
    ? JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8')).length
    : 0;

  console.log(`Total products:              ${saved.length}`);
  console.log(`Non-null nutrition:          ${vNutTotal} / ${saved.length} (${(vNutTotal/saved.length*100).toFixed(1)}%)`);
  console.log(`Non-empty ingredients:       ${vIngTotal} / ${saved.length} (${(vIngTotal/saved.length*100).toFixed(1)}%)`);
  console.log(`Junk ingredients found:      ${vJunk} (must be 0)`);
  console.log(`Audit file exists:           ${auditExists}`);
  console.log(`Audit entries:               ${auditRows}`);

  // 10 random samples
  const withNut = saved.filter(p => p.nutrition !== null);
  const samples  = withNut.sort(() => Math.random() - 0.5).slice(0, 10);
  console.log();
  console.log('── 10 random samples with nutrition ──');
  for (const p of samples) {
    console.log(`  ${p.product_name}`);
    console.log(`    nutrition: ${JSON.stringify(p.nutrition)}`);
    console.log(`    ingredients: ${(p.ingredients || '(null)').slice(0, 80)}`);
  }
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
