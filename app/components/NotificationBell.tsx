"use client";

import Link from "next/link";
import React, { useState, useEffect, useRef } from "react";
import { Bell, AlertCircle, CheckCircle2 } from "lucide-react";

const LAST_SEEN_KEY = "admin-dashboard-notifications-last-seen";

type NotificationItem = {
  id: string;
  type: "issue" | "status";
  message: string;
  projectCode: string;
  projectId: number;
  actorName: string;
  createdAt: string;
};

function getLastSeenAt(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(LAST_SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function setLastSeenAt(iso: string): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, iso);
  } catch {
    // ignore
  }
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 2592000) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [lastSeenAt, setLastSeenAtState] = useState("");
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = (showLoader = false) => {
    if (showLoader) setLoading(true);
    fetch("/api/notifications?limit=25")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLastSeenAtState(getLastSeenAt());
    fetchNotifications(false);
    const interval = setInterval(() => fetchNotifications(false), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) fetchNotifications(true);
  }, [open]);

  const markAllAsSeen = () => {
    if (items.length > 0) {
      const latest = items.reduce((max, n) =>
        n.createdAt > max ? n.createdAt : max,
        items[0].createdAt,
      );
      setLastSeenAt(latest);
      setLastSeenAtState(latest);
    }
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (open) markAllAsSeen();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, items]);

  const handleClose = () => {
    markAllAsSeen();
    setOpen(false);
  };

  const cutoff = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
  const unseenItems = items.filter((n) => new Date(n.createdAt).getTime() > cutoff);
  const displayItems = open ? unseenItems : items;
  const badgeCount = unseenItems.length;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          if (open) markAllAsSeen();
          setOpen((o) => !o);
        }}
        className="relative rounded-xl p-2.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
        aria-label={badgeCount ? `${badgeCount} new notifications` : "Notifications"}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" strokeWidth={2} />
        {badgeCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-700 bg-zinc-900 py-2 shadow-xl"
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-100">Notifications</h3>
            <span className="text-xs text-zinc-500">
              {badgeCount > 0 ? `${badgeCount} new` : "Fielder activity"}
            </span>
          </div>

          <div className="max-h-[min(70vh,400px)] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">Loading…</div>
            ) : displayItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">
                {items.length === 0
                  ? "No recent notifications"
                  : "No new notifications — you're all caught up"}
              </div>
            ) : (
              displayItems.map((n) => {
                const href = n.type === "issue"
                  ? `/projects/${n.projectId}#issues`
                  : `/projects/${n.projectId}`;
                return (
                  <Link
                    key={n.id}
                    href={href}
                    onClick={handleClose}
                    className="flex gap-3 px-4 py-3 hover:bg-zinc-800/80 transition-colors border-b border-zinc-800/50 last:border-0"
                  >
                    <span className="mt-0.5 shrink-0">
                      {n.type === "issue" ? (
                        <AlertCircle className="h-4 w-4 text-amber-400" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-100 truncate">
                        <span className="font-medium">{n.actorName}</span>
                        {n.type === "issue" ? (
                          <> logged an issue on <span className="text-zinc-300">{n.projectCode}</span></>
                        ) : (
                          <> {n.message} on <span className="text-zinc-300">{n.projectCode}</span></>
                        )}
                      </p>
                      {n.type === "issue" && (
                        <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{n.message}</p>
                      )}
                      <p className="mt-1 text-[11px] text-zinc-500">{relativeTime(n.createdAt)}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
          <div className="border-t border-zinc-800 px-4 py-2">
            <Link
              href="/activity"
              onClick={handleClose}
              className="block text-center text-xs font-medium text-zinc-400 hover:text-emerald-400 transition-colors"
            >
              View all activity
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
