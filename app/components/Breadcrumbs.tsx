import Link from "next/link";
import React from "react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-zinc-500">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && (
            <span className="text-zinc-500" aria-hidden>
              /
            </span>
          )}
          {item.href ? (
            <Link href={item.href} className="hover:text-emerald-400 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-zinc-100">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
