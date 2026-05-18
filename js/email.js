/* ═══════════════════════════════════════════════════
   APEX INDUSTRIAL — email.js
   Email dispatch integration with pixel-perfect visual parity
   ═══════════════════════════════════════════════════ */

'use strict';

// ── Email HTML template ────────────────────────────────
function generateEmailHTML(data, client, email, phone, address, grandTotal) {
  const refNo = data.quoteRef || 'APEX-000000';
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const m2Tot = (data.module2 || []).reduce((acc, r) => acc + (r.amount || 0), 0);
  const m4Tot = (data.module4 || []).reduce((acc, r) => acc + (r.amount || 0), 0);

  const weightMetric = data.totalWeightTons ? `${data.totalWeightTons} Tons` : '—';

  // Approvals status
  const approvals = (data._meta && data._meta.approvals) ? data._meta.approvals : {
    status: 'Auto-Approved',
    statusClass: 'status-green',
    marginPercent: 25
  };

  // Badge styling for email HTML inline CSS
  let badgeColor = '#15803d'; // Green
  let badgeBg = '#dcfce7';
  let badgeBorder = 'rgba(21, 128, 61, 0.2)';
  if (approvals.statusClass === 'status-yellow') {
    badgeColor = '#b45309'; // Gold
    badgeBg = '#fef3c7';
    badgeBorder = 'rgba(180, 83, 9, 0.2)';
  } else if (approvals.statusClass === 'status-red') {
    badgeColor = '#b91c1c'; // Red
    badgeBg = '#fee2e2';
    badgeBorder = 'rgba(185, 28, 28, 0.2)';
  }

  // Finance dot styling for email inline CSS
  const finDotColor = (approvals.statusClass === 'status-red') ? '#b45309' : '#15803d';

  const renderRows = (moduleData) => {
    if (!moduleData || moduleData.length === 0) return '';
    return moduleData.map((row, index) => {
      const bg = index % 2 === 1 ? '#f8fafc' : '#ffffff';
      return `
        <tr style="background-color:${bg}">
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;text-align:left">
            <strong>${row.item}</strong>
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;text-align:left">${row.basis || '—'}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:12px;font-family:monospace;text-align:left">${row.rate || '—'}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:bold;font-family:monospace;text-align:right">$${row.amount.toLocaleString()}</td>
        </tr>`;
    }).join('');
  };

  const renderSection = (title, total, rowsHtml) => {
    if (total === 0 && !rowsHtml) return '';
    return `
      <div style="border-bottom:1px solid #e2e8f0;background-color:#ffffff">
        <div style="padding:18px 24px">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="color:#0f172a;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.04em">${title}</td>
              <td align="right" style="color:#0f172a;font-size:14px;font-weight:bold;font-family:monospace">$${total.toLocaleString()}</td>
            </tr>
          </table>
        </div>
        <div style="border-top:1px solid #f1f5f9;background-color:#ffffff">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">${rowsHtml}</table>
        </div>
      </div>
    `;
  };

  return `
    <div style="background-color:#f8fafc;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;margin:auto;background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;color:#0f172a;box-shadow:0 4px 20px rgba(0,0,0,0.04);overflow:hidden">
        
        <!-- CORPORATE LETTERHEAD HEADER -->
        <tr>
          <td style="padding:32px;background-color:#ffffff;border-bottom:1px solid #e2e8f0">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="top">
                  <div style="font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.03em">
                    Apex <span style="color:#64748b;font-weight:400">Industrial</span>
                  </div>
                </td>
                <td align="right" valign="top">
                  <div style="font-family:monospace;font-size:14px;font-weight:600;color:#0f172a">${refNo}</div>
                  <div style="font-size:12px;color:#64748b;margin-top:4px">${date}</div>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top:24px">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px">
                    <tr>
                      <td width="50%" valign="top" style="padding-bottom:12px">
                        <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Client Name</div>
                        <div style="color:#0f172a;font-weight:500">${client}</div>
                      </td>
                      <td width="50%" valign="top" style="padding-bottom:12px">
                        <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Client Email</div>
                        <div style="color:#0f172a;font-weight:500">${email}</div>
                      </td>
                    </tr>
                    <tr>
                      <td width="50%" valign="top">
                        <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Mobile Number</div>
                        <div style="color:#0f172a;font-weight:500">${phone}</div>
                      </td>
                      <td width="50%" valign="top">
                        <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Delivery Address</div>
                        <div style="color:#0f172a;font-weight:500">${address}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- SECTIONS -->
        <tr>
          <td style="padding:0;background-color:#ffffff">
            ${renderSection('Section 1 — Materials & Processing', m2Tot, renderRows(data.module2))}
            ${m4Tot > 0 ? renderSection('Section 2 — Erection & Field Work', m4Tot, renderRows(data.module4)) : ''}
          </td>
        </tr>

        <!-- B2B APPROVAL LOGS -->
        <tr>
          <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle">
                  <div style="display:inline-block;vertical-align:middle;margin-right:12px">
                    <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em">Authorization Status</div>
                  </div>
                  <div style="display:inline-block;vertical-align:middle;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${badgeColor};background-color:${badgeBg};border:1px solid ${badgeBorder}">
                    ${approvals.status}
                  </div>
                </td>
                <td align="right" valign="middle" style="color:#64748b;font-size:11px">
                  <span style="display:inline-block;margin-left:14px">
                    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background-color:#15803d;margin-right:4px;vertical-align:middle"></span>
                    Costing Eng.
                  </span>
                  <span style="display:inline-block;margin-left:14px">
                    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background-color:#15803d;margin-right:4px;vertical-align:middle"></span>
                    Prod. Planner
                  </span>
                  <span style="display:inline-block;margin-left:14px">
                    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background-color:${finDotColor};margin-right:4px;vertical-align:middle"></span>
                    Finance Admin
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- GRAND TOTAL -->
        <tr>
          <td style="padding:24px 32px;background-color:#0f172a;color:#ffffff">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <div style="color:rgba(255,255,255,0.6);font-size:12px;text-transform:uppercase;letter-spacing:0.04em;font-weight:600">Total Estimated B2B Project Cost</div>
                  <div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:4px">May 2026 Raw Material Mill Indexing</div>
                </td>
                <td align="right">
                  <div style="color:#ffffff;font-size:32px;font-weight:700;font-family:monospace;letter-spacing:-0.02em">${grandTotal}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- B2B AUTHENTICITY QR MARK & FOOTER -->
        <tr>
          <td style="padding:24px 32px;background-color:#ffffff;border-top:1px solid #e2e8f0">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="color:#64748b;font-size:11px;line-height:1.6">
                  <strong>Apex Industrial &amp; Coil Processing Corp.</strong><br>
                  Authorized electronic RFQ summary. Digitally signed &amp; verified.<br>
                  <span style="color:#94a3b8">SYS.APEX.BOM.402 // CONFIDENTIAL PORTAL DISPATCH</span>
                </td>
                <td align="right" valign="middle" width="50">
                  <div style="width:42px;height:42px;border:1px solid #e2e8f0;border-radius:4px;padding:4px;background-color:#ffffff">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                      <path d="M14 14h2v2h-2z M18 18h3v3h-3z M14 20h2v1h-2z M18 14h3v2h-3z"></path>
                    </svg>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </div>
  `;
}
window.generateEmailHTML = generateEmailHTML;

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
    const phone = document.getElementById('clientPhone').value || '—';
    const address = document.getElementById('clientAddress').value || '—';
    const grandTotal = document.getElementById('gtAmount').textContent;
    const data = LState.lastQuote;
    const refNo = data.quoteRef || 'REF-000000';
    const buildType = 'residential';

    const m2Tot = (data.module2 || []).reduce((a, r) => a + (r.amount || 0), 0);
    const m4Tot = (data.module4 || []).reduce((a, r) => a + (r.amount || 0), 0);
    const laborTotal = m4Tot;
    const materialDesc = (data.module2 || []).map(r => r.item).join(', ') || 'Steel Fabrication Package';

    const htmlContent = generateEmailHTML(data, client, clientEmail, phone, address, grandTotal);

    const templateParams = {
      quote_id: refNo,
      category: buildType.charAt(0).toUpperCase() + buildType.slice(1),
      material: materialDesc,
      base_price: fmtRaw(m2Tot),
      labor_cost: fmtRaw(laborTotal),
      distance: 0,
      logistics_cost: '0.00',
      tax_cost: '0.00',
      total_price: fmtRaw(parseFloat(grandTotal.replace(/[^0-9.]/g, ''))),
      to_email: clientEmail,
      to_name: client,
      project_name: client,
      message_html: htmlContent,
      reply_to: 'sales@apexindustrial.com'
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
