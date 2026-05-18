/* ═══════════════════════════════════════════════════
   APEX INDUSTRIAL — engine-local.js
   Catalog loaded dynamically from Firebase.
   Matching: pure local token-scoring algorithm (no API dependency).
   ═══════════════════════════════════════════════════ */

'use strict';

// ── Pricing bands (defaults; overwritten by Firebase sync) ─
let PRICE_BANDS = { budget: 0.45, mid: 0.53, premium: 0.65 };
const DEFAULT_BAND = 'mid';

let FAB_RATE = 0.12;
let LOGISTICS_RATE = 4.25;
let CONTINGENCY_PCT = 0.06;
let ERECT_PER_TON_LOW = 250;
let ERECT_PER_TON_HIGH = 350;
let ERECT_PER_TON_MID = 300;



// ── Token-score threshold: below this → flag as missing ─
const SCORE_THRESHOLD = 0.35;

// ── In-memory catalog (populated from Firebase) ───────
// Shape: [{ id, name, grade, tags: string[], priceLb, fabLb, note }]
let CATALOG = [];

// ══════════════════════════════════════════════════════
//  loadCatalog — reads Firebase `catalog` collection
// ══════════════════════════════════════════════════════
async function loadCatalog() {
  try {
    // Use the bridge set by firebase-config.js on window._lsFirestore,
    // since engine-local.js is a classic (non-module) script.
    const fs = window._lsFirestore;
    if (!fs) {
      console.warn('[LocalEngine] Firebase bridge not ready — retrying in 500ms');
      setTimeout(loadCatalog, 500);
      return;
    }
    const snap = await fs.getDocs(fs.collection(fs.db, 'catalog'));
    CATALOG = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      CATALOG.push({
        id: docSnap.id,
        name: d.name || '',
        grade: d.grade || '',
        tags: Array.isArray(d.tags) ? d.tags.map(t => String(t).toLowerCase()) : [],
        priceLb: parseFloat(d.priceLb) || 0,
        fabLb: parseFloat(d.fabLb) || 0,
        marginPct: d.marginPct !== undefined ? parseFloat(d.marginPct) : undefined,
        note: d.note || ''
      });
    });
    console.log('[LocalEngine] Catalog loaded: ' + CATALOG.length + ' items');
  } catch (err) {
    console.error('[LocalEngine] Failed to load catalog from Firebase:', err);
  }
}

