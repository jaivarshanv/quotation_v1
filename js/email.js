/* ═══════════════════════════════════════════════════
   LANCASTER STEEL — email.js
   EmailJS integration and email HTML template
   ═══════════════════════════════════════════════════ */

'use strict';

// ── Email HTML template ────────────────────────────────
function generateEmailHTML(data, project, client, city, miles, grandTotal) {
  const refNo = data.quoteRef || 'REF-000000';
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const m2Tot = (data.module2 || []).reduce((acc, r) => acc + (r.amount || 0), 0);
  const m3Tot = (data.module3 || []).reduce((acc, r) => acc + (r.amount || 0), 0);
  const m4Tot = (data.module4 || []).reduce((acc, r) => acc + (r.amount || 0), 0);
  const m5Tot = (data.module5 || []).reduce((acc, r) => acc + (r.amount || 0), 0);

  const renderRows = (moduleData) => {
    if (!moduleData || moduleData.length === 0) return '';
    return moduleData.map(row => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#1d1d1f;font-size:13px">${row.item}</td>
        <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#6e6e73;font-size:12px;text-align:center">${row.basis || '—'}</td>
        <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#0071e3;font-size:13px;text-align:right;font-weight:bold">$${row.amount.toLocaleString()}</td>
      </tr>`).join('');
  };

  const renderSection = (title, total, rowsHtml) => `
    <div style="border-bottom:1px solid #e2e8f0">
      <details style="cursor:pointer">
        <summary style="list-style:none;outline:none;padding:20px 30px;display:block">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#1d1d1f;font-size:14px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;border-left:4px solid #0071e3;padding-left:12px">${title}</td>
              <td align="right" style="color:#1d1d1f;font-size:14px;font-weight:bold">$${total.toLocaleString()}</td>
            </tr>
          </table>
        </summary>
        <div style="padding:0 30px 20px 46px">
          <table width="100%">${rowsHtml}</table>
        </div>
      </details>
    </div>
  `;

  return `
    <div style="background-color:#f5f5f7;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
      <style>
        summary::-webkit-details-marker { display:none; }
      </style>
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:auto;background-color:#ffffff;border-radius:18px;border:1px solid #d2d2d7;color:#1d1d1f;box-shadow:0 4px 20px rgba(0,0,0,0.08);overflow:hidden">
        
        <!-- HEADER (Dark Hero) -->
        <tr><td style="padding:40px 30px;background-color:#1d1d1f;color:#ffffff;border-bottom:1px solid rgba(255,255,255,0.1)">
          <table width="100%"><tr>
            <td>
              <div style="color:#ffffff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;opacity:0.6">Lancaster Steel · Cost Estimate</div>
              <div style="color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.03em">Cost Estimate</div>
              <div style="color:rgba(255,255,255,0.6);font-size:14px;margin-top:6px">${project} · Lancaster, PA</div>
            </td>
            <td align="right" valign="top">
              <div style="color:#ffffff;font-family:monospace;font-size:15px;font-weight:bold;margin-bottom:4px">#${refNo}</div>
              <div style="color:rgba(255,255,255,0.5);font-size:13px">${date}</div>
              <div style="color:rgba(255,255,255,0.5);font-size:13px">${client}</div>
              <div style="color:rgba(255,255,255,0.5);font-size:13px">${city} (${miles} mi)</div>
            </td>
          </tr></table>
        </td></tr>

        <!-- MODULES -->
        <tr><td style="padding:0">
          ${renderSection('Module 2 — Material', m2Tot, renderRows(data.module2))}
          ${renderSection('Module 3 — Logistics', m3Tot, `
            <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#6e6e73;font-size:13px">Mileage Charge (${miles} miles)</td><td align="right" style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#1d1d1f;font-weight:bold">$${m3Tot.toLocaleString()}</td></tr>
          `)}
          ${m4Tot > 0 ? renderSection('Module 4 — Erection', m4Tot, renderRows(data.module4)) : ''}
          ${renderSection('Module 5 — Contingency', m5Tot, `
            <tr><td style="padding:10px 0;color:#6e6e73;font-size:13px">Tax & Compliance Fee</td><td align="right" style="padding:10px 0;color:#1d1d1f;font-weight:bold">$${m5Tot.toLocaleString()}</td></tr>
          `)}
        </td></tr>

        <!-- GRAND TOTAL (Dark) -->
        <tr><td style="padding:32px 30px;background-color:#000000;color:#ffffff">
          <table width="100%">
            <tr>
              <td>
                <div style="color:rgba(255,255,255,0.6);font-size:13px;text-transform:uppercase;letter-spacing:1px;font-weight:600">Total Estimated Project Cost</div>
                <div style="color:rgba(255,255,255,0.4);font-size:12px;margin-top:4px">Based on current PA mill rates</div>
              </td>
              <td align="right">
                <div style="color:#ffffff;font-size:36px;font-weight:bold;letter-spacing:-0.02em;font-family:monospace">${grandTotal}</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="padding:30px;background-color:#1d1d1f;text-align:center;border-top:1px solid rgba(255,255,255,0.1)">
          <div style="color:#aeaeb2;font-size:11px;line-height:1.6">
            <strong>Project:</strong> ${project} &nbsp;|&nbsp; <strong>Client:</strong> ${client}<br>
            This manifest was securely transmitted via Lancaster Steel Pricing Engine.<br>
            <span style="color:#6e6e73">SYS.BUILD.402 // DO NOT REPLY</span>
          </div>
        </td></tr>
      </table>
    </div>`;
}
window.generateEmailHTML = generateEmailHTML;

// ── Send email ─────────────────────────────────────────
async function sendEmail() {
  if (!LState.lastQuote) return showAlert('No quote to send.', 'warn');

  const emailBtn = document.getElementById('emailBtn');
  const clientEmail = document.getElementById('clientEmail').value;
  if (!clientEmail || !clientEmail.includes('@')) {
    return showAlert('Please enter a valid client email address.', 'warn');
  }

  emailBtn.disabled = true;
  emailBtn.textContent = 'Sending Email…';

  try {
    const client = document.getElementById('clientName').value || '—';
    const miles = parseFloat(document.getElementById('deliveryMiles').value) || 0;
    const grandTotal = document.getElementById('gtAmount').textContent;
    const data = LState.lastQuote;
    const refNo = data.quoteRef || 'REF-000000';
    const project = client;
    const city = '—';
    const buildType = 'residential';

    const m1Tot = (data.module1 || []).reduce((a, r) => a + (r.amount || 0), 0);
    const m2Tot = (data.module2 || []).reduce((a, r) => a + (r.amount || 0), 0);
    const m3Tot = (data.module3 || []).reduce((a, r) => a + (r.amount || 0), 0);
    const m4Tot = (data.module4 || []).reduce((a, r) => a + (r.amount || 0), 0);
    const m5Tot = (data.module5 || []).reduce((a, r) => a + (r.amount || 0), 0);
    const laborTotal = m4Tot;
    const materialDesc = (data.module2 || []).map(r => r.item).join(', ') || 'Steel Fabrication Package';

    const htmlContent = generateEmailHTML(data, project, client, city, miles, grandTotal);

    const templateParams = {
      quote_id: refNo,
      category: buildType.charAt(0).toUpperCase() + buildType.slice(1),
      material: materialDesc,
      base_price: fmtRaw(m2Tot),
      labor_cost: fmtRaw(laborTotal),
      distance: miles,
      logistics_cost: fmtRaw(m3Tot),
      tax_cost: fmtRaw(m5Tot),
      total_price: fmtRaw(parseFloat(grandTotal.replace(/[^0-9.]/g, ''))),
      to_email: clientEmail,
      to_name: client,
      project_name: project,
      message_html: htmlContent,
      reply_to: 'sales@lancastersteel.com'
    };

    const res = await fetch('/v1/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateParams)
    });

    if (!res.ok) throw new Error('Server responded with ' + res.status);
    showAlert('Quotation sent successfully to ' + clientEmail, 'success');
  } catch (err) {
    console.error('Email failed:', err);
    showAlert('Error: ' + err.message, 'err');
  } finally {
    emailBtn.disabled = false;
    emailBtn.textContent = 'Send via Email';
  }
}
window.sendEmail = sendEmail;
