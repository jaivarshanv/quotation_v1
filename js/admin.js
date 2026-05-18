import { db, collection, getDocs, query, orderBy, doc, getDoc, setDoc, deleteDoc, addDoc } from "./firebase-config.js";

const tbody = document.getElementById("allQuotesTableBody");


// ══════════════════════════════════════════════════════
//  Auth guard
// ══════════════════════════════════════════════════════
window.addEventListener("authStateReady", async (e) => {
  const { user, role } = e.detail;

  if (!user) {
    document.body.innerHTML = `
      <div style="text-align:center; margin-top:80px; font-family:system-ui;">
        <h2 style="color:#dc2626;">Access Denied</h2>
        <p style="color:#6b7280;">You must be logged in as an admin to view this page.</p>
        <a href="login.html" style="display:inline-block; margin-top:16px; padding:10px 24px; background:#0071e3; color:#fff; border-radius:8px; text-decoration:none;">Go to Login</a>
      </div>`;
    return;
  }

  if (role !== "admin") {
    document.body.innerHTML = `
      <div style="text-align:center; margin-top:80px; font-family:system-ui;">
        <h2 style="color:#dc2626;">Access Denied</h2>
        <p style="color:#6b7280;">Admin privileges required. Your account role: <strong>${role}</strong></p>
        <a href="index.html" style="display:inline-block; margin-top:16px; padding:10px 24px; background:#0071e3; color:#fff; border-radius:8px; text-decoration:none;">Go Home</a>
      </div>`;
    return;
  }

  loadAllQuotes();
  loadCatalogItems();
});

// ══════════════════════════════════════════════════════
//  Load & Sort Quotations
// ══════════════════════════════════════════════════════
let allQuotesData = [];
let currentSort = { col: 'date', asc: false };

async function loadAllQuotes() {
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--ls-mid);">Loading quotes…</td></tr>`;
  try {
    const qCol = collection(db, "quotations");
    const q = query(qCol, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    allQuotesData = [];
    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--ls-mid); padding:20px;">No quotations found in system.</td></tr>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const qd = data.quoteData || {};
      const rawDate = data.createdAt ? new Date(data.createdAt).getTime() : 0;
      const dateStr = data.createdAt
        ? new Date(data.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : "—";
      const rawRef = qd.quoteRef || "";
      const userName = data.userName || "Unknown";
      const userId = data.userId || "";
      const desc = qd.projectName || (qd.summary ? qd.summary.split(" · ")[0] : "Unnamed Project");
      const weightNum = qd.totalWeightTons || 0;
      const weightStr = qd.totalWeightTons ? `${qd.totalWeightTons} tons` : "—";
      const grand = ["module1","module2","module3","module4","module5"]
        .flatMap(m => qd[m] || [])
        .reduce((acc, r) => acc + (r.amount || 0), 0);
      allQuotesData.push({ id: docSnap.id, rawDate, dateStr, rawRef, refStr: rawRef || "—", userName, userId, desc, weightNum, weightStr, grand, grandFmt: grand > 0 ? `$${grand.toLocaleString()}` : "—", fullData: data });
    });

    renderQuotesTable();
  } catch (error) {
    console.error("Error loading quotes:", error);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red; padding:20px;">Error loading quotes: ${error.message}</td></tr>`;
  }
}

