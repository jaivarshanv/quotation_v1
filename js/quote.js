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
  validDate.setDate(validDate.getDate() + 7);
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
    tr.style.borderBottom = '1px solid #f1f5f9';
    tr.innerHTML = `
      <td style="padding: 12px 0; border: none; text-align: left;" title="${r.item || ''}"><span title="${r.item || ''}" style="color: #0f172a; font-weight: 500;">${r.item || ''}</span></td>
      <td style="padding: 12px 0; border: none; text-align: left; color: #475569;">${r.qty ? Number(r.qty).toLocaleString('en-US') + ' ' + (r.unit || '') : '—'}</td>
      <td style="padding: 12px 0; border: none; text-align: left; font-family: var(--font-mono); color: #475569;">${r.rate || '—'}</td>
      <td style="padding: 12px 0; border: none; text-align: right; font-family: var(--font-mono); font-weight: 500; color: #0f172a;">${fmt(r.amount || 0)}</td>
    `;
    itemsBody.appendChild(tr);
  });

  // Render Erection if present
  if (erect) {
    (data.module4 || []).forEach(r => {
      tErect += r.amount || 0;
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #f1f5f9';
      tr.innerHTML = `
        <td style="padding: 12px 0; border: none; text-align: left;" title="${r.item || ''}"><span title="${r.item || ''}" style="color: #0f172a; font-weight: 500;">${r.item || ''}</span></td>
        <td style="padding: 12px 0; border: none; text-align: left; color: #475569;">${r.qty ? Number(r.qty).toLocaleString('en-US') + ' ' + (r.unit || '') : '—'}</td>
        <td style="padding: 12px 0; border: none; text-align: left; font-family: var(--font-mono); color: #475569;">${r.rate || '—'}</td>
        <td style="padding: 12px 0; border: none; text-align: right; font-family: var(--font-mono); font-weight: 500; color: #0f172a;">${fmt(r.amount || 0)}</td>
      `;
      itemsBody.appendChild(tr);
    });
  }

  // Render Unavailable Items (faint font style, only in index.html web view, hidden via .unavailable-item-row CSS in print)
  const unavailableList = data._meta?.unavailable || [];
  unavailableList.forEach(un => {
    const tr = document.createElement('tr');
    tr.className = 'unavailable-item-row';
    tr.style.borderBottom = '1px solid #f1f5f9';
    tr.style.opacity = '0.55';
    tr.innerHTML = `
      <td style="padding: 12px 0; border: none; text-align: left;" title="${un.name || ''}">
        <span style="color: #64748b; font-weight: 500; text-decoration: line-through;">${un.name || ''}</span>
        <span style="font-size: 11px; color: #e11d48; margin-left: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">(Unavailable)</span>
      </td>
      <td style="padding: 12px 0; border: none; text-align: left; color: #64748b;">${un.qty ? Number(un.qty).toLocaleString('en-US') + ' ' + (un.unit || '') : '—'}</td>
      <td style="padding: 12px 0; border: none; text-align: left; font-style: italic; color: #94a3b8;">Unavailable</td>
      <td style="padding: 12px 0; border: none; text-align: right; font-family: var(--font-mono); color: #94a3b8;">—</td>
    `;
    itemsBody.appendChild(tr);
  });

  // Toggle dynamic PDF unavailable notice inside print-only terms
  const printNotice = document.getElementById('printUnavailableNotice');
  const printItemsList = document.getElementById('printUnavailableItemsList');
  if (printNotice) {
    if (unavailableList.length > 0) {
      printNotice.style.display = 'inline';
      if (printItemsList) {
        printItemsList.textContent = unavailableList.map(un => `${un.name} (${un.qty ? Number(un.qty).toLocaleString('en-US') + ' ' + (un.unit || 'lbs') : '—'})`).join(', ');
      }
    } else {
      printNotice.style.display = 'none';
    }
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

// ══════════════════════════════════════════════════════
//  downloadPDF — Pure jsPDF programmatic renderer
//  Reads directly from LState.lastQuote (no DOM capture,
//  no html2canvas, no CSS battles — works everywhere).
// ══════════════════════════════════════════════════════
async function downloadPDF() {
  if (!LState.lastQuote) return showAlert('No quote to download.', 'warn');

  const downloadBtn = document.getElementById('downloadPdfBtn');
  if (downloadBtn) { downloadBtn.disabled = true; downloadBtn.textContent = 'Generating PDF…'; }

  try {
    const data   = LState.lastQuote;
    const refNo  = data.quoteRef || 'APEX-QUOTE';

    // ── Collect client fields from the live DOM ──────────────────────────
    const client  = (document.getElementById('clientName')?.value    || '—').trim();
    const email   = (document.getElementById('clientEmail')?.value   || '—').trim();
    const phone   = (document.getElementById('clientPhone')?.value   || '—').trim();
    const address = (document.getElementById('clientAddress')?.value || '—').trim();

    // ── Dates ────────────────────────────────────────────────────────────
    const today     = new Date();
    const fmtDate   = d => d.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    const validDate = new Date(); validDate.setDate(validDate.getDate() + 7);
    const issueStr  = fmtDate(today);
    const validStr  = fmtDate(validDate);

    // ── Totals ───────────────────────────────────────────────────────────
    const m2rows   = data.module2 || [];
    const m4rows   = data.module4 || [];
    const allRows  = [...m2rows, ...m4rows];
    const subTotal = allRows.reduce((s, r) => s + (r.amount || 0), 0);
    const taxAmt   = subTotal * 0.06;
    const grandTotal = subTotal + taxAmt;
    const money    = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });

    // ── jsPDF setup (Letter, portrait) ───────────────────────────────────
    // html2pdf bundle exposes window.jspdf.jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'pt', format:'letter', orientation:'portrait' });

    const PW   = doc.internal.pageSize.getWidth();   // 612
    const PH   = doc.internal.pageSize.getHeight();  // 792
    const ML   = 48;   // margin left
    const MR   = 48;   // margin right
    const CW   = PW - ML - MR;  // content width
    const SLATE = [15, 23, 42];
    const MID   = [71, 85, 105];
    const LIGHT = [226, 232, 240];
    const WHITE = [255, 255, 255];
    const BLUE  = [0, 113, 227];
    const GREEN = [21, 128, 61];

    let y = 0; // cursor

    // ── Helper: new page guard ────────────────────────────────────────────
    function needsPage(h) {
      if (y + h > PH - 48) { doc.addPage(); y = 48; return true; }
      return false;
    }

    // ── Helper: horizontal rule ───────────────────────────────────────────
    function hRule(yPos, r=LIGHT[0], g=LIGHT[1], b=LIGHT[2]) {
      doc.setDrawColor(r, g, b); doc.setLineWidth(0.5);
      doc.line(ML, yPos, ML + CW, yPos);
    }

    // ════════════════════════════════════════════════════
    //  PAGE 1 — HEADER
    // ════════════════════════════════════════════════════
    y = 48;

    // Logo text block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...SLATE);
    doc.text('APEX', ML, y);
    doc.text('INDUSTRIAL', ML, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MID);
    doc.text('STEEL & COIL PROCESSING', ML, y + 30);

    // Company address block (right-aligned)
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE);
    doc.text('Apex Industrial & Coil Processing Corp.', ML + CW, y, { align:'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MID);
    doc.text('1280 Steel Way, Lancaster, PA 17601', ML + CW, y + 11, { align:'right' });
    doc.text('Phone: +1 (717) 555-0190', ML + CW, y + 22, { align:'right' });
    doc.text('sales@apexindustrial.com', ML + CW, y + 33, { align:'right' });

    y += 50;
    hRule(y); y += 18;

    // ── QUOTATION title ──────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...SLATE);
    doc.text('QUOTATION', ML, y);

    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...MID);
    doc.text(refNo, ML + CW, y, { align:'right' });
    y += 22;

    // ── Client / Date grid ────────────────────────────────────────────────
    // Col 1: Billed To
    const col2x = ML + CW * 0.42;
    const col3x = ML + CW * 0.72;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...MID);
    doc.text('BILLED TO', ML, y);
    doc.text('ISSUE DATE', col2x, y);
    doc.text('VALID UNTIL', col3x, y);
    y += 9;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...SLATE);
    doc.text(client, ML, y);
    doc.text(issueStr, col2x, y);
    doc.text(validStr, col3x, y);
    y += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MID);
    const addrLines = doc.splitTextToSize(address, CW * 0.38);
    doc.text(addrLines, ML, y);
    const addrH = addrLines.length * 11;
    doc.text(phone, ML, y + addrH);
    doc.text(email, ML, y + addrH + 11);
    y += Math.max(addrH + 22, 34);

    hRule(y); y += 18;

    // ════════════════════════════════════════════════════
    //  ITEMS TABLE
    // ════════════════════════════════════════════════════
    // Column x positions & widths
    const cols = {
      desc:  { x: ML,          w: CW * 0.42 },
      qty:   { x: ML + CW * 0.42, w: CW * 0.18 },
      rate:  { x: ML + CW * 0.60, w: CW * 0.20 },
      amt:   { x: ML + CW,     w: 0 }          // right-aligned to edge
    };

    // Table header row — no background fill, plain text with bottom rule
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...MID);
    doc.text('ITEM DESCRIPTION',      cols.desc.x + 4,  y + 9);
    doc.text('QUANTITY',              cols.qty.x  + 4,  y + 9);
    doc.text('UNIT PRICE',            cols.rate.x + 4,  y + 9);
    doc.text('AMOUNT',                cols.amt.x  - 4,  y + 9, { align:'right' });
    hRule(y + 14);
    y += 22;

    // Table rows
    for (const r of allRows) {
      const lineH = 22;
      needsPage(lineH);

      const qtyStr = r.qty ? Number(r.qty).toLocaleString('en-US') + ' ' + (r.unit || '') : '—';
      const nameLines = doc.splitTextToSize(r.item || '', cols.desc.w - 8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...SLATE);
      doc.text(nameLines[0], cols.desc.x + 4, y + 10);
      if (nameLines.length > 1) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...MID);
        doc.text(nameLines.slice(1).join(' '), cols.desc.x + 4, y + 19);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...MID);
      doc.text(qtyStr,          cols.qty.x  + 4,  y + 10);
      doc.text(r.rate  || '—',  cols.rate.x + 4,  y + 10);

      doc.setFont('courier', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...SLATE);
      doc.text(money(r.amount || 0), cols.amt.x - 4, y + 10, { align:'right' });

      // bottom rule
      doc.setDrawColor(...LIGHT); doc.setLineWidth(0.3);
      doc.line(ML, y + lineH - 2, ML + CW, y + lineH - 2);
      y += lineH;
    }

    y += 8;

    // ════════════════════════════════════════════════════
    //  SUMMARY BLOCK (right-aligned)
    // ════════════════════════════════════════════════════
    const sumX  = ML + CW * 0.58;
    const sumW  = CW * 0.42;
    const sumLX = sumX + 4;
    const sumRX = ML + CW - 4;

    function sumRow(label, value, bold=false, bg=null, txtColor=SLATE) {
      needsPage(20);
      if (bg) { doc.setFillColor(...bg); doc.rect(sumX, y - 2, sumW, 20, 'F'); }
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(bold ? 9 : 8.5);
      doc.setTextColor(...txtColor);
      doc.text(label, sumLX, y + 10);
      doc.setFont('courier', bold ? 'bold' : 'normal');
      doc.text(value, sumRX, y + 10, { align:'right' });
      doc.setDrawColor(...LIGHT); doc.setLineWidth(0.3);
      doc.line(sumX, y + 18, ML + CW, y + 18);
      y += 20;
    }

    sumRow('Subtotal',           money(subTotal));
    sumRow('Tax (6%)',           money(taxAmt));
    // Grand total — no fill, bold text with top rule
    needsPage(26);
    hRule(y - 2);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...SLATE);
    doc.text('Total Amount (USD)', sumLX, y + 13);
    doc.setFont('courier', 'bold'); doc.setFontSize(10);
    doc.text(money(grandTotal), sumRX, y + 13, { align:'right' });
    y += 30;

    y += 16;
    hRule(y); y += 14;

    // ════════════════════════════════════════════════════
    //  TERMS & NOTES
    // ════════════════════════════════════════════════════
    const unavail = data._meta?.unavailable || [];
    let termsText = 'Terms & Notes: This quotation is valid for 7 days, with prices quoted FOB Shipping Point and exclusive of applicable sales tax and freight charges. Payment requires a 30% advance with the purchase order, and the remaining 70% is due prior to shipment. Final billing will be calculated based on the certified scale weight at the time of loading, subject to a standard +/- 10% weight tolerance, and a Mill Test Report (MTR) will be provided.';
    if (unavail.length > 0) {
      const list = unavail.map(u => `${u.name} (${u.qty ? Number(u.qty).toLocaleString('en-US') + ' ' + (u.unit || 'lbs') : '—'})`).join(', ');
      termsText += ` Note: The following requested items were declared unavailable and not quoted: ${list}.`;
    }

    const termsLines = doc.splitTextToSize(termsText, CW);
    needsPage(termsLines.length * 11 + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MID);
    doc.text(termsLines, ML, y);
    y += termsLines.length * 11 + 10;

    // ── Footer on every page ─────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MID);
      doc.text(`${refNo}  ·  Page ${p} of ${totalPages}`, ML, PH - 28);
      doc.text('Apex Industrial & Coil Processing Corp.  ·  sales@apexindustrial.com', ML + CW, PH - 28, { align:'right' });
      doc.setDrawColor(...LIGHT); doc.setLineWidth(0.3);
      doc.line(ML, PH - 36, ML + CW, PH - 36);
    }

    doc.save(`${refNo}.pdf`);

  } catch (err) {
    console.error('PDF Generation Error:', err);
    showAlert('Error generating PDF: ' + err.message, 'err');
  } finally {
    if (downloadBtn) { downloadBtn.disabled = false; downloadBtn.textContent = 'Download PDF'; }
  }
}
window.downloadPDF = downloadPDF;

