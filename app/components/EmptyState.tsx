import Link from "next/link";
import React from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  /** Primary CTA: { label, href } or { label, onClick } for client actions */
  action?: { label: string; href: string } | { label: string; onClick: () => void };
  /** Optional icon (emoji or character) */
  icon?: string;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon = "📋",
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/50/50 py-14 px-6 text-center ${className}`}
    >
      <span className="mb-4 text-5xl opacity-80" aria-hidden>
        {icon}
      </span>
      <h3 className="text-lg font-bold tracking-tight text-zinc-100">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-zinc-400">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          {"href" in action ? (
            <Link
              href={action.href}
              className="btn-primary inline-flex items-center px-5 py-2.5 text-sm"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="btn-primary inline-flex items-center px-5 py-2.5 text-sm"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
