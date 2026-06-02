"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InvoiceLogoUpload({ hasLogo }: { hasLogo: boolean }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/settings/invoice-logo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setPreviewKey((k) => k + 1);
      router.refresh();
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function removeLogo() {
    if (!confirm("Remove the invoice logo?")) return;
    setUploading(true);
    setError(null);
    try {
      await fetch("/api/settings/invoice-logo", { method: "DELETE" });
      setPreviewKey((k) => k + 1);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3 md:col-span-2">
      <label className="label">Company logo (shown on invoice PDF)</label>
      <div className="flex flex-wrap items-start gap-4">
        {hasLogo ? (
          <div className="rounded-lg border border-zinc-700 bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={previewKey}
              src={`/api/settings/invoice-logo?t=${previewKey}`}
              alt="Invoice logo preview"
              className="max-h-16 max-w-[200px] object-contain"
            />
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No logo uploaded yet.</p>
        )}
        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
            onChange={onFile}
            className="text-sm text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:text-white"
          />
          {hasLogo && (
            <button
              type="button"
              onClick={removeLogo}
              disabled={uploading}
              className="text-left text-sm text-red-400 hover:underline"
            >
              Remove logo
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-zinc-500">PNG or JPG, max 2 MB. Appears top-left on every invoice.</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
