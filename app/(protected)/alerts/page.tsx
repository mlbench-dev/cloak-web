"use client";

import { ChevronLeft, Crown, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useNotifications,
  type ApiAlertItem,
} from "@/app/components/NotificationsProvider";

type AlertFilter = "All" | "Community" | "Rewards" | "System";

type AlertItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  group: string;
  filter: Exclude<AlertFilter, "All">;
  avatarType: "image" | "crown" | "info";
  avatarUrl?: string;
  badgeLabel?: string;
  badgeTone?: "cyan" | "green";
  href?: string;
};

const filters: AlertFilter[] = ["All", "Community", "Rewards", "System"];

// Alerts are grouped under a day heading, so each row only needs the time
// of day.
function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// "Today" / "Yesterday" / "12 August 2026"
function formatGroupLabel(dateString: string) {
  const date = new Date(dateString);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round(
    (startOfDay(new Date()) - startOfDay(date)) / (1000 * 60 * 60 * 24),
  );

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function AlertAvatar({
  avatarType,
  avatarUrl,
}: {
  avatarType: AlertItem["avatarType"];
  avatarUrl?: string;
}) {
  if (avatarType === "image") {
    return (
      <div
        className="h-9 w-9 shrink-0 rounded-full bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${avatarUrl || "/images/placeholder_avatar.png"})`,
        }}
        aria-hidden="true"
      />
    );
  }

  if (avatarType === "crown") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#01C3CF] to-[#03B3C0] text-white">
        <Crown className="h-5 w-5" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8E8E8] text-[#839297]">
      <Info className="h-[18px] w-[18px]" strokeWidth={1.5} />
    </div>
  );
}

function AlertBadge({
  label,
  tone,
}: {
  label?: string;
  tone?: AlertItem["badgeTone"];
}) {
  if (!label) return null;

  return (
    <span
      className={`inline-flex h-4 items-center whitespace-nowrap rounded-full px-2 text-[11px] font-normal ${
        tone === "green" ? "bg-[#19C48A] text-white" : "bg-[#1FC8D5] text-white"
      }`}
    >
      {label.trim()}
    </span>
  );
}

function AlertCardContent({ item }: { item: AlertItem }) {
  return (
    <>
      <AlertAvatar avatarType={item.avatarType} avatarUrl={item.avatarUrl} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[12px] font-medium leading-4 text-[#2B2B2B]">
              {item.title}
            </p>
            <AlertBadge label={item.badgeLabel} tone={item.badgeTone} />
          </div>
          <span className="shrink-0 whitespace-nowrap text-[12px] leading-4 text-[#8A8A8C]">
            {item.time}
          </span>
        </div>

        <p className="mt-[7px] text-[12px] leading-4 text-[#839297]">
          {item.description}
        </p>
      </div>
    </>
  );
}

// One row inside a day's card; rows are separated by the card's dividers.
function AlertRow({ item }: { item: AlertItem }) {
  const rowClass = "flex min-h-[62px] items-center gap-3.5 py-[11px]";

  if (item.href) {
    return (
      <Link href={item.href} className={`${rowClass} active:opacity-70`}>
        <AlertCardContent item={item} />
      </Link>
    );
  }

  return (
    <article className={rowClass}>
      <AlertCardContent item={item} />
    </article>
  );
}

function toAlertItem(item: ApiAlertItem): AlertItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    time: formatTime(item.createdAt),
    group: formatGroupLabel(item.createdAt),
    filter: item.filter,
    avatarType: item.avatarType,
    avatarUrl: item.avatarUrl,
    badgeLabel: item.badgeLabel,
    badgeTone: item.badgeTone,
    href: item.href,
  };
}

export default function AlertsPage() {
  const router = useRouter();
  const { subscribe, markAllViewed } = useNotifications();
  const [activeFilter, setActiveFilter] = useState<AlertFilter>("All");
  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Tracks which filter's request is the one allowed to apply its result.
  // Comparing against this at apply-time (rather than a cleanup-driven
  // "cancelled" flag) means a request never gets silently orphaned if the
  // effect re-runs before it resolves.
  const activeFilterRequestRef = useRef<string | null>(null);

  const fetchAlerts = useCallback(async (filter: AlertFilter) => {
    const requestFilter = filter;
    activeFilterRequestRef.current = requestFilter;
    const isStale = () => activeFilterRequestRef.current !== requestFilter;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "All") {
        params.set("filter", filter);
      }

      const res = await fetch(
        `/api/alerts${params.toString() ? `?${params.toString()}` : ""}`,
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        if (!isStale()) {
          setItems([]);
        }
        return;
      }

      const apiItems = (json.alerts || []) as ApiAlertItem[];
      if (!isStale()) {
        setItems(apiItems.map(toAlertItem));
      }
    } catch {
      if (!isStale()) {
        setItems([]);
      }
    } finally {
      if (!isStale()) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchAlerts(activeFilter);
  }, [activeFilter, fetchAlerts]);

  // Live push — a Realtime Database ping (see NotificationsProvider) tells
  // us the instant a new notification was created; RTDB only carries the
  // "something changed" signal, not the notification itself, so refetch
  // the current filtered list to pick it up.
  useEffect(() => {
    return subscribe(() => {
      void fetchAlerts(activeFilter);
    });
  }, [subscribe, activeFilter, fetchAlerts]);

  const hasMarkedViewed = useRef(false);
  useEffect(() => {
    if (hasMarkedViewed.current) return;
    hasMarkedViewed.current = true;
    markAllViewed();
  }, [markAllViewed]);

  // Alerts arrive newest-first, so the groups come out in the same order.
  const groups = Array.from(new Set(items.map((item) => item.group)));

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="flex items-center justify-between pb-5 bg-white z-10">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="-ml-3 w-10 p-2"
        >
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="flex-1 text-center text-[16px] font-medium leading-[22px] text-[#2B2B2B]">
          Alerts
        </h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto bg-white no-scrollbar">
        <div className="w-full pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <section>
            <div>
              <div className="flex items-center gap-2">
                {filters.map((filter) => {
                  const isActive = activeFilter === filter;

                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveFilter(filter)}
                      className={`h-[30px] min-w-0 flex-auto truncate rounded-full px-2 text-[14px] transition-all ${
                        isActive
                          ? "bg-[#01C3CF] text-white"
                          : "bg-[#F6F6F6] text-[#2B2B2B]"
                      }`}
                    >
                      {filter}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-10 w-10 rounded-full border-4 border-[#15C3CF]/20 border-t-[#15C3CF] animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-[#98A0A7]">
                No alerts yet
              </div>
            ) : (
              groups.map((group) => (
                <div key={group} className="mt-3.5">
                  <p className="mb-2 text-[14px] leading-5 text-[#839297]">
                    {group}
                  </p>
                  <div className="divide-y divide-[#E7E7E7] rounded-[20px] bg-[#F6F6F6] px-3.5 py-px">
                    {items
                      .filter((item) => item.group === group)
                      .map((item) => (
                        <AlertRow key={item.id} item={item} />
                      ))}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
