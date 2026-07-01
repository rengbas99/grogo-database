'use strict';

/**
 * probe-embedded-data.js
 *
 * Probes 3 products per store (Aldi, Sainsbury's, Iceland) and reports
 * whether the store's own product page exposes nutrition/ingredients/allergens
 * inside embedded JS blobs (__NEXT_DATA__, __APOLLO_STATE__, window globals, etc.)
 *
 * Reads only — no data files are modified.
 */

const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin  = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());

// ── Product URLs to probe ────────────────────────────────────────────────────

const PROBES = [
  // Aldi — we need INGREDIENTS
  {
    store: 'aldi',
    name:  'Sunflower Oil',
    url:   'https://www.aldi.co.uk/sunflower-oil/p/198481',
  },
  {
    store: 'aldi',
    name:  'British Rapeseed Oil',
    url:   'https://www.aldi.co.uk/specially-selected-british-rapeseed-oil/p/335573',
  },
  {
    store: 'aldi',
    name:  'Salted Cashews',
    url:   'https://www.aldi.co.uk/roasted-and-salted-cashews/p/282667',
  },

  // Sainsbury's — we need NUTRITION
  {
    store: 'sainsburys',
    name:  'Frylight Olive Oil Spray',
    url:   'https://www.sainsburys.co.uk/gol-ui/product/7578564',
  },
  {
    store: 'sainsburys',
    name:  'Sainsburys Vegetable Oil 1L',
    url:   'https://www.sainsburys.co.uk/gol-ui/product/6347',
  },
  {
    store: 'sainsburys',
    name:  'Sainsburys Olive Oil 1L',
    url:   'https://www.sainsburys.co.uk/gol-ui/product/115292',
  },

  // Iceland — we need NUTRITION
  {
    store: 'iceland',
    name:  "Crisp 'n Dry Rapeseed Oil 975ml",
    url:   'https://www.iceland.co.uk/p/crisp-n-dry-rapeseed-oil-975ml/46393.html',
  },
  {
    store: 'iceland',
    name:  'Pura Refined Vegetable Oil 2L',
    url:   'https://www.iceland.co.uk/p/pura-refined-vegetable-oil-2l/63776.html',
  },
  {
    store: 'iceland',
    name:  'Pura Refined Sunflower Oil 2L',
    url:   'https://www.iceland.co.uk/p/pura-refined-sunflower-oil-2l/63775.html',
  },
];

// ── Keys that signal useful data ─────────────────────────────────────────────

const NUTRITION_KEYS   = ['calories', 'energy', 'fat', 'carbohydrate', 'protein',
                           'salt', 'kcal', 'kj', 'nutritioninfo', 'nutritional',
                           'nutrients', 'per100g', 'per100', 'nf_'];
const INGREDIENT_KEYS  = ['ingredient', 'ingredients'];
const ALLERGEN_KEYS    = ['allergen', 'allergens', 'contains'];

function looksRelevant(key) {
  const k = key.toLowerCase();
  return [...NUTRITION_KEYS, ...INGREDIENT_KEYS, ...ALLERGEN_KEYS].some(kw => k.includes(kw));
}

// Recursively walk a parsed JSON object and collect paths to relevant keys.
// Returns array of { path, value }.
function findRelevantPaths(obj, pathSoFar = '', maxDepth = 12, results = []) {
  if (maxDepth <= 0 || obj === null || typeof obj !== 'object') return results;

  for (const [key, val] of Object.entries(obj)) {
    const fullPath = pathSoFar ? `${pathSoFar}.${key}` : key;

    if (looksRelevant(key)) {
      // Only store the value if it's non-empty
      const preview = typeof val === 'object'
        ? JSON.stringify(val).slice(0, 300)
        : String(val ?? '').slice(0, 300);

      if (preview && preview !== '{}' && preview !== '[]' && preview !== 'null' && preview !== '') {
        results.push({ path: fullPath, preview });
      }
    }

    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      findRelevantPaths(val, fullPath, maxDepth - 1, results);
    } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
      // Walk only the first element to keep things manageable
      findRelevantPaths(val[0], `${fullPath}[0]`, maxDepth - 1, results);
    }
  }

  return results;
}

// ── Browser helpers ──────────────────────────────────────────────────────────

