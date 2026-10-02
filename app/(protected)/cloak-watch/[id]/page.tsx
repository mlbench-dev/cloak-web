"use client";

import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { getMockPostsForLink, type MockPost } from "../_lib/mockPosts";

const STATUS_TABS = ["All", "New", "Confirmed", "Rejected"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

function matchTone(matchPercent: number): string {
  // Reference shows 70% as amber and 60% as red.
  return matchPercent >= 65
    ? "bg-[#F8E8C6] text-[#FFAD00]"
    : "bg-[#F7DEE2] text-[#F40033]";
}

export default function LinkPostsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const linkUrl = decodeURIComponent(params.id);

  const posts = getMockPostsForLink(linkUrl);
  const [activeTab, setActiveTab] = useState<StatusTab>("All");

  const filteredPosts =
    activeTab === "All" ? posts : posts.filter((post) => post.status === activeTab);
  const groups = Array.from(new Set(filteredPosts.map((post) => post.dateLabel)));

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="flex items-center justify-between bg-white z-10">
        <button type="button" onClick={() => router.back()} className="-ml-3 p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-[16px] font-medium text-[#2B2B2B]">Cloak Watch</h1>
        <div className="-mr-3 w-10" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto py-3 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="overflow-x-auto no-scrollbar">
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

        {groups.length > 0 ? (
          groups.map((group) => (
            <div key={group} className="mt-5">
              <p className="mb-2 text-[14px] leading-5 text-[#839297]">{group}</p>
              <div className="space-y-3">
                {filteredPosts
                  .filter((post) => post.dateLabel === group)
                  .map((post) => (
                    <PostRow key={post.id} linkId={params.id} post={post} />
                  ))}
              </div>
            </div>
          ))
        ) : (
          <p className="py-10 text-center text-[12px] text-[#839297]">No posts here</p>
        )}
      </main>
    </div>
  );
}

function PostRow({ linkId, post }: { linkId: string; post: MockPost }) {
  return (
    <Link href={`/cloak-watch/${linkId}/${post.id}`} className="block">
      <div className="flex items-start gap-4 rounded-[20px] bg-[#F6F6F6] px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[16px] leading-[22px] text-[#2B2B2B]">
              Post #{String(post.postNumber).padStart(2, "0")}
            </p>
            {post.status === "New" && (
              <span className="inline-flex h-[18px] shrink-0 items-center rounded-full bg-[#E1F1E6] px-2.5 text-[12px] text-[#33C757]">
                New
              </span>
            )}
          </div>
          <p className="mt-px flex gap-3 text-[12px] leading-4 text-[#839297]">
            <span>Sept 1, 2026</span>
            <span>{post.timeLabel}</span>
          </p>
          <span
            className={`mt-3 inline-flex h-[26px] items-center rounded-xl px-2.5 text-[12px] ${matchTone(post.matchPercent)}`}
          >
            {post.matchPercent} % Match
          </span>
        </div>
        <div className="relative h-[76px] w-[82px] shrink-0 overflow-hidden rounded-xl bg-gray-200">
          <Image src={post.thumbnailUrl} alt="" fill className="object-cover" />
        </div>
      </div>
    </Link>
  );
}