function renderQuotesTable() {
  allQuotesData.sort((a, b) => {
    let valA, valB;
    switch (currentSort.col) {
      case 'date':   valA = a.rawDate;              valB = b.rawDate;              break;
      case 'ref':    valA = a.rawRef.toLowerCase(); valB = b.rawRef.toLowerCase(); break;
      case 'user':   valA = a.userName.toLowerCase(); valB = b.userName.toLowerCase(); break;
      case 'desc':   valA = a.desc.toLowerCase();   valB = b.desc.toLowerCase();   break;
      case 'weight': valA = a.weightNum;             valB = b.weightNum;            break;
      case 'total':  valA = a.grand;                valB = b.grand;               break;
      default:       valA = a.rawDate;              valB = b.rawDate;
    }
    if (valA < valB) return currentSort.asc ? -1 : 1;
    if (valA > valB) return currentSort.asc ? 1 : -1;
    return 0;
  });

  tbody.innerHTML = "";
  
  const grouped = {};
  const userOrder = [];
  allQuotesData.forEach(item => {
    if (!grouped[item.userName]) {
      grouped[item.userName] = [];
      userOrder.push(item.userName);
    }
    grouped[item.userName].push(item);
  });

  userOrder.forEach(user => {
    const quotes = grouped[user];
    const totalGrand = quotes.reduce((acc, q) => acc + q.grand, 0);
    const totalGrandFmt = totalGrand > 0 ? `$${totalGrand.toLocaleString()}` : "—";
    
    const headerTr = document.createElement("tr");
    headerTr.style.cursor = "pointer";
    headerTr.style.background = "var(--ls-bg)";
    headerTr.innerHTML = `
      <td colspan="4" style="padding:12px 24px;">
        <div style="display:flex; align-items:flex-start;">
          <span style="display:inline-block; transition:transform 0.2s; margin-top:2px; margin-right:8px;" class="user-chevron">▶</span>
          <div>
            <div style="font-weight:600; font-size:14px; color:var(--ls-black);">${user} <span style="color:var(--ls-mid); font-weight:400; font-size:12px; margin-left:8px;">(${quotes.length} quote${quotes.length>1?'s':''})</span></div>
            <div style="font-size:12px; color:var(--ls-mid); font-family:var(--font-mono); margin-top:2px;">${quotes[0].userId}</div>
          </div>
        </div>
      </td>
      <td style="font-weight:700; padding:12px 24px; text-align:right;">${totalGrandFmt}</td>
    `;
    
    tbody.appendChild(headerTr);

    const rows = [];
    quotes.forEach(item => {
      const tr = document.createElement("tr");
      tr.style.display = "none";
      tr.style.cursor = "pointer";
      tr.title = "Click to inspect detailed B2B quote breakdown";
      tr.innerHTML = `
        <td>${item.dateStr}</td>
        <td><span style="font-family:var(--font-mono,monospace);font-size:12px;color:var(--ls-mid);">${item.refStr}</span></td>
        <td>${item.desc}</td>
        <td>${item.weightStr}</td>
        <td><strong>${item.grandFmt}</strong></td>
      `;
      tr.addEventListener("click", () => window.inspectQuote(item));
      tbody.appendChild(tr);
      rows.push(tr);
    });

    headerTr.addEventListener("click", () => {
      const isHidden = rows[0].style.display === "none";
      const chevron = headerTr.querySelector('.user-chevron');
      if (isHidden) {
        rows.forEach(r => r.style.display = "table-row");
        chevron.style.transform = "rotate(90deg)";
      } else {
        rows.forEach(r => r.style.display = "none");
        chevron.style.transform = "rotate(0deg)";
      }
    });
  });

  ['date','ref','desc','weight','total'].forEach(c => {
    const el = document.getElementById(`sort-${c}`);
    if (el) el.innerHTML = currentSort.col === c ? (currentSort.asc ? " &uarr;" : " &darr;") : "";
  });
}

window.sortBy = function(col) {
  if (currentSort.col === col) {
    currentSort.asc = !currentSort.asc;
  } else {
    currentSort.col = col;
    currentSort.asc = ['date','weight','total'].includes(col) ? false : true;
  }
  renderQuotesTable();
};

// ══════════════════════════════════════════════════════
//  Catalog CRUD
// ══════════════════════════════════════════════════════
const catalogTbody = document.getElementById("catalogTableBody");

async function loadCatalogItems() {
  catalogTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--ls-mid);">Loading catalog…</td></tr>`;
  try {
    const snap = await getDocs(collection(db, "catalog"));
    catalogTbody.innerHTML = "";

    if (snap.empty) {
      catalogTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--ls-mid); padding:20px;">No items in catalog. Add one above.</td></tr>`;
      return;
    }

    snap.forEach(docSnap => {
      const d = docSnap.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${d.name || "—"}</strong></td>
        <td>$${parseFloat(d.priceLb || 0).toFixed(3)}</td>
        <td>$${parseFloat(d.fabLb || 0).toFixed(3)}</td>
        <td>${d.marginPct !== undefined ? parseFloat(d.marginPct) + '%' : "—"}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="openItemForm('${docSnap.id}')">Edit</button>
          <button class="btn btn-ghost btn-sm" style="color:#dc2626;" onclick="deleteItem('${docSnap.id}','${(d.name||"").replace(/'/g,"\\'")}')">Delete</button>
        </td>
      `;
      catalogTbody.appendChild(tr);
    });

    // Refresh engine's in-memory catalog
    if (window.LocalEngine?.loadCatalog) window.LocalEngine.loadCatalog();
  } catch (error) {
    console.error("Error loading catalog:", error);
    catalogTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red; padding:20px;">Error: ${error.message}</td></tr>`;
  }
}

window.openItemForm = async function(docId = null) {
  document.getElementById("itemDocId").value = docId || "";
  document.getElementById("itemModalTitle").textContent = docId ? "Edit Item" : "Add Item";
  document.getElementById("itemName").value = "";
  document.getElementById("itemPriceLb").value = "";
  document.getElementById("itemFabLb").value = "";
  document.getElementById("itemMarginPct").value = "";
  document.getElementById("itemMsg").style.display = "none";

  if (docId) {
    try {
      const snap = await getDoc(doc(db, "catalog", docId));
      if (snap.exists()) {
        const d = snap.data();
        document.getElementById("itemName").value    = d.name || "";
        document.getElementById("itemPriceLb").value = d.priceLb || "";
        document.getElementById("itemFabLb").value   = d.fabLb || "";
        document.getElementById("itemMarginPct").value = d.marginPct !== undefined ? d.marginPct : "";
      }
    } catch (e) { console.error(e); }
  }

  document.getElementById("itemModalOverlay").style.display = "block";
  document.getElementById("itemModal").style.display = "block";
};

