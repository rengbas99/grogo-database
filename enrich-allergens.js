#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "fs";
import { basename, dirname, join } from "path";

const ALLERGENS = [
  "celery",
  "cereals containing gluten",
  "wheat",
  "rye",
  "barley",
  "oats",
  "crustaceans",
  "eggs",
  "fish",
  "lupin",
  "milk",
  "molluscs",
  "mustard",
  "nuts",
  "peanuts",
  "sesame",
  "soybeans",
  "soya",
  "sulphur dioxide",
  "sulphites",
];

const ALLERGEN_SET = new Set(ALLERGENS.map((a) => a.toLowerCase()));

function extractAllergens(ingredients) {
  if (!ingredients || typeof ingredients !== "string") return [];

  const found = new Set();

  const checkText = (text) => {
    const lower = text.trim().toLowerCase();
    if (ALLERGEN_SET.has(lower)) {
      found.add(lower);
      return;
    }
    // Also check individual words within a matched phrase
    for (const word of lower.split(/\s+/)) {
      if (ALLERGEN_SET.has(word)) found.add(word);
    }
  };

  // Method 1: ALL-CAPS sequences (single or adjacent all-caps words, min 2 chars each)
  // Matches things like: MILK, WHEAT, SOYA LECITHIN, BARLEY MALT
  const capsRegex = /\b[A-Z]{2,}(?:\s+[A-Z]{2,})*\b/g;
  for (const match of ingredients.matchAll(capsRegex)) {
    checkText(match[0]);
  }

  // Method 2: bold-formatted (**word** or **multi word**)
  const boldRegex = /\*\*([^*]+)\*\*/g;
  for (const match of ingredients.matchAll(boldRegex)) {
    checkText(match[1]);
  }

  // Method 3: colon-surrounded text like ": MILK :" or ":milk:"
  const colonRegex = /:\s*([^:,()]+?)\s*:/g;
  for (const match of ingredients.matchAll(colonRegex)) {
    checkText(match[1]);
  }

  return [...found].sort();
}

const filename = process.argv[2];
if (!filename) {
  console.error("Usage: bun enrich-allergens.js <path/to/products.json>");
  process.exit(1);
}

let raw;
try {
  raw = readFileSync(filename, "utf8");
} catch (e) {
  console.error(`Could not read file: ${filename}\n${e.message}`);
  process.exit(1);
}

const data = JSON.parse(raw);

const products = data.products;
if (!Array.isArray(products)) {
  console.error('Expected data.products to be an array. Got:', typeof products);
  process.exit(1);
}

let detected = 0;
let alreadyHadData = 0;
let noMatch = 0;
const samplesWithAllergens = [];

for (const product of products) {
  const existing = product.allergens;
  const hasExisting =
    existing !== null && existing !== undefined && existing !== "";

  if (hasExisting) {
    alreadyHadData++;
    continue;
  }

  const allergens = extractAllergens(product.ingredients);
  if (allergens.length > 0) {
    product.allergens = allergens.join(", ");
    detected++;
    if (samplesWithAllergens.length < 3) samplesWithAllergens.push(product);
  } else {
    noMatch++;
  }
}

console.log("\n=== Allergen Enrichment Summary ===");
console.log(`  Allergens detected (newly written): ${detected}`);
console.log(`  Already had allergen data:          ${alreadyHadData}`);
console.log(`  No allergen match found:            ${noMatch}`);
console.log(`  Total products processed:           ${products.length}`);

const dir = dirname(filename);
const base = basename(filename, ".json");
const outputPath = join(dir, `${base}-allergens.json`);
writeFileSync(outputPath, JSON.stringify(data, null, 2));
console.log(`\nSaved to: ${outputPath}`);

if (samplesWithAllergens.length > 0) {
  console.log("\n=== Sample Products with Detected Allergens ===");
  for (const p of samplesWithAllergens) {
    const name = p.name || p.productName || p.productId || "Unknown";
    const ing = (p.ingredients || "").slice(0, 200);
    console.log(`\nProduct: ${name}`);
    console.log(`  Ingredients: ${ing}${ing.length === 200 ? "..." : ""}`);
    console.log(`  Allergens:   ${p.allergens}`);
  }
} else {
  console.log("\nNo products had allergens detected.");
}
