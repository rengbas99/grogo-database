#!/usr/bin/env node
/**
 * aldi-retry-failed.js
 *
 * Re-runs the OFF name-search enrichment on a specific set of product indices
 * that previously returned "fetch-failed". Uses a slower 1000ms base delay.
 * Reads and writes aldi-final-products-enriched.json in-place.
 *
 * Usage:
 *   node aldi-retry-failed.js <enriched-file.json> <indices>
 *   where <indices> is a comma-separated list of 1-based product numbers.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// ── Config ────────────────────────────────────────────────────────────────────

const RATE_LIMIT_MS = 1000;
const PAGE_SIZE     = 5;
const MIN_SCORE     = 0.6;

const STOPWORDS = new Set(["the","of","and","a","an","with","in","for","to"]);

const DRIFT_WORDS = [
  "crisps","chips","seasoning","herbs","flavour","flavor","sauce",
  "snack","spread","dressing","blend","mix","soup","crackers",
  "biscuits","bar","drink","juice","powder","paste","cubes",
];

const PROCESSED_CATEGORIES = new Set([
  "snacks","crisps","chips","seasonings","sauces","spreads",
  "dressings","condiments","biscuits","crackers","confectionery",
  "beverages","desserts","prepared-dishes","snack-foods",
  "salted-snacks","fried-snacks","flavoured-crisps",
]);

const FRESH_NAME_WORDS = new Set([
  "pepper","peppers","chilli","garlic","onion","onions",
  "tomato","tomatoes","carrot","carrots","broccoli","cauliflower",
  "spinach","kale","courgette","cucumber","mushroom","mushrooms",
  "potato","potatoes","leek","leeks","lettuce","avocado",
  "apple","apples","banana","bananas","mango","strawberry",
  "strawberries","blueberry","blueberries","raspberry","raspberries",
  "lemon","lemons","lime","limes","orange","oranges","grape",
  "grapes","pear","pears","peach","peaches","plum","plums",
  "cherry","cherries","ginger","celery","asparagus","beetroot",
  "parsnip","swede","turnip","radish",
]);

const MEAT_DAIRY_WORDS = new Set([
  "chicken","beef","pork","lamb","turkey","fish","salmon","tuna",
  "bacon","sausage","ham","milk","cheese","butter","egg",
]);
const VEGAN_LABELS = new Set([
  "en:vegan","en:vegetarian","en:plant-based","en:meat-free","en:dairy-free-alternative",
]);
const VEGAN_NAME_MARKERS = [
  "isn't","not ","no-","vegan","plant-based","meat-free","alternative","free from",
];

const FETCH_HEADERS = { "User-Agent": "GrogoPipeline/1.0 (rengbas99@gmail.com)" };
const OFF_SEARCH    = "https://world.openfoodfacts.org/cgi/search.pl";

// ── CLI ───────────────────────────────────────────────────────────────────────

const rawArgs   = process.argv.slice(2);
const dryRun    = rawArgs.includes("--dry-run");
const posArgs   = rawArgs.filter(a => !a.startsWith("--"));
const [inputPath, indicesArg] = posArgs;

if (!inputPath || !indicesArg) {
  console.error("Usage: node aldi-retry-failed.js <file.json> <1-based-indices-csv> [--dry-run]");
  console.error("Example: node aldi-retry-failed.js aldi-final-products-enriched.json 27,28,46");
  process.exit(1);
}

const absInput  = path.resolve(inputPath);
const indices1  = indicesArg.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
const indices0  = indices1.map(n => n - 1);

if (!fs.existsSync(absInput)) {
  console.error(`File not found: ${absInput}`);
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, opts = {}, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) return res;
      if (attempt < maxRetries) {
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (attempt < maxRetries) { await sleep(1000 * Math.pow(2, attempt)); continue; }
      throw err;
    }
  }
}

async function fetchJson(url) {
  try {
    const res = await fetchWithRetry(url, { headers: FETCH_HEADERS });
    if (!res || !res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── Name / search ─────────────────────────────────────────────────────────────

function tokenise(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function meaningfulTokens(name) {
  return tokenise(name).filter(t => !STOPWORDS.has(t));
}

function cleanProductName(p) {
  const raw = (p.name || "").trim();
  if (raw.length >= 3) return raw;
  const pid = String(p.productId || p.id || "");
  return pid.split("?")[0].replace(/\.html?$/i,"").replace(/-0{3,}\d+$/,"")
            .replace(/\//g,"-").replace(/-+/g," ").trim();
}

function buildSearchQuery(p) {
  const name  = cleanProductName(p);
  const brand = (p.brand || "").trim();
  if (!brand || brand.toLowerCase() === name.toLowerCase()) return name;
  const nt = tokenise(name), bt = tokenise(brand);
  if (bt.every(t => nt.includes(t))) return name;
  return `${brand} ${name}`;
}

function scoreSimilarity(ourName, candidateName) {
  const ours   = tokenise(ourName);
  const theirs = new Set(tokenise(candidateName));
  if (!ours.length) return 0;
  return ours.filter(t => theirs.has(t)).length / ours.length;
}

// ── Validation gate (identical to main script) ────────────────────────────────

function validateCandidate(offProduct, score, ourName) {
  const ourTokens     = meaningfulTokens(ourName);
  const ourTokenCount = ourTokens.length;

  if (ourTokenCount === 1) {
    const matchedTokenCount = tokenise(offProduct.product_name || offProduct.product_name_en || "").length;
    if (score < 0.90 || matchedTokenCount > 1)
      return { ok: false, reason: "short-name-low-score" };
  } else if (ourTokenCount === 2) {
    if (score < 0.75) return { ok: false, reason: `score_${score.toFixed(2)}_below_threshold` };
  } else {
    if (score < MIN_SCORE) return { ok: false, reason: `score_${score.toFixed(2)}_below_threshold` };
  }

  const n = offProduct.nutriments || {};
  if (!Object.keys(n).length) return { ok: false, reason: "no_nutriments" };

  const ourSet       = new Set(tokenise(ourName));
  const matchedSet   = new Set(tokenise(offProduct.product_name || offProduct.product_name_en || ""));
  for (const w of DRIFT_WORDS) {
    if (matchedSet.has(w) && !ourSet.has(w)) return { ok: false, reason: "category-drift" };
  }

  const ourImpliesFresh = (
    [...ourSet].some(t => FRESH_NAME_WORDS.has(t)) &&
    !DRIFT_WORDS.some(w => ourSet.has(w))
  );
  if (ourImpliesFresh) {
    const offTagSlugs = (offProduct.categories_tags || [])
      .map(t => t.replace(/^[a-z]{2}:/, "").replace(/-/g, " ").trim());
    const offCatItems = (offProduct.categories || "").toLowerCase()
      .split(",").map(s => s.trim()).filter(Boolean);
    if ([...offTagSlugs, ...offCatItems].some(cat => PROCESSED_CATEGORIES.has(cat)))
      return { ok: false, reason: "category-mismatch" };
  }

  // Guard: plant-substitute mismatch
  const ourHasMeat = [...ourSet].some(t => MEAT_DAIRY_WORDS.has(t));
  if (ourHasMeat) {
    const offLabels    = offProduct.labels_tags || [];
    const offNameLower = (offProduct.product_name || offProduct.product_name_en || "").toLowerCase();
    const isPlantSub   = (
      offLabels.some(l => VEGAN_LABELS.has(l)) ||
      VEGAN_NAME_MARKERS.some(m => offNameLower.includes(m))
    );
    if (isPlantSub) return { ok: false, reason: "plant-substitute-mismatch" };
  }

  const countries = offProduct.countries_tags || [];
  const hasUK     = countries.includes("en:united-kingdom");
  const hasNonUK  = countries.length > 0 && !hasUK;

  const ing    = (offProduct.ingredients_text || "").toLowerCase();
  const isJunk = ["eau minérale","acqua","wasser","agua mineral"].some(x => ing.includes(x));
  if (isJunk)   return { ok: false, reason: "placeholder-junk" };
  if (hasNonUK) return { ok: false, reason: "non-uk-country" };

  return { ok: true, confidence: hasUK ? "high" : "medium" };
}

// ── Field mapping ─────────────────────────────────────────────────────────────

function isNutritionEmpty(p) {
  const n = p.nutrition;
  if (!n || typeof n !== "object") return true;
  const keys = Object.keys(n);
  return keys.length === 0 || keys.every(k => !n[k] || n[k] === 0);
}

function applyEnrichment(product, offProduct) {
  const n = offProduct.nutriments || {};
  const out = {};

  if (!product.nutrition || typeof product.nutrition !== "object") product.nutrition = {};

  function fillNutrient(subKey, offKey, label) {
    const val = n[offKey];
    if (val == null) { out[label] = "no_off_data"; return; }
    const existing = product.nutrition[subKey];
    if (existing != null && existing !== 0 && existing !== "") { out[label] = "already_had"; return; }
    product.nutrition[subKey] = val;
    out[label] = "filled";
  }
  fillNutrient("calories_per_100g", "energy-kcal_100g",   "calories_per_100g");
  fillNutrient("fat",               "fat_100g",           "fat");
  fillNutrient("carbs",             "carbohydrates_100g", "carbs");
  fillNutrient("protein",           "proteins_100g",      "protein");
  fillNutrient("salt",              "salt_100g",          "salt");
  fillNutrient("sugars",            "sugars_100g",        "sugars");

  const ingText = (offProduct.ingredients_text || "").trim();
  if (!ingText) {
    out.ingredients = "no_off_data";
  } else if (product.ingredients && String(product.ingredients).trim().length > 0) {
    out.ingredients = "already_had";
  } else {
    product.ingredients = ingText;
    out.ingredients = "filled";
  }

  const allergenTags = offProduct.allergens_tags || [];
  if (!allergenTags.length) {
    out.allergens = "no_off_data";
  } else if (product.allergens && String(product.allergens).trim().length > 0) {
    out.allergens = "already_had";
  } else {
    product.allergens = allergenTags
      .map(t => t.replace(/^[a-z]{2}:/, "").replace(/-/g, " ")).filter(Boolean).join(", ");
    out.allergens = "filled";
  }

  const grade = offProduct.nutriscore_grade;
  if (!grade) {
    out.nutriscore = "no_off_data";
  } else if (product.nutriscore) {
    out.nutriscore = "already_had";
  } else {
    product.nutriscore = grade.toLowerCase();
    out.nutriscore = "filled";
  }

  return out;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\nAldi fetch-failed retry");
  console.log(`Input:   ${absInput}`);
  console.log(`Retrying ${indices0.length} products (1-based: ${indices1.join(", ")})`);
  console.log(`Delay:   ${RATE_LIMIT_MS}ms\n`);

  const raw  = JSON.parse(fs.readFileSync(absInput, "utf8"));
  const wrapper  = raw.products ? raw : null;
  const products = wrapper ? raw.products : raw;

  const counters = { resolved: 0, still_failed: 0, genuine_reject: 0, skipped: 0 };
  const results  = [];

  for (let i = 0; i < indices0.length; i++) {
    const idx0    = indices0[i];
    const idx1    = indices1[i];
    const product = products[idx0];

    if (!product) {
      console.log(`[${idx1}] index out of range — skipping`);
      counters.skipped++;
      continue;
    }

    // If this product was actually enriched by a parallel occurrence in the
    // first run (duplicate name), skip it.
    if (!isNutritionEmpty(product)) {
      console.log(`[${idx1}] "${product.name}" — already has nutrition (filled by duplicate), skipping`);
      counters.skipped++;
      continue;
    }

    const cleanName = cleanProductName(product);
    const query     = buildSearchQuery(product);
    process.stdout.write(`[${idx1}] "${product.name}" → "${query}" ... `);

    await sleep(RATE_LIMIT_MS);

    const url  = `${OFF_SEARCH}?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1&page_size=${PAGE_SIZE}`;
    const data = await fetchJson(url);

    if (!data) {
      console.log("still fetch-failed");
      counters.still_failed++;
      results.push({ idx1, name: product.name, outcome: "still-fetch-failed" });
      continue;
    }

    const candidates = (data.products || []).slice(0, PAGE_SIZE);
    if (!candidates.length) {
      console.log("no results");
      counters.genuine_reject++;
      results.push({ idx1, name: product.name, outcome: "no-results" });
      continue;
    }

    let bestCandidate = null, bestScore = -1;
    for (const c of candidates) {
      const s = scoreSimilarity(cleanName, c.product_name || c.product_name_en || "");
      if (s > bestScore) { bestScore = s; bestCandidate = c; }
    }

    const validation = validateCandidate(bestCandidate, bestScore, cleanName);
    if (!validation.ok) {
      const matched = bestCandidate?.product_name || "(none)";
      console.log(`no-confident-match [${validation.reason}] best="${matched}" score=${bestScore.toFixed(2)}`);
      counters.genuine_reject++;
      results.push({ idx1, name: product.name, outcome: `rejected:${validation.reason}`, matched, score: bestScore });
      continue;
    }

    const confidence  = validation.confidence;
    const matchedName = bestCandidate.product_name || bestCandidate.product_name_en || "";
    const countryStr  = (bestCandidate.countries_tags || [])
      .filter(t => t.startsWith("en:")).map(t => t.replace("en:", "")).join(", ");

    const outcomes = applyEnrichment(product, bestCandidate);
    const filled   = Object.entries(outcomes).filter(([,v]) => v === "filled").map(([k]) => k).join(", ");

    console.log(`MATCH [${confidence}] score=${bestScore.toFixed(2)} "${matchedName}" | filled: ${filled || "nothing new"}`);
    counters.resolved++;
    results.push({ idx1, name: product.name, outcome: `accepted:${confidence}`, matched: matchedName, score: bestScore, countryTags: countryStr });
  }

  // Save merged result back to the enriched file
  const out = wrapper ? { ...raw, products } : products;
  if (dryRun) {
    console.log(`\n[DRY RUN] No changes written`);
  } else {
    fs.writeFileSync(absInput, JSON.stringify(out, null, 2));
    console.log(`\nSaved → ${absInput}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const L = 60;
  console.log(`\n${"─".repeat(L)}`);
  console.log("RETRY SUMMARY");
  console.log("─".repeat(L));
  console.log(`Attempted:        ${indices0.length}`);
  console.log(`Resolved (match): ${counters.resolved}`);
  console.log(`Genuine rejects:  ${counters.genuine_reject}`);
  console.log(`Still failed:     ${counters.still_failed}`);
  console.log(`Skipped:          ${counters.skipped}`);
  console.log("\nPer-product outcomes:");

  const COL = [6, 34, 20, 6, 20];
  console.log("─".repeat(COL.reduce((a,b)=>a+b,0)));
  console.log(
    "#".padEnd(COL[0]) + "Our Name".padEnd(COL[1]) +
    "Outcome".padEnd(COL[2]) + "Score".padEnd(COL[3]) + "Matched Name"
  );
  console.log("─".repeat(COL.reduce((a,b)=>a+b,0)));
  for (const r of results) {
    console.log(
      String(r.idx1).padEnd(COL[0]) +
      (r.name || "").slice(0, COL[1]-1).padEnd(COL[1]) +
      (r.outcome || "").slice(0, COL[2]-1).padEnd(COL[2]) +
      (r.score != null ? r.score.toFixed(2) : "-").padEnd(COL[3]) +
      (r.matched || "").slice(0, COL[4])
    );
  }
  console.log("─".repeat(COL.reduce((a,b)=>a+b,0)));
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