window.closeItemForm = function() {
  document.getElementById("itemModalOverlay").style.display = "none";
  document.getElementById("itemModal").style.display = "none";
};

window.saveItem = async function() {
  const docId   = document.getElementById("itemDocId").value.trim();
  const name    = document.getElementById("itemName").value.trim();
  const priceLb = parseFloat(document.getElementById("itemPriceLb").value);
  const fabLb   = parseFloat(document.getElementById("itemFabLb").value);
  const marginPctVal = document.getElementById("itemMarginPct").value.trim();

  if (!name)                        { showItemMsg("Name is required.", "error");        return; }
  if (isNaN(priceLb) || priceLb <= 0) { showItemMsg("Enter a valid Price/lb.", "error"); return; }
  if (isNaN(fabLb)   || fabLb < 0)    { showItemMsg("Enter a valid Fab/lb.", "error");   return; }
  
  let marginPct = undefined;
  if (marginPctVal !== "") {
    marginPct = parseFloat(marginPctVal);
    if (isNaN(marginPct) || marginPct < 0) {
      showItemMsg("Enter a valid Margin %.", "error");
      return;
    }
  }

  const nameTag = name.toLowerCase().trim();
  const tokens = nameTag.split(/[^a-z0-9]+/).filter(Boolean);
  const tags = [...new Set([nameTag, ...tokens])];

  const payload = { name, tags, priceLb, fabLb, updatedAt: new Date().toISOString() };
  if (marginPct !== undefined) {
    payload.marginPct = marginPct;
  }

  try {
    if (docId) {
      await setDoc(doc(db, "catalog", docId), payload);
    } else {
      await addDoc(collection(db, "catalog"), payload);
    }
    showItemMsg("✓ Saved.", "success");
    setTimeout(() => { closeItemForm(); loadCatalogItems(); }, 800);
  } catch (e) {
    console.error(e);
    showItemMsg("Error: " + e.message, "error");
  }
};

window.deleteItem = async function(docId, name) {
  if (!confirm(`Delete "${name}" from catalog? This cannot be undone.`)) return;
  try {
    await deleteDoc(doc(db, "catalog", docId));
    loadCatalogItems();
  } catch (e) {
    alert("Error deleting item: " + e.message);
  }
};

function showItemMsg(text, type = "success") {
  const el = document.getElementById("itemMsg");
  el.textContent = text;
  el.style.color = type === "success" ? "#16a34a" : "#dc2626";
  el.style.display = "block";
}

// Detailed Quote Inspector Modal Bindings
window.inspectQuote = function(item) {
  const fd = item.fullData || {};
  const qd = fd.quoteData || {};
  const meta = qd._meta || {};
  const rawMaterials = meta.rawMaterials || [];

  // Populate B2B client info
  document.getElementById("insClientName").textContent = fd.clientName || qd.clientName || fd.userName || "—";
  document.getElementById("insClientEmail").textContent = fd.clientEmail || qd.clientEmail || "—";
  document.getElementById("insClientPhone").textContent = fd.clientPhone || qd.clientPhone || "—";
  document.getElementById("insClientAddress").textContent = fd.clientAddress || qd.clientAddress || "—";

  document.getElementById("insTitle").textContent = `Quote Inspection — ${qd.quoteRef || "REF"}`;

  // Populate materials breakdown
  const mBody = document.getElementById("insMaterialsBody");
  mBody.innerHTML = "";
  
  if (rawMaterials.length === 0) {
    mBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:15px; color:#8e8e93;">No itemized materials saved for this quotation.</td></tr>`;
  } else {
    rawMaterials.forEach(m => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding:10px; border-bottom:1px solid #eee;"><strong>${m.itemName || "—"}</strong></td>
        <td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">${Math.round(m.weightLbs).toLocaleString()}</td>
        <td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">$${parseFloat(m.basePriceLb || 0).toFixed(3)}</td>
        <td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">$${parseFloat(m.fabLb || 0).toFixed(3)}</td>
        <td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">${parseFloat(m.marginPct || 0).toFixed(0)}%</td>
        <td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">$${parseFloat(m.loadedRate || 0).toFixed(3)}</td>
        <td style="padding:10px; border-bottom:1px solid #eee; text-align:right; font-weight:700;">$${parseFloat(m.amount || 0).toLocaleString()}</td>
      `;
      mBody.appendChild(tr);
    });
  }

  document.getElementById("insGrandTotal").textContent = item.grandFmt;

  // Show inspector modal
  document.getElementById("inspectorOverlay").style.display = "block";
  document.getElementById("inspectorModal").style.display = "block";
};

window.closeInspector = function() {
  document.getElementById("inspectorOverlay").style.display = "none";
  document.getElementById("inspectorModal").style.display = "none";
};
