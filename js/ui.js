/* ═══════════════════════════════════════════════════
   LANCASTER STEEL — ui.js
   UI helpers: mode tabs, steps, file handling, previews
   ═══════════════════════════════════════════════════ */

'use strict';

// ── State ─────────────────────────────────────────────
window.LState = {
  mode: 'csv',
  csvData: null,
  csvRawText: '',
  imageBase64: null,
  imageType: null,
  lastQuote: null,
  presetItems: []
};

// ── Preset Logic ───────────────────────────────────────
function handlePresetSearch(e) {
  const q = e.target.value.toLowerCase().trim();
  const dropdown = document.getElementById('presetSuggestions');
  
  if (!q) {
    dropdown.style.display = 'none';
    return;
  }

  // Hide the dropdown globally if clicking outside
  document.addEventListener('click', closePresetDropdown);

  let html = '';
  let count = 0;
  for (const [id, cfg] of Object.entries(window.LocalEngine.PRESET_CONFIGS)) {
    if (cfg.name.toLowerCase().includes(q) || cfg.grade.toLowerCase().includes(q)) {
      html += `<div style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--ls-divider);" onclick="selectPresetItem('${id}', '${esc(cfg.name)}', '${esc(cfg.grade)}')">
        <strong>${esc(cfg.name)}</strong><br/>
        <small style="color: var(--ls-mid);">${esc(cfg.grade)}</small>
      </div>`;
      count++;
    }
  }

  if (count === 0) {
    html = `<div style="padding: 8px 12px; color: var(--ls-mid);">No materials found.</div>`;
  }

  dropdown.innerHTML = html;
  dropdown.style.display = 'block';
}
window.handlePresetSearch = handlePresetSearch;

function closePresetDropdown(e) {
  if (e && e.target.closest('.preset-builder')) return;
  document.getElementById('presetSuggestions').style.display = 'none';
  document.removeEventListener('click', closePresetDropdown);
}

function selectPresetItem(id, name, grade) {
  document.getElementById('presetSelectedId').value = id;
  document.getElementById('presetSearch').value = name;
  document.getElementById('presetSuggestions').style.display = 'none';
  document.getElementById('presetQty').focus();
}
window.selectPresetItem = selectPresetItem;

