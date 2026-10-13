"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, SquarePlus } from "lucide-react";
import { PostCard } from "./_components/PostUI";
import { fetchPosts, type CloakWatchPost } from "./_lib/posts";
import { PLAN_LIMITS } from "@/lib/config";
import { showPlanLimitToast } from "@/app/components/planLimitToast";
import type { PlanCode } from "@/models/Subscription";

export default function CloakWatchPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<CloakWatchPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Optimistic UX only — blocks the compose flow before the user wastes
  // time writing a post, but POST /api/community/posts is still the real
  // enforcement (this can go stale for up to the JWT's refresh interval).
  const handleCreatePost = () => {
    const plan = ((session?.user as any)?.plan as PlanCode) || "FREEMIUM";
    if (!PLAN_LIMITS[plan].canPostCommunity) {
      showPlanLimitToast(
        "Community posting is a Cloak Pro perk. Upgrade to Cloak Pro to post in Cloak Watch.",
      );
      return;
    }
    router.push("/community/new-post");
  };

  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const nextPosts = await fetchPosts(query);
        setPosts(nextPosts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load posts");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="shrink-0 bg-white ">
        <div className="flex items-center justify-between">
          <h1 className="text-[16px] font-medium text-[#2B2B2B]">
            Community
          </h1>
          <div className="flex items-center gap-3">
            {/* <button
              type="button"
              onClick={() =>
                router.push("/community/personalised-appearance")
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#2D2D2D]"
            >
              <SlidersHorizontal className="h-5 w-5" strokeWidth={2.1} />
            </button> */}
            <button
              type="button"
              onClick={handleCreatePost}
              aria-label="New post"
              className="-mr-1.5 flex h-9 w-9 items-center justify-center text-[#2B2B2B]"
            >
              <SquarePlus className="h-6 w-6" strokeWidth={1.6} />
            </button>
          </div>
        </div>

        <div className="pt-2.5 pb-1">
          <div className="flex h-10 items-center gap-2 rounded-full bg-[#F6F6F6] px-3.5">
            <Search className="h-[18px] w-[18px] shrink-0 text-[#839297]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts,people,topics..."
              className="w-full bg-transparent text-base text-[#2B2B2B] outline-none placeholder:text-[14px] placeholder:text-[#839297]"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-2.5 no-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-10 w-10 rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF] animate-spin" />
          </div>
        ) : error ? (
          <div className="py-16 text-center text-[14px] text-[#98A0A7]">
            {error}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-[#98A0A7]">
            No posts found
          </div>
        ) : (
          <div className="space-y-5">
            {posts.map((item) => (
              <PostCard
                key={item.id}
                post={item}
                onOpenPost={(post) =>
                  router.push(`/community/post/${post.id}`)
                }
                onDeleted={(postId) =>
                  setPosts((prev) => prev.filter((post) => post.id !== postId))
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
