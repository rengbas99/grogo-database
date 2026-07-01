'use strict';

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'final-products');

// ── Junk detection ───────────────────────────────────────────────────────────
const JUNK_RE = /une eau min[eé]rale naturelle|acqua minerale naturelle|wasser|agua mineral/i;
function hasJunk(str) { return typeof str === 'string' && JUNK_RE.test(str); }

// ── Allergen normalisation ───────────────────────────────────────────────────
function toAllergenArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(s => String(s).trim()).filter(Boolean);
  if (typeof val === 'string') {
    if (!val.trim()) return [];
    return val.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

// ── Value parsers ────────────────────────────────────────────────────────────
// Extracts the first number from strings like "100.0g", "<0.5g", "8g)", "-"
function parseNum(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s || s === '-') return null;
  const m = s.match(/[<>~≈]?\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

// Extracts kcal from strings like "3700kJ / 900kcal", "526 kcal", "3404kJ/828kcal"
function parseKcal(val) {
  if (!val) return null;
  const s = String(val);
  const m = s.match(/(\d+(?:\.\d+)?)\s*kcal/i);
  if (m) return parseFloat(m[1]);
  // Fallback: bare number (might be kJ — only accept if no kJ marker present)
  if (!/kj/i.test(s)) {
    const n = s.match(/(\d+(?:\.\d+)?)/);
    if (n) return parseFloat(n[1]);
  }
  return null;
}

// ── Tesco nutritionalFacts → canonical nutrition ─────────────────────────────
// Maps every messy Tesco key variant to one of: calories|fat|saturates|carbs|sugars|protein|salt
const TESCO_KEY_MAP = {
  energy: 'calories',
  // fat
  fat: 'fat', 'fat - total': 'fat', 'total fat': 'fat',
  // saturates
  saturates: 'saturates',
  'of which saturates': 'saturates', '(of which saturates': 'saturates',
  'fat - saturated': 'saturates', 'of which saturated': 'saturates',
  'of which saturated fat': 'saturates',
  // carbs
  carbohydrate: 'carbs', carbohydrates: 'carbs',
  'total carbohydrate': 'carbs', 'of which carbohydrate': 'carbs',
  // sugars
  sugars: 'sugars', 'of which sugars': 'sugars',
  'of which sugar': 'sugars', '- sugars': 'sugars',
  'of which: sugars': 'sugars',
  // protein
  protein: 'protein',
  // salt
  salt: 'salt',
};

function normaliseTescoNutrition(nutritionalFacts) {
  if (!nutritionalFacts || typeof nutritionalFacts !== 'object') return null;

  const out = {
    calories_per_100g: null, fat: null, saturates: null,
    carbs: null, sugars: null, protein: null, salt: null,
  };
  let anySet = false;

  for (const [rawKey, rawVal] of Object.entries(nutritionalFacts)) {
    // Normalise key: lowercase, strip wrapping parens/spaces, strip trailing ")"
    const key = rawKey.toLowerCase().trim().replace(/^\(|\)$/g, '').trim();

    // Hard-skip metadata/non-nutrient keys
    if (key === 'measure' || key === 'reference' || key === 'fibre' ||
        key === 'fiber' || key.startsWith('omega') ||
        key.includes('monounsaturates') || key.includes('monunsaturates') ||
        key.includes('polyunsaturates') || key === 'mono-unsaturates' ||
        key.length > 50) continue;

    // Skip metadata rows where the value is "-" or a long sentence
    const valStr = String(rawVal ?? '').trim();
    if (valStr === '-' || valStr === '') continue;

    const canonical = TESCO_KEY_MAP[key];
    if (!canonical) continue;

    const field = canonical === 'calories' ? 'calories_per_100g' : canonical;
    if (out[field] !== null) continue; // first occurrence wins

    const parsed = canonical === 'calories' ? parseKcal(rawVal) : parseNum(rawVal);
    if (parsed !== null) { out[field] = parsed; anySet = true; }
  }

  return anySet ? out : null;
}

// ── Simple pass-through for stores already using numeric nutrition ────────────
function normaliseSimpleNutrition(nutrition) {
  if (!nutrition || typeof nutrition !== 'object') return null;
  const raw = nutrition;
  const out = {
    calories_per_100g: raw.calories_per_100g ?? null,
    fat:               raw.fat               ?? null,
    saturates:         raw.saturates         ?? raw.saturated_fat ?? null,
    carbs:             raw.carbs             ?? raw.carbohydrates ?? null,
    sugars:            raw.sugars            ?? null,
    protein:           raw.protein           ?? null,
    salt:              raw.salt              ?? null,
  };
  return Object.values(out).some(v => v !== null) ? out : null;
}

// ── Per-store normalisers ────────────────────────────────────────────────────
function normaliseTesco(p) {
  return {
    product_name:   p.productName  || null,
    nutrition:      normaliseTescoNutrition(p.nutritionalFacts),
    ingredients:    p.ingredients  || null,
    allergens:      toAllergenArray(p.allergens),
    barcode:        { value: p.id  || null, is_real_ean: false },
    source_store:   'tesco',
    needs_cleaning: false,
  };
}

function normaliseSainsbury(p) {
  return {
    product_name:   p.name         || null,
    nutrition:      normaliseSimpleNutrition(p.nutrition),
    ingredients:    p.ingredients  || null,
    allergens:      toAllergenArray(p.allergens),
    barcode:        { value: p.uid || null, is_real_ean: false },
    source_store:   'sainsburys',
    needs_cleaning: hasJunk(p.ingredients),
  };
}

function normaliseAldi(p) {
  return {
    product_name:   p.name         || null,
    nutrition:      normaliseSimpleNutrition(p.nutrition),
    ingredients:    p.ingredients  || null,
    allergens:      toAllergenArray(p.allergens),
    barcode:        { value: p.productId || null, is_real_ean: false },
    source_store:   'aldi',
    needs_cleaning: hasJunk(p.ingredients),
  };
}

function normaliseIceland(p) {
  return {
    product_name:   p.name         || null,
    nutrition:      normaliseSimpleNutrition(p.nutrition),
    ingredients:    p.ingredients  || null,
    allergens:      toAllergenArray(p.allergens),
    barcode:        { value: p.productId || null, is_real_ean: false },
    source_store:   'iceland',
    needs_cleaning: hasJunk(p.ingredients),
  };
}

// ── Load helper ──────────────────────────────────────────────────────────────
function loadProducts(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(raw) ? raw : (raw.products || []);
}

// ── Store configs ────────────────────────────────────────────────────────────
const STORES = [
  {
    name:      'tesco',
    inFile:    path.join(BASE, 'tesco/tesco-final-products-updated.json'),
    outFile:   path.join(BASE, 'tesco/tesco-normalised.json'),
    normalise: normaliseTesco,
  },
  {
    name:      'sainsburys',
    inFile:    path.join(BASE, 'sainsbury/sainsbury-final-products-enriched.json'),
    outFile:   path.join(BASE, 'sainsbury/sainsburys-normalised.json'),
    normalise: normaliseSainsbury,
  },
  {
    name:      'aldi',
    inFile:    path.join(BASE, 'aldi/aldi-final-products-enriched.json'),
    outFile:   path.join(BASE, 'aldi/aldi-normalised.json'),
    normalise: normaliseAldi,
  },
  {
    name:      'iceland',
    inFile:    path.join(BASE, 'iceland/iceland-final-products-enriched.json'),
    outFile:   path.join(BASE, 'iceland/iceland-normalised.json'),
    normalise: normaliseIceland,
  },
];

// ── Coverage helper ──────────────────────────────────────────────────────────
function pct(n, total) { return `${n}(${Math.round(n / total * 100)}%)`.padEnd(12); }

// ── Main ─────────────────────────────────────────────────────────────────────
const results = [];

for (const store of STORES) {
  const raw        = loadProducts(store.inFile);
  const normalised = raw.map(store.normalise);

  fs.writeFileSync(store.outFile, JSON.stringify(normalised, null, 2));

  const total = normalised.length;
  const c = {
    product_name:  normalised.filter(p => p.product_name).length,
    nutrition:     normalised.filter(p => p.nutrition !== null).length,
    ingredients:   normalised.filter(p => p.ingredients && p.ingredients.trim()).length,
    allergens:     normalised.filter(p => p.allergens.length > 0).length,
    needs_cleaning:normalised.filter(p => p.needs_cleaning).length,
  };
  results.push({ name: store.name, total, c });
  console.log(`✓ ${store.name}: ${total} products → ${store.outFile}`);
}

// ── Coverage table ───────────────────────────────────────────────────────────
console.log('\n══════════════════════════ COVERAGE TABLE (canonical keys) ══════════════════════════');
console.log('Store         Total   product_name  nutrition   ingredients  allergens   needs_cleaning');
console.log('─'.repeat(90));
for (const r of results) {
  const { total: t, c } = r;
  console.log(
    r.name.padEnd(14) +
    String(t).padEnd(8) +
    pct(c.product_name, t) +
    pct(c.nutrition, t) +
    pct(c.ingredients, t) +
    pct(c.allergens, t) +
    c.needs_cleaning
  );
}

// ── 3 samples per store ──────────────────────────────────────────────────────
for (const store of STORES) {
  const normalised = JSON.parse(fs.readFileSync(store.outFile, 'utf8'));
  // Prefer products with nutrition populated so we can verify parsing
  const withNutrition = normalised.filter(p => p.nutrition !== null);
  const samples = withNutrition.slice(0, 3);

  console.log(`\n━━━ ${store.name.toUpperCase()} — 3 samples with nutrition ━━━`);
  for (const p of samples) {
    console.log(`  name:        ${p.product_name}`);
    console.log(`  nutrition:   ${JSON.stringify(p.nutrition)}`);
    console.log(`  ingredients: ${(p.ingredients || '').slice(0, 100)}`);
    console.log(`  allergens:   ${JSON.stringify(p.allergens)}`);
    console.log(`  barcode:     ${JSON.stringify(p.barcode)}`);
    console.log(`  needs_cleaning: ${p.needs_cleaning}`);
    console.log();
  }
}
