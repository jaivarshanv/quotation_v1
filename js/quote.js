/* ═══════════════════════════════════════════════════
   APEX INDUSTRIAL — quote.js
   Quote rendering: sections, grand total, approvals, reset
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

  const erect = !!(data.module4 && data.module4.length > 0);
  const currency = 'usd';
  const client = document.getElementById('clientName').value || '—';
  const clientEmailVal = document.getElementById('clientEmail').value || '—';
  const clientPhoneVal = document.getElementById('clientPhone').value || '—';
  const clientAddressVal = document.getElementById('clientAddress').value || '—';

  // Generate a unique quote reference (APEX-YYYYMMDD-XXXXX) stored on the data object
  if (!data.quoteRef) {
    const today = new Date();
    const datePart = today.getFullYear().toString()
      + String(today.getMonth() + 1).padStart(2, '0')
      + String(today.getDate()).padStart(2, '0');
    const randPart = Math.random().toString(36).toUpperCase().slice(2, 7);
    data.quoteRef = 'APEX-' + datePart + '-' + randPart;
  }

  // Populate B2B Corporate Letterhead Fields
  document.getElementById('lblQuoteRef').textContent = data.quoteRef;
  document.getElementById('lblQuoteDate').textContent = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  document.getElementById('lblClientName').textContent = client;
  document.getElementById('lblClientEmail').textContent = clientEmailVal;
  document.getElementById('lblClientPhone').textContent = clientPhoneVal;
  document.getElementById('lblClientAddress').textContent = clientAddressVal;

  // Populate Rule-based approvals from metadata
  const approvals = (data._meta && data._meta.approvals) ? data._meta.approvals : {
    status: 'Auto-Approved',
    statusClass: 'status-green',
    marginPercent: 25
  };

  const badge = document.getElementById('lblApprovalBadge');
  if (badge) {
    badge.className = `approval-badge ${approvals.statusClass}`;
    badge.textContent = approvals.status;
  }

  const dotFinance = document.getElementById('dotFinance');
  if (dotFinance) {
    if (approvals.statusClass === 'status-red') {
      dotFinance.className = 'approval-log-dot pending'; // Yellow/pending state for director overrides
    } else {
      dotFinance.className = 'approval-log-dot'; // Green approved state
    }
  }

  // Populate sections
  const tMaterials = populateSection('rowsMaterials', 'totMaterials', data.module2);
  const tErect = erect ? populateSection('rowsErect', 'totErect', data.module4) : 0;

  const erectSec = document.getElementById('sectionErect');
  if (erectSec) erectSec.style.display = erect ? '' : 'none';

  // Grand total
  const grand = tMaterials + tErect;
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

  // Save to Firebase — attach client profile details for history and admin inspector
  if (window.getAuthUser && window.getAuthUser() && window.dbStore) {
    const user = window.getAuthUser();
    const userData = window.currentUserData || {};
    const enrichedData = {
      ...data,
      clientName: client,
      clientEmail: clientEmailVal,
      clientPhone: clientPhoneVal,
      clientAddress: clientAddressVal
    };
    window.dbStore.saveUserQuote(user.uid, userData.name || user.email, enrichedData);
  }
}
window.renderQuote = renderQuote;