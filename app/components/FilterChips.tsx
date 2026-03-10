"use client";

import Link from "next/link";

export type FilterChip = {
  key: string;
  label: string;
  value: string;
};

type FilterChipsProps = {
  chips: FilterChip[];
  basePath: string;
  /** Current search params to preserve when removing one chip (e.g. { archived: "1" }) */
  preserveParams?: Record<string, string>;
  className?: string;
};

export function FilterChips({
  chips,
  basePath,
  preserveParams = {},
  className = "",
}: FilterChipsProps) {
  if (chips.length === 0) return null;

  function buildUrlWithout(removeKey: string): string {
    const params = new URLSearchParams();
    Object.entries(preserveParams).forEach(([k, v]) => {
      if (k !== removeKey && v) params.set(k, v);
    });
    const q = params.toString();
    return q ? `${basePath}?${q}` : basePath;
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-sm text-zinc-500">Active filters:</span>
      {chips.map(({ key, label, value }) => (
        <span
          key={key}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 shadow-sm"
        >
          <span className="font-medium">{label}:</span>
          <span>{value}</span>
          <Link
            href={buildUrlWithout(key)}
            className="ml-0.5 rounded-full p-0.5 text-zinc-500 hover:bg-zinc-800/50 hover:text-emerald-400 transition-colors"
            aria-label={`Remove ${label} filter`}
          >
            ×
          </Link>
        </span>
      ))}
    </div>
  );
}
