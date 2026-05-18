/* ═══════════════════════════════════════════════════
   APEX INDUSTRIAL — engine.js
   Router:
     CSV    → LocalEngine.calcFromCsv()   (no API)
     Preset → LocalEngine.calcFromPreset() (no API)
     Image  → Gemini 2.0 Flash via proxy  (free tier)
   ═══════════════════════════════════════════════════ */

'use strict';

// ── Apex calibration context (image mode only) ────
const CALIBRATION_CONTEXT = `
You are a steel cost estimator for Apex Industrial Steel & Coil Corp. Use US units (lbs, short tons, sq ft, USD) and catalog-certified ASTM grade carbon steel by default.

QUANTITY
Formula: Total lbs = sq ft x intensity x 1.06 (6% margin reserve). Short tons = lbs / 2000.
Intensities: slab-only 2-3 | 1-story home+footings 4-5 (default 4.5) | 2-story+staircase 5-6.5 | basement+2-story 6.5-8 | light commercial 8-11 lbs/sq ft.

ELEMENT SPLIT (apply to adjusted total or extract from CSV if provided)
Foundation/footings 22-25% | #4-#5
Columns/piers 16-18% | #4-#6
Grade beams/lintels 18-20% | #4-#5
Floor/roof slab 20-24% | #3-#4
Stirrups/ties 7-8% | #3
Headers 5-6% | #3-#4
Staircase (if present) 4-5% | #4-#5

PRICING — May 2026 Apex Industrial base pricing:
budget $0.45/lb ($900/ton) | mid $0.53/lb ($1,050/ton) | premium $0.65/lb ($1,300/ton)
Note: Mill indexing updated May 2026. Flag if time-sensitive.

COST LINES (always keep separate)
Material: lbs x price/lb
Fabrication (optional): lbs x $0.10-0.15/lb
Install labor (optional): sq ft x $1.00-1.75

ALWAYS DISCLOSE
- Price source used and date
- Grade: ASTM catalog certified steel assumed unless stated
- Which elements included/excluded
- Fab and labor are contractor charges, not plant charges
- Not a substitute for PE-stamped engineering takeoff
- Note: Final costs may vary by ±$500.`;

const SYSTEM_IMAGE = `You are the Apex Industrial Steel Cost Estimator. Follow the CALIBRATION_CONTEXT exactly.
CRITICAL: Return ONLY valid JSON in this exact format, no markdown, no extra text:
{
  "summary": "Project estimate summary",
  "totalWeightTons": number,
  "module1": [],
  "module2": [{"item":"Element Name","basis":"Qty","rate":"$Rate","amount":number,"note":""}],
  "module3": [{"item":"Logistics","basis":"Mileage","rate":"$4.25","amount":number,"note":""}],
  "module4": [{"item":"Erection/Installation","basis":"Labor","rate":"$1.35/sqft","amount":number,"note":""}],
  "module5": [{"item":"Margin","basis":"Direct margin","rate":"6%","amount":number,"note":""}]
}`;

// ── API endpoint (proxy → Gemini 2.0 Flash) ───────────
const API_ENDPOINT = 'http://localhost:3131/v1/messages';

// ── PRESET_TITLES (for display only) ──────────────────
const PRESET_TITLES = [
  '',
  'Primary Reinforcement Steel (TMT Bars)',
  'Structural Steel Sections',
  'Binding & Assembly Materials',
  'Finishing & Infrastructure Steel'
];

// ══════════════════════════════════════════════════════
//  MAIN: generateQuote — routes by mode
// ══════════════════════════════════════════════════════
async function generateQuote() {
  const { mode, csvData, imageBase64 } = LState;

  // ── Validation ──
  const paste = (document.getElementById('pasteInput') && document.getElementById('pasteInput').value) || '';
  if (mode === 'image' && !imageBase64) {
    showAlert('Please upload a floor plan image first.', 'warn'); return;
  }

  setStep(3);
  startLoader();
  const btn = document.getElementById('generateBtn');
  if (btn) btn.disabled = true;

  const opts = { erection: 'no', buildType: 'residential', notes: '' };

  try {
    let quote;

    // Prefer pasted text; if empty, use CSV if uploaded; otherwise fallback
    if (paste && paste.trim()) {
      quote = await LocalEngine.calcFromText(paste, opts);
    } else if (csvData) {
      quote = await LocalEngine.calcFromCsv(csvData, opts);
    } else if (mode === 'preset' && window.LState.presetItems.length) {
      quote = await LocalEngine.calcFromPreset(window.LState.presetItems, opts);
    } else if (mode === 'image') {
      quote = await _generateImageQuote(0, opts.buildType, opts.erection, opts.notes);
    } else {
      throw new Error('Please paste requirements into the text box or upload a CSV file.');
    }

    stopLoader();
    if (btn) btn.disabled = false;
    // If there are unavailable items, show them in a modal
    const unavailable = quote && quote._meta && quote._meta.unavailable;
    if (Array.isArray(unavailable) && unavailable.length) {
      showUnavailableItems(unavailable);
    }
    
    if (!quote.module2 || quote.module2.length === 0) {
      throw new Error('All requested items are missing from our active catalog. Cannot generate a $0 quote.');
    }
    
    renderQuote(quote);

  } catch (err) {
    stopLoader();
    if (btn) btn.disabled = false;
    console.error(err);
    showAlert('Error generating quote: ' + err.message, 'err');
  }
}
window.generateQuote = generateQuote;

