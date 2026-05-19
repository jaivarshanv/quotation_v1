import {
  auth, db, googleProvider,
  setPersistence, browserLocalPersistence,
  onAuthStateChanged, signInWithPopup, signOut,
  doc, setDoc, getDoc
} from "./firebase-config.js";

// ── Admin email whitelist ──────────────────────────────
const ADMIN_EMAILS = [
  "admin@apexindustrial.com",
  "jaivarshanv@gmail.com"
];

let currentUser = null;
let currentUserRole = "user";

// ══════════════════════════════════════════════════════
//  Global Auth State Manager
// ══════════════════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (user) {
    const userDocRef = doc(db, "users", user.uid);
    let userDoc = await getDoc(userDocRef);

    const isAdminEmail = ADMIN_EMAILS.includes(user.email.toLowerCase());

    if (!userDoc.exists()) {
      // First-time sign-in: create user document
      const role = isAdminEmail ? "admin" : "user";
      await setDoc(userDocRef, {
        name: user.displayName || "Google User",
        email: user.email,
        role: role,
        createdAt: new Date().toISOString()
      });
      userDoc = await getDoc(userDocRef);
    } else {
      // Existing user: always enforce admin role for whitelisted emails
      const data = userDoc.data();
      if (isAdminEmail && data.role !== "admin") {
        await setDoc(userDocRef, { role: "admin" }, { merge: true });
        userDoc = await getDoc(userDocRef);
      }
    }

    const data = userDoc.data();
    currentUserRole = data.role || "user";
    window.currentUserData = data;

    window.dispatchEvent(new CustomEvent("authStateReady", {
      detail: { user, role: currentUserRole }
    }));

    // Redirect away from login page on successful auth
    if (window.location.pathname.endsWith("login.html")) {
      window.location.href = "index.html";
    }

  } else {
    currentUserRole = "user";
    window.currentUserData = null;
    window.dispatchEvent(new CustomEvent("authStateReady", {
      detail: { user: null, role: null }
    }));
  }

  updateNavbarUI();
});

// ══════════════════════════════════════════════════════
//  Login Page — only active on login.html
// ══════════════════════════════════════════════════════
const btnGoogleSignIn = document.getElementById("btnGoogleSignIn");
const authError = document.getElementById("authError");

if (btnGoogleSignIn) {
  btnGoogleSignIn.addEventListener("click", async () => {
    btnGoogleSignIn.disabled = true;
    if (authError) authError.style.display = "none";

    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged handles redirect
    } catch (error) {
      console.error("Google Auth error:", error);
      if (authError) {
        authError.textContent = getReadableError(error);
        authError.style.display = "block";
      }
      btnGoogleSignIn.disabled = false;
    }
  });
}

function getReadableError(error) {
  switch (error.code) {
    case "auth/popup-closed-by-user": return "Sign-in popup was closed. Please try again.";
    case "auth/popup-blocked": return "Popup blocked by browser. Please allow popups for this site.";
    case "auth/network-request-failed": return "Network error. Check your connection and try again.";
    case "auth/cancelled-popup-request": return "Another sign-in attempt is in progress. Please wait.";
    default: return error.message || "Authentication failed. Please try again.";
  }
}

// ══════════════════════════════════════════════════════
//  Navbar UI Injection
// ══════════════════════════════════════════════════════
function updateNavbarUI() {
  const navInner = document.querySelector(".nav-inner");
  if (!navInner) return;

  const existing = document.getElementById("authNavContainer");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.id = "authNavContainer";
  container.style.cssText = "display:flex; gap:12px; align-items:center; margin-left:auto;";

  const path = window.location.pathname;
  if (!path.endsWith("index.html") && !path.endsWith("/") && path !== "") {
    const backBtn = document.createElement("a");
    backBtn.href = "index.html";
    backBtn.className = "btn btn-ghost btn-sm";
    backBtn.textContent = "← Back to Quote";
    container.appendChild(backBtn);
  }

  if (currentUser) {
    // Name label
    const nameEl = document.createElement("span");
    nameEl.style.cssText = "font-size:13px; color:var(--ls-mid, #6e6e73); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
    nameEl.textContent = currentUser.displayName || currentUser.email;
    container.appendChild(nameEl);

    // My Quotes (hidden)
    /*
    const histBtn = document.createElement("a");
    histBtn.href = "history.html";
    histBtn.className = "btn btn-ghost btn-sm";
    histBtn.textContent = "My Quotes";
    container.appendChild(histBtn);
    */

    // Admin Dashboard (admin only)
    if (currentUserRole === "admin") {
      const adminBtn = document.createElement("a");
      adminBtn.href = "admin.html";
      adminBtn.className = "btn btn-secondary btn-sm";
      adminBtn.textContent = "Admin";
      container.appendChild(adminBtn);
    }

    // Logout
    const logoutBtn = document.createElement("button");
    logoutBtn.className = "btn btn-primary btn-sm";
    logoutBtn.textContent = "Logout";
    logoutBtn.onclick = async () => {
      await signOut(auth);
      window.location.reload();
    };
    container.appendChild(logoutBtn);

  } else {
    const loginBtn = document.createElement("a");
    loginBtn.href = "login.html";
    loginBtn.className = "btn btn-primary btn-sm";
    loginBtn.textContent = "Login / Register";
    container.appendChild(loginBtn);
  }

  navInner.appendChild(container);
}

// ── Global exports ─────────────────────────────────────
window.logOut = async () => { await signOut(auth); window.location.href = "index.html"; };
window.getAuthUser = () => currentUser;
window.getAuthRole = () => currentUserRole;
