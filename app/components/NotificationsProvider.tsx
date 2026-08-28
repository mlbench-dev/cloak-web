"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { signInWithCustomToken, signOut as signOutFirebase } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import { auth, database } from "@/lib/firebase";

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
  // Lets any mounted component (currently just the Alerts page) react the
  // instant a live notification ping arrives, without opening a second
  // Firebase connection of its own. No payload — Realtime Database only
  // carries a "something changed" signal (see notificationPings/{userId}),
  // not the notification's content, so subscribers refetch GET /api/alerts
  // themselves rather than being handed an item directly.
  subscribe: (handler: () => void) => () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

// Mounted once at the protected layout level so the whole app shares a
// single Realtime Database listener instead of every page/component
// opening its own.
export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const subscribersRef = useRef(new Set<() => void>());

  const refreshUnreadCount = useCallback(() => {
    fetch("/api/alerts/unread-count")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success) setUnreadCount(data.count);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      !session?.user?.id ||
      !database ||
      !auth
    ) {
      return;
    }
    // Narrowed to local consts — `database`/`auth` are module-level, so TS
    // can't carry the null-checks above through the async closure below.
    const db = database;
    const firebaseAuth = auth;

    let cancelled = false;
    // onValue fires immediately with the ping path's *current* value the
    // moment the listener attaches, not just on subsequent changes — that
    // first firing isn't a new notification, so it's skipped here.
    let isFirstSnapshot = true;
    let detachListener: (() => void) | null = null;

    const connect = async () => {
      try {
        const res = await fetch("/api/firebase/custom-token");
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.token) {
          throw new Error(data?.error || "Could not mint Firebase token");
        }
        if (cancelled) return;

        await signInWithCustomToken(firebaseAuth, data.token);
        if (cancelled) return;

        const pingRef = ref(db, `notificationPings/${session.user.id}`);
        detachListener = onValue(pingRef, () => {
          if (isFirstSnapshot) {
            isFirstSnapshot = false;
            return;
          }
          refreshUnreadCount();
          subscribersRef.current.forEach((handler) => handler());
        });
      } catch (error) {
        // Firebase not configured yet, or the token mint failed — the app
        // still works via the REST endpoints, just without live push.
        console.warn("Live notification push unavailable:", error);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      detachListener?.();
      void signOutFirebase(firebaseAuth).catch(() => null);
    };
  }, [status, session?.user?.id, refreshUnreadCount]);

  const markAllViewed = useCallback(() => {
    setUnreadCount(0);
    fetch("/api/alerts", { method: "POST" }).catch(() => null);
  }, []);

  const subscribe = useCallback((handler: () => void) => {
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
