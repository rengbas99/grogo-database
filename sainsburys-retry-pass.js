'use strict';

/**
 * sainsburys-retry-pass.js
 *
 * Targeted retry for:
 *  - 78 products that timed out in the main run (outcome=error in audit)
 *  - 7 products never attempted (null nutrition, not in checkpoint)
 *
 * Skips confirmed-delisted (276 products) entirely.
 * Appends results to sainsburys-nutrition-audit.json.
 * Writes updated data to sainsburys-normalised.json.
 */

const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin  = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());

const fs   = require('fs');
const path = require('path');

process.on('uncaughtException', err => {
  if (/rimraf|is not a function/i.test(err.message)) return;
  console.error('Uncaught:', err.message); process.exit(1);
});

// ── Paths ─────────────────────────────────────────────────────────────────────
const BASE          = path.join(__dirname, 'final-products/sainsbury');
const DATA_FILE     = path.join(BASE, 'sainsburys-normalised.json');
const MAIN_CKPT     = path.join(__dirname, 'sainsburys-enrich-checkpoint.json');
const RETRY_CKPT    = path.join(__dirname, 'sainsburys-retry-checkpoint.json');
const AUDIT_FILE    = path.join(BASE, 'sainsburys-nutrition-audit.json');
const ORIG_FILE     = path.join(BASE, 'sainsbury-final-products-enriched.json');
const BASE_URL      = 'https://www.sainsburys.co.uk';

// ── Config ─────────────────────────────────────────────────────────────────────
const RELAUNCH_EVERY   = 30;   // more frequent relaunch to stay under radar
const CHECKPOINT_EVERY = 10;
const PROGRESS_EVERY   = 10;
const BASE_DELAY_MIN   = 5000;
const BASE_DELAY_MAX   = 8000;
const RETRY_DELAY      = 15000; // wait 15s before first retry
const RETRY_DELAY_2    = 30000; // wait 30s before second retry
const TIMEOUT_1        = 45000; // first attempt
const TIMEOUT_2        = 55000; // retry 1
const TIMEOUT_3        = 65000; // retry 2

// ── Nutrition parsing (same as main script) ───────────────────────────────────
const LABEL_MAP = {
  'energy':'calories','energy (kj)':'kj_only','energy (kcal)':'calories',
  'energy kj':'kj_only','energy kcal':'calories',
  'fat':'fat','total fat':'fat',
  'saturated fat':'saturates','saturates':'saturates','of which saturates':'saturates',
  'carbohydrate':'carbs','carbohydrates':'carbs','total carbohydrate':'carbs',
  'of which carbohydrate':'carbs',
  'of which sugars':'sugars','sugars':'sugars','of which: sugars':'sugars',
  'protein':'protein','salt':'salt',
};
function normLabel(s) { return s.toLowerCase().trim().replace(/^\(+|\)+$/g,'').trim(); }
function parseNum(val) {
  if (val==null) return null;
  const s = String(val).trim();
  if (!s||s==='-') return null;
  if (/^trace$/i.test(s)) return 0;
  const kcal = s.match(/(\d+(?:\.\d+)?)\s*kcal/i);
  if (kcal) return parseFloat(kcal[1]);
  if (/kj/i.test(s)) return null;
  const m = s.match(/[<>≈~]?\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}
function parseKj(val) {
  if (!val) return null;
  const m = String(val).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}
function buildNutrition(rows) {
  const out = { calories_per_100g:null,fat:null,saturates:null,carbs:null,sugars:null,protein:null,salt:null };
  let kjAccum=null, unit_converted=false;
  for (const {label,per100} of rows) {
    const key = LABEL_MAP[normLabel(label)];
    if (!key) continue;
    if (key==='kj_only') { if (kjAccum===null) kjAccum=parseKj(per100); continue; }
    const field = key==='calories'?'calories_per_100g':key;
    if (out[field]!==null) continue;
    let val = parseNum(per100);
    if (field==='calories_per_100g' && val!==null && val>900) { val=Math.round(val/4.184); unit_converted=true; }
    out[field] = val;
  }
  if (out.calories_per_100g===null && kjAccum!==null) { out.calories_per_100g=Math.round(kjAccum/4.184); unit_converted=true; }
  if (typeof out.calories_per_100g==='number') out.calories_per_100g=Math.round(out.calories_per_100g);
  const hasAny = Object.values(out).some(v=>v!==null);
  return hasAny ? {...out,unit_converted} : null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r=>setTimeout(r,ms)); }