function printQuotation() {
  const element = document.getElementById('quoteOutput');
  if (!element) return;

  // 1. Create a temporary, hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;

  // 2. Clone active stylesheets into the iframe's head
  document.querySelectorAll('link[rel="stylesheet"], style').forEach(el => {
    doc.head.appendChild(el.cloneNode(true));
  });

  // 3. Inject explicit stylesheet rules for print layout (using standard 0.5in margins to resolve clipping)
  const style = document.createElement('style');
  style.textContent = `
    @page {
      size: letter portrait;
      margin: 0.5in 0.5in 0.5in 0.5in !important;
    }
    body {
      background: #ffffff !important;
      color: #000000 !important;
      margin: 0 !important;
      padding: 0 !important;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    #quoteOutput {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
      margin: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      background: #ffffff !important;
      animation: none !important;
      transition: none !important;
      transform: none !important;
    }
    #quoteOutput * {
      animation: none !important;
      transition: none !important;
      transform: none !important;
    }
    .print-only {
      display: block !important;
    }
    .print-only-flex {
      display: flex !important;
    }
    .print-only-grid {
      display: grid !important;
    }
    .print-row, .unavailable-item-row {
      display: none !important;
    }
  `;
  doc.head.appendChild(style);

  // 4. Inject invoice HTML structure
  doc.body.innerHTML = `<div id="quoteOutput">${element.innerHTML}</div>`;

  // 5. Open print dialog once elements are parsed and assets load
  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    
    // Clean up
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 1000);
  }, 400);
}
window.printQuotation = printQuotation;