function renderPresetTable() {
  const tbody = document.getElementById('presetTableBody');
  if (window.LState.presetItems.length === 0) {
    tbody.innerHTML = `<tr id="emptyPresetRow"><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">No items added yet. Search and add materials above.</td></tr>`;
    return;
  }

  let html = '';
  window.LState.presetItems.forEach((item, index) => {
    html += `<tr>
      <td>${esc(item.name)}</td>
      <td>${item.qty}</td>
      <td>${esc(item.unit)}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="editPresetItem(${index})" style="padding: 4px; min-width: 0;">✎</button>
        <button class="btn btn-ghost btn-sm" onclick="removePresetItem(${index})" style="padding: 4px; min-width: 0; color: #ef4444;">✕</button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;
}
window.renderPresetTable = renderPresetTable;

function syncClientEmailFromAuth() {
  const emailInput = document.getElementById('clientEmail');
  if (!emailInput) return;

  const authUser = (typeof window.getAuthUser === 'function') ? window.getAuthUser() : null;
  const authData = window.currentUserData || {};
  const email = authUser?.email || authData.email || '';

  if (email && !emailInput.value) {
    emailInput.value = email;
  }
}
window.syncClientEmailFromAuth = syncClientEmailFromAuth;

function getPresetCatalogRows() {
  const configs = (window.LocalEngine && window.LocalEngine.PRESET_CONFIGS) || {};
  return Object.entries(configs)
    .map(([id, cfg]) => ({
      id: Number(id),
      name: cfg.name || '',
      grade: cfg.grade || '',
      priceLb: cfg.priceLb ?? '',
      fabLb: cfg.fabLb ?? '',
      note: cfg.note || ''
    }))
    .sort((a, b) => a.id - b.id);
}

function downloadPresetCatalogCsv() {
  const rows = getPresetCatalogRows();
  if (!rows.length) {
    if (window.showAlert) window.showAlert('No preset items are available to export.', 'warn');
    return;
  }

  const escapeCsv = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  const lines = [
    ['id', 'name', 'grade', 'price_per_lb', 'fab_per_lb', 'note'].join(',')
  ];

  rows.forEach(row => {
    lines.push([
      row.id,
      escapeCsv(row.name),
      escapeCsv(row.grade),
      row.priceLb,
      row.fabLb,
      escapeCsv(row.note)
    ].join(','));
  });

  const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lancaster-steel-available-items.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
window.downloadPresetCatalogCsv = downloadPresetCatalogCsv;

function printPresetCatalog() {
  const rows = getPresetCatalogRows();
  if (!rows.length) {
    if (window.showAlert) window.showAlert('No preset items are available to print.', 'warn');
    return;
  }

  const win = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800');
  if (!win) {
    if (window.showAlert) window.showAlert('Popup blocked. Please allow popups to print the catalog.', 'warn');
    return;
  }

  const escHtml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tableRows = rows.map(row => `
    <tr>
      <td>${row.id}</td>
      <td>${escHtml(row.name)}</td>
      <td>${escHtml(row.grade)}</td>
      <td>${row.priceLb}</td>
      <td>${row.fabLb}</td>
      <td>${escHtml(row.note)}</td>
    </tr>
  `).join('');

  win.document.write(`
    <!doctype html>
    <html>
    <head>
      <title>Lancaster Steel Available Items</title>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
        h1 { margin: 0 0 8px; font-size: 24px; }
        p { margin: 0 0 16px; color: #4b5563; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; vertical-align: top; }
        th { background: #f3f4f6; }
        .meta { margin-bottom: 12px; font-size: 12px; color: #4b5563; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <h1>Lancaster Steel Available Items</h1>
      <p class="meta">Use this catalog as a reference for preset materials. Save or print this page to create a PDF.</p>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Grade</th>
            <th>Price / lb</th>
            <th>Fab / lb</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.onload = () => win.print();
}
window.printPresetCatalog = printPresetCatalog;

function addPresetItem() {
  const id = document.getElementById('presetSelectedId').value;
  const name = document.getElementById('presetSearch').value;
  const qty = document.getElementById('presetQty').value;
  const unit = document.getElementById('presetUnit').value;

  if (!id || !name) {
    if (window.showAlert) window.showAlert('Please select a material from the search suggestions.', 'warn');
    return;
  }
  if (!qty || parseFloat(qty) <= 0) {
    if (window.showAlert) window.showAlert('Please enter a valid quantity.', 'warn');
    return;
  }

  // add to state
  window.LState.presetItems.push({
    id: parseInt(id),
    name: name,
    qty: parseFloat(qty),
    unit: unit
  });

  // clear inputs
  document.getElementById('presetSelectedId').value = '';
  document.getElementById('presetSearch').value = '';
  document.getElementById('presetQty').value = '';
  
  renderPresetTable();
}
window.addPresetItem = addPresetItem;

function removePresetItem(index) {
  window.LState.presetItems.splice(index, 1);
  renderPresetTable();
}
window.removePresetItem = removePresetItem;

function editPresetItem(index) {
  const item = window.LState.presetItems[index];
  
  document.getElementById('presetSelectedId').value = item.id;
  document.getElementById('presetSearch').value = item.name;
  document.getElementById('presetQty').value = item.qty;
  document.getElementById('presetUnit').value = item.unit;

  // remove the item so it can be re-added
  removePresetItem(index);
}
window.editPresetItem = editPresetItem;

// ── Step indicator ─────────────────────────────────────
function setStep(n) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('step' + i);
    if (!el) continue;
    el.className = 'step-item ' + (i < n ? 'done' : i === n ? 'active' : '');
  }
}
window.setStep = setStep;

// ── Mode toggle ────────────────────────────────────────
function setMode(mode) {
  LState.mode = mode;
  ['csv', 'image', 'preset'].forEach(m => {
    const panel = document.getElementById('mode-' + m);
    if (panel) panel.style.display = m === mode ? 'block' : 'none';
    const tab = document.getElementById('tab-' + m);
    if (tab) tab.classList.toggle('active', m === mode);
  });
  setStep(1);
}
window.setMode = setMode;

// ── File handling ──────────────────────────────────────
function handleFile(evt, mode) {
  const file = evt.target.files[0];
  if (!file) return;
  if (mode === 'csv') handleCsv(file);
  else handleImage(file);
}
window.handleFile = handleFile;

function handleCsv(file) {
  const reader = new FileReader();
  reader.onload = e => {
    LState.csvRawText = e.target.result;
    LState.csvData = LState.csvRawText;
    const lines = LState.csvRawText.trim().split('\n').filter(Boolean);

    // file pill
    setEl('csv-file-name', file.name);
    setEl('csv-file-meta', `${lines.length - 1} rows · ${(file.size / 1024).toFixed(1)} KB`);
    show('csv-preview-wrap');

    // table preview (first 8 rows)
    const preview = lines.slice(0, 9);
    const headers = parseCsvLine(preview[0]);
    let html = '<thead><tr>' + headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr></thead><tbody>';
    preview.slice(1).forEach(row => {
      const cells = parseCsvLine(row);
      html += '<tr>' + cells.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>';
    });
    html += '</tbody>';
    document.getElementById('csv-table').innerHTML = html;
    setStep(2);
  };
  reader.readAsText(file);
}
window.handleCsv = handleCsv;

function handleImage(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const b64 = e.target.result;
    LState.imageBase64 = b64.split(',')[1];
    LState.imageType = file.type || 'image/jpeg';
    setEl('img-file-name', file.name);
    setEl('img-file-meta', `${(file.size / 1024).toFixed(1)} KB`);
    document.getElementById('img-preview').src = b64;
    show('img-preview-wrap');
    setStep(2);
  };
  reader.readAsDataURL(file);
}
window.handleImage = handleImage;

function clearFile(mode) {
  if (mode === 'csv') {
    LState.csvData = null;
    LState.csvRawText = '';
    hide('csv-preview-wrap');
    const el = document.getElementById('file-csv');
    if (el) el.value = '';
  } else {
    LState.imageBase64 = null;
    LState.imageType = null;
    hide('img-preview-wrap');
    const el = document.getElementById('file-img');
    if (el) el.value = '';
  }
  setStep(1);
}
window.clearFile = clearFile;

// ── Reset tool ─────────────────────────────────────────
function resetTool() {
  LState.csvData = null;
  LState.csvRawText = '';
  LState.imageBase64 = null;
  LState.imageType = null;
  LState.lastQuote = null;
  LState.presetItems = [];
  renderPresetTable();
  document.getElementById('presetSelectedId').value = '';
  document.getElementById('presetSearch').value = '';
  document.getElementById('presetQty').value = '';
  clearFile('csv');
  clearFile('image');
  const out = document.getElementById('quoteOutput');
  if (out) out.classList.remove('visible');
  const ldr = document.getElementById('loader');
  if (ldr) ldr.classList.remove('active');
  show('cardInput');
  show('cardDelivery');
  setStep(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.resetTool = resetTool;

// ── Section accordion ──────────────────────────────────
function toggleSec(head) {
  const body = head.nextElementSibling;
  const chev = head.querySelector('.qsec-chevron');
  body.classList.toggle('open');
  chev.classList.toggle('open');
}
window.toggleSec = toggleSec;

// ── Drag-and-drop ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  syncClientEmailFromAuth();

  const pasteInput = document.getElementById('pasteInput');
  const generateTextBtn = document.getElementById('generateTextBtn');
  if (pasteInput && generateTextBtn) {
    const updateGenerateButton = () => {
      generateTextBtn.style.display = pasteInput.value.trim() ? 'block' : 'none';
    };
    pasteInput.addEventListener('input', updateGenerateButton);
    updateGenerateButton();
  }

  ['drop-csv', 'drop-img'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (id === 'drop-csv') handleCsv(file);
      else handleImage(file);
    });
  });
});

window.addEventListener('authStateReady', () => {
  syncClientEmailFromAuth();
});

// ── Utility ────────────────────────────────────────────
function show(id) { const el = document.getElementById(id); if (el) el.style.display = ''; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function setEl(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
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
window.parseCsvLine = parseCsvLine;
