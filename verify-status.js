#!/usr/bin/env node
"use strict";

const fs   = require("fs");
const path = require("path");

const ROOT = __dirname;

// ── Config ────────────────────────────────────────────────────────────────────

const JUNK_PHRASES = [
  "eau minérale", "acqua minerale", "acqua", "wasser", "agua mineral",
  "une eau", "mineral water",
];

const FRESH_PRODUCE_WORDS = new Set([
  "tomato","tomatoes","apple","apples","banana","bananas","carrot","carrots",
  "broccoli","spinach","kale","lettuce","cucumber","courgette","pepper",
  "peppers","onion","onions","garlic","mushroom","mushrooms","potato",
  "potatoes","leek","leeks","celery","avocado","strawberry","strawberries",
  "raspberry","raspberries","blueberry","blueberries","mango","grape","grapes",
  "lemon","lemons","lime","limes","orange","oranges","pear","pears",
  "cherry","cherries","beetroot","parsnip","asparagus","ginger",
]);

const STORES = [
  {
    store:    "Tesco",
    enriched: "final-products/tesco/tesco-final-products-updated.json",
    audit:    null,
  },
  {
    store:    "Sainsbury's",
    enriched: "final-products/sainsbury/sainsbury-final-products-enriched.json",
    audit:    "final-products/sainsbury/sainsbury-match-audit.json",
  },
  {
    store:    "Aldi",
    enriched: "final-products/aldi/aldi-final-products-enriched.json",
    audit:    null,
  },
  {
    store:    "Iceland",
    enriched: "final-products/iceland/iceland-final-products-enriched.json",
    audit:    "final-products/iceland/iceland-match-audit.json",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadProducts(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (Array.isArray(raw)) return raw;
  if (raw.products && Array.isArray(raw.products)) return raw.products;
  for (const key of Object.keys(raw)) {
    if (Array.isArray(raw[key]) && raw[key].length > 5) return raw[key];
  }
  return null;
}

function loadAuditMap(relPath) {
  if (!relPath) return null;
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  const data = JSON.parse(fs.readFileSync(abs, "utf8"));
  const entries = data.matches || [];
  // accepted only; keyed by our_name for O(1) lookup
  const map = new Map();
  for (const e of entries) {
    if (e.accepted) map.set(e.our_name, e);
  }
  return map;
}

function getCalories(p) {
  const n = p.nutrition;
  if (!n || typeof n !== "object") return null;
  const v = n.calories_per_100g ?? n.calories ?? n.energy ?? n.energy_kcal ?? null;
  return (v != null && !isNaN(Number(v))) ? Number(v) : null;
}

function getFat(p) {
  const n = p.nutrition;
  if (!n || typeof n !== "object") return null;
  const v = n.fat ?? null;
  return (v != null && !isNaN(Number(v))) ? Number(v) : null;
}

function hasValidNutrition(p) {
  const n = p.nutrition;
  if (!n || typeof n !== "object") return false;
  return Object.values(n).some(v =>
    v != null && v !== "" && !isNaN(Number(v)) && Number(v) > 0
  );
}

function hasValidIngredients(p) {
  const ing = (p.ingredients || "").trim();
  if (ing.length <= 10) return false;
  const lo = ing.toLowerCase();
  return !JUNK_PHRASES.some(j => lo.includes(j));
}

function hasValidAllergens(p) {
  const a = p.allergens;
  if (!a) return false;
  if (Array.isArray(a))  return a.length > 0;
  return typeof a === "string" && a.trim().length > 0;
}

function isJunk(p) {
  const ing = (p.ingredients || "").toLowerCase();
  return JUNK_PHRASES.some(j => ing.includes(j));
}

// ── Auto-flags ────────────────────────────────────────────────────────────────

function autoFlags(p) {
  const flags = [];
  const cal  = getCalories(p);
  const fat  = getFat(p);
  const name = (p.name || "").toLowerCase();
  const ing  = (p.ingredients || "").trim();

  // 1. Calories out of range
  if (cal !== null && (cal < 0 || cal > 900)) {
    flags.push(`CALORIES_OOB(${cal})`);
  }

  // 2. Fresh produce name but high fat
  const nameToks = new Set(name.replace(/[^a-z ]/g, "").split(/\s+/));
  const impliesFresh = [...nameToks].some(t => FRESH_PRODUCE_WORDS.has(t));
  if (impliesFresh && fat !== null && fat > 15) {
    flags.push(`FRESH_NAME_HIGH_FAT(${fat}g)`);
  }

  // 3. First word of ingredients doesn't plausibly relate to product name
  if (ing.length > 10) {
    const firstWord = ing.split(/[\s,;:(]/)[0].toLowerCase().replace(/[^a-z]/g, "");
    // Flag if first ingredient word shares no tokens with product name
    // AND is a known suspicious mismatch indicator
    const SUSPICIOUS_FIRSTS = new Set([
      "sugar","sucre","zucker","sucrose","glucose",
      "water","eau","aqua","wasser",
      "salt","sel","salz",
    ]);
    const nameHasFirstWord = name.includes(firstWord);
    if (firstWord.length > 2 && SUSPICIOUS_FIRSTS.has(firstWord) && !nameHasFirstWord) {
      flags.push(`ING_STARTS_WITH(${firstWord})`);
    }
  }

  return flags.length ? flags.join(" | ") : "";
}

// Random sample (Fisher-Yates, reproducible enough for spot-checking)
function sample(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

function trunc(s, n) {
  if (!s) return "(none)";
  return String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s);
}

// ── PART 1 — Completeness table ───────────────────────────────────────────────

function pct(n, t) { return t ? (Math.round(n / t * 100) + "%").padStart(4) : "  0%"; }

console.log("\n══════════════════════════════════════════════════════════════════════");
console.log("PART 1 — COMPLETENESS (measured from files)");
console.log("══════════════════════════════════════════════════════════════════════");

const C = [14, 7, 13, 15, 11, 11, 14];
const HDR = ["Store","Total","Nutrition","Ingredients","Allergens","JunkFound","AuditEntries"];
console.log(HDR.map((h, i) => (i === 0 ? h.padEnd(C[i]) : h.padStart(C[i]))).join(""));
console.log("─".repeat(C.reduce((a,b) => a+b, 0)));

const storeData = [];

for (const { store, enriched, audit } of STORES) {
  const products = loadProducts(enriched);
  if (!products) {
    console.log(store.padEnd(C[0]) + "  FILE NOT FOUND".padStart(C[1]));
    storeData.push(null);
    continue;
  }
  const total   = products.length;
  const nutN    = products.filter(hasValidNutrition).length;
  const ingN    = products.filter(hasValidIngredients).length;
  const allN    = products.filter(hasValidAllergens).length;
  const junkN   = products.filter(isJunk).length;
  const auditMap = loadAuditMap(audit);
  const audStr  = audit
    ? (fs.existsSync(path.join(ROOT, audit))
        ? String(JSON.parse(fs.readFileSync(path.join(ROOT, audit), "utf8")).matches?.length ?? "?")
        : "MISSING")
    : "—";

  storeData.push({ store, products, auditMap });

  console.log(
    store.padEnd(C[0]) +
    String(total).padStart(C[1]) +
    `${nutN} ${pct(nutN, total)}`.padStart(C[2]) +
    `${ingN} ${pct(ingN, total)}`.padStart(C[3]) +
    `${allN} ${pct(allN, total)}`.padStart(C[4]) +
    (junkN > 0 ? `⚠ ${junkN}` : "0").padStart(C[5]) +
    audStr.padStart(C[6])
  );
}

// ── PART 2 — Correctness spot-check ──────────────────────────────────────────

console.log("\n\n══════════════════════════════════════════════════════════════════════");
console.log("PART 2 — CORRECTNESS SPOT-CHECK (10 random enriched products per store)");
console.log("══════════════════════════════════════════════════════════════════════");
console.log("Flags: CALORIES_OOB = outside 0–900 | FRESH_NAME_HIGH_FAT = fresh name + fat>15g | ING_STARTS_WITH = suspicious first ingredient\n");

for (const { store, enriched, audit } of STORES) {
  const entry = storeData.find(d => d && d.store === store);
  if (!entry) { console.log(`\n${store}: file not found, skipping`); continue; }
  const { products, auditMap } = entry;

  // Pool: products with any enriched content (nutrition OR valid ingredients)
  const enrichedPool = products.filter(p =>
    hasValidNutrition(p) || hasValidIngredients(p)
  );

  console.log(`\n${"─".repeat(120)}`);
  console.log(`${store.toUpperCase()}  (${enrichedPool.length} enriched products in pool, sampling 10)`);
  console.log("─".repeat(120));

  if (enrichedPool.length === 0) {
    console.log("  No enriched products to sample.");
    continue;
  }

  const picked = sample(enrichedPool, 10);

  const NC = [32, 34, 6, 45, 8, 0]; // Our name | OFF name | kcal | ingredients | conf | flags
  console.log(
    "Our Product Name".padEnd(NC[0]) +
    "Matched OFF Name".padEnd(NC[1]) +
    "kcal".padEnd(NC[2]) +
    "Ingredients (60 chars)".padEnd(NC[3]) +
    "Conf".padEnd(NC[4]) +
    "Flags"
  );
  console.log("─".repeat(120));

  for (const p of picked) {
    const auditEntry = auditMap ? auditMap.get(p.name) : null;
    const offName    = auditEntry ? auditEntry.matched_off_name : "(no audit)";
    const conf       = auditEntry ? auditEntry.confidence       : "—";
    const cal        = getCalories(p);
    const calStr     = cal !== null ? String(Math.round(cal)) : "—";
    const ingStr     = trunc(p.ingredients || "", 60);
    const flags      = autoFlags(p);

    const flagStr = flags ? `  ⚠ ${flags}` : "";

    console.log(
      trunc(p.name, NC[0] - 1).padEnd(NC[0]) +
      trunc(offName, NC[1] - 1).padEnd(NC[1]) +
      calStr.padEnd(NC[2]) +
      ingStr.padEnd(NC[3]) +
      conf.padEnd(NC[4]) +
      flagStr
    );
  }
}

console.log(`\n${"─".repeat(120)}`);
console.log("Done.\n");
