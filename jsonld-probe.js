#!/usr/bin/env node
/**
 * jsonld-probe.js
 *
 * Loads 3 product URLs per store, extracts all JSON-LD blocks,
 * finds the first @type:Product node, and prints it in full.
 * Confirms whether nutrition / ingredients appear before an overnight run.
 *
 * Usage: node jsonld-probe.js
 */

"use strict";

const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin  = require("puppeteer-extra-plugin-stealth");

puppeteerExtra.use(StealthPlugin());

// ── Probe targets — 3 products each missing nutrition ────────────────────────

const TARGETS = [
  {
    store: "Tesco",
    referer: "https://www.tesco.com/groceries/en-GB/",
    urls: [
      "https://www.tesco.com/groceries/en-GB/products/271168790",
      "https://www.tesco.com/groceries/en-GB/products/285725121",
      "https://www.tesco.com/groceries/en-GB/products/258732959",
    ],
  },
  {
    store: "Sainsbury's",
    referer: "https://www.sainsburys.co.uk/",
    urls: [
      "https://www.sainsburys.co.uk/gol-ui/product/frylight-olive-oil-spray-190ml",
      "https://www.sainsburys.co.uk/gol-ui/product/frylight-sunflower-oil-spray-190ml",
      "https://www.sainsburys.co.uk/gol-ui/product/frylight-1-cal-rapeseed-oil-spray-190g",
    ],
  },
  {
    store: "Aldi",
    referer: "https://www.aldi.co.uk/",
    urls: [
      "https://www.aldi.co.uk/product/solesta-sunflower-oil-000000000000198481",
      "https://www.aldi.co.uk/product/solesta-vegetable-oil-000000000000335872",
      "https://www.aldi.co.uk/product/specially-selected-british-rapeseed-oil-000000000000335573",
    ],
  },
  {
    store: "Iceland",
    referer: "https://www.iceland.co.uk/",
    urls: [
      "https://www.iceland.co.uk/p/crisp-n-dry-rapeseed-oil-975ml/46393.html",
      "https://www.iceland.co.uk/p/pura-refined-vegetable-oil-2l/63776.html",
      "https://www.iceland.co.uk/p/pura-refined-sunflower-oil-2l/63775.html",
    ],
  },
];

// Fields we care about finding in a Product node
const KEY_FIELDS = [
  "name", "sku", "brand", "description",
  "nutrition", "nutritionInformation", "nutritionInfo",
  "ingredients", "ingredientList",
  "offers", "image",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randomDelay() {
  return 2000 + Math.floor(Math.random() * 1500);
}

// Extract and parse every <script type="application/ld+json"> on the page
async function extractJsonLd(page) {
  return page.evaluate(() => {
    const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
    return scripts.map(s => {
      try { return JSON.parse(s.textContent); }
      catch { return null; }
    }).filter(Boolean);
  });
}

// Walk blocks + @graph arrays to find the first Product node
function findProductNode(blocks) {
  for (const block of blocks) {
    const items = Array.isArray(block["@graph"]) ? block["@graph"] : [block];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const type = item["@type"];
      if (
        type === "Product" ||
        (Array.isArray(type) && type.includes("Product"))
      ) {
        return item;
      }
    }
  }
  return null;
}

// Dismiss cookie / consent banners
async function dismissCookies(page) {
  const selectors = [
    "#onetrust-accept-btn-handler",
    'button[id*="accept"]',
    'button[class*="accept"]',
    '[data-testid="accept-button"]',
    '[data-testid="cookie-accept"]',
    'button[aria-label*="accept" i]',
    'button[aria-label*="cookie" i]',
  ];
  for (const sel of selectors) {
    try {
      await page.waitForSelector(sel, { timeout: 3000 });
      await page.click(sel);
      await sleep(800);
      return;
    } catch { /* not found — try next */ }
  }
}

// ── Per-store probe ───────────────────────────────────────────────────────────

async function probeStore(browser, { store, referer, urls }) {
  const BAR = "═".repeat(64);
  console.log(`\n${BAR}`);
  console.log(`STORE: ${store}`);
  console.log(BAR);

  let firstNode = null;
  let firstUrl  = null;

  for (const url of urls) {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1366, height: 768 });
    await page.setExtraHTTPHeaders({
      "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
      "Referer":         referer,
    });

    try {
      console.log(`\n  → ${url}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 35000 });
      await dismissCookies(page);
      await sleep(1200);

      const blocks = await extractJsonLd(page);
      console.log(`    LD+JSON blocks : ${blocks.length}`);

      if (blocks.length === 0) {
        console.log("    (no ld+json on this page)");
        await page.close();
        await sleep(randomDelay());
        continue;
      }

      // Show all @type values found even if no Product
      const allTypes = blocks.flatMap(b => {
        const items = Array.isArray(b["@graph"]) ? b["@graph"] : [b];
        return items.map(i => i && i["@type"]).filter(Boolean);
      });
      console.log(`    @types present : ${[...new Set(allTypes.flat())].join(", ")}`);

      const node = findProductNode(blocks);
      if (node) {
        console.log("    Product node   : ✓ found");
        if (!firstNode) { firstNode = node; firstUrl = url; }
      } else {
        console.log("    Product node   : ✗ not found");
      }

    } catch (err) {
      console.log(`    ERROR: ${err.message}`);
    } finally {
      await page.close();
    }

    await sleep(randomDelay());
  }

  // ── Print the first Product node found for this store ────────────────────
  if (firstNode) {
    console.log(`\n── Full Product JSON-LD (${firstUrl}) ──────────────`);
    console.log(JSON.stringify(firstNode, null, 2));

    console.log("\n── Key field presence ──────────────────────────────────");
    for (const field of KEY_FIELDS) {
      const val     = firstNode[field];
      const present = val != null &&
        !(typeof val === "object" && Object.keys(val).length === 0) &&
        !(typeof val === "string" && val.trim() === "");
      console.log(`  ${field.padEnd(26)}: ${present ? "✓" : "✗"}`);
    }
  } else {
    console.log("\n  ⚠  No @type:Product node found across all 3 URLs for this store.");
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("jsonld-probe — 3 URLs × 4 stores");
  console.log("Confirming JSON-LD Product node + nutrition/ingredients fields\n");

  const browser = await puppeteerExtra.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    for (const target of TARGETS) {
      await probeStore(browser, target);
      await sleep(3000);
    }
  } finally {
    await browser.close();
  }

  console.log("\n\nProbe complete.");
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
