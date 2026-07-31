"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PostCard } from "../../_components/PostUI";
import { fetchPostById, type CloakWatchPost } from "../../_lib/posts";

export default function CloakWatchPostDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [post, setPost] = useState<CloakWatchPost | null>(null);
  const [loading, setLoading] = useState(true);
  // Tracks which post id's request is allowed to apply its result, checked
  // at apply-time instead of via a cleanup-driven "cancelled" flag — that
  // way a request can never get silently orphaned if the effect re-runs
  // before it resolves.
  const activePostIdRequestRef = useRef<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    const requestId = params.id;
    activePostIdRequestRef.current = requestId;
    const isStale = () => activePostIdRequestRef.current !== requestId;

    const loadPost = async () => {
      try {
        setLoading(true);
        const nextPost = await fetchPostById(requestId);
        if (!isStale()) {
          setPost(nextPost);
        }
      } catch {
        if (!isStale()) {
          setPost(null);
        }
      } finally {
        if (!isStale()) {
          setLoading(false);
        }
      }
    };

    void loadPost();
  }, [params?.id]);

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="shrink-0 bg-white px-4 pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full"
          >
            <ChevronLeft className="h-6 w-6 text-[#98A0A7]" />
          </button>
          <h1 className="flex-1 text-center text-[17px] font-semibold text-[#2D2D2D]">
            Post
          </h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-5">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-10 w-10 rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF] animate-spin" />
          </div>
        ) : post ? (
          <PostCard post={post} onDeleted={() => router.back()} />
        ) : (
          <div className="flex h-full items-center justify-center text-[14px] text-[#98A0A7]">
            Post not found
          </div>
        )}
      </main>
    </div>
  );
}
