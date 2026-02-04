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
      <span className="text-sm text-slate-500">Active filters:</span>
      {chips.map(({ key, label, value }) => (
        <span
          key={key}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm"
        >
          <span className="font-medium">{label}:</span>
          <span>{value}</span>
          <Link
            href={buildUrlWithout(key)}
            className="ml-0.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
            aria-label={`Remove ${label} filter`}
          >
            ×
          </Link>
        </span>
      ))}
    </div>
  );
}
