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

    // Save parsed quote to state
    LState.parsedQuote = quote;

    // Render interactive Costing Review table
    renderCostingReview(quote);

  } catch (err) {
    stopLoader();
    if (btn) btn.disabled = false;
    console.error(err);
    showAlert('Error generating quote: ' + err.message, 'err');
  }
}
window.generateQuote = generateQuote;

// ── Pop-up Modal helpers for Unlisted Items ────────────
function openUnlistedModal() {
  const modal = document.getElementById('unlistedModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}
function closeUnlistedModal() {
  const modal = document.getElementById('unlistedModal');
  if (modal) {
    modal.style.display = 'none';
  }
}
function saveUnlistedItems() {
  const unlistedTbody = document.getElementById('unlistedTableBody');
  const reviewTbody = document.getElementById('reviewTableBody');
  const esc = window.esc || (s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));

  if (unlistedTbody && reviewTbody) {
    const rows = Array.from(unlistedTbody.querySelectorAll('tr'));
    rows.forEach(tr => {
      const cb = tr.querySelector('.review-checkbox');
      if (cb && cb.checked) {
        // Extract values entered by the user
        const nameVal = tr.querySelector('[data-field="name"]').value.trim();
        const qtyVal = parseFloat(tr.querySelector('[data-field="qty"]').value) || 0;
        const unitVal = tr.querySelector('[data-field="unit"]').value.trim();
        const basePriceLb = parseFloat(tr.querySelector('[data-field="basePriceLb"]').value) || 0;
        const fabLb = parseFloat(tr.querySelector('[data-field="fabLb"]').value) || 0;
        const marginPct = parseFloat(tr.querySelector('[data-field="marginPct"]').value) || 0;

        const labourLb = parseFloat(tr.querySelector('[data-field="labourLb"]').value) || 0;
        const freightLb = parseFloat(tr.querySelector('[data-field="freightLb"]').value) || 0;
        const wastagePct = parseFloat(tr.querySelector('[data-field="wastagePct"]').value) || 0;

        // Push directly as an active item to reviewTableBody!
        const newTr = document.createElement('tr');
        newTr.setAttribute('data-is-custom-unlisted', 'true');
        newTr.setAttribute('data-labour', labourLb);
        newTr.setAttribute('data-freight', freightLb);
        newTr.setAttribute('data-wastage', wastagePct);

        newTr.innerHTML = `
          <td style="text-align: center; vertical-align: middle;">
            <input type="checkbox" class="review-checkbox" data-type="matched" checked style="transform: scale(1.1); cursor: pointer;" />
          </td>
          <td title="${esc(nameVal)}">
            <input type="text" class="review-input" value="${esc(nameVal)}" title="${esc(nameVal)}" data-field="itemName" data-type="matched" />
          </td>
          <td title="${qtyVal}">
            <input type="number" step="any" class="review-input" value="${qtyVal}" title="${qtyVal}" data-field="qty" data-type="matched" />
          </td>
          <td title="${esc(unitVal)}">
            <input type="text" class="review-input" value="${esc(unitVal)}" title="${esc(unitVal)}" data-field="unit" data-type="matched" />
          </td>
          <td title="${basePriceLb}">
            <input type="number" step="any" class="review-input" value="${basePriceLb}" title="${basePriceLb}" data-field="basePriceLb" data-type="matched" />
          </td>
          <td title="${fabLb}">
            <input type="number" step="any" class="review-input" value="${fabLb}" title="${fabLb}" data-field="fabLb" data-type="matched" />
          </td>
          <td title="${marginPct}%">
            <input type="number" step="any" class="review-input" value="${marginPct}" title="${marginPct}%" data-field="marginPct" data-type="matched" />
          </td>
        `;
        reviewTbody.appendChild(newTr);

        // Remove row from unavailable/unlisted list so it isn't listed twice
        tr.remove();
      }
    });
  }

  // Update badge display count based on what's left
  if (unlistedTbody) {
    const remainingRows = unlistedTbody.querySelectorAll('tr').length;
    const badge = document.getElementById('unlistedCountBadge');
    if (badge) {
      badge.setAttribute('data-total', remainingRows);
      badge.textContent = `0 / ${remainingRows} selected`;
    }
    const btnOpenUnlisted = document.getElementById('btnOpenUnlisted');
    if (remainingRows === 0 && btnOpenUnlisted) {
      btnOpenUnlisted.style.display = 'none';
    }
  }

  closeUnlistedModal();
}
window.openUnlistedModal = openUnlistedModal;
window.closeUnlistedModal = closeUnlistedModal;
window.saveUnlistedItems = saveUnlistedItems;

function renderCostingReview(quote) {
  const tbody = document.getElementById('reviewTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const unlistedTbody = document.getElementById('unlistedTableBody');
  if (unlistedTbody) unlistedTbody.innerHTML = '';

  const matched = (quote._meta && quote._meta.rawMaterials) || [];
  const unavailable = (quote._meta && quote._meta.unavailable) || [];

  const esc = window.esc || (s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));

  // Update Add Unlisted Items button count badge
  const btnOpenUnlisted = document.getElementById('btnOpenUnlisted');
  if (btnOpenUnlisted) {
    if (unavailable.length === 0) {
      btnOpenUnlisted.style.display = 'none';
    } else {
      btnOpenUnlisted.style.display = 'flex';
      const badge = document.getElementById('unlistedCountBadge');
      if (badge) {
        badge.setAttribute('data-total', unavailable.length);
        badge.textContent = `0 / ${unavailable.length} selected`;
      }
    }
  }

  if (matched.length === 0 && unavailable.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--ls-mid);">No items parsed. Please check your inputs.</td></tr>`;
    return;
  }

  // Render Matched Catalog Items
  matched.forEach((m, idx) => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-labour', m.labourLb || 0);
    tr.setAttribute('data-freight', m.freightLb || 0);
    tr.setAttribute('data-wastage', m.wastagePct || 0);

    tr.innerHTML = `
      <td style="text-align: center; vertical-align: middle;">
        <input type="checkbox" checked class="review-checkbox" data-type="matched" data-index="${idx}" style="transform: scale(1.1); cursor: pointer;" />
      </td>
      <td title="${esc(m.itemName)}">
        <input type="text" class="review-input" value="${esc(m.itemName)}" title="${esc(m.itemName)}" data-field="itemName" data-type="matched" data-index="${idx}" />
      </td>
      <td title="${m.qty}">
        <input type="number" step="any" class="review-input" value="${m.qty}" title="${m.qty}" data-field="qty" data-type="matched" data-index="${idx}" />
      </td>
      <td title="${esc(m.unit || 'lbs')}">
        <input type="text" class="review-input" value="${esc(m.unit || 'lbs')}" title="${esc(m.unit || 'lbs')}" data-field="unit" data-type="matched" data-index="${idx}" />
      </td>
      <td title="${m.basePriceLb || 0}">
        <input type="number" step="any" class="review-input" value="${m.basePriceLb || 0}" title="${m.basePriceLb || 0}" data-field="basePriceLb" data-type="matched" data-index="${idx}" />
      </td>
      <td title="${m.fabLb || 0}">
        <input type="number" step="any" class="review-input" value="${m.fabLb || 0}" title="${m.fabLb || 0}" data-field="fabLb" data-type="matched" data-index="${idx}" />
      </td>
      <td title="${m.marginPct || 0}%">
        <input type="number" step="any" class="review-input" value="${m.marginPct || 0}" title="${m.marginPct || 0}%" data-field="marginPct" data-type="matched" data-index="${idx}" />
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Render Unavailable Items inside the Pop-up Modal (with unchecked checkboxes so user must opt-in and add rate/fab/margin)
  if (unlistedTbody) {
    unavailable.forEach((un, idx) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-labour', 0);
      tr.setAttribute('data-freight', 0);
      tr.setAttribute('data-wastage', 0);

      tr.innerHTML = `
        <td style="text-align: center; vertical-align: middle;">
          <input type="checkbox" class="review-checkbox" data-type="unavailable" data-index="${idx}" onchange="window.updateUnlistedCountBadge()" style="transform: scale(1.1); cursor: pointer;" />
        </td>
        <td title="${esc(un.name || '')}" style="position: relative;">
          <input type="text" class="review-input" value="${esc(un.name || '')}" title="${esc(un.name || '')}" data-field="name" data-type="unavailable" data-index="${idx}" oninput="window.suggestUnlistedMatch(this)" onfocus="window.suggestUnlistedMatch(this)" />
          <div class="match-suggest-box" style="position: absolute; top: 100%; left: 0; width: 100%; z-index: 1000; font-size: 11px; display: none; text-align: left; padding: 2px 0 0 0; background: transparent;"></div>
        </td>
        <td title="${un.qty || 0}">
          <input type="number" step="any" class="review-input" value="${un.qty || 0}" title="${un.qty || 0}" data-field="qty" data-type="unavailable" data-index="${idx}" />
        </td>
        <td title="${esc(un.unit || 'lbs')}">
          <input type="text" class="review-input" value="${esc(un.unit || 'lbs')}" title="${esc(un.unit || 'lbs')}" data-field="unit" data-type="unavailable" data-index="${idx}" />
        </td>
        <td title="Base Price per lb">
          <input type="number" step="any" class="review-input" placeholder="e.g. 0.50" title="Base Price per lb" data-field="basePriceLb" data-type="unavailable" data-index="${idx}" />
        </td>
        <td title="Fabrication Cost per lb">
          <input type="number" step="any" class="review-input" placeholder="e.g. 0.10" title="Fabrication Cost per lb" data-field="fabLb" data-type="unavailable" data-index="${idx}" />
        </td>
        <td title="Labour Cost per lb">
          <input type="number" step="any" class="review-input" placeholder="e.g. 0.05" title="Labour Cost per lb" data-field="labourLb" data-type="unavailable" data-index="${idx}" />
        </td>
        <td title="Freight Cost per lb">
          <input type="number" step="any" class="review-input" placeholder="e.g. 0.03" title="Freight Cost per lb" data-field="freightLb" data-type="unavailable" data-index="${idx}" />
        </td>
        <td title="Wastage %">
          <input type="number" step="any" class="review-input" placeholder="e.g. 5" title="Wastage %" data-field="wastagePct" data-type="unavailable" data-index="${idx}" />
        </td>
        <td title="Margin %">
          <input type="number" step="any" class="review-input" placeholder="e.g. 10" title="Margin %" data-field="marginPct" data-type="unavailable" data-index="${idx}" />
        </td>
      `;
      unlistedTbody.appendChild(tr);

      // Trigger fuzzy match check immediately on load
      const nameInput = tr.querySelector('[data-field="name"]');
      if (nameInput) window.suggestUnlistedMatch(nameInput);
    });
  }

  // Toggle visible sections — Keep raw requirements text and client info visible for easy cross-reference
  // hide('cardInput');
  // hide('cardClientInfo');

  const out = document.getElementById('quoteOutput');
  if (out) out.classList.remove('visible');

  show('cardReview');
  setStep(3);

  document.getElementById('cardReview').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.renderCostingReview = renderCostingReview;

function compileFinalQuotation() {
  const quote = LState.parsedQuote;
  if (!quote) return;

  const matchedTbody = document.getElementById('reviewTableBody');
  const unlistedTbody = document.getElementById('unlistedTableBody');
  if (!matchedTbody) return;

  const matchedRows = Array.from(matchedTbody.querySelectorAll('tr'));
  const unlistedRows = unlistedTbody ? Array.from(unlistedTbody.querySelectorAll('tr')) : [];
  const rows = [...matchedRows, ...unlistedRows];

  const newRawMaterials = [];
  let newTotalWeightLbs = 0;
  const newUnavailableList = [];

  rows.forEach(tr => {
    const cb = tr.querySelector('.review-checkbox');
    if (!cb) return;

    const isChecked = cb.checked;
    const type = cb.getAttribute('data-type');

    if (type === 'matched') {
      if (!isChecked) return; // Skips unchecked matched items

      const itemName = tr.querySelector('[data-field="itemName"]').value.trim();
      const qty = parseFloat(tr.querySelector('[data-field="qty"]').value) || 0;
      const unit = tr.querySelector('[data-field="unit"]').value.trim();
      const basePriceLb = parseFloat(tr.querySelector('[data-field="basePriceLb"]').value) || 0;
      const fabLb = parseFloat(tr.querySelector('[data-field="fabLb"]').value) || 0;
      const marginPct = parseFloat(tr.querySelector('[data-field="marginPct"]').value) || 0;

      const labourLb = parseFloat(tr.getAttribute('data-labour')) || 0;
      const freightLb = parseFloat(tr.getAttribute('data-freight')) || 0;
      const wastagePct = parseFloat(tr.getAttribute('data-wastage')) || 0;

      const weightLbs = window.LocalEngine.toWeightLbs(qty, unit, 0);
      newTotalWeightLbs += weightLbs;

      const loadedRate = ((basePriceLb * (1 + wastagePct / 100)) + fabLb + labourLb + freightLb) * (1 + marginPct / 100);
      const lineTotal = weightLbs * loadedRate;

      const isCustom = tr.getAttribute('data-is-custom-unlisted') === 'true';

      if (isCustom) {
        // Automatically seed new custom item into Firestore Catalog for future runs!
        if (window.dbStore && window.dbStore.addCatalogItem) {
          window.dbStore.addCatalogItem({
            name: itemName,
            grade: 'ASTM Grade Steel',
            priceLb: basePriceLb,
            fabLb: fabLb,
            labourLb: labourLb,
            freightLb: freightLb,
            wastagePct: wastagePct,
            marginPct: marginPct
          });
        }
      }

      newRawMaterials.push({
        itemName: isCustom ? itemName + ' (Custom)' : itemName,
        qty,
        unit,
        weightLbs,
        basePriceLb,
        fabLb,
        labourLb,
        freightLb,
        wastagePct,
        marginPct,
        loadedRate,
        amount: Math.round(lineTotal),
        isCustom: isCustom
      });

    } else if (type === 'unavailable') {
      const nameVal = tr.querySelector('[data-field="name"]').value.trim();
      const qtyVal = parseFloat(tr.querySelector('[data-field="qty"]').value) || 0;
      const unitVal = tr.querySelector('[data-field="unit"]').value.trim();

      if (!isChecked) {
        newUnavailableList.push({ name: nameVal, qty: qtyVal, unit: unitVal });
        return;
      }

      const basePriceLb = parseFloat(tr.querySelector('[data-field="basePriceLb"]').value);
      const fabLb = parseFloat(tr.querySelector('[data-field="fabLb"]').value);
      const marginPct = parseFloat(tr.querySelector('[data-field="marginPct"]').value);

      const labourLb = parseFloat(tr.querySelector('[data-field="labourLb"]').value) || 0;
      const freightLb = parseFloat(tr.querySelector('[data-field="freightLb"]').value) || 0;
      const wastagePct = parseFloat(tr.querySelector('[data-field="wastagePct"]').value) || 0;

      if (isNaN(basePriceLb) || isNaN(fabLb) || isNaN(marginPct)) {
        showAlert(`Please enter a valid Rate, Fab charge, and Margin % for custom item "${nameVal}".`, 'warn');
        throw new Error('Missing custom item pricing specifications.');
      }

      const weightLbs = window.LocalEngine.toWeightLbs(qtyVal, unitVal, 0);
      newTotalWeightLbs += weightLbs;

      const loadedRate = ((basePriceLb * (1 + wastagePct / 100)) + fabLb + labourLb + freightLb) * (1 + marginPct / 100);
      const lineTotal = weightLbs * loadedRate;

      // Automatically seed new custom item into Firestore Catalog for future runs!
      if (window.dbStore && window.dbStore.addCatalogItem) {
        window.dbStore.addCatalogItem({
          name: nameVal,
          grade: 'ASTM Grade Steel',
          priceLb: basePriceLb,
          fabLb: fabLb,
          labourLb: labourLb,
          freightLb: freightLb,
          wastagePct: wastagePct,
          marginPct: marginPct
        });
      }

      newRawMaterials.push({
        itemName: nameVal + ' (Custom)',
        qty: qtyVal,
        unit: unitVal,
        weightLbs,
        basePriceLb,
        fabLb,
        labourLb,
        freightLb,
        wastagePct,
        marginPct,
        loadedRate,
        amount: Math.round(lineTotal),
        isCustom: true
      });
    }
  });

  if (newRawMaterials.length === 0) {
    showAlert('Please select or enable at least one item to generate a quote.', 'warn');
    return;
  }

  const opts = { erection: 'no', buildType: 'residential' };
  const originalErect = !!(quote.module4 && quote.module4.length > 0);
  if (originalErect) opts.erection = 'yes';

  // Build the fresh final quote object using the local engine builder
  const finalQuote = window.LocalEngine._buildQuoteObject(
    newRawMaterials,
    newTotalWeightLbs,
    opts.erection,
    opts.buildType,
    quote._meta?.source || 'text',
    newUnavailableList
  );

  // Preserve quoteRef if already generated
  if (quote.quoteRef) {
    finalQuote.quoteRef = quote.quoteRef;
  }

  LState.lastQuote = finalQuote;

  // Render the final simplified quote output!
  renderQuote(finalQuote);
}
window.compileFinalQuotation = compileFinalQuotation;

function resetReview() {
  hide('cardReview');
  const out = document.getElementById('quoteOutput');
  if (out) out.classList.remove('visible');
  show('cardInput');
  show('cardClientInfo');
  setStep(1);
}
window.resetReview = resetReview;

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

  // Get or create fixed toast container
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.top = '24px';
    container.style.right = '24px';
    container.style.zIndex = '10000';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    container.style.maxWidth = '360px';
    container.style.width = 'calc(100% - 48px)';
  }

  // Ensure it is appended to the body
  if (!container.parentElement) {
    document.body.appendChild(container);
  }

  const el = document.createElement('div');
  el.className = `alert alert-${type}`;
  el.style.margin = '0';
  el.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.15)';
  el.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
  el.style.transform = 'translateY(15px)';
  el.style.opacity = '0';

  // High-end tailored colors matching component alerts
  if (type === 'success') {
    el.style.background = '#dcfce7';
    el.style.border = '1px solid #b3ddc9';
    el.style.color = '#15803d';
  } else if (type === 'err') {
    el.style.background = '#fee2e2';
    el.style.border = '1px solid #f5b3b3';
    el.style.color = '#b91c1c';
  } else if (type === 'info') {
    el.style.background = '#e0f2fe';
    el.style.border = '1px solid #b3d4f5';
    el.style.color = '#1d4ed8';
  } else {
    el.style.background = '#fef3c7';
    el.style.border = '1px solid #e8d080';
    el.style.color = '#b45309';
  }

  el.innerHTML = `<span class="alert__icon" style="font-size: 16px; font-weight: bold; margin-right: 2px;">${icons[type]}</span><div class="alert__body">${msg}</div>`;
  container.appendChild(el);

  // Trigger browser paint
  el.offsetHeight;

  // Animate in
  el.style.transform = 'translateY(0)';
  el.style.opacity = '1';

  // Slide out and remove after 5 seconds
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-15px)';
    setTimeout(() => {
      el.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }, 5000);
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

// ── Unavailable Item Matching & Autocomplete suggestions ──────
window.suggestUnlistedMatch = function (inputEl) {
  const val = inputEl.value.trim();
  const tr = inputEl.closest('tr');
  const suggestDiv = tr.querySelector('.match-suggest-box');
  if (!suggestDiv) return;

  if (!window.LocalEngine || !window.LocalEngine.CATALOG) {
    suggestDiv.style.display = 'none';
    return;
  }

  const catalog = window.LocalEngine.CATALOG;
  const valLower = val.toLowerCase();

  // Find all items that have some token matching, sorted by score
  const tokens = valLower.split(/\s+/).filter(t => t.length > 1);
  let matches = [];

  catalog.forEach((item, catIdx) => {
    const nameLower = item.name.toLowerCase();

    // Exact match has highest score
    if (nameLower === valLower) {
      matches.push({ item, catIdx, score: 9999 });
      return;
    }

    let score = 0;
    // Words starting with tokens
    tokens.forEach(token => {
      if (nameLower.includes(token)) {
        score += token.length;
        if (nameLower.startsWith(token)) score += 5; // Prefix bonus
      }
    });

    if (score > 1) {
      matches.push({ item, catIdx, score });
    }
  });

  // Sort matches by score descending, then by name alphabetically
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.name.localeCompare(b.item.name);
  });

  const topMatches = matches.slice(0, 15);
  const esc = window.esc || (s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));

  if (topMatches.length > 0) {
    let html = `<div class="custom-suggest-dropdown">`;
    html += `<div class="custom-suggest-item item-header">Top Matches</div>`;
    topMatches.forEach(m => {
      html += `<div class="custom-suggest-item" onclick="window.applyCatalogMatch(this, ${m.catIdx})">${esc(m.item.name)}</div>`;
    });
    // Add spacer and allow choosing all items too
    html += `<div class="custom-suggest-item item-header">All Catalog Items</div>`;
    catalog.forEach((item, catIdx) => {
      // Don't duplicate if already in top matches
      if (!topMatches.some(tm => tm.catIdx === catIdx)) {
        html += `<div class="custom-suggest-item" onclick="window.applyCatalogMatch(this, ${catIdx})">${esc(item.name)}</div>`;
      }
    });
    html += `</div>`;
    suggestDiv.innerHTML = html;
    suggestDiv.style.display = 'block';
  } else {
    // Dropdown showing all catalog items
    let html = `<div class="custom-suggest-dropdown">`;
    html += `<div class="custom-suggest-item item-header">All Catalog Items</div>`;
    catalog.forEach((item, catIdx) => {
      html += `<div class="custom-suggest-item" onclick="window.applyCatalogMatch(this, ${catIdx})">${esc(item.name)}</div>`;
    });
    html += `</div>`;
    suggestDiv.innerHTML = html;
    suggestDiv.style.display = 'block';
  }
};

window.handleUnlistedSelectChange = function (selectEl) {
  const catalogIdxVal = selectEl.value;
  if (catalogIdxVal === "") return;

  const catalogIndex = parseInt(catalogIdxVal);
  window.applyCatalogMatch(selectEl, catalogIndex);

  // Reset select to top option
  selectEl.value = "";
};

window.applyCatalogMatch = function (suggestSpan, catalogIndex) {
  const catalog = window.LocalEngine.CATALOG;
  const item = catalog[catalogIndex];
  if (!item) return;

  const tr = suggestSpan.closest('tr');

  // 1. Fill Name
  const nameInput = tr.querySelector('[data-field="name"]');
  if (nameInput) nameInput.value = item.name;

  // 2. Fill Pricing
  const priceInput = tr.querySelector('[data-field="basePriceLb"]');
  if (priceInput) priceInput.value = item.priceLb || '';

  // 3. Fill Fabrication
  const fabInput = tr.querySelector('[data-field="fabLb"]');
  if (fabInput) fabInput.value = item.fabLb || '0';

  // 4. Fill Margin
  const marginInput = tr.querySelector('[data-field="marginPct"]');
  if (marginInput) marginInput.value = item.marginPct !== undefined ? item.marginPct : '25';

  // 5. Fill Labour, Freight, and Wastage inputs
  const labourInput = tr.querySelector('[data-field="labourLb"]');
  if (labourInput) labourInput.value = item.labourLb !== undefined ? item.labourLb : '0';

  const freightInput = tr.querySelector('[data-field="freightLb"]');
  if (freightInput) freightInput.value = item.freightLb !== undefined ? item.freightLb : '0';

  const wastageInput = tr.querySelector('[data-field="wastagePct"]');
  if (wastageInput) wastageInput.value = item.wastagePct !== undefined ? item.wastagePct : '0';

  // Set data attributes for compatibility
  tr.setAttribute('data-labour', item.labourLb || 0);
  tr.setAttribute('data-freight', item.freightLb || 0);
  tr.setAttribute('data-wastage', item.wastagePct || 0);

  // 6. Check the checkbox automatically
  const checkbox = tr.querySelector('.review-checkbox');
  if (checkbox) checkbox.checked = true;

  // 7. Hide suggestion box
  const suggestDiv = tr.querySelector('.match-suggest-box');
  if (suggestDiv) suggestDiv.style.display = 'none';

  // 8. Update selected count badge
  if (window.updateUnlistedCountBadge) window.updateUnlistedCountBadge();
};

window.updateUnlistedCountBadge = function () {
  const unlistedTbody = document.getElementById('unlistedTableBody');
  const badge = document.getElementById('unlistedCountBadge');
  if (unlistedTbody && badge) {
    const total = unlistedTbody.querySelectorAll('tr').length;
    const checked = unlistedTbody.querySelectorAll('.review-checkbox:checked').length;
    badge.setAttribute('data-total', total);
    badge.textContent = `${checked} / ${total} selected`;
  }
};

// Automatically update title tooltip on input for all review inputs
document.addEventListener('input', function(e) {
  if (e.target && e.target.classList.contains('review-input')) {
    e.target.title = e.target.value;
  }
});

// Click outside to close unlisted suggestion box dropdowns
document.addEventListener('click', function(e) {
  if (!e.target.closest('.match-suggest-box') && !e.target.closest('[data-field="name"]')) {
    document.querySelectorAll('.match-suggest-box').forEach(box => {
      box.style.display = 'none';
    });
  }
});
