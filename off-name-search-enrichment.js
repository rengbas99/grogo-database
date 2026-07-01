#!/usr/bin/env node
/**
 * off-name-search-enrichment.js
 *
 * Enriches product data using OpenFoodFacts name-search with strict validation.
 * Precision over coverage — wrong matches are worse than no match.
 *
 * Usage:
 *   node off-name-search-enrichment.js <path-to-dataset.json> [--limit N] [--dry-run]
 *
 * --limit N   process only the first N products (default: all)
 * --dry-run   fetch and score but do NOT write changes to the dataset
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// ── Config ───────────────────────────────────────────────────────────────────

const OFF_SEARCH = "https://world.openfoodfacts.org/cgi/search.pl";
const RATE_LIMIT_MS  = 600;
const CHECKPOINT_EVERY = 25;
const PAGE_SIZE = 5;

const WATER_PHRASES = [
  "eau minérale",
  "acqua minerale",
  "acqua",
  "agua mineral",
  "wasser",
];

const MIN_SCORE = 0.6;

const STOPWORDS = new Set(["the", "of", "and", "a", "an", "with", "in", "for", "to"]);

// Name-level backstop: reject if matched name contains these words and ours doesn't.
const DRIFT_WORDS = [
  "crisps", "chips", "seasoning", "herbs", "flavour", "flavor", "sauce",
  "snack", "spread", "dressing", "blend", "mix", "soup", "crackers",
  "biscuits", "bar", "drink", "juice", "powder", "paste", "cubes",
  "fresh", "egg",
];

// OFF categories_tags slugs (after stripping "en:" prefix) that mark a
// product as processed/packaged — not a raw ingredient.
const PROCESSED_CATEGORIES = new Set([
  "snacks", "crisps", "chips", "seasonings", "sauces", "spreads",
  "dressings", "condiments", "biscuits", "crackers", "confectionery",
  "beverages", "desserts", "prepared-dishes", "snack-foods",
  "salted-snacks", "fried-snacks", "flavoured-crisps",
]);

// Words in OUR product name that signal we expect a fresh/raw product.
const FRESH_NAME_WORDS = new Set([
  "pepper", "peppers", "chilli", "garlic", "onion", "onions",
  "tomato", "tomatoes", "carrot", "carrots", "broccoli", "cauliflower",
  "spinach", "kale", "courgette", "cucumber", "mushroom", "mushrooms",
  "potato", "potatoes", "leek", "leeks", "lettuce", "avocado",
  "apple", "apples", "banana", "bananas", "mango", "strawberry",
  "strawberries", "blueberry", "blueberries", "raspberry", "raspberries",
  "lemon", "lemons", "lime", "limes", "orange", "oranges", "grape",
  "grapes", "pear", "pears", "peach", "peaches", "plum", "plums",
  "cherry", "cherries", "ginger", "celery", "asparagus", "artichoke",
  "beetroot", "parsnip", "swede", "turnip", "radish",
]);

// Words in OUR name that indicate an animal-derived product.
const MEAT_DAIRY_WORDS = new Set([
  "chicken","beef","pork","lamb","turkey","fish","salmon","tuna",
  "bacon","sausage","ham","milk","cheese","butter","egg",
]);

// OFF labels_tags that flag a plant-based substitute.
const VEGAN_LABELS = new Set([
  "en:vegan","en:vegetarian","en:plant-based","en:meat-free","en:dairy-free-alternative",
]);

// Phrases in the OFF product NAME that betray a plant-based substitute.
const VEGAN_NAME_MARKERS = [
  "isn't","not ","no-","vegan","plant-based","meat-free","alternative","free from",
];

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const inputPath = args.find(a => !a.startsWith("--"));
const limitArg  = args.find(a => a.startsWith("--limit=")) || args.find(a => a === "--limit");
const dryRun    = args.includes("--dry-run");

if (!inputPath) {
  console.error(
    "Usage: node off-name-search-enrichment.js <dataset.json> [--limit N] [--dry-run]"
  );
  process.exit(1);
}

let limitIndex = args.indexOf("--limit");
const limit = limitArg
  ? (limitArg.includes("=") ? parseInt(limitArg.split("=")[1]) : parseInt(args[limitIndex + 1]))
  : Infinity;

const absInput = path.resolve(inputPath);
if (!fs.existsSync(absInput)) {
  console.error(`File not found: ${absInput}`);
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const FETCH_HEADERS = { "User-Agent": "GrogoPipeline/1.0 (rengbas99@gmail.com)" };

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;
      // non-200 → retryable
      if (attempt < maxRetries) {
        const wait = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (attempt < maxRetries) {
        const wait = 1000 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
}

async function fetchJson(url) {
  try {
    const res = await fetchWithRetry(url, { headers: FETCH_HEADERS });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Name cleaning ────────────────────────────────────────────────────────────

/**
 * Clean a product name for search.
 * Priority: use the human-readable `name` field if present and non-trivial.
 * Fallback: extract from productId slug by stripping trailing numeric IDs
 * and normalising hyphens.
 *
 * Examples:
 *   productId "solesta-sunflower-oil-000000000000198481" → "solesta sunflower oil"
 *   productId "crisp-n-dry-rapeseed-oil-975ml/46393.html" → "crisp n dry rapeseed oil 975ml"
 */
