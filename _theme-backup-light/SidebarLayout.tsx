"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import { SessionTimeout } from "./SessionTimeout";
import { GlobalSearch } from "./GlobalSearch";

type SidebarLayoutProps = {
  title: string;
  children: React.ReactNode;
  current: "dashboard" | "projects" | "assignments" | "fielders" | "payments" | "additional" | "activity" | "audit" | "settings" | "reports" | "reports-monthly" | "reports-manager-commissions";
  headerAction?: React.ReactNode;
  backLink?: { href: string; label: string };
};

const STORAGE_KEY = "admin-dashboard-sidebar-collapsed";
const DENSITY_STORAGE_KEY = "admin-dashboard-table-density-compact";

export function SidebarLayout({
  title,
  children,
  current,
  headerAction,
  backLink,
}: SidebarLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [compactDensity, setCompactDensity] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isLg, setIsLg] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setMounted(true);
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "1") setCollapsed(true);
        const densityStored = localStorage.getItem(DENSITY_STORAGE_KEY);
        if (densityStored === "1") setCompactDensity(true);
      } catch {
        // ignore
      }
      const mq = window.matchMedia("(min-width: 1024px)");
      setIsLg(mq.matches);
    }, 0);
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = () => setIsLg(window.matchMedia("(min-width: 1024px)").matches);
    mq.addEventListener("change", handler);
    return () => {
      clearTimeout(id);
      mq.removeEventListener("change", handler);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, compactDensity ? "1" : "0");
    } catch {
      // ignore
    }
  }, [compactDensity, mounted]);

  useEffect(() => {
    if (isLg) {
      const id = setTimeout(() => setMobileMenuOpen(false), 0);
      return () => clearTimeout(id);
    }
  }, [isLg]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="dashboard-layout flex min-h-screen text-slate-900">
      <SessionTimeout />
      <a href="#main-content" className="skip-link no-print">
        Skip to main content
      </a>
      {/* Backdrop when mobile menu is open */}
      {!isLg && mobileMenuOpen && (
        <button
          type="button"
          onClick={closeMobileMenu}
          className="no-print fixed inset-0 z-30 bg-black/50 lg:hidden"
          aria-label="Close menu"
        />
      )}
      {/* Toggle button when sidebar is hidden on desktop */}
      {isLg && collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="no-print fixed left-0 top-5 z-30 rounded-r-xl border-0 bg-gradient-to-b from-slate-800 to-slate-900 px-3 py-3.5 text-white shadow-xl hover:from-slate-700 hover:to-slate-800 transition-all"
          aria-label="Show sidebar"
        >
          <span className="text-lg">→</span>
        </button>
      )}
      <aside
        className={
          "no-print flex w-64 flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 px-5 py-7 " +
          (!isLg
            ? `fixed left-0 top-0 bottom-0 z-40 transform shadow-2xl transition-transform duration-200 ease-out ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`
            : `transition-[margin] duration-200 ${collapsed ? "-ml-64 w-0 overflow-hidden" : "shadow-2xl"}`
          )
        }
      >
        <div className="mb-8 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">
              UrbanLink Networks
            </h1>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.25em]">
              Admin
            </p>
          </div>
          <button
            type="button"
            onClick={() => (isLg ? setCollapsed(true) : closeMobileMenu())}
            className="shrink-0 rounded-xl p-2.5 text-slate-500 hover:bg-white/5 hover:text-white transition-colors"
            aria-label={isLg ? "Collapse sidebar" : "Close menu"}
          >
            ←
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          <SidebarLink href="/" label="Dashboard" active={current === "dashboard"} onNavigate={!isLg ? closeMobileMenu : undefined} />
          <SidebarLink href="/projects" label="Projects" active={current === "projects"} onNavigate={!isLg ? closeMobileMenu : undefined} />
          <SidebarLink href="/assignments" label="Fielders" active={current === "assignments"} onNavigate={!isLg ? closeMobileMenu : undefined} />
          <SidebarLink href="/fielders" label="Fielder reports" active={current === "fielders"} onNavigate={!isLg ? closeMobileMenu : undefined} />
          <SidebarLink href="/payments" label="Payments" active={current === "payments"} onNavigate={!isLg ? closeMobileMenu : undefined} />
          <SidebarLink href="/additional-work" label="Additional work" active={current === "additional"} onNavigate={!isLg ? closeMobileMenu : undefined} />
          <SidebarLink href="/reports/monthly" label="Monthly summary" active={current === "reports" || current === "reports-monthly"} onNavigate={!isLg ? closeMobileMenu : undefined} />
          <SidebarLink href="/reports/manager-commissions" label="Manager commissions" active={current === "reports" || current === "reports-manager-commissions"} onNavigate={!isLg ? closeMobileMenu : undefined} />
          <SidebarLink href="/activity" label="Activity log" active={current === "activity"} onNavigate={!isLg ? closeMobileMenu : undefined} />
          <SidebarLink href="/audit" label="Audit trail" active={current === "audit"} onNavigate={!isLg ? closeMobileMenu : undefined} />
          <SidebarLink href="/settings" label="Settings" active={current === "settings"} onNavigate={!isLg ? closeMobileMenu : undefined} />
        </nav>
        <div className="mt-6 rounded-xl bg-white/5 border border-white/5 p-2.5">
          <button
            type="button"
            onClick={() => setCompactDensity((v) => !v)}
            className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${compactDensity ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
          >
            {compactDensity ? "✓ Compact tables" : "Comfortable tables"}
          </button>
          <p className="mt-1.5 px-2 text-[11px] text-slate-500 uppercase tracking-wider">
            Table density
          </p>
        </div>
        <form method="POST" action="/api/auth/logout" className="mt-6">
          <button
            type="submit"
            className="w-full rounded-xl border border-slate-600/80 bg-transparent px-4 py-3 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white hover:border-slate-500 transition-colors"
          >
            Log out
          </button>
        </form>
      </aside>
      <main id="main-content" tabIndex={-1} className={`flex-1 min-w-0 ${compactDensity ? "table-density-compact" : ""}`}>
        <header className="sticky top-0 z-20 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
              {!isLg && (
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="header-menu-btn no-print shrink-0 rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  aria-label="Open menu"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              <div className="flex h-9 w-1 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-indigo-500 to-indigo-600 min-w-[4px]" aria-hidden />
              <div className="min-w-0">
                {backLink && (
                  <Link
                    href={backLink.href}
                    className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors mb-0.5"
                  >
                    ← {backLink.label}
                  </Link>
                )}
                <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl truncate">
                  {title}
                </h2>
              </div>
              <div className="hidden sm:block flex-1 min-w-0 max-w-xs">
                <GlobalSearch />
              </div>
            </div>
            {headerAction != null ? <div className="no-print shrink-0">{headerAction}</div> : null}
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">{children}</div>
      </main>
    </div>
  );
}

type SidebarLinkProps = {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
};

function SidebarLink({ href, label, active, onNavigate }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`relative rounded-xl pl-5 pr-4 py-3 text-sm font-medium transition-all ${
        active
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
          : "text-slate-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      {active && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1 rounded-full bg-indigo-300 h-5" aria-hidden />
      )}
      <span className={active ? "relative" : ""}>{label}</span>
    </Link>
  );
}
