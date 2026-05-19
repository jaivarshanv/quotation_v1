/* ═══════════════════════════════════════════════════
   APEX INDUSTRIAL — email.js
   Email dispatch integration with pixel-perfect visual parity
   ═══════════════════════════════════════════════════ */

'use strict';

// ── Email HTML template ────────────────────────────────
function generateEmailHTML(data, client, email, phone, address, grandTotal) {
  const refNo = data.quoteRef || 'APEX-000000';
  const today = new Date();
  const date = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const validDate = new Date();
  validDate.setDate(validDate.getDate() + 7);
  const validStr = validDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const m2Tot = (data.module2 || []).reduce((acc, r) => acc + (r.amount || 0), 0);
  const m4Tot = (data.module4 || []).reduce((acc, r) => acc + (r.amount || 0), 0);
  const subTotalVal = m2Tot + m4Tot;
  const taxVal = subTotalVal * 0.06;
  const totalVal = subTotalVal + taxVal;

  const unavailableList = data._meta?.unavailable || [];
  let unavailableNotice = '';
  if (unavailableList.length > 0) {
    const listStr = unavailableList.map(un => `${un.name} (${un.qty ? Number(un.qty).toLocaleString('en-US') + ' ' + (un.unit || 'lbs') : '—'})`).join(', ');
    unavailableNotice = `<br><span style="font-weight: 500; color: #64748b;">Note: The following requested items were declared unavailable and not quoted: <strong style="color: #64748b; font-weight: 600;">${listStr}</strong>.</span>`;
  }

  const renderRows = (moduleData) => {
    if (!moduleData || moduleData.length === 0) return '';
    return moduleData.map(row => {
      const qtyStr = row.qty ? Number(row.qty).toLocaleString('en-US') + ' ' + (row.unit || '') : '—';
      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding:12px 0;border:none;color:#0f172a;font-size:13px;font-weight:500;text-align:left">${row.item}</td>
          <td style="padding:12px 0;border:none;color:#475569;font-size:12px;text-align:left">${qtyStr}</td>
          <td style="padding:12px 0;border:none;color:#475569;font-size:12px;font-family:monospace;text-align:left">${row.rate || '—'}</td>
          <td style="padding:12px 0;border:none;color:#0f172a;font-size:13px;font-weight:500;font-family:monospace;text-align:right">$${row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>`;
    }).join('');
  };

  const allItemsRows = renderRows(data.module2) + (m4Tot > 0 ? renderRows(data.module4) : '');

  return `
    <div style="background-color:#f8fafc;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;margin:auto;background-color:#ffffff;border-radius:8px;border:1px solid #e2e8f0;color:#000000;box-shadow:0 4px 20px rgba(0,0,0,0.04);overflow:hidden">
        
        <!-- HEADER -->
        <tr>
          <td style="padding:32px 32px 12px 32px;background-color:#ffffff">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 1px solid #cbd5e1; padding-bottom: 16px;">
              <tr>
                <td valign="bottom" align="left">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-size:24px;font-weight:600;color:#000000;text-transform:uppercase;line-height:1;">Apex</td>
                    </tr>
                    <tr>
                      <td style="font-size:24px;font-weight:600;color:#000000;text-transform:uppercase;line-height:1;padding-top:2px;">Industrial</td>
                    </tr>
                    <tr>
                      <td style="font-size:9px;font-weight:500;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;padding-top:6px;">Steel &amp; Coil Processing</td>
                    </tr>
                  </table>
                </td>
                <td align="right" valign="bottom" style="font-size:12.5px;color:#475569;line-height:1.5;padding-top:4px;">
                  <strong style="color:#0f172a;font-size:13.5px;font-weight:600;">Apex Industrial &amp; Coil Processing Corp.</strong><br>
                  1280 Steel Way, Lancaster, PA 17601<br>
                  Phone: +1 (717) 555-0190 | sales@apexindustrial.com
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- DETAILS BLOCK -->
        <tr>
          <td style="padding:24px 32px;background-color:#ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;color:#475569;line-height:1.6;">
              <tr>
                <!-- Column 1: Billed to -->
                <td width="40%" valign="top">
                  <div style="font-weight:600;color:#64748b;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;margin-bottom:8px;">Billed to</div>
                  <div style="font-weight:600;color:#0f172a;font-size:14px;margin-bottom:4px;">${client}</div>
                  <div style="margin-bottom:2px;">${address}</div>
                  <div style="margin-bottom:2px;font-family:monospace;">${phone}</div>
                  <div style="font-family:monospace;">${email}</div>
                </td>
                <!-- Column 2: Quote Number -->
                <td width="35%" valign="top">
                  <div style="font-weight:600;color:#64748b;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;margin-bottom:8px;">Quotation Number</div>
                  <div style="font-family:monospace;font-weight:600;color:#0f172a;font-size:14px;white-space:nowrap;">${refNo}</div>
                </td>
                <!-- Column 3: Dates -->
                <td width="25%" valign="top">
                  <div style="margin-bottom:16px;">
                    <div style="font-weight:600;color:#64748b;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;margin-bottom:4px;">Issue Date</div>
                    <div style="font-weight:500;color:#0f172a;">${date}</div>
                  </div>
                  <div>
                    <div style="font-weight:600;color:#64748b;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;margin-bottom:4px;">Valid Until</div>
                    <div style="font-weight:500;color:#0f172a;">${validStr}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ITEMS TABLE -->
        <tr>
          <td style="padding:0 32px 24px 32px;background-color:#ffffff">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <thead>
                <tr style="border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1;">
                  <th style="padding:10px 0;color:#475569;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;text-align:left;">Item Description</th>
                  <th style="padding:10px 0;color:#475569;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;text-align:left;width:100px;">Quantity</th>
                  <th style="padding:10px 0;color:#475569;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;text-align:left;width:120px;">Unit Price</th>
                  <th style="padding:10px 0;color:#475569;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;text-align:right;width:120px;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${allItemsRows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- SUMMARY BLOCK -->
        <tr>
          <td style="padding:0 32px 32px 32px;background-color:#ffffff;" align="right">
            <table cellpadding="0" cellspacing="0" border="0" style="width:280px;border-collapse:collapse;">
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 0;font-size:13px;color:#475569;text-align:left;font-weight:500;">Subtotal</td>
                <td style="padding:8px 0;font-size:13px;font-weight:500;font-family:monospace;color:#475569;text-align:right;">$${subTotalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 0;font-size:13px;color:#475569;text-align:left;font-weight:500;">Tax (6%)</td>
                <td style="padding:8px 0;font-size:13px;font-weight:500;font-family:monospace;color:#475569;text-align:right;">$${taxVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr style="border-bottom:1.5px solid #cbd5e1;">
                <td style="padding:10px 0;font-size:14px;font-weight:600;letter-spacing:0.5px;text-align:left;color:#000000;">Total Amount (USD)</td>
                <td style="padding:10px 0;font-size:14px;font-weight:600;font-family:monospace;color:#000000;text-align:right;">$${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:32px;background-color:#ffffff;border-top:1px solid #cbd5e1;text-align:left;">
            <!-- Terms & Notes -->
            <div style="font-size:11px;color:#64748b;line-height:1.6;margin-bottom:0;text-align:justify;">
              <strong style="color:#0f172a;font-weight:600;">Terms &amp; Notes:</strong> This quotation is valid for 7 days, with prices quoted FOB Shipping Point and exclusive of applicable sales tax and freight charges. Payment requires a 30% advance with the purchase order, and the remaining 70% is due prior to shipment. Final billing will be calculated based on the certified scale weight at the time of loading, subject to a standard +/- 10% weight tolerance, and a Mill Test Report (MTR) will be provided.${unavailableNotice}
            </div>
          </td>
        </tr>

      </table>
    </div>

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
    const grandTotal = document.getElementById('lblSummaryTotal').textContent;
    const taxTotal = document.getElementById('lblSummaryTax').textContent;
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
      tax_cost: fmtRaw(parseFloat(taxTotal.replace(/[^0-9.]/g, ''))),
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

    // Send confirmation copy to Sender (logged-in salesperson or admin)
    const user = window.getAuthUser ? window.getAuthUser() : null;
    const senderEmail = user?.email || 'admin@apexindustrial.com';

    if (senderEmail && senderEmail.toLowerCase() !== clientEmail.toLowerCase()) {
      const confirmParams = {
        ...templateParams,
        to_email: senderEmail,
        to_name: user?.displayName || 'Apex Industrial Sales',
        quote_id: `${refNo} (Confirmation Copy)`
      };

      try {
        await fetch('/v1/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(confirmParams)
        });
        console.log('[Email] Confirmation copy sent to ' + senderEmail);
        showAlert('Email sent to ' + clientEmail, 'success');
      } catch (confirmErr) {
        console.warn('[Email] Failed to send confirmation copy to ' + senderEmail, confirmErr);
        // Do not fail the whole transaction if only the confirmation copy fails
        showAlert('Email sent to ' + clientEmail, 'success');
      }
    } else {
      showAlert('Email sent to ' + clientEmail, 'success');
    }
  } catch (err) {
    console.error('Email failed:', err);
    showAlert('Error: ' + err.message, 'err');
  } finally {
    emailBtn.disabled = false;
    emailBtn.textContent = 'Send via Email';
  }
}
window.sendEmail = sendEmail;