function randomDelay(min = 3000, max = 6000) {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

async function probeUrl(browser, { store, name, url }) {
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1280, height: 900 });

  const result = {
    store, name, url,
    status: null,
    globals_found: [],
    relevant_paths: [],
    raw_sizes: {},
    error: null,
  };

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    result.status = response.status();
    await randomDelay(1500, 2500);

    // Extract all embedded JSON blobs from the page
    const blobs = await page.evaluate(() => {
      const out = {};

      // __NEXT_DATA__
      const nextScript = document.querySelector('#__NEXT_DATA__');
      if (nextScript) {
        try { out.__NEXT_DATA__ = JSON.parse(nextScript.textContent); } catch (_) {}
      }

      // window globals: walk window keys, try to JSON-serialise objects
      for (const key of Object.keys(window)) {
        if (
          key.startsWith('__') ||
          ['__APOLLO_STATE__', '__INITIAL_STATE__', '__REDUX_STATE__',
           '__APP_STATE__', '__PRELOADED_STATE__', 'dataLayer',
           '__NUXT__', 'pageData', 'serverData'].includes(key)
        ) {
          try {
            const v = window[key];
            if (v && typeof v === 'object') {
              const s = JSON.stringify(v);
              if (s.length > 10) out[key] = v;
            }
          } catch (_) {}
        }
      }

      // All <script> tags that look like JSON assignments (not module/src)
      const scripts = [...document.querySelectorAll('script:not([src])')];
      let jsonScriptIdx = 0;
      for (const s of scripts) {
        const t = s.textContent.trim();
        // Look for JSON-like blobs: starts with { or [
        const m = t.match(/^\s*[\[{]/);
        if (m) {
          try {
            const parsed = JSON.parse(t);
            if (typeof parsed === 'object') {
              out[`__inline_json_${jsonScriptIdx++}`] = parsed;
            }
          } catch (_) {}
        }
        // Look for window.X = {...} patterns
        const assign = t.match(/window\.(\w+)\s*=\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*;?$/);
        if (assign) {
          try {
            const parsed = JSON.parse(assign[2]);
            if (typeof parsed === 'object') out[`window.${assign[1]}`] = parsed;
          } catch (_) {}
        }
      }

      // application/ld+json
      const ldScripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
      ldScripts.forEach((s, i) => {
        try {
          out[`__ld_json_${i}`] = JSON.parse(s.textContent);
        } catch (_) {}
      });

      return out;
    });

    // Record what globals we found and their sizes
    for (const [key, val] of Object.entries(blobs)) {
      const size = JSON.stringify(val).length;
      result.globals_found.push({ key, size });
      result.raw_sizes[key] = size;

      // Walk for relevant paths
      if (typeof val === 'object') {
        const found = findRelevantPaths(val, key);
        result.relevant_paths.push(...found);
      }
    }

  } catch (err) {
    result.error = err.message;
  } finally {
    await page.close();
  }

  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  const browser = await puppeteerExtra.launch({
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const allResults = [];

  for (const probe of PROBES) {
    console.log(`\n[${probe.store.toUpperCase()}] ${probe.name}`);
    console.log(`  URL: ${probe.url}`);

    const result = await probeUrl(browser, probe);
    allResults.push(result);

    if (result.error) {
      console.log(`  ✗ Error: ${result.error}`);
    } else {
      console.log(`  HTTP ${result.status}`);
      console.log(`  Globals found: ${result.globals_found.map(g => `${g.key}(${g.size}b)`).join(', ') || 'none'}`);
      if (result.relevant_paths.length > 0) {
        console.log(`  ✓ RELEVANT PATHS (${result.relevant_paths.length}):`);
        // Deduplicate by path prefix to avoid noise
        const seen = new Set();
        for (const { path, preview } of result.relevant_paths) {
          const key = path.replace(/\.\w+\.\w+$/, ''); // group by parent
          if (!seen.has(key)) {
            seen.add(key);
            console.log(`    ${path}`);
            console.log(`      → ${preview.slice(0, 200)}`);
          }
        }
      } else {
        console.log('  ✗ No nutrition/ingredients/allergen keys found in any embedded data');
      }
    }

    await randomDelay(3000, 5000);
  }

  await browser.close();

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n\n══════════════ PROBE SUMMARY ══════════════');
  const stores = ['aldi', 'sainsburys', 'iceland'];
  for (const store of stores) {
    const storeResults = allResults.filter(r => r.store === store);
    const needsWhat = store === 'aldi' ? 'INGREDIENTS' : 'NUTRITION';
    console.log(`\n${store.toUpperCase()} (need: ${needsWhat})`);

    for (const r of storeResults) {
      const nutritionFound    = r.relevant_paths.filter(p => NUTRITION_KEYS.some(k => p.path.toLowerCase().includes(k)));
      const ingredientsFound  = r.relevant_paths.filter(p => INGREDIENT_KEYS.some(k => p.path.toLowerCase().includes(k)));
      const allergensFound    = r.relevant_paths.filter(p => ALLERGEN_KEYS.some(k => p.path.toLowerCase().includes(k)));

      console.log(`  ${r.name}`);
      if (r.error) {
        console.log(`    ERROR: ${r.error}`);
        continue;
      }
      console.log(`    nutrition in page:    ${nutritionFound.length   > 0 ? '✓ YES' : '✗ NO'}${nutritionFound[0]   ? ' @ ' + nutritionFound[0].path   : ''}`);
      console.log(`    ingredients in page: ${ingredientsFound.length > 0 ? '✓ YES' : '✗ NO'}${ingredientsFound[0] ? ' @ ' + ingredientsFound[0].path : ''}`);
      console.log(`    allergens in page:   ${allergensFound.length   > 0 ? '✓ YES' : '✗ NO'}${allergensFound[0]   ? ' @ ' + allergensFound[0].path   : ''}`);
    }
  }

  console.log('\n══════════════ SOURCING RECOMMENDATION ══════════════');
  console.log('Based on probe results:');
  for (const store of stores) {
    const storeResults = allResults.filter(r => r.store === store);
    const errors = storeResults.filter(r => r.error).length;
    if (errors === storeResults.length) {
      console.log(`  ${store}: all pages errored — cannot determine`);
      continue;
    }
    const hasIngredients = storeResults.some(r => r.relevant_paths.some(p => INGREDIENT_KEYS.some(k => p.path.toLowerCase().includes(k))));
    const hasNutrition   = storeResults.some(r => r.relevant_paths.some(p => NUTRITION_KEYS.some(k => p.path.toLowerCase().includes(k))));
    const needsIngredients = store === 'aldi';
    const needsNutrition   = store !== 'aldi';
    const canSelfSource = (needsIngredients && hasIngredients) || (needsNutrition && hasNutrition);
    console.log(`  ${store}: ${canSelfSource ? '✓ SCRAPE OWN PAGES' : '✗ NO — try OFF name-search or skip'}`);
    if (hasNutrition)    console.log(`    → nutrition found in embedded data`);
    if (hasIngredients)  console.log(`    → ingredients found in embedded data`);
  }
})();