// ══════════════════════════════════════════════════════
//  IMAGE: call Gemini 2.0 Flash via proxy
// ══════════════════════════════════════════════════════
async function _generateImageQuote(miles, buildType, erection, notes) {
  const userContent = [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: LState.imageType,
        data: LState.imageBase64
      }
    },
    {
      type: 'text',
      text: `Building type: ${buildType}
Delivery distance: ${miles} miles
Erection required: ${erection}
Notes: ${notes}

CRITICAL CALIBRATION CONTEXT:
${CALIBRATION_CONTEXT}

Analyse the attached floor plan and generate a harmonized rebar quote based strictly on these rules.
IMPORTANT: If "Erection required" is "yes", include a detailed erection/crane cost in "module4" based on the estimated sqft.`
    }
  ];

  const resp = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-2.0-flash',   // upgraded from 1.5-flash
      max_tokens: 4000,
      system: SYSTEM_IMAGE,
      messages: [{ role: 'user', content: userContent }]
    })
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || JSON.stringify(data));

  const raw = data.content.map(b => b.text || '').join('');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Invalid AI response: No JSON found. Try again or use CSV mode.');

  let jsonString = raw.substring(start, end + 1);
  jsonString = jsonString.replace(/,\s*([\]}])/g, '$1');

  try {
    return JSON.parse(jsonString);
  } catch (parseErr) {
    console.error('JSON Parse Error:', parseErr, 'Raw:', jsonString);
    throw new Error('AI returned malformed data. Please try again or switch to CSV mode.');
  }
}

// ── Inline alert helper ────────────────────────────────
function showAlert(msg, type = 'warn') {
  const icons = { warn: '⚠', err: '✖', info: 'ℹ', success: '✔' };
  let el = document.getElementById('engine-alert');
  if (!el) {
    el = document.createElement('div');
    el.id = 'engine-alert';
    const btn = document.getElementById('generateBtn');
    btn.insertAdjacentElement('beforebegin', el);
  }
  el.className = `alert alert-${type}`;
  el.innerHTML = `<span class="alert__icon">${icons[type]}</span><div class="alert__body">${msg}</div>`;
  setTimeout(() => { if (el) el.remove(); }, 6000);
}
window.showAlert = showAlert;

// Show a simple modal listing unavailable items
function showUnavailableItems(items) {
  // remove existing
  const existing = document.getElementById('unavail-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'unavail-modal';
  overlay.style = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';

  const box = document.createElement('div');
  box.style = 'background:#fff;color:#111;border-radius:8px;padding:18px;max-width:720px;width:90%;max-height:70%;overflow:auto;box-shadow:0 8px 30px rgba(0,0,0,0.2);';
  const h = document.createElement('div');
  h.style = 'font-weight:700;margin-bottom:8px;font-size:16px;';
  h.textContent = 'Unavailable items — not quoted';
  box.appendChild(h);

  const p = document.createElement('div');
  p.style = 'margin-bottom:12px;color:#444;';
  p.textContent = 'The following requested items are not found in our available items catalog:';
  box.appendChild(p);

  const ul = document.createElement('ul');
  ul.style = 'margin:0 0 12px 18px;';
  items.forEach(it => {
    const li = document.createElement('li'); li.textContent = it; ul.appendChild(li);
  });
  box.appendChild(ul);

  const close = document.createElement('button');
  close.className = 'btn btn-primary';
  close.textContent = 'Close';
  close.onclick = () => overlay.remove();
  box.appendChild(close);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}
window.showUnavailableItems = showUnavailableItems;
