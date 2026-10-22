"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// history.length at the moment we left for PayFast — set by startCheckout.
export const CHECKOUT_HISTORY_KEY = "checkoutHistoryLength";

const GUARD_KEY = "checkoutBackGuard";

// After a PayFast round-trip the history looks like
//   [... previous page, /subscription, PayFast..., <this page>]
// The browser back button would pop into PayFast (cross-origin, so we can't
// intercept it there), which bounces straight back to the return URL — a
// loop. To catch it, we push a same-document guard entry: browser back then
// only pops the guard, fires `popstate` here, and we jump over the whole
// checkout section to the page before /subscription in one history.go().
// Returns the same exit for the in-app back button.
export function useCheckoutBackGuard(enabled: boolean, fallback = "/profile") {
  const router = useRouter();
  // How far back the page before /subscription is from this (non-guard)
  // entry; null when unknown (e.g. /subscription was the first entry).
  const stepsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let saved: number | null = null;
    try {
      const raw = window.sessionStorage.getItem(CHECKOUT_HISTORY_KEY);
      saved = raw ? Number(raw) : null;
    } catch {
      saved = null;
    }

    // Strict Mode re-runs effects — don't stack a second guard.
    const onGuard = Boolean(window.history.state?.[GUARD_KEY]);
    const currentIndex = window.history.length - 1 - (onGuard ? 1 : 0);
    // /subscription sat at index saved - 1; the page before it at saved - 2.
    const steps = saved && saved >= 2 ? currentIndex - (saved - 2) : null;
    stepsRef.current = steps && steps > 0 ? steps : null;

    if (!onGuard) {
      window.history.pushState({ [GUARD_KEY]: true }, "");
    }

    const onPopState = (event: PopStateEvent) => {
      // Forward navigation back onto the guard — nothing to do.
      if (event.state?.[GUARD_KEY]) return;
      if (stepsRef.current) {
        window.history.go(-stepsRef.current);
      } else {
        router.replace(fallback);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [enabled, fallback, router]);

  // In-app back: pop the guard ourselves so both buttons share one path.
  return useCallback(() => {
    if (window.history.state?.[GUARD_KEY]) {
      window.history.back();
    } else {
      router.replace(fallback);
    }
  }, [fallback, router]);
}
