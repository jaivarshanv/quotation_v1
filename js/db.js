import {
  db, collection, doc,
  setDoc, getDoc, getDocs,
  onSnapshot, addDoc,
  query, where, orderBy
} from "./firebase-config.js";

// ══════════════════════════════════════════════════════
//  Pricing
// ══════════════════════════════════════════════════════
export async function fetchPricing() {
  const docRef = doc(db, "pricing", "current");
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

export function listenToPricing(callback) {
  const docRef = doc(db, "pricing", "current");
  return onSnapshot(docRef, (docSnap) => {
    callback(docSnap.exists() ? docSnap.data() : null);
  });
}

export async function updatePricing(priceBands, presetConfigs) {
  const docRef = doc(db, "pricing", "current");
  await setDoc(docRef, {
    priceBands,
    presetConfigs,
    updatedAt: new Date().toISOString()
  });
}

// ══════════════════════════════════════════════════════
//  Quotations
// ══════════════════════════════════════════════════════
export async function saveUserQuote(userId, userName, quoteData) {
  try {
    await addDoc(collection(db, "quotations"), {
      userId,
      userName,
      quoteData,
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.error("Error saving quote:", e);
  }
}

export async function fetchUserQuotes(userId) {
  const q = query(
    collection(db, "quotations"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchAllQuotes() {
  const q = query(collection(db, "quotations"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ══════════════════════════════════════════════════════
//  Users
// ══════════════════════════════════════════════════════
export async function fetchAllUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateUserRole(userId, newRole) {
  await setDoc(doc(db, "users", userId), { role: newRole }, { merge: true });
}

// ── Global access for non-module scripts (quote.js etc.) ─
window.dbStore = {
  fetchPricing,
  listenToPricing,
  updatePricing,
  saveUserQuote,
  fetchUserQuotes,
  fetchAllQuotes,
  fetchAllUsers,
  updateUserRole
};
