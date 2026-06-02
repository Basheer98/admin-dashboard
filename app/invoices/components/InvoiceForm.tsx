"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LineState = {
  projectCode: string;
  totalSqft: string;
  ratePerSqft: string;
};

type InvoiceFormProps = {
  suggestedInvoiceNumber: string;
  defaultIssueDate: string;
  defaultCompanyRate: number | null;
};

function emptyLine(defaultRate: string): LineState {
  return {
    projectCode: "",
    totalSqft: "",
    ratePerSqft: defaultRate,
  };
}

export function InvoiceForm({
  suggestedInvoiceNumber,
  defaultIssueDate,
  defaultCompanyRate,
}: InvoiceFormProps) {
  const router = useRouter();
  const defaultRateStr =
    defaultCompanyRate != null && defaultCompanyRate > 0 ? String(defaultCompanyRate) : "";

  const [invoiceNumber, setInvoiceNumber] = useState(suggestedInvoiceNumber);
  const [clientName, setClientName] = useState("");
  const [issueDate, setIssueDate] = useState(defaultIssueDate);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineState[]>([
    emptyLine(defaultRateStr),
    emptyLine(defaultRateStr),
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function lookupLine(index: number) {
    const code = lines[index]?.projectCode.trim();
    if (!code) return;
    const res = await fetch(`/api/invoices/lookup?code=${encodeURIComponent(code)}`);
    const data = await res.json();
    if (!data.project) return;
    updateLine(index, {
      projectCode: data.project.projectCode,
      totalSqft: String(data.project.totalSqft),
      ratePerSqft:
        defaultRateStr || String(data.project.companyRatePerSqft),
    });
    if (!clientName) setClientName(data.project.clientName);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!defaultRateStr && lines.every((l) => !l.ratePerSqft.trim())) {
      setError("Set a default company rate in Settings → Billing rates, or enter a rate on each line.");
      return;
    }

    const payloadLines = lines
      .filter((l) => l.projectCode.trim())
      .map((l) => ({
        projectCode: l.projectCode.trim(),
        clientName: null as string | null,
        totalSqft: Number(l.totalSqft),
        ratePerSqft: Number(l.ratePerSqft || defaultRateStr),
      }));

    if (payloadLines.length === 0) {
      setError("Add at least one line with a project number.");
      return;
    }
    if (!clientName.trim()) {
      setError("Client name is required (who you are billing).");
      return;
    }
    for (const l of payloadLines) {
      if (!Number.isFinite(l.totalSqft) || l.totalSqft <= 0) {
        setError("Each line needs a valid SQFT.");
        return;
      }
      if (!Number.isFinite(l.ratePerSqft) || l.ratePerSqft < 0) {
        setError("Each line needs a valid billing rate.");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: invoiceNumber.trim(),
          clientName: clientName.trim(),
          issueDate,
          dueDate: dueDate.trim() || null,
          notes: notes.trim() || null,
          syncProjectInvoiceNumber: false,
          syncProjectsToDashboard: false,
          lines: payloadLines,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save invoice");
        return;
      }
      router.push(`/invoices/${data.id}?success=1`);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  const previewTotal = lines.reduce((sum, l) => {
    const sqft = Number(l.totalSqft);
    const rate = Number(l.ratePerSqft || defaultRateStr);
    if (!l.projectCode.trim() || !Number.isFinite(sqft) || !Number.isFinite(rate)) return sum;
    return sum + sqft * rate;
  }, 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <p className="text-sm text-zinc-400">
        This invoice is for your <strong className="text-zinc-200">client</strong> (project #, SQFT, rate, total).
        Fielder payouts are tracked separately under Fielder reports. Billing rate defaults come from{" "}
        <a href="/settings" className="text-emerald-400 hover:underline">Settings</a>.
      </p>

      <div className="card grid gap-4 p-6 md:grid-cols-2">
        <div className="space-y-1">
          <label className="label">Invoice number</label>
          <input
            className="input h-11 w-full"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="label">Bill to (client name)</label>
          <input
            className="input h-11 w-full"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="label">Issue date</label>
          <input
            type="date"
            className="input h-11 w-full"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="label">Due date (optional)</label>
          <input
            type="date"
            className="input h-11 w-full"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="label">Notes (optional)</label>
          <textarea
            className="input min-h-[80px] w-full"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {defaultRateStr && (
          <p className="text-sm text-zinc-500 md:col-span-2">
            Default billing rate from settings: <strong className="text-zinc-300">{defaultRateStr}</strong> / sqft (editable per line)
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-zinc-100">Billable lines</h3>
          <p className="text-sm text-zinc-400">
            Total:{" "}
            <span className="font-medium text-zinc-200">
              ${previewTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </p>
        </div>

        {lines.map((line, index) => (
          <div key={index} className="card grid gap-3 p-4 md:grid-cols-3">
            <div className="space-y-1 md:col-span-3">
              <label className="label">Project #</label>
              <div className="flex gap-2">
                <input
                  className="input h-11 flex-1"
                  placeholder="e.g. PRJ24086"
                  value={line.projectCode}
                  onChange={(e) => updateLine(index, { projectCode: e.target.value })}
                />
                <button
                  type="button"
                  className="btn-secondary h-11 shrink-0 px-4"
                  onClick={() => lookupLine(index)}
                >
                  Look up SQFT
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="label">SQFT</label>
              <input
                type="number"
                min={1}
                className="input h-11 w-full"
                value={line.totalSqft}
                onChange={(e) => updateLine(index, { totalSqft: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="label">Billing rate / sqft</label>
              <input
                type="number"
                step="0.001"
                min={0}
                className="input h-11 w-full"
                placeholder={defaultRateStr || "From settings"}
                value={line.ratePerSqft}
                onChange={(e) => updateLine(index, { ratePerSqft: e.target.value })}
              />
            </div>
            <div className="flex items-end text-sm text-zinc-500">
              Line total: $
              {(
                (Number(line.totalSqft) || 0) * (Number(line.ratePerSqft || defaultRateStr) || 0)
              ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        ))}

        <button
          type="button"
          className="btn-secondary px-4 py-2"
          onClick={() => setLines((prev) => [...prev, emptyLine(defaultRateStr)])}
        >
          + Add line
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary px-6 py-2.5" disabled={saving}>
          {saving ? "Saving…" : "Create client invoice"}
        </button>
        <Link href="/invoices" className="btn-secondary inline-flex items-center px-6 py-2.5">
          Cancel
        </Link>
      </div>
    </form>
  );
}
