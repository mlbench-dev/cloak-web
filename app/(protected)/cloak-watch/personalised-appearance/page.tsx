"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { PostCard } from "../_components/PostUI";
import { fetchPosts, type CloakWatchPost } from "../_lib/posts";

export default function PersonalisedAppearancePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<CloakWatchPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      <header className="shrink-0 bg-white">
        <div className="flex items-center justify-between px-4 py-4">
          <button type="button" onClick={() => router.back()} className="p-2">
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
          <h1 className="text-lg font-semibold text-[#2D2D2D]">
            Personalised Appearance
          </h1>
          <div className="w-10" />
        </div>

        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-3 rounded-full bg-[#F3F3F3] px-4 py-3">
            <Search className="h-5 w-5 text-[#98A0A7]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts,people,topics..."
              className="w-full bg-transparent text-[14px] text-[#2D2D2D] outline-none placeholder:text-[#98A0A7]"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-2 no-scrollbar">
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
          <div className="space-y-8">
            {posts.map((item) => (
              <PostCard
                key={item.id}
                post={item}
                onOpenPost={(post) => router.push(`/cloak-watch/post/${post.id}`)}
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
