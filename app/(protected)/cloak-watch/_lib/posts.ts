"use client";

export type CloakWatchPost = {
  id: string;
  username: string;
  displayName: string;
  level: number;
  createdAt: string;
  avatarUrl: string;
  body: string;
  images: string[];
  up: number;
  down: number;
  shares: number;
  saves: number;
  reports: number;
  viewerVote: 1 | -1 | 0;
  isSaved: boolean;
  isOwner: boolean;
  isDeleted: boolean;
};

export type CloakWatchPostScope = "all" | "my" | "saved";

export function formatTimeAgo(dateString: string) {
  const created = new Date(dateString).getTime();
  const diffMinutes = Math.max(
    0,
    Math.floor((Date.now() - created) / (1000 * 60)),
  );
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export async function fetchPosts(
  query?: string,
  options?: { scope?: CloakWatchPostScope },
) {
  const params = new URLSearchParams();
  if (query?.trim()) {
    params.set("q", query.trim());
  }
  if (options?.scope && options.scope !== "all") {
    params.set("scope", options.scope);
  }
  const res = await fetch(
    `/api/cloak-watch/posts${params.toString() ? `?${params.toString()}` : ""}`,
    { cache: "no-store" },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || "Unable to load posts");
  }
  return (json.posts || []) as CloakWatchPost[];
}

export async function fetchPostById(id: string) {
  const res = await fetch(`/api/cloak-watch/posts/${id}`, { cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || "Unable to load post");
  }
  return json.post as CloakWatchPost;
}