// ══════════════════════════════════════════════════════
//  Token scoring (pure JS, offline, instant)
// ══════════════════════════════════════════════════════
function tokenize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function stem(word) {
  const w = word.toLowerCase();
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function isWordMatch(w_in, tag) {
  if (w_in === tag) return true;
  
  // Explicitly prevent "plated" or "plating" matching "plate"
  if (w_in === 'plated' && tag === 'plate') return false;
  if (w_in === 'plating' && tag === 'plate') return false;
  
  if (w_in.length >= 3 && tag.length >= 3) {
    if (w_in.includes(tag) || tag.includes(w_in)) {
      return true;
    }
  }
  return false;
}

function getSteelCategoryMatch(inputName) {
  const inputWords = tokenize(inputName).map(w => stem(w));
  if (!inputWords.length) return null;

  const STEEL_TAXONOMY = [
    {
      name: 'TMT Reinforcing Bars (Rebar)',
      tags: ['rebar', 'tmt', 'reinforcing', 'bar', 'bars']
    },
    {
      name: 'Hot-Dip Galvanized Sheets (HDGI)',
      tags: ['galvanized', 'galv', 'hdgi', 'sheet', 'sheets', 'coil', 'plate', 'grating', 'grate', 'grates']
    },
    {
      name: 'Wide Flange Beams (I-Beams / H-Beams)',
      tags: ['beam', 'beams', 'i-beam', 'h-beam', 'rail', 'rails', 'track', 'crane']
    },
    {
      name: 'Heavy Hot Rolled Plates',
      tags: ['plate', 'plates', 'tread', 'checker', 'diamond', 'girder', 'girders', 'heavy', 'rolled', 'hot']
    },
    {
      name: 'Hollow Structural Sections (HSS Tubing)',
      tags: ['tubing', 'tube', 'tubes', 'hss', 'hollow', 'pipe', 'pipes', 'railing', 'railings', 'ss', 'stainless']
    },
    {
      name: 'Structural Angles (L-Angles)',
      tags: ['angle', 'angles', 'l-angle', 'l-angles']
    },
    {
      name: 'Mild Steel Channels (C-Channels)',
      tags: ['channel', 'channels', 'c-channel', 'c-channels', 'purlin', 'purlins', 'girt', 'girts']
    },
    {
      name: 'Steel Wire Rods',
      tags: ['rod', 'rods', 'wire', 'wires', 'bolt', 'bolts', 'thread', 'threaded', 'turnbuckle', 'turnbuckles', 'anchor']
    },
    {
      name: 'Cold Rolled Coil (CRC)',
      tags: ['cold', 'crc', 'coil', 'coils']
    },
    {
      name: 'Hot Rolled Coil (HRC)',
      tags: ['hot', 'hrc', 'coil', 'coils']
    }
  ];

  let bestMatch = null;
  let maxScore = 0;

  for (const cat of STEEL_TAXONOMY) {
    const stemmedTags = cat.tags.map(t => stem(t));
    
    // Count how many input words match tags in this category
    let matches = 0;
    for (const w_in of inputWords) {
      const hasMatch = stemmedTags.some(tag => isWordMatch(w_in, tag));
      if (hasMatch) {
        matches++;
      }
    }

    const score = matches / inputWords.length;
    
    // Strict 60% threshold for confidence
    if (score >= 0.60 && score > maxScore) {
      maxScore = score;
      bestMatch = cat.name;
    }
  }

  return bestMatch;
}

function scoreItemAgainstCatalog(inputName) {
  // Returns { catalogEntry, score }  where score is 0–1
  const inputTokens = tokenize(inputName);
  if (!inputTokens.length || !CATALOG.length) return { catalogEntry: null, score: 0 };

  // Explicit blacklist to reject fictional or non-steel materials instantly
  const BLACKLIST = ['vibranium', 'unobtanium', 'unobtainium', 'kryptonite', 'adamantium', 'mythril', 'shielding', 'wood', 'concrete', 'plastic', 'glass', 'rubber'];
  if (inputTokens.some(t => BLACKLIST.includes(t))) {
    return { catalogEntry: null, score: 0 };
  }

  // 1. High-fidelity classification matching for standard B2B steel terms
  const targetCategory = getSteelCategoryMatch(inputName);
  if (targetCategory) {
    const matchedEntry = CATALOG.find(entry => entry.name.toLowerCase() === targetCategory.toLowerCase());
    if (matchedEntry) {
      return { catalogEntry: matchedEntry, score: 0.95 };
    }
  }

  let best = { catalogEntry: null, score: 0 };

  for (const entry of CATALOG) {
    const catalogTokens = tokenize([entry.name, ...entry.tags].join(' '));
    if (!catalogTokens.length) continue;

    const inputSet = new Set(inputTokens);
    const catalogSet = new Set(catalogTokens);

    // Complete keyword subset match (e.g., matching "TMT" to "TMT Reinforcing Bars (Rebar)" or "I-Beams" to "Wide Flange Beams (I-Beams / H-Beams)")
    let containsAll = true;
    for (const t of inputTokens) {
      const tMatch = catalogSet.has(t) || catalogTokens.some(ct => ct.length >= 3 && t.length >= 3 && (ct.includes(t) || t.includes(ct)));
      if (!tMatch) {
        containsAll = false;
        break;
      }
    }

    if (containsAll && inputTokens.length > 0) {
      const score = 0.8 + 0.15 * (inputTokens.length / catalogTokens.length);
      if (score > best.score) best = { catalogEntry: entry, score };
      continue;
    }

    let matches = 0;
    inputSet.forEach(t => { if (catalogSet.has(t)) matches++; });

    // Partial-token bonus for longer tokens (maximum of one 0.4 bonus per input token to prevent tag-duplication inflation)
    inputTokens.forEach(t => {
      if (t.length >= 3) {
        const hasPartial = catalogTokens.some(ct =>
          ct.length >= 3 && ct !== t && (ct.includes(t) || t.includes(ct))
        );
        if (hasPartial) {
          matches += 0.4;
        }
      }
    });

    const union = inputSet.size + catalogSet.size - matches;
    const score = union > 0 ? matches / union : 0;
    if (score > best.score) best = { catalogEntry: entry, score };
  }

  return best;
}

// ══════════════════════════════════════════════════════
//  resolveItem — Local Text Parsing
// ══════════════════════════════════════════════════════
async function resolveItem(inputName) {
  const { catalogEntry, score } = scoreItemAgainstCatalog(inputName);

  if (catalogEntry && score >= SCORE_THRESHOLD) {
    return catalogEntry;
  }

  console.warn(`[LocalEngine] No confident match for "${inputName}" (score: ${score.toFixed(2)}). Flagging as missing.`);
  return null;
}

// ══════════════════════════════════════════════════════
//  CSV / parsing utilities
// ══════════════════════════════════════════════════════
const COL_MAP = {
  item: ['item', 'material', 'description', 'desc', 'name', 'product', 'steel type', 'type', 'steel', 'category'],
  quantity: ['quantity', 'qty', 'amount', 'count', 'volume', 'no', 'nos', 'number', 'pcs', 'pieces'],
  unit: ['unit', 'uom', 'units', 'measure', 'u/m'],
  grade: ['grade', 'spec', 'specification', 'standard', 'class'],
  length_ft: ['length_ft', 'length', 'len', 'length (ft)', 'ft', 'feet', 'l (ft)'],
  weight_lbs: ['weight_lbs', 'weight', 'wt', 'lbs', 'pounds', 'weight (lbs)', 'mass'],
  weight_tons: ['weight_tons', 'tons', 'short tons', 'ton', 'tonnes', 'mt', 'metric ton'],
  unit_price: ['unit_price', 'price', 'rate', 'cost', 'unit cost', '$/lb', 'price/lb', 'mill price'],
};

function parseCsvLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for (const c of line) {
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  result.push(cur.trim());
  return result;
}

function normHeader(h) {
  return String(h).toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
}

function findCol(headers, key) {
  const synonyms = COL_MAP[key] || [key];
  for (let i = 0; i < headers.length; i++) {
    const h = normHeader(headers[i]);
    if (synonyms.some(s => h === s || h.includes(s))) return i;
  }
  return -1;
}

function toWeightLbs(qty, unit, lengthFt) {
  if (!qty || isNaN(qty)) return 0;
  const u = String(unit || '').toLowerCase().replace(/[^a-z]/g, '');
  if (u === 'tons' || u === 'ton' || u === 'shorttons') return qty * 2000;
  if (u === 'mt' || u === 'metricton' || u === 'tonnes') return qty * 2204.62;
  if (u === 'kg' || u === 'kilograms') return qty * 2.20462;
  if (u === 'lbs' || u === 'lb' || u === 'pounds') return qty;
  if (u === 'ft' || u === 'feet' || u === 'lf') return qty * 0.668;
  if (u === 'sqft' || u === 'sf' || u === 'm2') return qty * 4.5;
  return qty; // fallback: treat as lbs
}

const cleanName = v => String(v || '')
  .replace(/^[,;:\-\s]+/, '').replace(/[,;:\-\s]+$/, '').replace(/\s{2,}/g, ' ').trim();

// ══════════════════════════════════════════════════════
//  calcFromText
// ══════════════════════════════════════════════════════
async function calcFromText(text, opts = {}) {
  const { erection = 'no', buildType = 'residential' } = opts;
  const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error('No text input found. Paste requirements into the text box.');

  const unitPattern = '(?:tons?|tonnes?|t|lbs?|pounds?|kg|kgs?|pcs?|pieces?|sqft|sq\\s*ft|ft|feet)';
  const qtyUnitRx = new RegExp(`([0-9][0-9,]*(?:\\.[0-9]+)?)\\s*(${unitPattern})\\b`, 'gi');

  let rawMaterials = [], totalWeightLbs = 0, unavailable = [];

  for (const rawLine of lines) {
    const fragments = rawLine.split(/\s*;\s*|\s+,\s+/).map(p => p.trim()).filter(Boolean);
    const entries = [];

    for (const fragment of fragments) {
      const matches = [...fragment.matchAll(qtyUnitRx)];
      if (!matches.length) continue;

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const nextMatch = matches[i + 1];
        let qty = parseFloat(match[1].replace(/,/g, '')) || 0;
        let unit = String(match[2] || '').toLowerCase().replace(/\.|s$/g, '').trim();
        if (unit === 't') unit = 'tons';

        const before = cleanName(fragment.slice(0, match.index));
        const after = cleanName(fragment.slice(match.index + match[0].length, nextMatch ? nextMatch.index : fragment.length));
        const name = before && after
          ? (before.length >= after.length ? before : after)
          : (before || after || fragment);

        entries.push({ qty, unit, name: cleanName(name) || fragment });
      }
    }

    for (const entry of entries) {
      if (!entry.qty || entry.qty <= 0) continue;
      const weightLbs = toWeightLbs(entry.qty, entry.unit, 0);
      if (weightLbs <= 0) continue;

      const catalogEntry = await resolveItem(entry.name);
      if (!catalogEntry) {
        unavailable.push({ name: entry.name || rawLine, qty: entry.qty, unit: entry.unit });
        continue;
      }

      totalWeightLbs += weightLbs;
      const pricePerLb = catalogEntry.priceLb || PRICE_BANDS[DEFAULT_BAND];
      const fabPerLb = catalogEntry.fabLb || 0;
      const marginPct = catalogEntry.marginPct !== undefined ? catalogEntry.marginPct : (CONTINGENCY_PCT * 100);
      const loadedRate = (pricePerLb + fabPerLb) * (1 + marginPct / 100);
      const lineTotal = weightLbs * loadedRate;

      rawMaterials.push({
        itemName: catalogEntry.name,
        qty: entry.qty,
        unit: entry.unit,
        weightLbs: weightLbs,
        basePriceLb: pricePerLb,
        fabLb: fabPerLb,
        marginPct: marginPct,
        loadedRate: loadedRate,
        amount: Math.round(lineTotal)
      });
    }
  }

  if (!rawMaterials.length) {
    if (unavailable.length) return _buildQuoteObject([], 0, erection, buildType, 'text', unavailable);
    throw new Error('No available items parsed from text. Check the pasted requirements and the catalog.');
  }
  return _buildQuoteObject(rawMaterials, totalWeightLbs, erection, buildType, 'text', unavailable);
}

