"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  ConfirmLinksScreen,
  ScrapingLinksScreen,
  ScrapingPostsScreen,
  useLinkFetchStatus,
} from "@/app/components/linkDiscovery/LinkDiscovery";

// Shown after the identity profile is first completed: starts link
// discovery, then Scraping Links -> Confirm Links -> Scraping Posts.
// Closing at any point is fine — both jobs keep running on the server and
// Cloak Watch picks them up.
export default function LinkDiscoveryFlow({
  subjectName,
  onClose,
  onDone,
}: {
  subjectName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { status, startError, start, retryScrape, applyStatus } = useLinkFetchStatus();
  const [stage, setStage] = useState<"links" | "confirm" | "posts">("links");
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  // Starting hits the external service, so do it once per mount — not
  // again on React's dev-mode double effect.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
  }, [start]);

  if (stage === "posts") {
    return (
      <ScrapingPostsScreen
        scrape={status?.scrape ?? null}
        error={scrapeError}
        onBack={onClose}
        onOk={onDone}
        onRetry={async () => {
          setScrapeError(await retryScrape());
        }}
      />
    );
  }

  if (stage === "confirm" && status?.awaitingReview) {
    return (
      <ConfirmLinksScreen
        urls={status.urls}
        subjectName={subjectName}
        onBack={onClose}
        onDone={(next) => {
          // Choosing starts scraping on the server.
          applyStatus(next);
          setStage("posts");
        }}
      />
    );
  }

  return (
    <ScrapingLinksScreen
      status={status}
      error={startError}
      onBack={onClose}
      onRetry={() => void start()}
      onOk={() => {
        if (status?.awaitingReview) {
          setStage("confirm");
        } else {
          toast("No new links found");
          onDone();
        }
      }}
    />
  );
}
