'use strict';

/**
 * sainsburys-fill-nutrition.js
 *
 * Enriches sainsburys-normalised.json for all products where nutrition === null.
 * Also fills ingredients/allergens where currently empty.
 *
 * Fill-empty-only — never overwrites existing non-null data.
 * Resumable via sainsburys-enrich-checkpoint.json.
 * Audit appended to sainsburys-nutrition-audit.json (never deleted).
 */

const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin  = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());

const fs   = require('fs');
const path = require('path');

process.on('uncaughtException', err => {
  if (/rimraf|is not a function/i.test(err.message)) return;
  console.error('Uncaught:', err.message); process.exit(1);
});

// ── Paths ─────────────────────────────────────────────────────────────────────
const BASE       = path.join(__dirname, 'final-products/sainsbury');
const DATA_FILE  = path.join(BASE, 'sainsburys-normalised.json');
const CKPT_FILE  = path.join(__dirname, 'sainsburys-enrich-checkpoint.json');
const AUDIT_FILE = path.join(BASE, 'sainsburys-nutrition-audit.json');
const ORIG_FILE  = path.join(BASE, 'sainsbury-final-products-enriched.json');
const BASE_URL   = 'https://www.sainsburys.co.uk';

// ── Config ────────────────────────────────────────────────────────────────────
const RELAUNCH_EVERY   = 50;
const CHECKPOINT_EVERY = 10;
const PROGRESS_EVERY   = 25;

// ── Nutrition label → canonical key ──────────────────────────────────────────
const LABEL_MAP = {
  'energy':                   'calories',
  'energy (kj)':              'kj_only',
  'energy (kcal)':            'calories',
  'energy kj':                'kj_only',
  'energy kcal':              'calories',
  'fat':                      'fat',
  'total fat':                'fat',
  'saturated fat':            'saturates',
  'saturates':                'saturates',
  'of which saturates':       'saturates',
  'carbohydrate':             'carbs',
  'carbohydrates':            'carbs',
  'total carbohydrate':       'carbs',
  'of which carbohydrate':    'carbs',
  'of which sugars':          'sugars',
  'sugars':                   'sugars',
  'of which: sugars':         'sugars',
  'protein':                  'protein',
  'salt':                     'salt',
};

function normLabel(raw) {
  return raw.toLowerCase().trim().replace(/^\(+|\)+$/g, '').trim();
}

