// payments.js — payment-ready architecture.
//
// Design: every gateway implements the same tiny interface:
//   { id, label, startCheckout({ itemId, itemType, price, onSuccess }) }
// The active gateway is picked by ACTIVE_GATEWAY. Today only "demo" exists
// (no real money moves — it simply unlocks locally so the rest of the product
// can be built/tested end-to-end). Wiring a real gateway later means adding a
// new adapter object below and flipping ACTIVE_GATEWAY — no other file in the
// app needs to change, because everything calls purchaseItem()/isUnlocked().

const PURCHASES_KEY = "ic_purchases_v1";

/** Demo/local gateway — unlocks instantly. Replace with a real adapter for production. */
const demoGateway = {
  id: "demo",
  label: "Demo Ödəniş",
  async startCheckout({ itemId, itemType, onSuccess }) {
    // In production this redirects to the gateway's hosted checkout and
    // onSuccess() fires from a webhook/return-URL handler instead.
    await new Promise((r) => setTimeout(r, 700));
    recordPurchase(itemId, itemType);
    onSuccess?.();
  },
};

/** Stub adapters — implement startCheckout() when credentials are available. */
const stripeGateway = {
  id: "stripe",
  label: "Stripe",
  async startCheckout() {
    throw new Error("Stripe inteqrasiyası hələ konfiqurasiya edilməyib.");
    // Real impl: POST to your backend to create a Checkout Session, then
    // window.location = session.url; unlock happens via webhook -> DB -> isUnlocked() check.
  },
};

const lemonSqueezyGateway = {
  id: "lemonsqueezy",
  label: "Lemon Squeezy",
  async startCheckout() {
    throw new Error("Lemon Squeezy inteqrasiyası hələ konfiqurasiya edilməyib.");
  },
};

const payriffGateway = {
  id: "payriff",
  label: "Payriff",
  async startCheckout() {
    throw new Error("Payriff inteqrasiyası hələ konfiqurasiya edilməyib.");
  },
};

const kapitalBankGateway = {
  id: "kapitalbank",
  label: "Kapital Bank",
  async startCheckout() {
    throw new Error("Kapital Bank inteqrasiyası hələ konfiqurasiya edilməyib.");
  },
};

export const GATEWAYS = {
  demo: demoGateway,
  stripe: stripeGateway,
  lemonsqueezy: lemonSqueezyGateway,
  payriff: payriffGateway,
  kapitalbank: kapitalBankGateway,
};

// Flip this to "stripe" / "payriff" / "kapitalbank" / "lemonsqueezy" once an
// adapter above is fully implemented with real API credentials.
export const ACTIVE_GATEWAY = "demo";

function readPurchases() {
  try {
    return JSON.parse(localStorage.getItem(PURCHASES_KEY)) || [];
  } catch {
    return [];
  }
}

function recordPurchase(itemId, itemType) {
  const purchases = readPurchases();
  purchases.push({ itemId, itemType, ts: Date.now() });
  localStorage.setItem(PURCHASES_KEY, JSON.stringify(purchases));
}

export function isUnlocked(itemId) {
  return readPurchases().some((p) => p.itemId === itemId);
}

export function getPurchaseHistory() {
  return readPurchases();
}

export async function purchaseItem({ itemId, itemType, price = 0 }) {
  const gateway = GATEWAYS[ACTIVE_GATEWAY];
  return new Promise((resolve, reject) => {
    gateway
      .startCheckout({ itemId, itemType, price, onSuccess: resolve })
      .catch(reject);
  });
}
