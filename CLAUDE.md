# Grogo MVP — Project Context for Claude Code

## What this project is
UK grocery product data pipeline. We scrape 5 UK supermarkets 
(Aldi, Iceland, Lidl, Tesco, Sainsbury's) and store structured 
product data in Firebase and local JSON files.

## Tech stack
- Node.js + Puppeteer (headless scraping)
- OpenFoodFacts API (enrichment fallback)
- Firebase (storage)
- All data files are JSON arrays of product objects

## Current data quality
- Aldi: 400 products — nutrition 100%, ingredients 100%, 
  barcodes 100%, allergens 0%, size 8%
- Iceland: 265 products — nutrition 100%, ingredients 100%, 
  barcodes 100%, allergens 0%  
- Sainsbury's: 595 products — nutrition 5.5%, ingredients 2.9%, 
  allergens 0% — CRITICAL PRIORITY
- Tesco: 337 products — nutrition 70.9%, ingredients 74.5%
- Lidl: 24 products — barcodes 0%, ingredients 0%

## Key rules
- Never overwrite existing non-empty fields, only fill empty ones
- Rate limit all scraping: 2–5 second random delay between requests
- Save progress every 50 products to allow resume on crash
- Output enrichment stats after every script run
- EU 14 allergens must be extracted from ingredients text