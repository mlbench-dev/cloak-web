// Pure, dependency-free on purpose — safe to import from both server code
// and client components. lib/reportAiConfidence.ts pulls in server-only
// modules (Mongo, Firebase Admin) transitively, so anything client-side
// that needs platform detection (e.g. the dashboard) must import this file
// directly, never reportAiConfidence.ts, or the whole server chain ends up
// in the browser bundle.
export function detectPlatform(link: string): string {
  const lowerLink = link.toLowerCase();
  if (lowerLink.includes("tiktok.com")) return "tiktok";
  if (lowerLink.includes("instagram.com")) return "instagram";
  if (lowerLink.includes("facebook.com") || lowerLink.includes("fb.com"))
    return "facebook";
  if (lowerLink.includes("twitter.com") || lowerLink.includes("x.com"))
    return "twitter";
  // Anything else — YouTube included — falls through to "other" and gets
  // the generic globe icon, same as any unrecognized site.
  return "other";
}
