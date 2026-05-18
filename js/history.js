import { fetchUserQuotes } from "./db.js";

const tbody = document.getElementById("historyTableBody");

// ── Format helpers ─────────────────────────────────────
const fmt = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ══════════════════════════════════════════════════════
//  Auth guard + data load
// ══════════════════════════════════════════════════════
window.addEventListener("authStateReady", async (e) => {
  const { user } = e.detail;

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--ls-mid);">Loading your quotes…</td></tr>`;

  try {
    const quotes = await fetchUserQuotes(user.uid);
    renderHistory(quotes);
  } catch (err) {
    console.error("Error fetching quotes:", err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red; padding:20px;">Error loading quotes: ${err.message}</td></tr>`;
  }
});

// ══════════════════════════════════════════════════════
//  Render history table
// ══════════════════════════════════════════════════════
function renderHistory(quotes) {
  tbody.innerHTML = "";

  if (quotes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; color:var(--ls-mid); padding:40px;">
          No quotes saved yet. <a href="index.html" style="color:#0071e3;">Generate your first quote →</a>
        </td>
      </tr>`;
    return;
  }

  quotes.forEach((q) => {
    const data = q.quoteData || {};
    const date = q.createdAt
      ? new Date(q.createdAt).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      })
      : "—";

    const desc = data.projectName || (data.summary ? data.summary.split(" · ")[0] : "Unnamed Project");
    const quoteRef = data.quoteRef ? data.quoteRef : "REF-PENDING"; // Add this line!
    const weight = data.totalWeightTons ? `${data.totalWeightTons} tons` : "—";

    const grand = ["module1", "module2", "module3", "module4", "module5"]
      .flatMap(m => data[m] || [])
      .reduce((acc, r) => acc + (r.amount || 0), 0);
    const grandFmt = grand > 0 ? fmt(grand) : "—";

    const mode = data._meta?.source || "csv";
    const modeBadge = {
      csv: `<span class="chip" style="background:#dcfce7;color:#166534;">BOM/CSV</span>`,
      preset: `<span class="chip" style="background:#e0f2fe;color:#0284c7;">Preset</span>`,
      image: `<span class="chip" style="background:#fef9c3;color:#854d0e;">AI Floor Plan</span>`
    }[mode] || `<span class="chip">—</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${date}</td>
      <td>
        <strong>${esc(desc)}</strong><br>
        <small style="color:var(--ls-mid); font-family:var(--font-mono, monospace);">${esc(quoteRef)}</small>
      </td>
      <td>${weight}</td>
      <td><strong>${grandFmt}</strong></td>
      <td>${modeBadge}</td>
    `;

    // Tap → open detail drawer
    tr.addEventListener("click", () => openDrawer(q));
    tbody.appendChild(tr);
  });
}

// ══════════════════════════════════════════════════════
//  Drawer — open
// ══════════════════════════════════════════════════════
function openDrawer(q) {
  const data = q.quoteData || {};
  const meta = data._meta || {};

  // ── Title & subtitle ──────────────────────────────
  const desc = data.projectName || (data.summary ? data.summary.split(" · ")[0] : "Unnamed Project");
  document.getElementById("drawerTitle").textContent = desc;
  const dateStr = q.createdAt
    ? new Date(q.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
  const refStr = data.quoteRef ? data.quoteRef + " · " : "";
  document.getElementById("drawerSubtitle").textContent = refStr + dateStr;

  // ── Meta grid ─────────────────────────────────────
  const weight = data.totalWeightTons ? `${data.totalWeightTons} short tons` : "—";
  const mode = meta.source || "csv";
  const modeLabel = { csv: "BOM / CSV Upload", preset: "Quick Presets", image: "AI Floor Plan" }[mode] || mode;

  const grand = ["module1", "module2", "module3", "module4", "module5"]
    .flatMap(m => data[m] || [])
    .reduce((acc, r) => acc + (r.amount || 0), 0);

  document.getElementById("drawerMeta").innerHTML = `
    <div class="meta-cell">
      <div class="meta-cell__label">Total Weight</div>
      <div class="meta-cell__value">${weight}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-cell__label">Input Method</div>
      <div class="meta-cell__value">${modeLabel}</div>
    </div>
  `;

  // ── Sections ───────────────────────────────────────
  const SECTION_TITLES = {
    module2: "Material Cost",
    module4: "Erection & Field Work Cost"
  };

  const modulesEl = document.getElementById("drawerModules");
  modulesEl.innerHTML = "";

  let sectionIdx = 0;
  for (const [key, title] of Object.entries(SECTION_TITLES)) {
    const rows = data[key] || [];
    if (rows.length === 0) continue;

    const sectTotal = rows.reduce((a, r) => a + (r.amount || 0), 0);
    const blockId = `mod-body-${sectionIdx}`;
    const chevId = `mod-chev-${sectionIdx}`;

    const block = document.createElement("div");
    block.className = "mod-block";
    block.innerHTML = `
      <div class="mod-head" onclick="toggleModBlock('${blockId}','${chevId}')">
        <div class="mod-label">${title}</div>
        <div class="mod-right">
          <span class="mod-total">${fmt(sectTotal)}</span>
          <span class="mod-chev" id="${chevId}">▶</span>
        </div>
      </div>
      <div class="mod-body" id="${blockId}">
        ${rows.map(r => `
          <div class="line-row">
            <div class="line-row__top">
              <div class="line-row__name">${esc(r.item || "")}</div>
              <div class="line-row__amount">${fmt(r.amount || 0)}</div>
            </div>
            ${(r.qty || r.rate) ? `
              <div class="line-row__meta">
                ${r.qty ? `Quantity: ${Number(r.qty).toLocaleString('en-US')} ${esc(r.unit || '')}` : ''}
                ${(r.qty && r.rate) ? ' · ' : ''}
                ${r.rate ? `Rate: ${esc(r.rate)}` : ''}
              </div>
            ` : ''}
          </div>`).join("")}
      </div>
    `;
    modulesEl.appendChild(block);
    sectionIdx++;
  }

  // Auto-expand Section 1 (most interesting)
  const s1body = document.getElementById("mod-body-0");
  const s1chev = document.getElementById("mod-chev-0");
  if (s1body) { s1body.classList.add("open"); }
  if (s1chev) { s1chev.classList.add("open"); }

  // ── Grand total ────────────────────────────────────
  document.getElementById("drawerGrandTotal").textContent = fmt(grand);

  // ── Disclaimer ────────────────────────────────────
  document.getElementById("drawerDisclaimer").textContent = "";

  // ── Show ───────────────────────────────────────────
  document.getElementById("modalOverlay").classList.add("open");
  document.getElementById("detailDrawer").classList.add("open");
  document.body.style.overflow = "hidden";
}

// ── Close drawer ───────────────────────────────────────
window.closeDrawer = function () {
  document.getElementById("modalOverlay").classList.remove("open");
  document.getElementById("detailDrawer").classList.remove("open");
  document.body.style.overflow = "";
};

// ── Toggle module accordion ────────────────────────────
window.toggleModBlock = function (bodyId, chevId) {
  const body = document.getElementById(bodyId);
  const chev = document.getElementById(chevId);
  if (!body) return;
  body.classList.toggle("open");
  if (chev) chev.classList.toggle("open");
};

// ── Close on swipe down ────────────────────────────────
(function initSwipe() {
  const drawer = document.getElementById("detailDrawer");
  if (!drawer) return;
  let startY = 0;
  drawer.addEventListener("touchstart", e => { startY = e.touches[0].clientY; }, { passive: true });
  drawer.addEventListener("touchend", e => {
    const delta = e.changedTouches[0].clientY - startY;
    if (delta > 80) closeDrawer(); // swipe down 80px to close
  }, { passive: true });
})();

// ── Escape key to close ────────────────────────────────
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeDrawer();
});

// ── Utility ───────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}