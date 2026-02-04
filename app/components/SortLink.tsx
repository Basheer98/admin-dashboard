import Link from "next/link";

type SortLinkProps = {
  label: string;
  sortKey: string;
  currentSort: string | null;
  currentOrder: "asc" | "desc";
  basePath: string;
  preserveParams?: Record<string, string>;
};

export function SortLink({
  label,
  sortKey,
  currentSort,
  currentOrder,
  basePath,
  preserveParams = {},
}: SortLinkProps) {
  const isActive = currentSort === sortKey;
  const nextOrder =
    isActive && currentOrder === "desc" ? "asc" : "desc";
  const params = new URLSearchParams(preserveParams);
  params.set("sort", sortKey);
  params.set("order", nextOrder);
  const href = `${basePath}?${params.toString()}`;

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-indigo-600 transition-colors"
    >
      {label}
      {isActive && (
        <span className="text-indigo-500" aria-hidden>
          {currentOrder === "asc" ? "↑" : "↓"}
        </span>
      )}
    </Link>
  );
}
