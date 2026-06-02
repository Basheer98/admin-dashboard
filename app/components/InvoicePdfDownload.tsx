"use client";

import { useState } from "react";

type Props = {
  invoiceId: number;
  invoiceNumber: string;
  className?: string;
};

export function InvoicePdfDownload({ invoiceId, invoiceNumber, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/invoice-records/${invoiceId}/pdf`, { credentials: "include" });
      if (!res.ok) {
        let message = "Could not generate PDF. Try again or check server logs.";
        try {
          const data = await res.json();
          if (data.error) message = String(data.error);
        } catch {
          const text = await res.text();
          if (text) message = text.slice(0, 200);
        }
        setError(message);
        return;
      }
      const blob = await res.blob();
      if (!blob.type.includes("pdf") && blob.size < 500) {
        setError("Server did not return a valid PDF.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const safeName = invoiceNumber.replace(/[^\w.-]+/g, "-");
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className={className ?? "btn-primary inline-flex items-center px-4 py-2"}
      >
        {loading ? "Preparing PDF…" : "Download PDF"}
      </button>
      {error && <p className="max-w-xs text-right text-xs text-red-400">{error}</p>}
    </div>
  );
}
