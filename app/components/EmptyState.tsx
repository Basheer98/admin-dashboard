import Link from "next/link";
import { FileText, type LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { href: string; label: string };
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  const IconComponent = icon ?? FileText;
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-zinc-700/60 border-dashed bg-zinc-900/40 px-8 py-12 text-center ${className}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-500">
        <IconComponent className="h-7 w-7" strokeWidth={1.5} aria-hidden />
      </div>
      <h3 className="mt-4 text-base font-semibold text-zinc-200">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>
      )}
      {action && (
        <Link
          href={action.href}
          className="btn-primary mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-sm"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
