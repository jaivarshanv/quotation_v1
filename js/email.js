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
  validDate.setDate(validDate.getDate() + 30);
  const validStr = validDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const m2Tot = (data.module2 || []).reduce((acc, r) => acc + (r.amount || 0), 0);
  const m4Tot = (data.module4 || []).reduce((acc, r) => acc + (r.amount || 0), 0);
  const subTotalVal = m2Tot + m4Tot;
  const taxVal = subTotalVal * 0.06;
  const totalVal = subTotalVal + taxVal;

  const renderRows = (moduleData) => {
    if (!moduleData || moduleData.length === 0) return '';
    return moduleData.map(row => {
      const qtyStr = row.qty ? Number(row.qty).toLocaleString('en-US') + ' ' + (row.unit || '') : '—';
      return `
        <tr>
          <td style="padding:10px 16px;border:1px solid #e2e8f0;color:#000000;font-size:13px;font-weight:bold;text-align:left">${row.item}</td>
          <td style="padding:10px 16px;border:1px solid #e2e8f0;color:#334155;font-size:12px;text-align:left">${qtyStr}</td>
          <td style="padding:10px 16px;border:1px solid #e2e8f0;color:#334155;font-size:12px;font-family:monospace;text-align:left">${row.rate || '—'}</td>
          <td style="padding:10px 16px;border:1px solid #e2e8f0;color:#000000;font-size:13px;font-weight:bold;font-family:monospace;text-align:right">$${row.amount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        </tr>`;
    }).join('');
  };

  const allItemsRows = renderRows(data.module2) + (m4Tot > 0 ? renderRows(data.module4) : '');

  return `
    <div style="background-color:#f8fafc;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;margin:auto;background-color:#ffffff;border-radius:8px;border:1px solid #e2e8f0;color:#000000;box-shadow:0 4px 20px rgba(0,0,0,0.04);overflow:hidden">
        
        <!-- HEADER -->
        <tr>
          <td style="padding:32px;background-color:#ffffff;border-bottom:1px solid #e2e8f0">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle">
                  <div style="font-size:24px;font-weight:800;color:#000000;letter-spacing:-1px;text-transform:uppercase;">Apex Industrial</div>
                  <div style="font-size:10px;font-weight:600;color:#64748b;letter-spacing:0.5px;text-transform:uppercase;margin-top:2px;">Steel &amp; Coil Processing</div>
                </td>
                <td align="right" valign="middle" style="font-size:11px;color:#334155;line-height:1.4;">
                  <strong>Apex Industrial &amp; Coil Processing Corp.</strong><br>
                  1280 Steel Way, Lancaster, PA 17601<br>
                  +1 (717) 555-0190 | sales@apexindustrial.com
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- DETAILS BLOCK -->
        <tr>
          <td style="padding:24px 32px;background-color:#ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:4px;overflow:hidden;">
              <!-- Black Top Accent Bar -->
              <tr>
                <td colspan="2" style="background-color:#000000;color:#ffffff;padding:8px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
                  Quotation Details
                </td>
              </tr>
              <!-- Details Content -->
              <tr style="background-color:#f8fafc;">
                <!-- Left Column -->
                <td width="50%" valign="top" style="padding:16px 20px;font-size:13px;color:#334155;line-height:1.6;">
                  <strong style="color:#000000;">Quote Reference:</strong> <span style="font-family:monospace;font-weight:600;">${refNo}</span><br>
                  <strong style="color:#000000;">Date:</strong> ${date}<br>
                  <strong style="color:#000000;">Valid Until:</strong> ${validStr}
                </td>
                <!-- Right Column -->
                <td width="50%" valign="top" style="padding:16px 20px;font-size:13px;color:#334155;line-height:1.6;">
                  <strong style="color:#000000;">Customer Name:</strong> ${client}<br>
                  <strong style="color:#000000;">Address:</strong> ${address}<br>
                  <strong style="color:#000000;">Contact:</strong> ${phone}<br>
                  <strong style="color:#000000;">Email:</strong> ${email}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ITEMS TABLE -->
        <tr>
          <td style="padding:0 32px 24px 32px;background-color:#ffffff">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:4px;overflow:hidden;border-collapse:collapse;">
              <thead>
                <tr style="background-color:#000000;">
                  <th style="padding:10px 16px;color:#ffffff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:left;">Item Description</th>
                  <th style="padding:10px 16px;color:#ffffff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:left;width:100px;">Quantity</th>
                  <th style="padding:10px 16px;color:#ffffff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:left;width:120px;">Unit Price</th>
                  <th style="padding:10px 16px;color:#ffffff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:right;width:120px;">Amount</th>
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
            <table cellpadding="0" cellspacing="0" border="0" style="width:280px;border:1px solid #e2e8f0;border-radius:4px;overflow:hidden;border-collapse:collapse;">
              <tr>
                <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;text-align:left;">Sub Total:</td>
                <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;font-family:monospace;color:#000000;text-align:right;">$${subTotalVal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;text-align:left;">Tax (6%):</td>
                <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;font-family:monospace;color:#000000;text-align:right;">$${taxVal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
              </tr>
              <tr style="background-color:#000000;color:#ffffff;">
                <td style="padding:12px 16px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-align:left;">Grand Total:</td>
                <td style="padding:12px 16px;font-size:13px;font-weight:700;font-family:monospace;text-align:right;">$${totalVal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:32px;background-color:#ffffff;border-top:1px solid #e2e8f0;text-align:center;">
            <div style="font-size:12px;font-weight:600;color:#000000;letter-spacing:0.5px;margin-bottom:14px;">
              Verified and digitally authorized by ApexIndustrial
            </div>
            <div style="font-size:24px;font-weight:800;color:#000000;letter-spacing:-0.5px;text-transform:uppercase;">
              Thank You!
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
