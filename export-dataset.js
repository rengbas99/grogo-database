'use strict';

/**
 * export-dataset.js
 *
 * Merges all 4 normalised store files into:
 *   /dist/grogo-products.json      — clean JSON, all stores
 *   /dist/grogo-products.csv       — flat CSV
 *   /dist/quality-report.json      — per-store + per-field coverage
 *
 * Rules:
 *   - Strips price and internal store IDs (sell composition, not prices)
 *   - barcode.is_real_ean: false for Aldi/Iceland (slugs, not EAN-13s)
 *   - data_quality_score 0–100 by field completeness
 *   - needs_cleaning: any products still flagged are excluded from export
 */

const fs   = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'final-products');
const DIST = path.join(__dirname, 'dist');

// ── Store file configs ────────────────────────────────────────────────────────
const STORES = [
  { name: 'tesco',      file: 'tesco/tesco-normalised.json' },
  { name: 'sainsburys', file: 'sainsbury/sainsburys-normalised.json' },
  { name: 'aldi',       file: 'aldi/aldi-normalised.json' },
  { name: 'iceland',    file: 'iceland/iceland-normalised.json' },
];

// ── Data quality score ────────────────────────────────────────────────────────
// Weights reflect how important each field is for a product record
const WEIGHTS = {
  product_name:       25,  // always have this; base expectation
  nutrition_calories: 20,  // calories_per_100g present and numeric
  nutrition_macros:   15,  // at least fat + carbs + protein present
  ingredients:        20,  // non-empty string
  allergens:          10,  // array with ≥1 entry
  barcode:            10,  // has a barcode value (even if not real EAN)
};
// Total: 100

function qualityScore(p) {
  let score = 0;
  if (p.product_name) score += WEIGHTS.product_name;

  const n = p.nutrition;
  if (n && typeof n === 'object') {
    if (typeof n.calories_per_100g === 'number') score += WEIGHTS.nutrition_calories;
    if (typeof n.fat === 'number' && typeof n.carbs === 'number' && typeof n.protein === 'number')
      score += WEIGHTS.nutrition_macros;
  }

  if (p.ingredients && typeof p.ingredients === 'string' && p.ingredients.trim().length > 3)
    score += WEIGHTS.ingredients;

  if (Array.isArray(p.allergens) && p.allergens.length > 0)
    score += WEIGHTS.allergens;

  if (p.barcode?.value) score += WEIGHTS.barcode;

  return score;
}

// ── Flatten nutrition object for CSV ─────────────────────────────────────────
const NUT_FIELDS = ['calories_per_100g','fat','saturates','carbs','sugars','protein','salt'];

function nutVal(p, field) {
  return p.nutrition?.[field] ?? '';
}

// ── CSV helpers ───────────────────────────────────────────────────────────────
function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCSVRow(p) {
  return [
    p.product_name,
    p.source_store,
    p.barcode?.value ?? '',
    p.barcode?.is_real_ean ?? false,
    nutVal(p,'calories_per_100g'),
    nutVal(p,'fat'),
    nutVal(p,'saturates'),
    nutVal(p,'carbs'),
    nutVal(p,'sugars'),
    nutVal(p,'protein'),
    nutVal(p,'salt'),
    (p.ingredients || ''),
    (Array.isArray(p.allergens) ? p.allergens.join('; ') : (p.allergens || '')),
    p.data_quality_score,
  ].map(csvCell).join(',');
}

const CSV_HEADER = [
  'product_name','source_store','barcode','is_real_ean',
  'calories_per_100g','fat_g','saturates_g','carbs_g','sugars_g','protein_g','salt_g',
  'ingredients','allergens','data_quality_score',
].join(',');

// ── Coverage counters ─────────────────────────────────────────────────────────
function coverageStats(products) {
  const total = products.length;
  const has = (fn) => products.filter(fn).length;

  return {
    total,
    product_name:   has(p => !!p.product_name),
    nutrition:      has(p => p.nutrition && Object.values(p.nutrition).some(v => typeof v === 'number')),
    calories:       has(p => typeof p.nutrition?.calories_per_100g === 'number'),
    ingredients:    has(p => p.ingredients && p.ingredients.trim().length > 3),
    allergens:      has(p => Array.isArray(p.allergens) && p.allergens.length > 0),
    barcode:        has(p => !!p.barcode?.value),
    real_ean:       has(p => p.barcode?.is_real_ean === true),
    quality_avg:    Math.round(products.reduce((s, p) => s + p.data_quality_score, 0) / total),
    quality_ge50:   has(p => p.data_quality_score >= 50),
    quality_ge75:   has(p => p.data_quality_score >= 75),
  };
}

function pct(n, total) { return +(n / total * 100).toFixed(1); }

// ── Main ──────────────────────────────────────────────────────────────────────
const allProducts = [];
const storeReports = {};

