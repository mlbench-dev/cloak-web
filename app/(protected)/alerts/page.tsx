"use client";

import { Crown, Info } from "lucide-react";
import { useEffect, useState } from "react";

type AlertFilter = "All" | "Community" | "Rewards" | "System";

type AlertItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  filter: Exclude<AlertFilter, "All">;
  avatarType: "image" | "crown" | "info";
  avatarUrl?: string;
  badgeLabel?: string;
  badgeTone?: "cyan" | "green";
};

const filters: AlertFilter[] = ["All", "Community", "Rewards", "System"];

type ApiAlertItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  filter: Exclude<AlertFilter, "All">;
  avatarType: "image" | "crown" | "info";
  avatarUrl?: string;
  badgeLabel?: string;
  badgeTone?: "cyan" | "green";
};

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return "Just now";
}

function AlertAvatar({
  avatarType,
  avatarUrl,
}: {
  avatarType: AlertItem["avatarType"];
  avatarUrl?: string;
}) {
  if (avatarType === "image" && avatarUrl) {
    return (
      <div
        className="h-10 w-10 shrink-0 rounded-full bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${avatarUrl})` }}
        aria-hidden="true"
      />
    );
  }

  if (avatarType === "crown") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#15C3CF] text-white">
        <Crown className="h-6 w-6" strokeWidth={1.8} />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E6E6E6] text-[#98A0A7]">
      <Info className="h-6 w-6" strokeWidth={1.8} />
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
      className={`inline-flex h-5 items-center whitespace-nowrap rounded-full px-2 text-[11px] font-normal ${
        tone === "green" ? "bg-[#19C48A] text-white" : "bg-[#1FC8D5] text-white"
      }`}
    >
      {label.trim()}
    </span>
  );
}

function AlertCard({ item }: { item: AlertItem }) {
  return (
    <article className="flex items-start gap-3 rounded-[20px] bg-[#F2F2F2] px-4 py-3.5">
      <AlertAvatar avatarType={item.avatarType} avatarUrl={item.avatarUrl} />

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 text-[#2D2D2D]">
              {item.title}
            </p>
            <AlertBadge label={item.badgeLabel} tone={item.badgeTone} />
          </div>
          <span className="shrink-0 whitespace-nowrap text-[12px] font-medium text-[#98A0A7]">
            {item.time}
          </span>
        </div>

        <p className="mt-1 text-[12px] leading-5 text-[#98A0A7]">
          {item.description}
        </p>
      </div>
    </article>
  );
}

export default function AlertsPage() {
  const [activeFilter, setActiveFilter] = useState<AlertFilter>("All");
  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchAlerts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeFilter !== "All") {
          params.set("filter", activeFilter);
        }

        const res = await fetch(
          `/api/alerts${params.toString() ? `?${params.toString()}` : ""}`,
        );
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          if (!cancelled) {
            setItems([]);
          }
          return;
        }

        const apiItems = (json.alerts || []) as ApiAlertItem[];
        const nextItems: AlertItem[] = apiItems.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          time: formatTimeAgo(item.createdAt),
          filter: item.filter,
          avatarType: item.avatarType,
          avatarUrl: item.avatarUrl,
          badgeLabel: item.badgeLabel,
          badgeTone: item.badgeTone,
        }));

        if (!cancelled) {
          setItems(nextItems);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchAlerts();

    return () => {
      cancelled = true;
    };
  }, [activeFilter]);

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="flex items-center justify-between px-4 pb-4 bg-white z-10">
        <div className="w-10" />
        <h1 className="flex-1 text-center text-lg font-semibold text-[#2D2D2D]">
          Alerts
        </h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto bg-white no-scrollbar">
        <div className="w-full space-y-5 px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <section className="pt-1">
            <div className="overflow-x-auto no-scrollbar">
              <div className="flex w-max min-w-full flex-nowrap items-center justify-between gap-1 min-[412px]:gap-3 min-[430px]:gap-4">
                {filters.map((filter) => {
                  const isActive = activeFilter === filter;

                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveFilter(filter)}
                      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-medium transition-all min-[375px]:px-3.5 min-[390px]:px-4 ${
                        isActive
                          ? "bg-[#15C3CF] text-white shadow-[0_8px_18px_rgba(21,195,207,0.18)]"
                          : "bg-[#F3F3F3] text-[#4B4B4B]"
                      }`}
                    >
                      {filter}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="space-y-3.5">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-10 w-10 rounded-full border-4 border-[#15C3CF]/20 border-t-[#15C3CF] animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-[#98A0A7]">
                No alerts yet
              </div>
            ) : (
              items.map((item) => <AlertCard key={item.id} item={item} />)
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
