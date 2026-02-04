"use client";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print btn-secondary no-print"
      aria-label={label === "Print" ? "Print this page" : label}
    >
      {label}
    </button>
  );
}