for (const { name, file } of STORES) {
  const raw = JSON.parse(fs.readFileSync(path.join(BASE, file), 'utf8'));
  const arr = Array.isArray(raw) ? raw : (raw.products || []);

  // Exclude any product still flagged needs_cleaning
  const dirty = arr.filter(p => p.needs_cleaning).length;
  if (dirty > 0) console.log(`⚠  ${name}: ${dirty} products excluded (needs_cleaning)`);

  const clean = arr.filter(p => !p.needs_cleaning).map(p => {
    // Build export product — strip price, strip internal IDs, add score
    const exported = {
      product_name:       p.product_name || null,
      source_store:       p.source_store || name,
      barcode: {
        value:       p.barcode?.value || null,
        is_real_ean: p.barcode?.is_real_ean ?? false,
      },
      nutrition:    p.nutrition    || null,
      ingredients:  p.ingredients  || null,
      allergens:    Array.isArray(p.allergens) ? p.allergens : [],
    };
    exported.data_quality_score = qualityScore(exported);
    return exported;
  });

  const stats = coverageStats(clean);
  storeReports[name] = {
    ...stats,
    excluded_dirty: dirty,
    pct_nutrition:    pct(stats.nutrition, stats.total),
    pct_calories:     pct(stats.calories, stats.total),
    pct_ingredients:  pct(stats.ingredients, stats.total),
    pct_allergens:    pct(stats.allergens, stats.total),
    pct_quality_ge50: pct(stats.quality_ge50, stats.total),
    pct_quality_ge75: pct(stats.quality_ge75, stats.total),
  };

  allProducts.push(...clean);
  console.log(`✓ ${name}: ${clean.length} products`);
}

// ── Overall stats ─────────────────────────────────────────────────────────────
const overall = coverageStats(allProducts);
const overallReport = {
  ...overall,
  pct_nutrition:    pct(overall.nutrition, overall.total),
  pct_calories:     pct(overall.calories, overall.total),
  pct_ingredients:  pct(overall.ingredients, overall.total),
  pct_allergens:    pct(overall.allergens, overall.total),
  pct_quality_ge50: pct(overall.quality_ge50, overall.total),
  pct_quality_ge75: pct(overall.quality_ge75, overall.total),
};

// ── Write outputs ─────────────────────────────────────────────────────────────
// JSON
fs.writeFileSync(
  path.join(DIST, 'grogo-products.json'),
  JSON.stringify(allProducts, null, 2)
);
console.log(`\n✓ grogo-products.json written (${allProducts.length} products)`);

// CSV
const csvRows = [CSV_HEADER, ...allProducts.map(toCSVRow)];
fs.writeFileSync(path.join(DIST, 'grogo-products.csv'), csvRows.join('\n'));
console.log(`✓ grogo-products.csv written`);

// Quality report
const qualityReport = {
  generated_at: new Date().toISOString(),
  overall:      overallReport,
  by_store:     storeReports,
  field_weights: WEIGHTS,
  notes: [
    'barcode.is_real_ean=false for Aldi and Iceland (slugs/internal IDs, not EAN-13)',
    'needs_cleaning products excluded from export',
    'data_quality_score: 0-100 weighted by field completeness',
    'nutrition values are per 100g/ml, numeric',
  ],
};
fs.writeFileSync(
  path.join(DIST, 'quality-report.json'),
  JSON.stringify(qualityReport, null, 2)
);
console.log(`✓ quality-report.json written`);

// ── Print quality report to console ──────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════');
console.log('QUALITY REPORT');
console.log('══════════════════════════════════════════════════════════');
console.log(`Total products exported: ${overall.total}`);
console.log(`  Quality ≥50:  ${overall.quality_ge50} (${overallReport.pct_quality_ge50}%)`);
console.log(`  Quality ≥75:  ${overall.quality_ge75} (${overallReport.pct_quality_ge75}%)`);
console.log(`  Avg score:    ${overall.quality_avg}`);
console.log();
console.log('Per-field coverage (all stores):');
console.log(`  product_name:    ${overall.product_name} / ${overall.total} (${pct(overall.product_name, overall.total)}%)`);
console.log(`  nutrition:       ${overall.nutrition} / ${overall.total} (${overallReport.pct_nutrition}%)`);
console.log(`  calories:        ${overall.calories} / ${overall.total} (${overallReport.pct_calories}%)`);
console.log(`  ingredients:     ${overall.ingredients} / ${overall.total} (${overallReport.pct_ingredients}%)`);
console.log(`  allergens:       ${overall.allergens} / ${overall.total} (${overallReport.pct_allergens}%)`);
console.log(`  barcode:         ${overall.barcode} / ${overall.total} (${pct(overall.barcode, overall.total)}%)`);
console.log(`  real EAN:        ${overall.real_ean} / ${overall.total} (${pct(overall.real_ean, overall.total)}%)`);
console.log();
console.log('By store:');
const storeFields = ['total','nutrition','pct_nutrition','calories','pct_calories','ingredients','pct_ingredients','allergens','pct_allergens','quality_avg'];
for (const [store, s] of Object.entries(storeReports)) {
  console.log(`  ${store.padEnd(12)} total=${s.total} | nutrition=${s.nutrition}(${s.pct_nutrition}%) | ingredients=${s.ingredients}(${s.pct_ingredients}%) | allergens=${s.allergens}(${s.pct_allergens}%) | avg_score=${s.quality_avg}`);
}
