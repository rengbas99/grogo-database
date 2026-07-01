# Grogo MVP — Project Context for Claude Code

> Last updated: 2 June 2026. Keep this file accurate — stale facts here cause bad decisions downstream.

## What this project is

A UK grocery product data pipeline. We scrape 5 UK supermarkets (Aldi, Iceland, Lidl, Tesco, Sainsbury's), enrich the products with nutrition / ingredients / allergens, and produce a clean structured dataset. This dataset is the foundation (the "dictionary") for a later product — **BillConnect**, a resolver that turns messy retail transaction strings (e.g. `TSCO S/S MLK 2L`) into canonical product records.

## Tech stack

- Node.js + `puppeteer-extra` + `puppeteer-extra-plugin-stealth` (headless scraping)
- Open Food Facts (OFF) API — enrichment fallback (name search; barcode lookup where real EANs exist)
- Firebase (original source store) + local JSON files (working data)
- All datasets are JSON arrays of product objects, one file per store

## Directory layout (key paths)

- `final-products/{store}/` — the working + enriched datasets per store
- `scraped-data/` — raw scrape outputs (e.g. `iceland-product-database.json`)
- Enrichment + scraper scripts live in the repo root / `scripts/`
- Audit files: `{store}-match-audit.json` — permanent QA record per store (NEVER auto-delete)

## CRITICAL DATA FACTS (corrected — do not regress)

1. **Aldi and Iceland do NOT have real barcodes/EANs.**
   - Aldi `productId` = internal article number (e.g. `solesta-sunflower-oil-...198481`).
   - Iceland `productId` = URL slug (e.g. `crisp-n-dry-rapeseed-oil-975ml/46393.html`).
   - **These will NOT resolve in OFF barcode lookup.** Use OFF *name search* (gated) or DOM scraping for these two stores. The old "barcodes 100%" claim was a false audit and is WRONG.

2. **OFF name-search MUST be gated.** An early ungated run wrote French placeholder junk (`"une eau minérale naturelle"`) across whole datasets. All enrichment must pass the validation guards below.

3. **JSON-LD on these stores does NOT contain nutrition/ingredients.** Confirmed by probe across all 4 stores. Tesco/Sainsbury's embed real data in `__NEXT_DATA__` / app-state script tags, NOT in JSON-LD. (Pending: `__NEXT_DATA__` extraction approach.)

4. **Empty fields are often CORRECT.** Single-ingredient products (oils, salts, plain milk, raw meat, fresh produce) have no rendered ingredients section. Empty is the right answer, not a scraper bug.

## ENRICHMENT VALIDATION GUARDS (all must stay active)

When matching a product to an OFF entry, REJECT the match if any of these fire:

- **Score gate:** name-similarity score below threshold (scaled by name length — 1 token needs >=0.90, 2 tokens >=0.75, 3+ tokens >=0.6).
- **Short-name guard (Guard 1):** single-token names (e.g. "Garlic") only match single/near-single-token OFF names; block matches into multi-word unrelated products.
- **Category-drift guard (Guard 2):** uses OFF `categories_tags` (not just name). Reject fresh-implied products matching processed categories (e.g. "Red Pepper" → crisps).
- **Plant-substitute guard (Guard 3):** if our name has a meat/dairy word and the OFF product is tagged vegan/plant-based/meat-free (or name contains "isn't"/"not"/"vegan"/"alternative"), REJECT (different macros).
- **Fresh/egg drift:** "fresh" and "egg" are in DRIFT_WORDS — block dried/ambient products matching fresh/egg variants.
- **Placeholder-junk:** reject ingredients containing "eau minérale", "acqua", "wasser", "agua mineral".
- **Non-UK country:** reject if `countries_tags` contains a non-UK country AND does NOT also include `en:united-kingdom`. Empty country tag → accept as MEDIUM confidence.

Confidence: UK-tagged = high; no country tag = medium. Tag every accepted match.

## ENGINEERING RULES (learned the hard way)

- **Always test on a small sample (3–20) before a full run.** If "re-runs" produce identical output, the edit never saved — read the file on disk, don't trust the console.
- **Precision over coverage.** Better to leave a field empty than fill it with data a buyer would catch as wrong.
- **Fill empty fields ONLY — never overwrite** existing scraped/validated data.
- **Distinguish error from genuine miss** in logs: `fetch-failed` vs `no-confident-match`.
- **Reuse ONE browser instance**, close pages not the browser, relaunch every ~50 products to avoid memory leaks.
- **Checkpoint every 10–50 products**, resume from checkpoint on restart.
- **Random delays** 2–7s between requests; exponential backoff retry (1s/2s/4s) on fetch errors.
- **NEVER auto-delete match-audit files.** They are the QA/proof trail.
- **Back up a file before any destructive edit** (e.g. stripping a poisoned field).
- **Tesco uses Akamai bot detection** — keep stealth on; small batches, don't hammer.

## Output contracts

- Enriched output: `{store}-final-products-enriched.json` (never overwrite the original).
- Audit: `{store}-match-audit.json` with `our_name`, `matched_off_name`, `score`, `confidence`, `country_tags`, `accepted`, `reject_reason`.
- Final export: clean JSON + CSV to `/dist`, plus `quality-report.json` with per-store, per-field coverage and `data_quality_score`.

## What NOT to do

- Do NOT run OFF barcode lookup on Aldi/Iceland (no real EANs).
- Do NOT build a JSON-LD nutrition enricher (the stores don't put it there).
- Do NOT trust any "barcodes 100%" statement — it was a false audit.
- Do NOT merge the resolver and the offline clustering/enrichment into one live path.
- Do NOT include live PRICE in the sellable dataset (sell composition data; lower legal risk).
