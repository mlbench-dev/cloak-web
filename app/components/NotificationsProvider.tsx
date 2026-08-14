"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type ApiAlertItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  filter: "Community" | "Rewards" | "System";
  avatarType: "image" | "crown" | "info";
  avatarUrl?: string;
  badgeLabel?: string;
  badgeTone?: "cyan" | "green";
  href?: string;
};

type NotificationsContextValue = {
  unreadCount: number;
  // Resets the badge to 0 and tells the server the current alerts have been
  // seen — call this from the Alerts page on mount.
  markAllViewed: () => void;
  // Lets any mounted component (currently just the Alerts page) react to a
  // notification the instant it arrives over the shared SSE connection,
  // without opening a second connection of its own.
  subscribe: (handler: (alert: ApiAlertItem) => void) => () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

// Mounted once at the protected layout level so the whole app shares a
// single EventSource connection instead of every page/component opening
// its own change-stream-backed request.
export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const subscribersRef = useRef(new Set<(alert: ApiAlertItem) => void>());

  useEffect(() => {
    let cancelled = false;

    fetch("/api/alerts/unread-count")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success) setUnreadCount(data.count);
      })
      .catch(() => null);

    // Native EventSource reconnects automatically on drop (server function
    // duration limits, network blips) — no manual retry logic needed. Any
    // notification created while briefly disconnected is still picked up
    // next time the Alerts page does its own REST fetch.
    const source = new EventSource("/api/alerts/stream");

    source.addEventListener("alert", (event) => {
      try {
        const alert = JSON.parse(
          (event as MessageEvent).data,
        ) as ApiAlertItem;
        setUnreadCount((count) => count + 1);
        subscribersRef.current.forEach((handler) => handler(alert));
      } catch {
        // ignore malformed payloads
      }
    });

    return () => {
      cancelled = true;
      source.close();
    };
  }, []);

  const markAllViewed = useCallback(() => {
    setUnreadCount(0);
    fetch("/api/alerts", { method: "POST" }).catch(() => null);
  }, []);

  const subscribe = useCallback((handler: (alert: ApiAlertItem) => void) => {
    subscribersRef.current.add(handler);
    return () => {
      subscribersRef.current.delete(handler);
    };
  }, []);

  return (
    <NotificationsContext.Provider
      value={{ unreadCount, markAllViewed, subscribe }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a NotificationsProvider",
    );
  }
  return ctx;
}