function randDelay(min,max) { return delay(min+Math.random()*(max-min)); }

function loadJson(f) { try { return JSON.parse(fs.readFileSync(f,'utf8')); } catch(_) { return null; } }
function saveJson(f,d) { fs.writeFileSync(f,JSON.stringify(d,null,2)); }

function flushAudit(pending) {
  if (!pending.length) return;
  const existing = loadJson(AUDIT_FILE) || [];
  saveJson(AUDIT_FILE, [...existing,...pending]);
}

// ── Page scraper with retry ───────────────────────────────────────────────────
async function scrapePage(browser, slug, attempt=1) {
  const timeout = attempt===1 ? TIMEOUT_1 : attempt===2 ? TIMEOUT_2 : TIMEOUT_3;
  const url = BASE_URL + slug;

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  await page.setViewport({width:1280,height:900});

  try {
    const resp = await page.goto(url, {waitUntil:'networkidle2', timeout});
    const status = resp.status();
    if (status>=400) throw new Error(`HTTP ${status}`);

    await delay(1200);
    await page.evaluate(()=>document.querySelector('#onetrust-accept-btn-handler')?.click()).catch(()=>{});

    const title = await page.title();
    if (/oops|online grocery shopping/i.test(title)) return {outcome:'delisted', status};

    // Click nutrition accordion
    const clickResult = await page.evaluate(()=>{
      const item = [...document.querySelectorAll('[data-testid="accordion-item"]')]
        .find(el=>/^nutrition$/i.test(el.querySelector('.ds-c-accordion-item__label--text')?.innerText?.trim()));
      if (!item) return 'no-accordion';
      const det = item.querySelector('details');
      if (!det) return 'no-details';
      if (!det.open) { det.querySelector('summary')?.click(); return 'clicked'; }
      return 'already-open';
    });

    if (clickResult==='clicked') await delay(1500);

    const data = await page.evaluate(()=>{
      const res = {};
      const table = document.querySelector('table.ds-c-table');
      res.table_found = !!table;
      res.raw_rows = [];
      if (table) {
        const headers = [...table.querySelectorAll('thead th,thead td')].map(c=>c.innerText.trim());
        res.headers = headers;
        // Skip index 0 — always the label column
        res.per100_idx = headers.findIndex((h,i)=>i>0 && /per\s*100/i.test(h));
        let last='';
        table.querySelectorAll('tbody tr').forEach(tr=>{
          const cells=[...tr.querySelectorAll('td,th')].map(c=>c.innerText.trim());
          if (!cells.length) return;
          const label=cells[0]||last; if(cells[0])last=cells[0];
          const per100=res.per100_idx>=0?cells[res.per100_idx]:cells[cells.length-1];
          res.raw_rows.push({label,per100});
        });
      }
      const getAcc = re=>{
        const item=[...document.querySelectorAll('[data-testid="accordion-item"]')]
          .find(el=>re.test(el.querySelector('.ds-c-accordion-item__label--text')?.innerText?.trim()));
        if(!item)return null;
        const det=item.querySelector('details'); if(!det)return null;
        const cl=det.cloneNode(true); cl.querySelector('summary')?.remove();
        return cl.innerText.trim()||null;
      };
      res.raw_ingredients = getAcc(/^ingredients$/i);
      res.raw_allergens   = getAcc(/^allergen/i);
      return res;
    });

    let ingredients = data.raw_ingredients||null;
    if (ingredients) { ingredients=ingredients.replace(/^ingredients?:\s*/i,'').trim(); if(ingredients.length<=3)ingredients=null; }
    let allergens = data.raw_allergens||null;
    if (allergens) { allergens=allergens.replace(/^allergen[s]?:\s*/i,'').trim(); if(allergens.length<=3)allergens=null; }

    const nutrition = buildNutrition(data.raw_rows);
    return {outcome:'ok', status, clickResult, table_found:data.table_found, nutrition, ingredients, allergens};

  } finally {
    await page.close().catch(()=>{});
  }
}

