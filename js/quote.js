/* ═══════════════════════════════════════════════════
   LANCASTER STEEL — quote.js
   Quote rendering: sections, grand total, reset
   ═══════════════════════════════════════════════════ */

'use strict';

// ── Format helpers ─────────────────────────────────────
function fmt(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtRaw(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtINR(usd) {
  const inr = usd * 84.5;
  return '₹' + inr.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
window.fmt = fmt;
window.fmtRaw = fmtRaw;
window.fmtINR = fmtINR;

// ── Populate a module section ──────────────────────────
function populateSection(tbodyId, totId, rows) {
  let total = 0;
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = '';
  (rows || []).forEach(r => {
    total += r.amount || 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${r.item || ''}</strong></td>
      <td>${r.basis || '—'}</td>
      <td style="font-family:var(--font-mono);font-size:12px">${r.rate || '—'}</td>
      <td>${fmt(r.amount || 0)}</td>`;
    tbody.appendChild(tr);
  });
  const totEl = document.getElementById(totId);
  if (totEl) totEl.textContent = fmt(total);
  return total;
}
window.populateSection = populateSection;

// ── Main render ────────────────────────────────────────
function renderQuote(data) {
  LState.lastQuote = data;

  const erect = false;
  const currency = 'usd';
  const project = document.getElementById('clientName').value || 'Unnamed Project';
  const client = document.getElementById('clientName').value || '—';
  const miles = parseFloat(document.getElementById('deliveryMiles').value) || 0;

  // Generate a unique quote reference (LS-YYYYMMDD-XXXXX) stored on the data object
  if (!data.quoteRef) {
    const today = new Date();
    const datePart = today.getFullYear().toString()
      + String(today.getMonth() + 1).padStart(2, '0')
      + String(today.getDate()).padStart(2, '0');
    const randPart = Math.random().toString(36).toUpperCase().slice(2, 7);
    data.quoteRef = 'LS-' + datePart + '-' + randPart;
  }

  // Populate modules
  const t1 = populateSection('rows1', 'tot1', data.module1);
  const t2 = populateSection('rows2', 'tot2', data.module2);
  const t3 = populateSection('rows3', 'tot3', data.module3);
  const t4 = erect ? populateSection('rows4', 'tot4', data.module4) : 0;
  const t5 = populateSection('rows5', 'tot5', data.module5);

  const quoteSections = document.querySelectorAll('.quote-body .qsec');
  if (quoteSections[0]) quoteSections[0].style.display = t1 > 0 ? '' : 'none';

  const erectSec = document.getElementById('sectionErect');
  if (erectSec) erectSec.style.display = erect ? '' : 'none';

  // Grand total
  const grand = t1 + t2 + t3 + t4 + t5;
  const lo = grand * 0.95, hi = grand * 1.05;
  document.getElementById('gtAmount').textContent = fmt(grand);
  document.getElementById('gtRange').textContent =
    LState.mode === 'preset'
      ? 'Direct calculation based on provided quantities'
      : LState.mode === 'image'
        ? `Approximation range: ${fmt(lo)} – ${fmt(hi)}`
        : '';

  const inrEl = document.getElementById('gtInr');
  if (currency === 'both') {
    inrEl.style.display = 'block';
    inrEl.textContent = '≈ ' + fmtINR(grand) + ' INR';
  } else {
    inrEl.style.display = 'none';
  }

  // Show quote
  const output = document.getElementById('quoteOutput');
  output.classList.add('visible');
  output.style.animation = 'fadeUp .5s both';
  output.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setStep(4);

  // Save to Firebase — attach project/client so history can display them
  if (window.getAuthUser && window.getAuthUser() && window.dbStore) {
    const user = window.getAuthUser();
    const userData = window.currentUserData || {};
    const enrichedData = {
      ...data,
      clientName: client,
      deliveryMiles: miles
    };
    window.dbStore.saveUserQuote(user.uid, userData.name || user.email, enrichedData);
  }
}
window.renderQuote = renderQuote;