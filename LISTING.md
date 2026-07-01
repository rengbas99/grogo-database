# UK Grocery Product Dataset — 1,658 Products, 4 Supermarkets

**Clean, structured UK grocery data with nutrition, ingredients, and EU-14 allergens.**

---

## What's Included

1,658 products scraped and enriched from four UK supermarkets: **Tesco**, **Iceland**, **Aldi**, and **Sainsbury's**. Every product has been normalised to a consistent schema, quality-scored, and exported as both JSON and CSV.

### Per-store coverage

| Store | Products | Nutrition | Ingredients | Allergens | Quality score (avg) |
|---|---|---|---|---|---|
| Tesco | 337 | 67.4% | 77.4% | 33.5% | 74 / 100 |
| Iceland | 326 | 62.3% | 67.2% | 9.2% | 70 / 100 |
| Aldi | 400 | 39.0% | — | 19.0% | 51 / 100 |
| Sainsbury's | 595 | 34.6% | 30.1% | 8.6% | 54 / 100 |
| **Total** | **1,658** | **47.8%** | **39.7%** | **16.3%** | **60 / 100** |

Quality score is a weighted composite: product name (25%), calories (20%), ingredients (20%), nutrition macros (15%), allergens (10%), barcode (10%).

---

## Strengths

- **Tesco and Iceland are the strongest stores.** Tesco: 77% ingredients coverage, 67% nutrition. Iceland: 67% ingredients, 62% nutrition. Both score 70+ on the quality index.
- **EU-14 allergen parsing.** Allergens are extracted from ingredients text and stored as a structured array where present — not just a raw string. Covers the 14 allergens required under UK/EU food labelling law.
- **Audit trail per data point.** Every enriched field links back to a match-audit record with the source, match score, confidence level (high/medium), and country tag. You can verify any value.
- **Nutrition values are numeric and per 100g/ml** — ready to compare, calculate, or ingest directly. No unit-parsing required.
- **Consistent schema across all four stores.** One file, one shape, regardless of source.

---

## Limitations — stated plainly

- **Nutrition coverage varies significantly by store.** Sainsbury's and Aldi are below 40%. If your use case requires near-complete nutrition across all products, this dataset is not there yet for those two stores.
- **No live prices.** This dataset contains product composition data only. Retail prices are not included.
- **No real EAN-13 barcodes.** Aldi and Iceland use internal IDs (article numbers and URL slugs). Tesco and Sainsbury's IDs are store-level identifiers, not guaranteed EAN-13. The `is_real_ean` flag is false for all records in this release.
- **Aldi ingredients not included.** Aldi ingredients could not be reliably extracted in this release. The field is empty across all 400 Aldi products.
- **~44% of products have calorie data overall.** Strong for Tesco/Iceland; low for Aldi/Sainsbury's.

---

## Who This Is For

**Nutrition and calorie-tracking app developers** — you need a clean, structured ingredient and macro dataset for UK products to power food logging or barcode scanning. Tesco (337 products, 77% ingredients) and Iceland (326, 67%) are directly usable. Sainsbury's provides breadth for name-matching even where nutrition is sparse.

**Health-tech startups building meal planning or dietary analysis tools** — you need EU-14 allergen data in a machine-readable format, not buried in raw label text. 270 products (16.3%) have structured allergen arrays, with full audit provenance.

**Academic and food-systems researchers** — you need a reproducible, documented snapshot of UK retail product composition across multiple supermarket tiers (budget, mid-market, mainstream). The quality-score methodology and match-audit files are included for methodological transparency.

---

## Schema

Each product record contains:

| Field | Type | Notes |
|---|---|---|
| `id` | string | Store-internal identifier |
| `store` | string | `tesco` / `iceland` / `aldi` / `sainsburys` |
| `name` | string | Product name, 100% coverage |
| `category` | string | Store-provided category |
| `url` | string | Source product URL |
| `nutrition` | object | Per 100g/ml: `energy_kcal`, `fat`, `saturates`, `carbohydrates`, `sugars`, `fibre`, `protein`, `salt` |
| `ingredients` | string | Raw ingredients text where available |
| `allergens` | array | EU-14 allergens extracted from ingredients |
| `barcode` | string | Store ID or slug — see `is_real_ean` |
| `is_real_ean` | boolean | `false` for all records in this release |
| `data_quality_score` | number | 0–100 weighted completeness score |

**Formats:** JSON array (`grogo-products.json`, 763 KB) and CSV (`grogo-products.csv`, 321 KB). A `quality-report.json` with per-store coverage statistics is included.

---

## FAQ

**Q: Can I use the barcodes to look up products in other databases (e.g. Open Food Facts)?**

Not reliably. Tesco and Sainsbury's IDs are internal store identifiers. Aldi and Iceland use article numbers and URL slugs respectively. None are EAN-13. If you need barcode-linked records, this dataset is not the right fit.

**Q: Why is Sainsbury's coverage lower than the other stores, given it's the largest set (595 products)?**

Sainsbury's nutrition and ingredients data is embedded in a JavaScript app-state object (`__NEXT_DATA__`) rather than in accessible HTML. Extraction requires page-by-page rendering. The 595 products were scraped; full per-product deep extraction is ongoing. The name, category, URL, and store ID are complete for all 595 — the data is there, the coverage reflects the current extraction state.

**Q: How recent is the data?**

Products were scraped and enriched in May–June 2026. Prices, product ranges, and nutritional information change regularly. This is a point-in-time snapshot, not a live feed.
