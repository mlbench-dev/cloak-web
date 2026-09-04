// Mock data — there's no CV<->MERN discovery pipeline to call yet (see the
// Phase 2.0 plan). Shared between the Dashboard's "Recent Incidents"
// preview and this module's list/detail pages so they never drift out of
// sync with each other. Swap this whole file for a real API call once the
// discovery contract exists — every consumer already reads through the
// functions below, not the array directly.

export type IncidentStatus = "New" | "Reviewing" | "Confirmed" | "Rejected";

export type Incident = {
  id: string;
  platform: "instagram" | "tiktok" | "twitter" | "facebook" | "youtube";
  platformLabel: string;
  urlLabel: string;
  sourceUrl: string;
  detectedAgo: string;
  detectedAt: string;
  matchPercent: number;
  status: IncidentStatus;
  evidenceImageUrl: string;
  discoveryMethod: string;
};

export const INCIDENT_STATUS_TABS: ("All" | IncidentStatus)[] = [
  "All",
  "New",
  "Reviewing",
  "Confirmed",
];

export const MOCK_INCIDENTS: Incident[] = [
  {
    id: "1",
    platform: "instagram",
    platformLabel: "Instagram",
    urlLabel: "instagram.com/p/xyz...",
    sourceUrl: "https://instagram.com/p/xyz123abc",
    detectedAgo: "12 min ago",
    detectedAt: "Sept 1, 2026 · 4:42 PM",
    matchPercent: 94,
    status: "New",
    evidenceImageUrl: "/images/splashScreen/compressed/first.webp",
    discoveryMethod: "Scheduled AI Scan",
  },
  {
    id: "2",
    platform: "tiktok",
    platformLabel: "TikTok",
    urlLabel: "tiktok.com/@user/video/...",
    sourceUrl: "https://tiktok.com/@user/video/7123456789",
    detectedAgo: "1 hr ago",
    detectedAt: "Sept 1, 2026 · 3:54 PM",
    matchPercent: 87,
    status: "New",
    evidenceImageUrl: "/images/splashScreen/compressed/second.webp",
    discoveryMethod: "Scheduled AI Scan",
  },
  {
    id: "3",
    platform: "twitter",
    platformLabel: "X",
    urlLabel: "x.com/user/status/123...",
    sourceUrl: "https://x.com/user/status/1234567890",
    detectedAgo: "3 hr ago",
    detectedAt: "Sept 1, 2026 · 1:48 PM",
    matchPercent: 82,
    status: "Reviewing",
    evidenceImageUrl: "/images/splashScreen/compressed/third.webp",
    discoveryMethod: "Scheduled AI Scan",
  },
  {
    id: "4",
    platform: "facebook",
    platformLabel: "Facebook",
    urlLabel: "facebook.com/watch/....",
    sourceUrl: "https://facebook.com/watch/?v=1234567890",
    detectedAgo: "3 hr ago",
    detectedAt: "Sept 1, 2026 · 1:40 PM",
    matchPercent: 82,
    status: "New",
    evidenceImageUrl: "/images/splashScreen/compressed/first.webp",
    discoveryMethod: "Scheduled AI Scan",
  },
  {
    id: "5",
    platform: "youtube",
    platformLabel: "YouTube",
    urlLabel: "youtube.com/watch?v=...",
    sourceUrl: "https://youtube.com/watch?v=abc123xyz",
    detectedAgo: "1 day ago",
    detectedAt: "Aug 31, 2026 · 4:52 PM",
    matchPercent: 70,
    status: "Confirmed",
    evidenceImageUrl: "/images/splashScreen/compressed/second.webp",
    discoveryMethod: "Scheduled AI Scan",
  },
];

export function getIncidentById(id: string): Incident | undefined {
  return MOCK_INCIDENTS.find((incident) => incident.id === id);
}

// Mutates the shared mock array by id rather than by a reference captured
// during a component's render — keeps the write out of React Compiler's
// render-purity checks (react-hooks/immutability), since callers don't pass
// in a render-scoped `incident` object here, just its id.
export function setIncidentStatus(id: string, status: IncidentStatus): void {
  const incident = MOCK_INCIDENTS.find((item) => item.id === id);
  if (incident) {
    incident.status = status;
  }
}
