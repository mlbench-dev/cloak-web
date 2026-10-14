// Pure, dependency-free — used by the Known Websites form (instant
// feedback) and by the server (the real check), so both agree on what a
// valid watched link is.

export type WatchedPlatform = "instagram" | "facebook" | "twitter";

export const WATCHED_PLATFORM_LABELS: Record<WatchedPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X (Twitter)",
};

// Exact hostnames (after dropping "www."), not substrings — "netflix.com"
// must not count as x.com.
const HOST_PLATFORMS: Record<string, WatchedPlatform> = {
  "instagram.com": "instagram",
  "facebook.com": "facebook",
  "m.facebook.com": "facebook",
  "fb.com": "facebook",
  "twitter.com": "twitter",
  "mobile.twitter.com": "twitter",
  "x.com": "twitter",
};

// One host per platform, so m.facebook.com/x and facebook.com/x (or
// twitter.com/x and x.com/x) are the same link — and what's stored and
// sent to the CV API is always the standard address.
const CANONICAL_HOST: Record<WatchedPlatform, string> = {
  instagram: "www.instagram.com",
  facebook: "www.facebook.com",
  twitter: "x.com",
};

export type ParsedWatchedLink =
  | {
      ok: true;
      // What gets stored and sent to the CV API.
      url: string;
      platform: WatchedPlatform;
      // Comparison key: host without www, path without trailing slash,
      // lowercased — so "instagram.com/Name" and
      // "https://www.instagram.com/name/" are the same link.
      key: string;
    }
  | { ok: false; error: string };

export function parseWatchedLink(input: string): ParsedWatchedLink {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Enter a link." };

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: `"${raw}" isn't a valid link.` };
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const platform = HOST_PLATFORMS[host];
  if (!platform) {
    return {
      ok: false,
      error: "Only Instagram, Facebook and X (Twitter) links can be added.",
    };
  }

  const path = parsed.pathname.replace(/\/+$/, "");
  if (!path) {
    return {
      ok: false,
      error: `Add the full profile link, e.g. ${host}/yourname.`,
    };
  }

  const url = `https://${CANONICAL_HOST[platform]}${parsed.pathname}`;
  return { ok: true, url, platform, key: watchedLinkKey(url) };
}

// Key for any URL (also the CV API's own links), for de-duplication.
export function watchedLinkKey(url: string): string {
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const bareHost = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const platform = HOST_PLATFORMS[bareHost];
    const host = platform ? CANONICAL_HOST[platform].replace(/^www\./, "") : bareHost;
    return `${host}${parsed.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}