function cleanProductName(product) {
  // Prefer the `name` field — it's already human-readable for Aldi/Iceland
  const rawName = (product.name || "").trim();
  if (rawName.length >= 3) return rawName;

  // Fallback: extract from productId
  const pid = String(product.productId || product.id || "");
  return cleanFromSlug(pid);
}

function cleanFromSlug(slug) {
  // Remove file extensions and query strings
  let s = slug.split("?")[0].replace(/\.html?$/i, "");
  // Drop trailing numeric article numbers (8+ consecutive digits, possibly with leading zeros)
  s = s.replace(/-0{3,}\d+$/, "");
  // Normalise path separators to hyphens
  s = s.replace(/\//g, "-");
  // Replace hyphens with spaces, collapse whitespace
  s = s.replace(/-+/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Build the search query. If the product has a brand that isn't just a
 * capitalised version of the product name, prepend it for specificity.
 */
function buildSearchQuery(product) {
  const name  = cleanProductName(product);
  const brand = (product.brand || "").trim();

  // Skip trivially matching or empty brands
  if (!brand || brand.toLowerCase() === name.toLowerCase()) return name;
  // Avoid brands that are just single words matching a name token
  const nameTokens = tokenise(name);
  const brandTokens = tokenise(brand);
  const brandAlreadyInName = brandTokens.every(t => nameTokens.includes(t));
  if (brandAlreadyInName) return name;

  return `${brand} ${name}`;
}

/**
 * Normalise a raw product name for OFF search. Reusable across stores.
 * Returns { full_clean, core_only } where:
 *   full_clean  — brand + product, size/pack tokens stripped
 *   core_only   — same but first token (likely brand) dropped
 *
 * Examples:
 *   "Crisp 'n Dry Rapeseed Oil 975ml" → { full_clean: "Crisp n Dry Rapeseed Oil",
 *                                          core_only:  "n Dry Rapeseed Oil" }
 *   "Schwartz Garlic Granules 50g"    → { full_clean: "Schwartz Garlic Granules",
 *                                          core_only:  "Garlic Granules" }
 *   "British Rapeseed Oil"            → { full_clean: "British Rapeseed Oil",
 *                                          core_only:  "Rapeseed Oil" }
 */
function cleanSearchQuery(rawName) {
  let s = rawName
    .replace(/[''`]/g, "")          // strip apostrophes
    .replace(/&/g, "and")           // & → and
    .replace(/[^\w\s]/g, " ");      // remaining punctuation → space

  // Strip in order: multipack first (so "6x23g" goes before plain "g" rule)
  s = s.replace(/\d+\s*x\s*\d+\s*\w*/gi, "");            // 6x23g, 4 x 30g
  s = s.replace(/\bx\s*\d+\b/gi, "");                     // trailing x6, x12
  s = s.replace(/\d+\s*(ml|cl|litre[s]?|liter[s]?)\b/gi, ""); // ml, cl, litres
  s = s.replace(/\d+\s*l\b/gi, "");                        // standalone 2L
  s = s.replace(/\d+\s*(kg|mg)\b/gi, "");                  // kg, mg (before plain g)
  s = s.replace(/\d+\s*g\b/gi, "");                        // plain grams
  s = s.replace(/\d+\s*(pack|pk|rolls?|pads?|sheets?|bags?|sachets?|count|ct)\b/gi, "");
  s = s.replace(/\b\d+\b/g, "");                           // stray standalone digits

  s = s.replace(/\s+/g, " ").trim();
  const full_clean = s;

  // core_only: drop the first token (typically the brand name)
  const tokens = full_clean.split(" ").filter(Boolean);
  const core_only = tokens.length > 1 ? tokens.slice(1).join(" ") : full_clean;

  return { full_clean, core_only };
}

// ── Token similarity ─────────────────────────────────────────────────────────

function tokenise(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Score = (tokens in our name that appear in candidate name) / (total tokens in our name).
 * Uses the clean `name` (not the full query) so brand prefix doesn't inflate the denominator.
 */
function scoreSimilarity(ourName, candidateName) {
  const ours = tokenise(ourName);
  const theirs = new Set(tokenise(candidateName));
  if (ours.length === 0) return 0;
  const matches = ours.filter(t => theirs.has(t)).length;
  return matches / ours.length;
}

// ── Validation gate ──────────────────────────────────────────────────────────

/** Tokens in a name that are not stopwords and not single characters. */
function meaningfulTokens(name) {
  return tokenise(name).filter(t => !STOPWORDS.has(t) && t.length > 1);
}

/**
 * Returns { ok: true, confidence } or { ok: false, reason }.
 * confidence is "high" (UK-tagged) or "medium" (untagged but not foreign).
 *
 * Guards applied in order:
 *   1. Base score threshold (scaled by meaningful-token count in our name)
 *   2. Must have nutriments
 *   3. Category-drift rejection
 *   4. Confidence hierarchy (UK / non-UK / foreign-only)
 *   5. Water-placeholder junk check
 */
function validateCandidate(offProduct, score, ourName) {
  // ── GUARD 1: Short-name strictness ─────────────────────────────────────────
  const ourTokens     = meaningfulTokens(ourName);
  const ourTokenCount = ourTokens.length;

  if (ourTokenCount === 1) {
    // Single-token name: very strict — score must be 0.90+ AND matched name
    // must be exactly 1 token, so "Garlic" can match "garlic" but NOT
    // "garlic herbs" (2 tokens) or "garlic & herbs seasoning".
    const matchedTokenCount = tokenise(
      offProduct.product_name || offProduct.product_name_en || ""
    ).length;
    if (score < 0.90 || matchedTokenCount > 1) {
      return { ok: false, reason: "short-name-low-score" };
    }
  } else if (ourTokenCount === 2) {
    if (score < 0.75) {
      return { ok: false, reason: `score_${score.toFixed(2)}_below_threshold` };
    }
  } else {
    // 3+ meaningful tokens: standard threshold
    if (score < MIN_SCORE) {
      return { ok: false, reason: `score_${score.toFixed(2)}_below_threshold` };
    }
  }

  // ── Must have nutriments ────────────────────────────────────────────────────
  const n = offProduct.nutriments || {};
  if (Object.keys(n).length === 0) {
    return { ok: false, reason: "no_nutriments" };
  }

  // ── GUARD 2: Category-aware drift rejection ────────────────────────────────
  const ourTokenSet = new Set(tokenise(ourName));

  // 2a. Name-level backstop: reject if matched name has a drift word ours lacks.
  const matchedNameSet = new Set(tokenise(
    offProduct.product_name || offProduct.product_name_en || ""
  ));
  for (const word of DRIFT_WORDS) {
    if (matchedNameSet.has(word) && !ourTokenSet.has(word)) {
      return { ok: false, reason: "category-drift" };
    }
  }

  // 2b. Category-tag mismatch: if our name implies FRESH, reject any OFF
  //     product whose categories_tags fall in the PROCESSED bucket.
  const ourImpliesFresh = (
    [...ourTokenSet].some(t => FRESH_NAME_WORDS.has(t)) &&
    !DRIFT_WORDS.some(w => ourTokenSet.has(w))
  );

  if (ourImpliesFresh) {
    // Match the FULL normalised tag slug against PROCESSED_CATEGORIES — never
    // split into individual tokens, or "en:plant-based-foods-and-beverages"
    // would falsely hit "beverages" and reject fresh produce.
    const offTagSlugs = (offProduct.categories_tags || [])
      .map(t => t.replace(/^[a-z]{2}:/, "").replace(/-/g, " ").trim());

    // Also check comma-separated items in the free-text categories field.
    const offCatItems = (offProduct.categories || "")
      .toLowerCase()
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const allOffCats = [...offTagSlugs, ...offCatItems];
    const isProcessed = allOffCats.some(cat => PROCESSED_CATEGORIES.has(cat));
    if (isProcessed) {
      return { ok: false, reason: "category-mismatch" };
    }
  }

  // ── GUARD 3: Plant-substitute mismatch ─────────────────────────────────────
  // Reject plant-based analogues when our name names real meat/dairy.
  const ourHasMeat = [...ourTokenSet].some(t => MEAT_DAIRY_WORDS.has(t));
  if (ourHasMeat) {
    const offLabels    = offProduct.labels_tags || [];
    const offNameLower = (offProduct.product_name || offProduct.product_name_en || "").toLowerCase();
    const isPlantSub   = (
      offLabels.some(l => VEGAN_LABELS.has(l)) ||
      VEGAN_NAME_MARKERS.some(m => offNameLower.includes(m))
    );
    if (isPlantSub) return { ok: false, reason: "plant-substitute-mismatch" };
  }

  // ── Confidence hierarchy ────────────────────────────────────────────────────
  const countries = offProduct.countries_tags || [];
  const hasUK     = countries.includes("en:united-kingdom");
  const hasNonUK  = countries.length > 0 && !hasUK;

  const ing    = (offProduct.ingredients_text || "").toLowerCase();
  const isJunk = ["eau minérale", "acqua", "wasser", "agua mineral"]
                   .some(x => ing.includes(x));

  if (isJunk)   return { ok: false, reason: "placeholder-junk" };
  if (hasNonUK) return { ok: false, reason: "non-uk-country" };

  const confidence = hasUK ? "high" : "medium";
  return { ok: true, confidence };
}

// ── Field mapping ─────────────────────────────────────────────────────────────

function isNutritionEmpty(product) {
  const n = product.nutrition;
  if (!n || typeof n !== "object") return true;
  const keys = Object.keys(n);
  if (keys.length === 0) return true;
  return keys.every(k => !n[k] || n[k] === 0);
}

function isStringEmpty(val) {
  if (!val) return true;
  if (Array.isArray(val)) return val.length === 0;
  return String(val).trim().length === 0;
}

/** Fill empty fields only. Returns per-field outcome map. */
function applyEnrichment(product, offProduct) {
  const n = offProduct.nutriments || {};
  const outcomes = {};

  if (!product.nutrition || typeof product.nutrition !== "object") {
    product.nutrition = {};
  }

  function fillNutrient(subKey, offKey, label) {
    const val = n[offKey];
    if (val == null) { outcomes[label] = "no_off_data"; return; }
    const existing = product.nutrition[subKey];
    if (existing != null && existing !== 0 && existing !== "") {
      outcomes[label] = "already_had"; return;
    }
    product.nutrition[subKey] = val;
    outcomes[label] = "filled";
  }

  fillNutrient("calories_per_100g", "energy-kcal_100g",    "calories_per_100g");
  fillNutrient("fat",               "fat_100g",            "fat");
  fillNutrient("carbs",             "carbohydrates_100g",  "carbs");
  fillNutrient("protein",           "proteins_100g",       "protein");
  fillNutrient("salt",              "salt_100g",           "salt");
  fillNutrient("sugars",            "sugars_100g",         "sugars");

  // Ingredients
  const ingText = (offProduct.ingredients_text || "").trim();
  if (!ingText) {
    outcomes.ingredients = "no_off_data";
  } else if (!isStringEmpty(product.ingredients)) {
    outcomes.ingredients = "already_had";
  } else {
    product.ingredients = ingText;
    outcomes.ingredients = "filled";
  }

  // Allergens — strip "en:" language prefix, humanise tag names
  const allergenTags = offProduct.allergens_tags || [];
  if (allergenTags.length === 0) {
    outcomes.allergens = "no_off_data";
  } else if (!isStringEmpty(product.allergens)) {
    outcomes.allergens = "already_had";
  } else {
    product.allergens = allergenTags
      .map(t => t.replace(/^[a-z]{2}:/, "").replace(/-/g, " "))
      .filter(Boolean)
      .join(", ");
    outcomes.allergens = "filled";
  }

  // Nutriscore
  const grade = offProduct.nutriscore_grade;
  if (!grade) {
    outcomes.nutriscore = "no_off_data";
  } else if (product.nutriscore) {
    outcomes.nutriscore = "already_had";
  } else {
    product.nutriscore = grade.toLowerCase();
    outcomes.nutriscore = "filled";
  }

  return outcomes;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function makeStats() {
  return {
    total: 0,
    skipped_has_nutrition: 0,
    fetched: 0,
    fetch_error: 0,
    no_results: 0,
    no_confident_match: 0,
    enriched: 0,
    accepted_high: 0,
    accepted_medium: 0,
    rejections: {
      score_below_threshold: 0,
      short_name_low_score: 0,
      no_nutriments: 0,
      category_drift: 0,
      category_mismatch: 0,
      plant_substitute_mismatch: 0,
      non_uk_country: 0,
      placeholder_junk: 0,
    },
    fields: {
      filled: {},
      already_had: {},
      no_off_data: {},
    },
  };
}

const FIELD_NAMES = [
  "calories_per_100g", "fat", "carbs", "protein",
  "salt", "sugars", "ingredients", "allergens", "nutriscore",
];

function initFieldStats(stats) {
  for (const bucket of Object.keys(stats.fields)) {
    for (const f of FIELD_NAMES) stats.fields[bucket][f] = 0;
  }
}

function accFieldStats(stats, outcomes) {
  for (const [field, outcome] of Object.entries(outcomes)) {
    const bucket = outcome === "filled" ? "filled"
                 : outcome === "already_had" ? "already_had"
                 : "no_off_data";
    if (stats.fields[bucket][field] != null) stats.fields[bucket][field]++;
  }
}

function printReport(stats, matchLog) {
  const L = 68;
  const line = "─".repeat(L);

  console.log(`\n${line}`);
  console.log("ENRICHMENT REPORT");
  console.log(line);
  console.log(`Products processed:       ${stats.total}`);
  console.log(`Skipped (had nutrition):  ${stats.skipped_has_nutrition}`);
  console.log(`Fetched from OFF:         ${stats.fetched}`);
  console.log(`  → Fetch error:          ${stats.fetch_error}`);
  console.log(`  → No results:           ${stats.no_results}`);
  console.log(`  → No confident match:   ${stats.no_confident_match}`);
  console.log(`     (score < thresh):    ${stats.rejections.score_below_threshold}`);
  console.log(`     (short-name guard):  ${stats.rejections.short_name_low_score}`);
  console.log(`     (no nutriments):     ${stats.rejections.no_nutriments}`);
  console.log(`     (name drift):        ${stats.rejections.category_drift}`);
  console.log(`     (category mismatch): ${stats.rejections.category_mismatch}`);
  console.log(`     (plant substitute):  ${stats.rejections.plant_substitute_mismatch}`);
  console.log(`     (non-UK country):    ${stats.rejections.non_uk_country}`);
  console.log(`     (water junk):        ${stats.rejections.placeholder_junk}`);
  console.log(`  → Enriched:             ${stats.enriched}`);
  console.log(`     (confidence high):   ${stats.accepted_high}`);
  console.log(`     (confidence medium): ${stats.accepted_medium}`);

  if (dryRun) console.log(`\n[DRY RUN] No changes written to disk`);

  console.log(`\nPer-field breakdown:`);
  const FC = 20, NC = 11;
  console.log(
    "Field".padEnd(FC) +
    "Filled".padStart(NC) +
    "Had Data".padStart(NC) +
    "No OFF Data".padStart(NC)
  );
  console.log("─".repeat(FC + NC * 3));
  for (const f of FIELD_NAMES) {
    console.log(
      f.padEnd(FC) +
      String(stats.fields.filled[f]).padStart(NC) +
      String(stats.fields.already_had[f]).padStart(NC) +
      String(stats.fields.no_off_data[f]).padStart(NC)
    );
  }

  // Random spot-check sample (10 accepted matches, mixing high and medium)
  const accepted = matchLog.filter(m => m.accepted);
  if (accepted.length > 0) {
    const SAMPLE_SIZE = 10;
    let sample;
    if (accepted.length <= SAMPLE_SIZE) {
      sample = [...accepted];
    } else {
      // Reservoir sample so high and medium are both represented
      const high   = accepted.filter(m => m.confidence === "high");
      const medium = accepted.filter(m => m.confidence === "medium");
      const pickN  = (arr, n) => {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy.slice(0, n);
      };
      const nMedium  = Math.min(medium.length, Math.floor(SAMPLE_SIZE / 3));
      const nHigh    = Math.min(high.length,   SAMPLE_SIZE - nMedium);
      sample = [...pickN(high, nHigh), ...pickN(medium, nMedium)];
    }

    console.log(`\n${line}`);
    console.log(`SPOT-CHECK SAMPLE (${sample.length} random accepted matches)`);
    console.log(line);
    const COL = [28, 36, 7, 8, 20];
    const header =
      "Our Name".padEnd(COL[0]) +
      "Matched OFF Name".padEnd(COL[1]) +
      "Score".padEnd(COL[2]) +
      "Conf".padEnd(COL[3]) +
      "Country Tags";
    console.log(header);
    console.log("─".repeat(COL[0] + COL[1] + COL[2] + COL[3] + COL[4]));
    for (const m of sample) {
      console.log(
        m.our_name.slice(0, COL[0] - 1).padEnd(COL[0]) +
        m.matched_off_name.slice(0, COL[1] - 1).padEnd(COL[1]) +
        m.score.toFixed(2).padEnd(COL[2]) +
        (m.confidence || "?").padEnd(COL[3]) +
        m.country_tags.slice(0, COL[4])
      );
    }
  } else {
    console.log("\nNo confident matches found.");
  }

  console.log(line);
}

// ── Dataset I/O ───────────────────────────────────────────────────────────────

function loadDataset(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (Array.isArray(raw)) return { wrapper: null, products: raw };
  if (raw.products && Array.isArray(raw.products))
    return { wrapper: raw, products: raw.products };
  throw new Error("Unrecognised JSON structure — expected array or { products: [] }");
}

function saveDataset(filePath, wrapper, products) {
  const out = wrapper === null ? products : { ...wrapper, products };
  fs.writeFileSync(filePath, JSON.stringify(out, null, 2));
}

// ── Checkpoint ────────────────────────────────────────────────────────────────

function cpPath(inputFile) {
  const dir  = path.dirname(inputFile);
  const base = path.basename(inputFile, ".json");
  const store = base.split(/[-_]/)[0];
  return path.join(dir, `${store}-off-name-progress.json`);
}

function auditPath(inputFile) {
  const dir  = path.dirname(inputFile);
  const base = path.basename(inputFile, ".json");
  const store = base.split(/[-_]/)[0];
  return path.join(dir, `${store}-match-audit.json`);
}

function loadCheckpoint(cp) {
  if (!fs.existsSync(cp)) return null;
  try {
    const saved = JSON.parse(fs.readFileSync(cp, "utf8"));
    console.log(`Resuming from checkpoint: ${saved.processedCount} already done`);
    return saved;
  } catch {
    console.warn("Corrupt checkpoint — starting fresh");
    return null;
  }
}

function saveCheckpoint(cp, processedCount, stats, matchLog) {
  fs.writeFileSync(cp, JSON.stringify({ processedCount, stats, matchLog, savedAt: new Date().toISOString() }, null, 2));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\nOpenFoodFacts Name-Search Enrichment (strict validation)");
  if (dryRun) console.log("[DRY RUN mode — no writes]");
  console.log(`Input:  ${absInput}`);
  console.log(`Limit:  ${isFinite(limit) ? limit : "all"}\n`);

  // Derive output path: same dir, same base + "-enriched"
  const outPath = (() => {
    const dir  = path.dirname(absInput);
    const base = path.basename(absInput, ".json");
    return path.join(dir, `${base}-enriched.json`);
  })();
  console.log(`Output: ${outPath}\n`);

  let wrapper, products;
  try {
    ({ wrapper, products } = loadDataset(absInput));
  } catch (e) {
    console.error(`Load failed: ${e.message}`);
    process.exit(1);
  }

  const slice = isFinite(limit) ? products.slice(0, limit) : products;
  console.log(`Loaded ${products.length} total → processing ${slice.length}`);

  const cp = cpPath(absInput);
  const checkpoint = loadCheckpoint(cp);

  const stats = checkpoint ? checkpoint.stats : makeStats();
  initFieldStats(stats);
  const matchLog = checkpoint ? (checkpoint.matchLog || []) : [];
  const startAt  = checkpoint ? checkpoint.processedCount : 0;

  let dirty = false;

  for (let i = startAt; i < slice.length; i++) {
    const product = slice[i];
    stats.total++;

    // Skip if nutrition already populated
    if (!isNutritionEmpty(product)) {
      stats.skipped_has_nutrition++;
      process.stdout.write(`[${i+1}] "${product.name}" — SKIP (has nutrition)\n`);
      continue;
    }

    const rawName = cleanProductName(product);
    const { full_clean, core_only } = cleanSearchQuery(rawName);

    // Print name breakdown so the caller can verify cleaning
    console.log(
      `[${i+1}] "${product.name}"\n` +
      `  full="${full_clean}" | core="${core_only}"`
    );
    process.stdout.write("  → ");

    // ── Two-step search: try full_clean first, fall back to core_only ──────────
    const makeUrl = q =>
      `${OFF_SEARCH}?search_terms=${encodeURIComponent(q)}&search_simple=1&json=1&page_size=${PAGE_SIZE}`;

    await sleep(RATE_LIMIT_MS);
    stats.fetched++;

    let candidates  = null;
    let searchBasis = null;
    let searchPath  = null;

    // Step A: full_clean
    const dataA = await fetchJson(makeUrl(full_clean));
    if (!dataA) {
      stats.fetch_error++;
      console.log("fetch-failed [A:full_clean]");
      continue;
    }
    const candA = (dataA.products || []).slice(0, PAGE_SIZE);

    if (candA.length > 0) {
      candidates  = candA;
      searchBasis = full_clean;
      searchPath  = "A:full_clean";
    } else {
      // Step B: core_only fallback
      process.stdout.write(`[A:no-results] → `);
      await sleep(RATE_LIMIT_MS);

      const dataB = await fetchJson(makeUrl(core_only));
      if (!dataB) {
        stats.fetch_error++;
        console.log("fetch-failed [B:core_only]");
        continue;
      }
      const candB = (dataB.products || []).slice(0, PAGE_SIZE);

      if (candB.length > 0) {
        candidates  = candB;
        searchBasis = core_only;
        searchPath  = "B:core_only";
      }
    }

    if (!candidates || candidates.length === 0) {
      stats.no_results++;
      console.log("no results (A+B)");
      continue;
    }

    // Score against whichever search basis produced results
    let bestCandidate = null;
    let bestScore     = -1;
    for (const c of candidates) {
      const s = scoreSimilarity(searchBasis, c.product_name || c.product_name_en || "");
      if (s > bestScore) { bestScore = s; bestCandidate = c; }
    }

    // Validation gate — ourName is the search basis (drives guard thresholds)
    const validation = validateCandidate(bestCandidate, bestScore, searchBasis);

    if (!validation.ok) {
      stats.no_confident_match++;
      const reason = validation.reason;
      if (reason.startsWith("score_"))            stats.rejections.score_below_threshold++;
      else if (reason === "short-name-low-score") stats.rejections.short_name_low_score++;
      else if (reason === "no_nutriments")        stats.rejections.no_nutriments++;
      else if (reason === "category-drift")       stats.rejections.category_drift++;
      else if (reason === "category-mismatch")         stats.rejections.category_mismatch++;
      else if (reason === "plant-substitute-mismatch") stats.rejections.plant_substitute_mismatch++;
      else if (reason === "non-uk-country")            stats.rejections.non_uk_country++;
      else if (reason === "placeholder-junk")     stats.rejections.placeholder_junk++;
      const matchedName = bestCandidate?.product_name || bestCandidate?.product_name_en || "(none)";
      const rejCountryStr = (bestCandidate?.countries_tags || [])
        .filter(t => t.startsWith("en:"))
        .map(t => t.replace("en:", ""))
        .join(", ");
      matchLog.push({
        our_name:         product.name || rawName,
        matched_off_name: matchedName,
        score:            bestScore,
        confidence:       null,
        search_path:      searchPath,
        country_tags:     rejCountryStr,
        accepted:         false,
        reject_reason:    reason,
      });
      console.log(`no-confident-match [${reason}] [${searchPath}] best="${matchedName}" score=${bestScore.toFixed(2)}`);
      continue;
    }

    // Accepted — log it for spot-checking
    const confidence = validation.confidence;
    const countryStr = (bestCandidate.countries_tags || [])
      .filter(t => t.startsWith("en:"))
      .map(t => t.replace("en:", ""))
      .join(", ");
    const matchedName = bestCandidate.product_name || bestCandidate.product_name_en || "";

    matchLog.push({
      our_name:         product.name || rawName,
      matched_off_name: matchedName,
      score:            bestScore,
      confidence:       confidence,
      search_path:      searchPath,
      country_tags:     countryStr,
      accepted:         true,
      reject_reason:    null,
    });

    // Apply enrichment
    const outcomes = applyEnrichment(product, bestCandidate);
    accFieldStats(stats, outcomes);
    stats.enriched++;
    if (confidence === "high") stats.accepted_high++;
    else                       stats.accepted_medium++;
    dirty = true;

    const filled = Object.entries(outcomes)
      .filter(([, v]) => v === "filled")
      .map(([k]) => k)
      .join(", ");

    console.log(
      `MATCH [${confidence}] [${searchPath}] score=${bestScore.toFixed(2)} "${matchedName}" | filled: ${filled || "nothing new"}`
    );

    // Checkpoint every CHECKPOINT_EVERY products
    if ((i + 1) % CHECKPOINT_EVERY === 0) {
      saveCheckpoint(cp, i + 1, stats, matchLog);
      if (!dryRun && dirty) {
        saveDataset(outPath, wrapper, products);
        dirty = false;
      }
    }

    // Progress banner every 50 products
    if ((i + 1) % 50 === 0) {
      const totalSeen  = i + 1;
      const totalSlice = slice.length;
      const rejected   = stats.no_confident_match + stats.no_results;
      console.log(
        `\n[${totalSeen}/${totalSlice}] | accepted high: ${stats.accepted_high}` +
        ` | accepted medium: ${stats.accepted_medium}` +
        ` | rejected: ${rejected}` +
        ` | fetch-failed: ${stats.fetch_error}\n`
      );
    }
  }

  // Final save — always write to the enriched output file, never touch the original
  if (!dryRun) {
    saveDataset(outPath, wrapper, products);
    console.log(`\nSaved enriched data → ${outPath}`);
  }

  // Write permanent QA audit (accepted + rejected), then drop the temp checkpoint.
  if (!dryRun) {
    const ap    = auditPath(absInput);
    const store = path.basename(absInput, ".json").split(/[-_]/)[0];
    fs.writeFileSync(ap, JSON.stringify({
      store,
      runDate:   new Date().toISOString(),
      inputFile: absInput,
      stats,
      matches:   matchLog,
    }, null, 2));
    console.log(`Match audit  → ${ap}`);
  }
  if (fs.existsSync(cp)) {
    fs.unlinkSync(cp);
    console.log("Checkpoint removed.");
  }

  printReport(stats, matchLog);
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
