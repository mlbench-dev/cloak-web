"use client";

import { ChevronLeft, Radar } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlatformIcon } from "../_components/IncidentUI";
import { detectPlatform } from "@/lib/platform";
import type { CloakWatchPost } from "@/lib/cloakWatchPosts";

const STATUS_TABS = ["All", "New", "Confirmed", "Rejected"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

// Same scale the match score used: 65%+ amber, below that red.
function attentionTextTone(percent: number): string {
  return percent >= 65 ? "text-[#FFAD00]" : "text-[#F40033]";
}

// "@handle" from a profile URL (instagram.com/name → @name).
function handleFromUrl(url: string): string {
  try {
    const first = new URL(url).pathname.split("/").filter(Boolean)[0];
    return first ? `@${decodeURIComponent(first)}` : url;
  } catch {
    return url;
  }
}

type ProfilePreview = { title: string | null; description: string | null; image: string | null };

function dayLabel(iso: string | null): string {
  if (!iso) return "Earlier";
  const date = new Date(iso);
  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(today) - startOfDay(date)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Day headers are the scrape date — with "Scraped" in front, since each
// row underneath shows the post's own publish date.
function scrapedDayLabel(iso: string | null): string {
  const label = dayLabel(iso);
  return /^(Today|Yesterday|Earlier)$/.test(label)
    ? `Scraped ${label.toLowerCase()}`
    : `Scraped ${label}`;
}

function startOfDayTime(iso: string | null): number {
  if (!iso) return 0;
  const date = new Date(iso);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatDate(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
}

function formatTime(iso: string | null): string {
  return iso
    ? new Date(iso)
        .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        .replace(" ", "")
        .toLowerCase()
    : "";
}

export default function LinkPostsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const linkUrl = decodeURIComponent(params.id);

  const [posts, setPosts] = useState<CloakWatchPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StatusTab>("All");
  // The watched account's picture/name/bio, from its link preview — often
  // blocked by Instagram/Facebook, so everything has a fallback.
  const [profile, setProfile] = useState<ProfilePreview | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/link-preview?url=${encodeURIComponent(linkUrl)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.success || !data.preview) return;
        setProfile({
          title: data.preview.title || null,
          description: data.preview.description || null,
          image: data.preview.image || null,
        });
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [linkUrl]);

  // Posts the CV scraper found on this link (GET /api/cloak-watch/posts).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cloak-watch/posts?link=${encodeURIComponent(linkUrl)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data?.success) {
          setError(data?.error || "Couldn't load posts.");
          return;
        }
        setPosts(data.posts as CloakWatchPost[]);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load posts.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [linkUrl]);

  // Newest scrape day first; within a day the server's order (newest post
  // first) is kept, since sort is stable.
  const filteredPosts = (
    activeTab === "All" ? posts : posts.filter((post) => post.status === activeTab)
  )
    .slice()
    .sort((a, b) => startOfDayTime(b.scrapedAt) - startOfDayTime(a.scrapedAt));
  const groups = Array.from(new Set(filteredPosts.map((post) => scrapedDayLabel(post.scrapedAt))));

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="flex items-center justify-between bg-white z-10">
        <button type="button" onClick={() => router.back()} className="-ml-3 p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-[16px] font-medium text-[#2B2B2B]">Profile</h1>
        <div className="-mr-3 w-10" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto py-3 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="flex items-center gap-3 rounded-[20px] bg-[#F5F5F5] px-3 py-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-[#839297]">
            {profile?.image && !avatarFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.image}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <PlatformIcon platform={detectPlatform(linkUrl)} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] leading-[22px] text-[#2B2B2B]">{handleFromUrl(linkUrl)}</p>
            {profile?.title && (
              <p className="truncate text-[12px] leading-4 text-[#839297]">{profile.title}</p>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-1 text-[12px] leading-4 text-[#0FB87F]">
            <Radar className="h-3.5 w-3.5" />
            Monitoring Active
          </span>
        </div>

        {profile?.description && (
          <div className="mt-4">
            <p className="text-[16px] font-medium leading-[22px] text-[#2B2B2B]">About:</p>
            <p className="mt-1 line-clamp-3 text-[13px] leading-5 text-[#839297]">
              {profile.description}
            </p>
          </div>
        )}

        <div className="mt-4 overflow-x-auto no-scrollbar">
          <div className="flex w-max min-w-full flex-nowrap items-center gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`h-[30px] shrink-0 whitespace-nowrap rounded-full px-5 text-[14px] transition-all ${
                  activeTab === tab ? "bg-[#01C3CF] text-white" : "bg-[#F6F6F6] text-[#2A2A2A]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF]" />
          </div>
        ) : error ? (
          <p className="py-10 text-center text-[12px] text-[#839297]">{error}</p>
        ) : groups.length > 0 ? (
          groups.map((group) => (
            <div key={group} className="mt-5">
              <p className="mb-2 text-[14px] leading-5 text-[#839297]">{group}</p>
              <div className="space-y-3">
                {filteredPosts
                  .filter((post) => scrapedDayLabel(post.scrapedAt) === group)
                  .map((post) => (
                    <PostRow key={post.id} linkId={params.id} post={post} />
                  ))}
              </div>
            </div>
          ))
        ) : (
          <p className="py-10 text-center text-[12px] text-[#839297]">
            {posts.length === 0 ? "No posts found on this link yet" : "No posts here"}
          </p>
        )}
      </main>
    </div>
  );
}

function PostRow({ linkId, post }: { linkId: string; post: CloakWatchPost }) {
  return (
    <Link href={`/cloak-watch/${linkId}/${post.id}`} className="block">
      <div className="flex items-center gap-3 rounded-[16px] bg-[#F5F5F5] px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[16px] leading-[22px] text-[#2B2B2B]">
              Post #{String(post.number).padStart(2, "0")}
            </p>
            {post.status === "New" && (
              <span className="inline-flex h-[18px] items-center rounded-full bg-[#E1F1E6] px-2 text-[11px] text-[#33C757]">
                New
              </span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-2.5 text-[12px] leading-4 text-[#839297]">
            <span>{formatDate(post.publishedAt)}</span>
            <span>{formatTime(post.publishedAt)}</span>
            {post.attentionPercent != null && (
              <span className={attentionTextTone(post.attentionPercent)}>
                {post.attentionPercent} % Match
              </span>
            )}
          </p>
        </div>
        <PostThumbnail url={post.url} />
      </div>
    </Link>
  );
}

// The CV API saves no image, so the thumbnail comes from the post's link
// preview (og:image); the platform icon stands in when there's none —
// Facebook/Instagram often refuse previews to logged-out requests.
function PostThumbnail({ url }: { url: string }) {
  const [image, setImage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success && data.preview?.image) setImage(data.preview.image);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="relative flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#E9ECEE]">
      {image && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <PlatformIcon platform={detectPlatform(url)} />
      )}
    </div>
  );
}