// ══════════════════════════════════════════════════════
//  calcFromCsv
// ══════════════════════════════════════════════════════
async function calcFromCsv(csvText, opts = {}) {
  const { erection = 'no', buildType = 'residential' } = opts;
  const lines = csvText.trim().split('\n').filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');

  const headers = parseCsvLine(lines[0]);
  const ci = {
    item: findCol(headers, 'item'),
    qty: findCol(headers, 'quantity'),
    unit: findCol(headers, 'unit'),
    grade: findCol(headers, 'grade'),
    lengthFt: findCol(headers, 'length_ft'),
    weightLbs: findCol(headers, 'weight_lbs'),
    weightTons: findCol(headers, 'weight_tons'),
  };
  if (ci.qty === -1) {
    for (let i = 0; i < headers.length; i++) {
      if (i !== ci.item) { ci.qty = i; break; }
    }
  }

  let rawMaterials = [], totalWeightLbs = 0, unavailable = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.every(c => !c)) continue;

    const itemName = ci.item >= 0 ? cells[ci.item] || `Item ${i}` : `Item ${i}`;
    const qty = parseFloat(ci.qty >= 0 ? cells[ci.qty] : 0) || 0;
    const unit = ci.unit >= 0 ? cells[ci.unit] || 'lbs' : 'lbs';
    const grade = ci.grade >= 0 ? cells[ci.grade] || '' : '';
    const lengthFt = parseFloat(ci.lengthFt >= 0 ? cells[ci.lengthFt] : 0) || 0;

    let weightLbs = 0;
    if (ci.weightLbs >= 0 && parseFloat(cells[ci.weightLbs]))
      weightLbs = parseFloat(cells[ci.weightLbs]);
    else if (ci.weightTons >= 0 && parseFloat(cells[ci.weightTons]))
      weightLbs = parseFloat(cells[ci.weightTons]) * 2000;
    else
      weightLbs = toWeightLbs(qty, unit, lengthFt);

    if (weightLbs <= 0) continue;

    const catalogEntry = await resolveItem(itemName);
    if (!catalogEntry) { unavailable.push({ name: itemName, qty: qty, unit: unit }); continue; }

    totalWeightLbs += weightLbs;
    const pricePerLb = catalogEntry.priceLb || PRICE_BANDS[DEFAULT_BAND];
    const fabPerLb = catalogEntry.fabLb || 0;
    const marginPct = catalogEntry.marginPct !== undefined ? catalogEntry.marginPct : (CONTINGENCY_PCT * 100);
    const loadedRate = (pricePerLb + fabPerLb) * (1 + marginPct / 100);
    const lineTotal = weightLbs * loadedRate;

    rawMaterials.push({
      itemName: catalogEntry.name + (grade ? ` (${grade})` : ''),
      qty: qty,
      unit: unit,
      weightLbs: weightLbs,
      basePriceLb: pricePerLb,
      fabLb: fabPerLb,
      marginPct: marginPct,
      loadedRate: loadedRate,
      amount: Math.round(lineTotal)
    });
  }

  if (!rawMaterials.length) {
    if (unavailable.length) return _buildQuoteObject([], 0, erection, buildType, 'csv', unavailable);
    throw new Error('No available items found in CSV. Check column headers or the catalog.');
  }
  return _buildQuoteObject(rawMaterials, totalWeightLbs, erection, buildType, 'csv', unavailable);
}

