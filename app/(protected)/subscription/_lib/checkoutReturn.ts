// PayFast leaves its own pages in the tab's history, and going back into
// them bounces straight to our return URL again — a loop. So whenever the
// user comes back from PayFast (success, cancel, or that bounce), the tab
// is rewound to the /subscription entry checkout started from. PayFast's
// pages are then *forward* history, and back from /subscription works as
// normal. Nothing is pushed: browsers skip entries a page adds without a
// user gesture, so an extra "guard" entry can't be relied on.

const RECORD_KEY = "checkoutReturn";
const RESULT_KEY = "checkoutResult";
// Stored in the /subscription entry's own history state: its index.
const ORIGIN_INDEX_KEY = "checkoutOriginIndex";

type CheckoutRecord = {
  // History index of the /subscription entry checkout started from.
  subscriptionIndex: number;
};

export type CheckoutResult = "success" | "cancelled";

type NavigationLike = {
  currentEntry?: { index: number } | null;
  entries?: () => unknown[];
};

// This entry's position in the tab's history. Usually it's the newest one
// (just navigated to), but a PayFast bounce can *replace* an older entry,
// leaving our earlier page ahead of it. The Navigation API sees those
// same-site entries ahead; its own index can't be used directly, as it
// only counts this site's entries since the last cross-site page.
function currentIndex(): number {
  const navigation = (window as { navigation?: NavigationLike }).navigation;
  const index = navigation?.currentEntry?.index;
  const count = navigation?.entries?.().length;
  const ahead = typeof index === "number" && typeof count === "number" ? count - 1 - index : 0;
  return window.history.length - 1 - Math.max(0, ahead);
}

function readRecord(): CheckoutRecord | null {
  try {
    const raw = window.sessionStorage.getItem(RECORD_KEY);
    return raw ? (JSON.parse(raw) as CheckoutRecord) : null;
  } catch {
    return null;
  }
}

function writeRecord(record: CheckoutRecord) {
  try {
    window.sessionStorage.setItem(RECORD_KEY, JSON.stringify(record));
  } catch {
    // Storage blocked — returns fall back to plain redirects.
  }
}

// On /subscription, just before handing off to PayFast.
export function recordCheckoutStart() {
  // Rewound to after an earlier checkout, this entry isn't the newest (that
  // checkout's PayFast pages are still forward history) — it carries its
  // index from then.
  const state = window.history.state as Record<string, unknown> | null;
  const known = state?.[ORIGIN_INDEX_KEY];
  const index = typeof known === "number" ? known : currentIndex();
  writeRecord({ subscriptionIndex: index });
  window.history.replaceState({ ...state, [ORIGIN_INDEX_KEY]: index }, "");
}

function stepsToSubscription(): number {
  const record = readRecord();
  return record ? currentIndex() - record.subscriptionIndex : 0;
}

// Whether rewindToSubscription has somewhere to go.
export function canRewindToSubscription(): boolean {
  return stepsToSubscription() > 0;
}

// Jumps back to the /subscription entry checkout started from, leaving
// `result` for that page to pick up. False when there's nothing to rewind
// to (no record, storage blocked) — the caller then redirects instead.
export function rewindToSubscription(result?: CheckoutResult): boolean {
  const steps = stepsToSubscription();
  if (steps <= 0) return false;
  try {
    if (result) window.sessionStorage.setItem(RESULT_KEY, result);
  } catch {
    // Only costs the toast.
  }
  window.history.go(-steps);
  return true;
}

// /subscription: the result rewindToSubscription left, without consuming
// it (safe to call while rendering).
export function peekCheckoutResult(): CheckoutResult | null {
  try {
    const result = window.sessionStorage.getItem(RESULT_KEY);
    return result === "success" || result === "cancelled" ? result : null;
  } catch {
    return null;
  }
}

// /subscription: the result rewindToSubscription left, read once.
export function takeCheckoutResult(): CheckoutResult | null {
  try {
    const result = window.sessionStorage.getItem(RESULT_KEY);
    window.sessionStorage.removeItem(RESULT_KEY);
    return result === "success" || result === "cancelled" ? result : null;
  } catch {
    return null;
  }
}