function parseNum(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s || s === '-' || s === 'n/a' || s === '') return null;
  if (/^trace$/i.test(s)) return 0;
  // kcal explicitly stated — most reliable
  const kcal = s.match(/(\d+(?:\.\d+)?)\s*kcal/i);
  if (kcal) return parseFloat(kcal[1]);
  // kJ value — don't auto-use, caller handles it
  if (/kj/i.test(s)) return null;
  // Plain number: "<0.5g", "92.0g", "0.01g"
  const m = s.match(/[<>≈~]?\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function parseKj(val) {
  if (!val) return null;
  const m = String(val).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function buildNutrition(rows) {
  const out = {
    calories_per_100g: null, fat: null, saturates: null,
    carbs: null, sugars: null, protein: null, salt: null,
  };
  let kjAccum      = null;
  let unit_converted = false;

  for (const { label, per100 } of rows) {
    const norm = normLabel(label);
    const key  = LABEL_MAP[norm];
    if (!key) continue;

    if (key === 'kj_only') {
      if (kjAccum === null) kjAccum = parseKj(per100);
      continue;
    }

    const field = key === 'calories' ? 'calories_per_100g' : key;
    if (out[field] !== null) continue;

    let val = parseNum(per100);

    // Apply >900 = kJ conversion immediately
    if (field === 'calories_per_100g' && val !== null && val > 900) {
      val = Math.round(val / 4.184);
      unit_converted = true;
    }

    out[field] = val;
  }

  // Fallback: derive kcal from kJ row if kcal row was absent
  if (out.calories_per_100g === null && kjAccum !== null) {
    out.calories_per_100g = Math.round(kjAccum / 4.184);
    unit_converted = true;
  }

  // Round calorie float to int
  if (typeof out.calories_per_100g === 'number') {
    out.calories_per_100g = Math.round(out.calories_per_100g);
  }

  const hasAny = Object.values(out).some(v => v !== null);
  return hasAny ? { ...out, unit_converted } : null;
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

// ── Audit (append-only batched) ───────────────────────────────────────────────
function flushAudit(pending) {
  if (!pending.length) return;
  let existing = [];
  if (fs.existsSync(AUDIT_FILE)) {
    try { existing = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8')); } catch (_) {}
  }
  fs.writeFileSync(AUDIT_FILE, JSON.stringify([...existing, ...pending], null, 2));
}

// ── Page scraper ──────────────────────────────────────────────────────────────
async function scrapePage(page, slug) {
  const url  = BASE_URL + slug;
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });
  const status = resp.status();
  if (status >= 400) throw new Error(`HTTP ${status}`);

  // Guard 1: URL resolution — if resolved to root or search, it's a dead redirect
  const resolvedUrl = page.url();
  if (resolvedUrl === BASE_URL + '/' ||
      resolvedUrl === BASE_URL ||
      /\/search\?|\/search$/i.test(resolvedUrl)) {
    return { outcome: 'delisted', status };
  }

  await new Promise(r => setTimeout(r, 1200));

  // Accept cookie banner silently
  await page.evaluate(() => {
    document.querySelector('#onetrust-accept-btn-handler')?.click();
  }).catch(() => {});

  // Guard 2: title-based redirect detection (belt-and-braces)
  const title = await page.title();
  if (/oops|online grocery shopping/i.test(title)) {
    return { outcome: 'delisted', status };
  }

  // Click Nutrition accordion to populate table (cells lazy-render when closed)
  const clickResult = await page.evaluate(() => {
    const items = [...document.querySelectorAll('[data-testid="accordion-item"]')];
    const nutItem = items.find(el =>
      /^nutrition$/i.test(el.querySelector('.ds-c-accordion-item__label--text')?.innerText?.trim())
    );
    if (!nutItem) return 'no-accordion';
    const details = nutItem.querySelector('details');
    if (!details) return 'no-details';
    if (!details.open) { details.querySelector('summary')?.click(); return 'clicked'; }
    return 'already-open';
  });

  if (clickResult === 'clicked') await new Promise(r => setTimeout(r, 1500));

  const data = await page.evaluate(() => {
    const res = {};

    // ── Nutrition table ────────────────────────────────────────────────────
    const table = document.querySelector('table.ds-c-table');
    res.table_found = !!table;
    res.raw_rows = [];

    if (table) {
      const headers = [...table.querySelectorAll('thead th, thead td')]
        .map(th => th.innerText.trim());
      res.headers = headers;

      // Skip index 0 — always the label column, even when its text contains "per 100"
      const per100Idx = headers.findIndex((h, i) => i > 0 && /per\s*100/i.test(h));
      res.per100_col_idx = per100Idx;

      let lastLabel = '';
      table.querySelectorAll('tbody tr').forEach(tr => {
        const cells = [...tr.querySelectorAll('td, th')].map(c => c.innerText.trim());
        if (!cells.length) return;

        // Split-row handling: empty first cell = continuation of previous label
        const label = cells[0] || lastLabel;
        if (cells[0]) lastLabel = cells[0];

        const per100 = per100Idx >= 0
          ? (cells[per100Idx] ?? cells[cells.length - 1])
          : cells[cells.length - 1];

        res.raw_rows.push({ label, per100 });
      });
    }

    // ── Accordion content extractor ────────────────────────────────────────
    const accordionItems = [...document.querySelectorAll('[data-testid="accordion-item"]')];
    const getAccordionText = (labelRe) => {
      const item = accordionItems.find(el =>
        labelRe.test(el.querySelector('.ds-c-accordion-item__label--text')?.innerText?.trim())
      );
      if (!item) return null;
      const details = item.querySelector('details');
      if (!details) return null;
      const clone = details.cloneNode(true);
      clone.querySelector('summary')?.remove();
      return clone.innerText.trim() || null;
    };

    res.raw_ingredients = getAccordionText(/^ingredients$/i);
    res.raw_allergens   = getAccordionText(/^allergen/i);

    return res;
  });

  // Clean ingredients text
  let ingredients = data.raw_ingredients || null;
  if (ingredients) {
    ingredients = ingredients.replace(/^ingredients?:\s*/i, '').trim();
    if (ingredients.length <= 3) ingredients = null;
  }

  // Clean allergens text
  let allergens = data.raw_allergens || null;
  if (allergens) {
    allergens = allergens.replace(/^allergen[s]?:\s*/i, '').trim();
    if (allergens.length <= 3) allergens = null;
  }

  const nutrition = buildNutrition(data.raw_rows);

  return {
    outcome: 'ok',
    status,
    clickResult,
    nutrition,
    ingredients,
    allergens,
    table_found: data.table_found,
  };
}

// ── Browser factory ───────────────────────────────────────────────────────────
async function launchBrowser() {
  return puppeteerExtra.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
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
  // Build slug lookup from original enriched data (url field)
  const origData = JSON.parse(fs.readFileSync(ORIG_FILE, 'utf8'));
  const origProds = origData.products || origData;
  const slugMap = {};  // uid → slug path
  origProds.forEach(p => {
    if (p.uid && p.url) {
      const slug = p.url.replace(/^https?:\/\/[^/]+/, '');
      slugMap[p.uid] = slug;
    }
  });

  const products   = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const cp         = loadCheckpoint();

  const toProcess  = products
    .filter(p => p.nutrition === null && slugMap[p.barcode.value])
    .filter(p => !cp.completed[p.barcode.value]);

  const totalTarget = products.filter(p => p.nutrition === null && slugMap[p.barcode.value]).length;
  const alreadyDone = totalTarget - toProcess.length;

  console.log(`Sainsbury's nutrition enricher`);
  console.log(`Target (null nutrition + known slug): ${totalTarget}`);
  console.log(`Already done (checkpoint):            ${alreadyDone}`);
  console.log(`Remaining this run:                   ${toProcess.length}`);
  console.log();

  const idxMap = new Map(products.map((p, i) => [p.barcode.value, i]));

  let browser   = await launchBrowser();
  let pageCount = 0;
  let nutritionFilled   = 0;
  let ingredientsFilled = 0;
  let allergensFilled   = 0;
  let delisted          = 0;
  let noSection         = 0;
  let errors            = 0;
  let processed         = 0;
  const pendingAudit    = [];

  const flush = () => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
    saveCheckpoint(cp);
    flushAudit(pendingAudit.splice(0));
  };

  for (const product of toProcess) {
    const uid  = product.barcode.value;
    const slug = slugMap[uid];
    const idx  = idxMap.get(uid);

    // Relaunch browser every RELAUNCH_EVERY pages
    if (pageCount > 0 && pageCount % RELAUNCH_EVERY === 0) {
      console.log(`  → relaunching browser at page ${pageCount}`);
      await browser.close().catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      browser = await launchBrowser();
    }

    const page = await makePage(browser);

    const audit = {
      uid,
      product_name:       product.product_name,
      slug,
      outcome:            null,
      nutrition_filled:   false,
      ingredients_filled: false,
      allergens_filled:   false,
      unit_converted:     false,
      error:              null,
      scraped_at:         new Date().toISOString(),
    };

    try {
      const result = await scrapePage(page, slug);
      audit.outcome = result.outcome;

      if (result.outcome === 'delisted') {
        delisted++;
      } else if (result.clickResult === 'no-accordion' || !result.table_found) {
        noSection++;
      } else {
        // Fill nutrition (fill-empty-only)
        if (result.nutrition !== null && products[idx].nutrition === null) {
          // Strip unit_converted flag from stored data
          const { unit_converted, ...nut } = result.nutrition;
          products[idx].nutrition = nut;
          nutritionFilled++;
          audit.nutrition_filled   = true;
          audit.unit_converted     = unit_converted;
        }
        // Fill ingredients
        if (result.ingredients && !products[idx].ingredients) {
          products[idx].ingredients = result.ingredients;
          ingredientsFilled++;
          audit.ingredients_filled = true;
        }
        // Fill allergens
        if (result.allergens && !products[idx].allergens?.length) {
          products[idx].allergens = [result.allergens];
          allergensFilled++;
          audit.allergens_filled = true;
        }
      }
    } catch (err) {
      errors++;
      audit.outcome = 'error';
      audit.error   = err.message;
      console.log(`  ✗ [${product.product_name.slice(0, 50)}]: ${err.message}`);
    } finally {
      await page.close().catch(() => {});
    }

    pendingAudit.push(audit);
    cp.completed[uid] = true;
    processed++;
    pageCount++;

    if (processed % CHECKPOINT_EVERY === 0) flush();

    if (processed % PROGRESS_EVERY === 0) {
      console.log(
        `[${alreadyDone + processed}/${products.length}] | ` +
        `nutrition filled: ${nutritionFilled} | ` +
        `ingredients filled: ${ingredientsFilled} | ` +
        `delisted/skipped: ${delisted} | ` +
        `no-section: ${noSection} | errors: ${errors}`
      );
    }

    await new Promise(r => setTimeout(r, 3000 + Math.random() * 3000));
  }

  flush();
  await browser.close().catch(() => {});

  console.log();
  console.log('══════════════════════════════════════════════');
  console.log('RUN COMPLETE');
  console.log(`Processed:           ${processed}`);
  console.log(`Nutrition filled:    ${nutritionFilled}`);
  console.log(`Ingredients filled:  ${ingredientsFilled}`);
  console.log(`Allergens filled:    ${allergensFilled}`);
  console.log(`Delisted (skipped):  ${delisted}`);
  console.log(`No-section:          ${noSection}`);
  console.log(`Errors:              ${errors}`);

  // ── Disk verification ──────────────────────────────────────────────────────
  console.log();
  console.log('══════════════════════════════════════════════');
  console.log('DISK VERIFICATION');

  const saved  = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const junkRe = /une eau min[eé]rale naturelle|acqua minerale|wasser|agua mineral/i;

  const vNut   = saved.filter(p => {
    const n = p.nutrition;
    return n && typeof n === 'object' &&
      Object.values(n).some(v => typeof v === 'number');
  }).length;
  const vIng   = saved.filter(p => p.ingredients && p.ingredients.length > 5).length;
  const vJunk  = saved.filter(p => p.ingredients && junkRe.test(p.ingredients)).length;
  const auditCount = fs.existsSync(AUDIT_FILE)
    ? JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8')).length : 0;

  console.log(`Total products:          ${saved.length}`);
  console.log(`Numeric nutrition:       ${vNut} / ${saved.length} (${(vNut/saved.length*100).toFixed(1)}%)`);
  console.log(`Non-empty ingredients:   ${vIng} / ${saved.length} (${(vIng/saved.length*100).toFixed(1)}%)`);
  console.log(`Junk ingredients:        ${vJunk} (must be 0)`);
  console.log(`Audit entries:           ${auditCount}`);

  const withNut = saved.filter(p => p.nutrition !== null);
  const samples = withNut.sort(() => Math.random() - 0.5).slice(0, 10);
  console.log();
  console.log('── 10 random samples ──');
  for (const p of samples) {
    const cal = p.nutrition?.calories_per_100g ?? '—';
    const ing = (p.ingredients || '(null)').slice(0, 60);
    console.log(`  ${p.product_name.slice(0, 52)}`);
    console.log(`    cal=${cal} | ${ing}`);
  }
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