// ══════════════════════════════════════════════════════
//  calcFromPreset  (entry.id = Firebase catalog doc ID)
// ══════════════════════════════════════════════════════
function calcFromPreset(presetEntries, opts = {}) {
  const { erection = 'no', buildType = 'residential' } = opts;
  let rawMaterials = [], totalWeightLbs = 0;

  for (const entry of presetEntries) {
    const cfg = CATALOG.find(c => c.id === entry.id);
    if (!cfg) continue;

    const weightLbs = toWeightLbs(entry.qty, entry.unit, 0);
    if (weightLbs <= 0) continue;

    const pricePerLb = cfg.priceLb || PRICE_BANDS[DEFAULT_BAND];
    const fabPerLb = cfg.fabLb || 0;
    const marginPct = cfg.marginPct !== undefined ? cfg.marginPct : (CONTINGENCY_PCT * 100);
    const loadedRate = (pricePerLb + fabPerLb) * (1 + marginPct / 100);
    const lineTotal = weightLbs * loadedRate;

    totalWeightLbs += weightLbs;
    rawMaterials.push({
      itemName: cfg.name,
      qty: entry.qty,
      unit: entry.unit,
      weightLbs: weightLbs,
      basePriceLb: pricePerLb,
      fabLb: fabPerLb,
      marginPct: marginPct,
      loadedRate: loadedRate,
      amount: Math.round(lineTotal)
    });
  }

  if (!rawMaterials.length) throw new Error('No valid quantities entered.');
  return _buildQuoteObject(rawMaterials, totalWeightLbs, erection, buildType, 'preset', []);
}

