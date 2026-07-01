#!/usr/bin/env node
/**
 * off-barcode-enrichment.js
 *
 * Enriches product data from any store JSON file using the OpenFoodFacts API,
 * keyed by barcode/EAN. Only fills fields that are currently empty.
 *
 * Usage: node off-barcode-enrichment.js <path-to-dataset.json>
 */

const fs = require("fs");
const path = require("path");

const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";
const RATE_LIMIT_MS = 200;
const CHECKPOINT_EVERY = 50;

const WATER_KEYWORDS = [
  "eau minérale",
  "acqua minerale",
  "agua mineral",
  "wasser",
];

// ── CLI ──────────────────────────────────────────────────────────────────────

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node off-barcode-enrichment.js <path-to-dataset.json>");
  process.exit(1);
}

const absInput = path.resolve(inputPath);
if (!fs.existsSync(absInput)) {
  console.error(`File not found: ${absInput}`);
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fetch a URL with a 10-second timeout, returns parsed JSON or null. */
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "GrogoPipeline/1.0 (rengbas99@gmail.com)" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** Extract a barcode from a product object. Returns string or null. */
function extractBarcode(product) {
  // Explicit fields first
  const explicit = product.barcode || product.ean || product.gtin || product.upc;
  if (explicit) {
    const s = String(explicit).trim().replace(/\s+/g, "");
    if (/^\d{8,14}$/.test(s)) return s;
  }
  return null;
}

/** True if the nutrition object counts as empty. */
function isNutritionEmpty(product) {
  const n = product.nutrition;
  if (!n || typeof n !== "object") return true;
  const keys = Object.keys(n);
  if (keys.length === 0) return true;
  // All values falsy/zero → still empty
  return keys.every((k) => !n[k] || n[k] === 0);
}

/** True if ingredients field is empty. */
function isIngredientEmpty(product) {
  const v = product.ingredients;
  return !v || String(v).trim().length === 0;
}

/** True if allergens field is empty. */
function isAllergenEmpty(product) {
  const v = product.allergens;
  if (!v) return true;
  if (Array.isArray(v)) return v.length === 0;
  return String(v).trim().length === 0;
}

/**
 * Validate an OFF API response.
 * Returns the product object if valid, or null with a reason string.
 */
function validateOFF(data) {
  if (!data || data.status !== 1 || !data.product) {
    return { ok: false, reason: "not_found" };
  }
  const p = data.product;

  // Reject water / mineral water products by ingredients text
  const ingText = (p.ingredients_text || "").toLowerCase();
  for (const kw of WATER_KEYWORDS) {
    if (ingText.includes(kw.toLowerCase())) {
      return { ok: false, reason: "rejected_water" };
    }
  }

  // Require ingredients_text to be meaningful if it exists
  if (p.ingredients_text && p.ingredients_text.trim().length <= 5) {
    return { ok: false, reason: "rejected_short_ingredients" };
  }

  return { ok: true, product: p };
}

/**
 * Map OFF fields onto a product in-place.
 * Returns a per-field result object: { filled, already_had, skipped }.
 */
function mapOFFFields(product, offProduct) {
  const n = offProduct.nutriments || {};
  const result = {
    calories_per_100g: "skipped",
    fat: "skipped",
    carbs: "skipped",
    protein: "skipped",
    salt: "skipped",
    sugars: "skipped",
    ingredients: "skipped",
    allergens: "skipped",
    nutriscore: "skipped",
  };

  if (!product.nutrition || typeof product.nutrition !== "object") {
    product.nutrition = {};
  }

  // Helper: fill nutrition sub-field
  function fillNutrition(subKey, offValue, resultKey) {
    if (offValue == null) return;
    const existing = product.nutrition[subKey];
    if (existing != null && existing !== 0 && existing !== "") {
      result[resultKey] = "already_had";
      return;
    }
    product.nutrition[subKey] = offValue;
    result[resultKey] = "filled";
  }

  fillNutrition("calories_per_100g", n["energy-kcal_100g"], "calories_per_100g");
  fillNutrition("fat", n["fat_100g"], "fat");
  fillNutrition("carbs", n["carbohydrates_100g"], "carbs");
  fillNutrition("protein", n["proteins_100g"], "protein");
  fillNutrition("salt", n["salt_100g"], "salt");
  fillNutrition("sugars", n["sugars_100g"], "sugars");

  // Ingredients
  if (offProduct.ingredients_text && offProduct.ingredients_text.trim().length > 5) {
    if (!isIngredientEmpty(product)) {
      result.ingredients = "already_had";
    } else {
      product.ingredients = offProduct.ingredients_text.trim();
      result.ingredients = "filled";
    }
  }

  // Allergens — strip "en:" prefix from allergens_tags array
  if (Array.isArray(offProduct.allergens_tags) && offProduct.allergens_tags.length > 0) {
    const cleaned = offProduct.allergens_tags
      .map((t) => t.replace(/^[a-z]{2}:/, "").replace(/-/g, " "))
      .filter(Boolean);
    if (!isAllergenEmpty(product)) {
      result.allergens = "already_had";
    } else {
      product.allergens = cleaned.join(", ");
      result.allergens = "filled";
    }
  }

  // Nutriscore
  if (offProduct.nutriscore_grade) {
    if (product.nutriscore) {
      result.nutriscore = "already_had";
    } else {
      product.nutriscore = offProduct.nutriscore_grade.toLowerCase();
      result.nutriscore = "filled";
    }
  }

  return result;
}

// ── Stats accumulator ─────────────────────────────────────────────────────────

function makeStats() {
  const fields = [
    "calories_per_100g", "fat", "carbs", "protein",
    "salt", "sugars", "ingredients", "allergens", "nutriscore",
  ];
  const counts = { filled: {}, already_had: {}, skipped: {} };
  for (const f of fields) {
    counts.filled[f] = 0;
    counts.already_had[f] = 0;
    counts.skipped[f] = 0;
  }
  return {
    total: 0,
    no_barcode: 0,
    fetched: 0,
    not_found: 0,
    rejected_water: 0,
    rejected_short_ingredients: 0,
    fetch_error: 0,
    enriched: 0,
    fields: counts,
  };
}

function accumulateFieldStats(stats, fieldResult) {
  for (const [field, outcome] of Object.entries(fieldResult)) {
    if (stats.fields[outcome]?.[field] != null) {
      stats.fields[outcome][field]++;
    }
  }
}

function printReport(stats) {
  const line = "─".repeat(60);
  console.log(`\n${line}`);
  console.log("ENRICHMENT REPORT");
  console.log(line);
  console.log(`Total products:        ${stats.total}`);
  console.log(`No barcode:            ${stats.no_barcode}`);
  console.log(`Fetched from OFF:      ${stats.fetched}`);
  console.log(`  → Not found:         ${stats.not_found}`);
  console.log(`  → Rejected (water):  ${stats.rejected_water}`);
  console.log(`  → Rejected (short):  ${stats.rejected_short_ingredients}`);
  console.log(`  → Fetch error:       ${stats.fetch_error}`);
  console.log(`  → Enriched:          ${stats.enriched}`);
  console.log(`\nPer-field breakdown:`);

  const FIELD_COL = 20;
  const NUM_COL = 10;
  const header =
    "Field".padEnd(FIELD_COL) +
    "Filled".padStart(NUM_COL) +
    "Had Data".padStart(NUM_COL) +
    "No OFF Data".padStart(NUM_COL);
  console.log(header);
  console.log("─".repeat(FIELD_COL + NUM_COL * 3));

  for (const field of Object.keys(stats.fields.filled)) {
    const filled = stats.fields.filled[field];
    const had = stats.fields.already_had[field];
    const skipped = stats.fields.skipped[field];
    console.log(
      field.padEnd(FIELD_COL) +
        String(filled).padStart(NUM_COL) +
        String(had).padStart(NUM_COL) +
        String(skipped).padStart(NUM_COL)
    );
  }
  console.log(line);
}

// ── Load & detect structure ───────────────────────────────────────────────────

function loadDataset(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (Array.isArray(raw)) {
    return { wrapper: null, products: raw };
  }
  if (raw.products && Array.isArray(raw.products)) {
    return { wrapper: raw, products: raw.products };
  }
  throw new Error("Unrecognised JSON structure — expected array or { products: [] }");
}

function saveDataset(filePath, wrapper, products) {
  let output;
  if (wrapper === null) {
    output = products;
  } else {
    output = { ...wrapper, products };
  }
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
}

// ── Checkpoint ────────────────────────────────────────────────────────────────

function checkpointPath(inputFile) {
  const dir = path.dirname(inputFile);
  const base = path.basename(inputFile, ".json");
  // derive store name from filename (first word before hyphen or underscore)
  const store = base.split(/[-_]/)[0];
  return path.join(dir, `${store}-off-progress.json`);
}

function loadCheckpoint(cpPath) {
  if (fs.existsSync(cpPath)) {
    try {
      const cp = JSON.parse(fs.readFileSync(cpPath, "utf8"));
      console.log(
        `Resuming from checkpoint: ${cp.processedCount} products already done`
      );
      return cp;
    } catch {
      console.warn("Checkpoint file corrupt — starting fresh");
    }
  }
  return null;
}

function saveCheckpoint(cpPath, processedCount, stats) {
  fs.writeFileSync(
    cpPath,
    JSON.stringify({ processedCount, stats, savedAt: new Date().toISOString() }, null, 2)
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nOpenFoodFacts Barcode Enrichment`);
  console.log(`Input: ${absInput}\n`);

  let wrapper, products;
  try {
    ({ wrapper, products } = loadDataset(absInput));
  } catch (e) {
    console.error(`Failed to load dataset: ${e.message}`);
    process.exit(1);
  }
  console.log(`Loaded ${products.length} products`);

  const cpPath = checkpointPath(absInput);
  const checkpoint = loadCheckpoint(cpPath);

  const stats = checkpoint ? checkpoint.stats : makeStats();
  const startIndex = checkpoint ? checkpoint.processedCount : 0;

  let dirty = false; // track if any product was modified

  for (let i = startIndex; i < products.length; i++) {
    const product = products[i];
    stats.total++;

    const barcode = extractBarcode(product);
    if (!barcode) {
      stats.no_barcode++;
      // Progress dot every 50 for no-barcode
      if (stats.no_barcode % 50 === 0) process.stdout.write(".");
      continue;
    }

    // Only fetch if nutrition is empty (ingredients/allergens also checked per-field)
    if (!isNutritionEmpty(product)) {
      // Nutrition already present — still check other fields in mapping
    }

    stats.fetched++;
    process.stdout.write(`[${i + 1}/${products.length}] ${barcode} "${product.name}" ... `);

    await sleep(RATE_LIMIT_MS);

    const data = await fetchJson(`${OFF_BASE}/${barcode}.json`);
    if (!data) {
      stats.fetch_error++;
      console.log("FETCH ERROR");
      continue;
    }

    const { ok, reason, product: offProduct } = validateOFF(data);
    if (!ok) {
      stats[reason] = (stats[reason] || 0) + 1;
      console.log(reason.toUpperCase());
      continue;
    }

    const fieldResult = mapOFFFields(product, offProduct);
    accumulateFieldStats(stats, fieldResult);

    const anyFilled = Object.values(fieldResult).some((v) => v === "filled");
    if (anyFilled) {
      stats.enriched++;
      dirty = true;
      const filled = Object.entries(fieldResult)
        .filter(([, v]) => v === "filled")
        .map(([k]) => k)
        .join(", ");
      console.log(`OK → filled: ${filled}`);
    } else {
      console.log("OK → no new data");
    }

    // Checkpoint every N products
    if ((i + 1) % CHECKPOINT_EVERY === 0) {
      saveCheckpoint(cpPath, i + 1, stats);
      if (dirty) {
        saveDataset(absInput, wrapper, products);
        dirty = false;
        console.log(`  ✓ Checkpoint saved (${i + 1} done)`);
      }
    }
  }

  // Final save
  if (dirty) {
    saveDataset(absInput, wrapper, products);
  }

  // Remove checkpoint on successful completion
  if (fs.existsSync(cpPath)) {
    fs.unlinkSync(cpPath);
    console.log("\nCheckpoint removed (run complete)");
  }

  printReport(stats);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
