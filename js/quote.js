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
      <td title="${r.item || ''}"><strong title="${r.item || ''}">${r.item || ''}</strong></td>
      <td>${r.qty ? Number(r.qty).toLocaleString('en-US') + ' ' + (r.unit || '') : '—'}</td>
      <td style="font-family:var(--font-mono);font-size:12px">${r.rate || '—'}</td>
      <td style="text-align: right;">${fmt(r.amount || 0)}</td>`;
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

  // Set Valid Until date
  const validDate = new Date();
  validDate.setDate(validDate.getDate() + 30);
  const validStr = validDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('lblQuoteValid').textContent = validStr;

  // Populate unified table body
  const itemsBody = document.getElementById('quoteItemsBody');
  itemsBody.innerHTML = '';
  
  let tMaterials = 0;
  let tErect = 0;

  // Render Materials
  (data.module2 || []).forEach(r => {
    tMaterials += r.amount || 0;
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #e2e8f0';
    tr.innerHTML = `
      <td style="padding: 12px 20px; border: 1px solid #e2e8f0;" title="${r.item || ''}"><strong title="${r.item || ''}">${r.item || ''}</strong></td>
      <td style="padding: 12px 20px; border: 1px solid #e2e8f0;">${r.qty ? Number(r.qty).toLocaleString('en-US') + ' ' + (r.unit || '') : '—'}</td>
      <td style="padding: 12px 20px; border: 1px solid #e2e8f0; font-family: var(--font-mono);">${r.rate || '—'}</td>
      <td style="padding: 12px 20px; border: 1px solid #e2e8f0; text-align: right; font-family: var(--font-mono); font-weight: 600;">${fmt(r.amount || 0)}</td>
    `;
    itemsBody.appendChild(tr);
  });

  // Render Erection if present
  if (erect) {
    (data.module4 || []).forEach(r => {
      tErect += r.amount || 0;
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #e2e8f0';
      tr.innerHTML = `
        <td style="padding: 12px 20px; border: 1px solid #e2e8f0;" title="${r.item || ''}"><strong title="${r.item || ''}">${r.item || ''}</strong></td>
        <td style="padding: 12px 20px; border: 1px solid #e2e8f0;">${r.qty ? Number(r.qty).toLocaleString('en-US') + ' ' + (r.unit || '') : '—'}</td>
        <td style="padding: 12px 20px; border: 1px solid #e2e8f0; font-family: var(--font-mono);">${r.rate || '—'}</td>
        <td style="padding: 12px 20px; border: 1px solid #e2e8f0; text-align: right; font-family: var(--font-mono); font-weight: 600;">${fmt(r.amount || 0)}</td>
      `;
      itemsBody.appendChild(tr);
    });
  }

  // Calculate tax and totals
  const subTotal = tMaterials + tErect;
  const tax = subTotal * 0.06;
  const finalTotal = subTotal + tax;

  // Populate summary block
  document.getElementById('lblSummarySubtotal').textContent = fmt(subTotal);
  document.getElementById('lblSummaryTax').textContent = fmt(tax);
  document.getElementById('lblSummaryTotal').textContent = fmt(finalTotal);

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