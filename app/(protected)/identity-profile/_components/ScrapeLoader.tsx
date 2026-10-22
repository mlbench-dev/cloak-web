"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import {
  ScrapingPostsScreen,
  useLinkFetchStatus,
} from "@/app/components/linkDiscovery/LinkDiscovery";

// Shown after saving new Known Websites links once the first scrape has
// already run: they start scraping straight away. Closing it is fine —
// scraping carries on and Cloak Watch picks it up.
export default function ScrapeLoader({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const { status, refresh, retryScrape, retrying } = useLinkFetchStatus();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ScrapingPostsScreen
      scrape={status?.scrape ?? null}
      onBack={onClose}
      onOk={onDone}
      onRetry={() =>
        void retryScrape().then((error) => error && toast.error(error, { id: "scrape-retry" }))
      }
      retrying={retrying}
    />
  );
}