// ══════════════════════════════════════════════════════
//  _buildQuoteObject (shared)
// ══════════════════════════════════════════════════════
function _buildQuoteObject(rawMaterials, totalWeightLbs, erection, buildType, sourceMode, unavailableList = []) {
  const tons = totalWeightLbs / 2000;

  const module2 = [];
  rawMaterials.forEach(m => {
    module2.push({
      item: m.itemName,
      qty: m.qty,
      unit: m.unit,
      rate: `$${m.loadedRate.toFixed(3)} / lb`,
      rateVal: m.loadedRate,
      amount: m.amount,
      note: `Base: $${m.basePriceLb.toFixed(3)}/lb, Fab: $${m.fabLb.toFixed(3)}/lb, Margin: ${m.marginPct}%`
    });
  });

  let module4 = [];
  if (erection === 'yes') {
    const cost = Math.round(tons * ERECT_PER_TON_MID);
    module4 = [{
      item: 'Erection & Crane Operations',
      qty: parseFloat(tons.toFixed(2)),
      unit: 'tons',
      rate: `$${ERECT_PER_TON_MID} / ton`,
      rateVal: ERECT_PER_TON_MID,
      amount: cost,
      note: 'Field assembly, crane operations, and site management safety compliance'
    }];
  }

  // Calculate Weighted blended margin percentage for approvals validation
  let totalBaseCost = 0;
  let totalMarginCost = 0;
  rawMaterials.forEach(m => {
    const base = m.weightLbs * (m.basePriceLb + m.fabLb);
    const margin = base * (m.marginPct / 100);
    totalBaseCost += base;
    totalMarginCost += margin;
  });

  const blendedMarginPercent = totalBaseCost > 0
    ? Math.round(totalMarginCost / totalBaseCost * 100)
    : Math.round(CONTINGENCY_PCT * 100);

  let approvalStatus = 'Requires Executive/Director Override';
  let approvalClass = 'status-red';

  if (blendedMarginPercent >= 25) {
    approvalStatus = 'Auto-Approved';
    approvalClass = 'status-green';
  } else if (blendedMarginPercent >= 15) {
    approvalStatus = 'Pending Sales Manager Sign-off';
    approvalClass = 'status-yellow';
  }

  const buildLabel = { residential: 'Residential', commercial: 'Commercial', industrial: 'Industrial' }[buildType] || buildType;

  return {
    summary: `${buildLabel} run · ${tons.toFixed(2)} short tons · May 2026 mill indexing.`,
    totalWeightTons: parseFloat(tons.toFixed(2)),
    module1: [],
    module2,
    module3: [],
    module4,
    module5: [],
    _meta: {
      source: sourceMode,
      priceDate: 'May 2026',
      priceBand: `Standard ($${PRICE_BANDS.mid.toFixed(3)}/lb base)`,
      grade: 'ASTM Grade Steel - Catalog Certified',
      disclaimer: 'Electronic RFQ pricing summary - official contract binding pending final review.',
      unavailable: unavailableList || [],
      rawMaterials: rawMaterials, // FULL details saved for Admin inspector!
      approvals: {
        marginPercent: blendedMarginPercent,
        status: approvalStatus,
        statusClass: approvalClass
      }
    }
  };
}

