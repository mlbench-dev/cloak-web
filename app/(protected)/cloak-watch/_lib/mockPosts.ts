// Mock per-link post data — the CV service currently only returns
// profile/group/page-level links (see /api/scan-results), not the
// individual posts found on each one. There's no contract yet for a
// per-link post-level scan, so this generates stable, link-scoped mock
// posts instead (same "UI now, swap the data layer later" pattern used
// elsewhere in this module before it had real data). Swap this whole file
// for a real per-link API call once that CV contract exists.

export type PostStatus = "New" | "Confirmed" | "Rejected";

export interface MockPost {
  id: string;
  postNumber: number;
  dateLabel: string;
  timeLabel: string;
  detectedAt: string;
  matchPercent: number;
  status: PostStatus;
  thumbnailUrl: string;
  discoveryMethod: string;
  aiAnalysis: string;
}

const THUMBNAILS = [
  "/images/splashScreen/compressed/first.webp",
  "/images/splashScreen/compressed/second.webp",
  "/images/splashScreen/compressed/third.webp",
];

const AI_ANALYSIS_SAMPLES = [
  "This post contains imagery and text patterns that closely resemble your protected reference media. Facial landmarks and contextual cues suggest a high likelihood of identity misuse.",
  "The account posting this content shares stylistic and biometric similarities with your reference profile. Review the evidence below to confirm whether this is a genuine match.",
  "Automated analysis detected a partial facial match combined with matching aliases in the post's caption. Manual confirmation is recommended.",
];

// Cheap deterministic string hash so the same link always generates the
// same mock posts within a session, instead of a new random set on every
// render/navigation.
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getMockPostsForLink(linkUrl: string): MockPost[] {
  const seed = hashString(linkUrl);
  const count = 2 + (seed % 3); // 2-4 posts per link

  return Array.from({ length: count }, (_, index) => {
    const postSeed = seed + index * 17;
    const isToday = index < 2;
    const matchPercent = 55 + (postSeed % 40); // 55-94
    const status: PostStatus =
      matchPercent >= 85 ? "New" : matchPercent >= 65 ? "New" : "Rejected";

    return {
      id: `${seed}-${index + 1}`,
      postNumber: index + 1,
      dateLabel: isToday ? "Today" : "Yesterday",
      timeLabel: "4:06pm",
      detectedAt: "Sept 1, 2026 · 4:42 PM",
      matchPercent,
      status,
      thumbnailUrl: THUMBNAILS[postSeed % THUMBNAILS.length],
      discoveryMethod: "Scheduled AI Scan",
      aiAnalysis: AI_ANALYSIS_SAMPLES[postSeed % AI_ANALYSIS_SAMPLES.length],
    };
  });
}

export function getMockPostById(
  linkUrl: string,
  postId: string,
): MockPost | undefined {
  return getMockPostsForLink(linkUrl).find((post) => post.id === postId);
}
