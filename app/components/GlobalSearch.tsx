"use client";

import Link from "next/link";
import React, { useState, useEffect, useRef, useCallback } from "react";

type SearchResult = {
  projects: { id: number; projectCode: string; clientName: string; invoiceNumber: string | null }[];
  fielders: string[];
  invoices: string[];
};

const DEBOUNCE_MS = 200;

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  const fetchSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResult(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        setResult(null);
      }
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debouncedQ) {
      fetchSearch(debouncedQ);
    } else {
      setResult(null);
    }
  }, [debouncedQ, fetchSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasResults =
    result &&
    (result.projects.length > 0 || result.fielders.length > 0 || result.invoices.length > 0);
  const showDropdown = open && (focused || hasResults) && (q.trim() !== "" || loading);

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <label htmlFor="global-search" className="sr-only">
        Search projects, fielders, invoices
      </label>
      <input
        id="global-search"
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          setOpen(true);
        }}
        onBlur={() => setFocused(false)}
        placeholder="Search projects, fielders, invoices…"
        className="input w-full py-2 text-sm"
        autoComplete="off"
        aria-expanded={!!showDropdown}
        aria-controls="global-search-results"
        aria-autocomplete="list"
      />
      {showDropdown && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 py-2 shadow-xl"
        >
          {loading ? (
            <div className="px-4 py-3 text-sm text-zinc-500">Searching…</div>
          ) : !hasResults ? (
            <div className="px-4 py-3 text-sm text-zinc-500">
              No projects, fielders, or invoices match &quot;{q.trim()}&quot;
            </div>
          ) : (
            <>
              {result!.projects.length > 0 && (
                <div className="px-2 pb-1">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Projects
                  </div>
                  {result!.projects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800/50"
                      role="option"
                    >
                      <span className="font-medium text-emerald-400">{p.projectCode}</span>
                      {p.clientName && (
                        <span className="ml-2 text-zinc-500">{p.clientName}</span>
                      )}
                      {p.invoiceNumber && (
                        <span className="ml-2 text-xs text-zinc-500">Inv: {p.invoiceNumber}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
              {result!.fielders.length > 0 && (
                <div className="px-2 pb-1">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Fielders
                  </div>
                  {result!.fielders.map((name) => (
                    <Link
                      key={name}
                      href={`/fielders/${encodeURIComponent(name)}`}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800/50"
                      role="option"
                    >
                      {name}
                    </Link>
                  ))}
                </div>
              )}
              {result!.invoices.length > 0 && (
                <div className="px-2">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Invoices
                  </div>
                  {result!.invoices.map((inv) => (
                    <Link
                      key={inv}
                      href={`/projects?invoice=${encodeURIComponent(inv)}`}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800/50"
                      role="option"
                    >
                      {inv}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
