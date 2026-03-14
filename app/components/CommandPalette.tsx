"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef, useCallback } from "react";

type SearchResult = {
  projects: { id: number; projectCode: string; clientName: string; invoiceNumber: string | null }[];
  fielders: string[];
  invoices: string[];
};

type NavItem = {
  href: string;
  label: string;
  shortcut?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/assignments", label: "Fielders" },
  { href: "/fielders", label: "Fielder reports" },
  { href: "/payments", label: "Payments" },
  { href: "/additional-work", label: "Additional work" },
  { href: "/reports/monthly", label: "Monthly summary" },
  { href: "/reports/manager-commissions", label: "Manager commissions" },
  { href: "/activity", label: "Activity log" },
  { href: "/audit", label: "Audit trail" },
  { href: "/settings", label: "Settings" },
];

const ACTION_ITEMS: NavItem[] = [
  { href: "/projects", label: "Add project" },
  { href: "/assignments", label: "Assign fielder" },
  { href: "/payments", label: "Log payment" },
];

const DEBOUNCE_MS = 150;

function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const fetchSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSearchResult(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResult(data);
      } else {
        setSearchResult(null);
      }
    } catch {
      setSearchResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debouncedQuery) {
      fetchSearch(debouncedQuery);
    } else {
      setSearchResult(null);
    }
  }, [debouncedQuery, fetchSearch]);

  useEffect(() => {
    const handleOpen = () => {
      setOpen(true);
      setQuery("");
      setSearchResult(null);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    };
    window.addEventListener("openCommandPalette" as keyof WindowEventMap, handleOpen as EventListener);
    return () => window.removeEventListener("openCommandPalette" as keyof WindowEventMap, handleOpen as EventListener);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        if (!open) {
          setQuery("");
          setSearchResult(null);
          setSelectedIndex(0);
          setTimeout(() => inputRef.current?.focus(), 0);
        }
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const hasSearchResults =
    searchResult &&
    (searchResult.projects.length > 0 || searchResult.fielders.length > 0 || searchResult.invoices.length > 0);

  const filteredNav = query.trim()
    ? NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(query.trim().toLowerCase()))
    : NAV_ITEMS;
  const filteredActions = query.trim()
    ? ACTION_ITEMS.filter((n) => n.label.toLowerCase().includes(query.trim().toLowerCase()))
    : ACTION_ITEMS;

  const flatDisplayItems = query.trim() && hasSearchResults
    ? [
        ...(searchResult!.projects.length > 0
          ? [{ section: "Projects" as const, items: searchResult!.projects.map((p) => ({ href: `/projects/${p.id}`, label: `${p.projectCode} – ${p.clientName}`.trim(), sub: p.invoiceNumber ?? undefined })) }]
          : []),
        ...(searchResult!.fielders.length > 0
          ? [{ section: "Fielders" as const, items: searchResult!.fielders.map((name) => ({ href: `/fielders/${encodeURIComponent(name)}`, label: name, sub: undefined })) }]
          : []),
        ...(searchResult!.invoices.length > 0
          ? [{ section: "Invoices" as const, items: searchResult!.invoices.map((inv) => ({ href: `/projects?invoice=${encodeURIComponent(inv)}`, label: inv, sub: undefined })) }]
          : []),
      ]
    : null;

  const totalCount = flatDisplayItems
    ? flatDisplayItems.reduce((s, g) => s + g.items.length, 0)
    : filteredNav.length + filteredActions.length;

  const selectAndGo = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  useEffect(() => {
    setSelectedIndex((i) => (totalCount > 0 ? Math.min(i, totalCount - 1) : 0));
  }, [totalCount, query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % totalCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + totalCount) % totalCount);
    } else if (e.key === "Enter" && totalCount > 0) {
      e.preventDefault();
      if (flatDisplayItems) {
        let idx = 0;
        for (const g of flatDisplayItems) {
          for (const it of g.items) {
            if (idx === selectedIndex) {
              selectAndGo(it.href);
              return;
            }
            idx++;
          }
        }
      } else {
        const item = selectedIndex < filteredNav.length ? filteredNav[selectedIndex] : filteredActions[selectedIndex - filteredNav.length];
        if (item) selectAndGo(item.href);
      }
    }
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const modKey = isMac() ? "⌘" : "Ctrl";
  const shortcutHint = `${modKey} K`;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-zinc-700 px-4">
          <svg className="h-5 w-5 shrink-0 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or jump to…"
            className="flex-1 bg-transparent py-3.5 text-base text-zinc-100 placeholder-zinc-500 focus:outline-none"
            autoComplete="off"
          />
          <kbd className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-500">{shortcutHint}</kbd>
        </div>
        <div ref={listRef} className="max-h-[min(60vh,400px)] overflow-y-auto py-2">
          {query.trim() && loading ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">Searching…</div>
          ) : flatDisplayItems && flatDisplayItems.length > 0 ? (
            flatDisplayItems.map((group) => (
              <div key={group.section} className="mb-2">
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {group.section}
                </div>
                {group.items.map((it, i) => {
                  const globalIdx = flatDisplayItems
                    .slice(0, flatDisplayItems.indexOf(group))
                    .reduce((s, g) => s + g.items.length, 0) + i;
                  return (
                    <Link
                      key={it.href + it.label}
                      href={it.href}
                      data-index={globalIdx}
                      onClick={() => setOpen(false)}
                      className={`mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        selectedIndex === globalIdx ? "bg-white/10 text-white" : "text-zinc-200 hover:bg-zinc-800"
                      }`}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                    >
                      <span className="font-medium">{it.label}</span>
                      {it.sub && <span className="text-zinc-500">{it.sub}</span>}
                    </Link>
                  );
                })}
              </div>
            ))
          ) : query.trim() && !loading ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">No results for &quot;{query}&quot;</div>
          ) : (
            <>
              <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Navigate
              </div>
              {filteredNav.map((item, i) => (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  data-index={i}
                  onClick={() => setOpen(false)}
                  className={`mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    selectedIndex === i ? "bg-white/10 text-white" : "text-zinc-200 hover:bg-zinc-800"
                  }`}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-2 border-t border-zinc-700 pt-2">
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Quick actions
                </div>
                {filteredActions.map((item, i) => {
                  const idx = filteredNav.length + i;
                  return (
                    <Link
                      key={item.href + item.label}
                      href={item.href}
                      data-index={idx}
                      onClick={() => setOpen(false)}
                      className={`mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        selectedIndex === idx ? "bg-white/10 text-white" : "text-zinc-200 hover:bg-zinc-800"
                      }`}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div className="border-t border-zinc-700 px-4 py-2 text-xs text-zinc-500">
          <kbd className="rounded border border-zinc-600 px-1.5 py-0.5">↑</kbd> <kbd className="rounded border border-zinc-600 px-1.5 py-0.5">↓</kbd> to navigate
          <span className="mx-2">•</span>
          <kbd className="rounded border border-zinc-600 px-1.5 py-0.5">Enter</kbd> to select
          <span className="mx-2">•</span>
          <kbd className="rounded border border-zinc-600 px-1.5 py-0.5">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
