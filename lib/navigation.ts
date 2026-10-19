import type { useRouter } from "next/navigation";

// Back to wherever the user came from (Alerts, Profile, Submit Report…);
// falls back to `fallback` when there's no history, e.g. a direct link.
export function goBack(router: ReturnType<typeof useRouter>, fallback: string) {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push(fallback);
  }
}