async function scrapeWithRetry(browser, browserRef, slug, name) {
  for (let attempt=1; attempt<=3; attempt++) {
    try {
      return await scrapePage(browserRef.browser, slug, attempt);
    } catch(err) {
      if (attempt<3 && /timeout|TIMEOUT|Navigation|net::/i.test(err.message)) {
        const waitMs = attempt===1 ? RETRY_DELAY : RETRY_DELAY_2;
        console.log(`    timeout on attempt ${attempt}, waiting ${waitMs/1000}s before retry...`);
        await delay(waitMs);
        continue;
      }
      throw err;
    }
  }
}

// ── Browser factory ───────────────────────────────────────────────────────────
async function launchBrowser() {
  return puppeteerExtra.launch({
    headless:'new',
    args:['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled'],
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async()=>{
  // Load data
  const products  = loadJson(DATA_FILE);
  const mainCkpt  = loadJson(MAIN_CKPT) || {completed:{}};
  const retryCkpt = loadJson(RETRY_CKPT) || {completed:{}};
  const audit     = loadJson(AUDIT_FILE) || [];

  // Build slug map
  const origData = loadJson(ORIG_FILE);
  const origProds = origData?.products || origData || [];
  const slugMap = {};
  origProds.forEach(p=>{ if(p.uid&&p.url) slugMap[String(p.uid)]=p.url.replace(/^https?:\/\/[^/]+/,''); });

  // Fast index
  const idxMap = new Map(products.map((p,i)=>[p.barcode.value,i]));

  // Errored UIDs from audit
  const erroredUids = new Set(audit.filter(e=>e.outcome==='error').map(e=>e.uid));
  // Confirmed delisted — skip entirely
  const delistedUids = new Set(audit.filter(e=>e.outcome==='delisted').map(e=>e.uid));

  // Build target list:
  // 1. errored products (in checkpoint but errored) — retry regardless of checkpoint
  // 2. untouched products (null nutrition, has slug, not in checkpoint, not delisted)
  const targets = [];

  // Errored — pull slug from audit
  for (const e of audit.filter(a=>a.outcome==='error')) {
    if (!retryCkpt.completed[e.uid]) {
      targets.push({uid:e.uid, product_name:e.product_name, slug:e.slug, source:'errored'});
    }
  }

  // Untouched
  for (const p of products) {
    const uid = p.barcode.value;
    if (p.nutrition!==null) continue;
    if (mainCkpt.completed[uid]) continue; // already attempted in main run
    if (delistedUids.has(uid)) continue;   // confirmed dead
    if (!slugMap[uid]) continue;
    if (retryCkpt.completed[uid]) continue; // already done in this retry run
    targets.push({uid, product_name:p.product_name, slug:slugMap[uid], source:'untouched'});
  }

  console.log(`Sainsbury's retry pass`);
  console.log(`Errored (timeout retry): ${targets.filter(t=>t.source==='errored').length}`);
  console.log(`Untouched (new):         ${targets.filter(t=>t.source==='untouched').length}`);
  console.log(`Total targets:           ${targets.length}`);
  console.log(`Delays: ${BASE_DELAY_MIN/1000}–${BASE_DELAY_MAX/1000}s | relaunch every ${RELAUNCH_EVERY}`);
  console.log();

  const browserRef = { browser: await launchBrowser() };
  let pageCount=0, nutritionFilled=0, ingredientsFilled=0;
  let delisted=0, noSection=0, errors=0, processed=0;
  const pendingAudit=[];

  const flush=()=>{
    saveJson(DATA_FILE, products);
    saveJson(RETRY_CKPT, retryCkpt);
    flushAudit(pendingAudit.splice(0));
  };

  for (const target of targets) {
    const {uid,product_name,slug} = target;
    const idx = idxMap.get(uid);

    if (pageCount>0 && pageCount%RELAUNCH_EVERY===0) {
      console.log(`  → relaunching browser at page ${pageCount}`);
      await browserRef.browser.close().catch(()=>{});
      await delay(3000);
      browserRef.browser = await launchBrowser();
    }

    const audit_entry = {
      uid, product_name, slug,
      outcome:null, nutrition_filled:false, ingredients_filled:false,
      allergens_filled:false, unit_converted:false,
      retry_source: target.source, error:null,
      scraped_at: new Date().toISOString(),
    };

    try {
      const result = await scrapeWithRetry(browserRef.browser, browserRef, slug, product_name);
      audit_entry.outcome = result.outcome;

      if (result.outcome==='delisted') {
        delisted++;
      } else if (!result.table_found || result.clickResult==='no-accordion') {
        noSection++;
      } else {
        if (result.nutrition!==null && products[idx].nutrition===null) {
          const {unit_converted,...nut} = result.nutrition;
          products[idx].nutrition = nut;
          nutritionFilled++;
          audit_entry.nutrition_filled=true;
          audit_entry.unit_converted=unit_converted;
        }
        if (result.ingredients && !products[idx].ingredients) {
          products[idx].ingredients=result.ingredients;
          ingredientsFilled++;
          audit_entry.ingredients_filled=true;
        }
        if (result.allergens && !products[idx].allergens?.length) {
          products[idx].allergens=[result.allergens];
          audit_entry.allergens_filled=true;
        }
      }
    } catch(err) {
      errors++;
      audit_entry.outcome='error';
      audit_entry.error=err.message;
      console.log(`  ✗ [${product_name.slice(0,50)}]: ${err.message}`);
    }

    pendingAudit.push(audit_entry);
    retryCkpt.completed[uid]=true;
    processed++; pageCount++;

    if (processed%CHECKPOINT_EVERY===0) flush();

    if (processed%PROGRESS_EVERY===0) {
      console.log(
        `[${processed}/${targets.length}] | `+
        `nutrition filled: ${nutritionFilled} | `+
        `ingredients: ${ingredientsFilled} | `+
        `delisted: ${delisted} | no-section: ${noSection} | errors: ${errors}`
      );
    }

    await randDelay(BASE_DELAY_MIN, BASE_DELAY_MAX);
  }

  flush();
  await browserRef.browser.close().catch(()=>{});

  console.log();
  console.log('══════════════════════════════════════════════');
  console.log('RETRY PASS COMPLETE');
  console.log(`Processed:          ${processed}`);
  console.log(`Nutrition filled:   ${nutritionFilled}  ← of ${targets.filter(t=>t.source==='errored').length} errored + ${targets.filter(t=>t.source==='untouched').length} untouched`);
  console.log(`Ingredients filled: ${ingredientsFilled}`);
  console.log(`Delisted (also dead):${delisted}`);
  console.log(`No section (genuinely empty): ${noSection}`);
  console.log(`Still erroring:     ${errors}`);

  // ── Disk verification ─────────────────────────────────────────────────────
  console.log();
  console.log('══════════════════════════════════════════════');
  console.log('DISK VERIFICATION');
  const saved = JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));
  const junkRe = /une eau min[eé]rale naturelle|acqua minerale|wasser|agua mineral/i;

  const vNut = saved.filter(p=>{
    const n=p.nutrition; return n&&typeof n==='object'&&Object.values(n).some(v=>typeof v==='number');
  }).length;
  const vIng  = saved.filter(p=>p.ingredients&&p.ingredients.length>5).length;
  const vJunk = saved.filter(p=>p.ingredients&&junkRe.test(p.ingredients)).length;
  const vHigh = saved.filter(p=>p.nutrition?.calories_per_100g>900).length;
  const auditCount = (loadJson(AUDIT_FILE)||[]).length;

  console.log(`Total products:          ${saved.length}`);
  console.log(`Real numeric nutrition:  ${vNut} / ${saved.length} (${(vNut/saved.length*100).toFixed(1)}%)`);
  console.log(`Non-empty ingredients:   ${vIng} / ${saved.length} (${(vIng/saved.length*100).toFixed(1)}%)`);
  console.log(`Junk ingredients:        ${vJunk} (must be 0)`);
  console.log(`Calories >900 (kJ leak): ${vHigh} (must be 0)`);
  console.log(`Audit entries total:     ${auditCount}`);

  const withNut = saved.filter(p=>p.nutrition!==null);
  const samples = withNut.sort(()=>Math.random()-0.5).slice(0,10);
  console.log();
  console.log('── 10 random samples ──');
  for (const p of samples) {
    const cal = p.nutrition?.calories_per_100g??'—';
    const ing = (p.ingredients||'(null)').slice(0,55);
    console.log(`  ${p.product_name.slice(0,52)}`);
    console.log(`    cal=${cal} | ${ing}`);
  }
})().catch(e=>{console.error('Fatal:',e.message);process.exit(1);});