// ── Public API ─────────────────────────────────────────
window.LocalEngine = {
  calcFromCsv,
  calcFromPreset,
  calcFromText,
  loadCatalog,
  _buildQuoteObject,
  toWeightLbs,

  get CATALOG() { return CATALOG; },
  get PRICE_BANDS() { return PRICE_BANDS; },
  get SERVICE_RATES() {
    return {
      fabRate: FAB_RATE,
      logisticsRate: LOGISTICS_RATE,
      contingencyPct: CONTINGENCY_PCT,
      erectLow: ERECT_PER_TON_LOW,
      erectHigh: ERECT_PER_TON_HIGH
    };
  },

  updatePricingData(newData) {
    if (newData.priceBands) PRICE_BANDS = newData.priceBands;
    if (newData.serviceRates) {
      FAB_RATE = newData.serviceRates.fabRate;
      LOGISTICS_RATE = newData.serviceRates.logisticsRate;
      CONTINGENCY_PCT = newData.serviceRates.contingencyPct;
      ERECT_PER_TON_LOW = newData.serviceRates.erectLow;
      ERECT_PER_TON_HIGH = newData.serviceRates.erectHigh;
      ERECT_PER_TON_MID = (ERECT_PER_TON_LOW + ERECT_PER_TON_HIGH) / 2;
    }
    console.log('[LocalEngine] Pricing updated from Firebase');
  }
};

// Load catalog once auth is confirmed (avoids Firestore permission errors)
window.addEventListener('authStateReady', () => loadCatalog());
// Also try immediately in case authStateReady already fired
if (window._lsFirestore) loadCatalog();
