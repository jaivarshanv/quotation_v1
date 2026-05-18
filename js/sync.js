import { listenToPricing } from "./db.js";

// ── Sync Firebase pricing → LocalEngine ───────────────
// LocalEngine is a non-module script (engine-local.js) loaded before this.
// We use a small poll to ensure it's available before subscribing.

function startPricingSync() {
  if (!window.LocalEngine) {
    // LocalEngine not ready yet — retry shortly
    setTimeout(startPricingSync, 100);
    return;
  }

  listenToPricing((pricingData) => {
    if (pricingData) {
      window.LocalEngine.updatePricingData(pricingData);
      console.log("[sync] Pricing updated from Firebase:", pricingData.updatedAt || "—");
    }
  });
}

startPricingSync();
