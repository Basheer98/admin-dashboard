"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Step = "upload" | "map" | "preview" | "done";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "— Ignore —" },
  { value: "projectCode", label: "Project #" },
  { value: "clientName", label: "Client name" },
  { value: "totalSqft", label: "SQFT" },
  { value: "companyRate", label: "Company rate" },
  { value: "fielderName", label: "Fielder name" },
  { value: "fielderRate", label: "Fielder rate" },
  { value: "location", label: "Location" },
  { value: "status", label: "Status" },
  { value: "invoiceNumber", label: "Invoice / batch" },
];

type PreviewRow = {
  projectCode: string;
  clientName: string;
  totalSqft: number;
  companyRatePerSqft: number;
  fielders: { name: string; ratePerSqft: number }[];
  action: string;
  message: string;
  assignmentsToAdd: { name: string; ratePerSqft: number }[];
  assignmentsSkipped: string[];
};

export function InvoiceImportWizard({ suggestedInvoiceNumber }: { suggestedInvoiceNumber: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [headerRoles, setHeaderRoles] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [invoiceNumber, setInvoiceNumber] = useState(suggestedInvoiceNumber);
  const [defaultClientName, setDefaultClientName] = useState("");
  const [defaultCompanyRate, setDefaultCompanyRate] = useState("0.05");
  const [defaultLocation, setDefaultLocation] = useState("");
  const [defaultStatus, setDefaultStatus] = useState("ASSIGNED");
  const [syncBatch, setSyncBatch] = useState(true);
  const [projectConflict, setProjectConflict] = useState<"update" | "skip_project" | "skip">("update");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [importResult, setImportResult] = useState<{
    invoiceId: number;
    invoiceNumber: string;
    projectsCreated: number;
    projectsUpdated: number;
    assignmentsAdded: number;
    errors: string[];
  } | null>(null);

  const mapping = useMemo(() => {
    const m: Record<string, string> = {};
    for (const [header, role] of Object.entries(headerRoles)) {
      if (role) m[role] = header;
    }
    return m;
  }, [headerRoles]);

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/invoices/import/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not parse file");
        return;
      }
      setFilename(data.filename);
      setHeaders(data.headers);
      setRows(data.rows);
      const roleMap: Record<string, string> = {};
      for (const h of data.headers as string[]) {
        roleMap[h] = "";
      }
      for (const [role, col] of Object.entries(data.mapping as Record<string, string>)) {
        if (col && roleMap[col] !== undefined) roleMap[col] = role;
      }
      setHeaderRoles(roleMap);
      if (data.suggestedInvoiceNumber) setInvoiceNumber(data.suggestedInvoiceNumber);
      setStep("map");
    } catch {
      setError("Upload failed");
    } finally {
      setLoading(false);
    }
  }

  function buildOptions() {
    return {
      invoiceNumber: invoiceNumber.trim(),
      defaultClientName: defaultClientName.trim() || "Unknown",
      defaultCompanyRate: Number(defaultCompanyRate) || 0,
      defaultLocation: defaultLocation.trim(),
      defaultStatus: defaultStatus.trim() || "ASSIGNED",
      syncProjectInvoiceNumber: syncBatch,
      projectConflict,
      issueDate,
      dueDate: null,
      notes: null,
    };
  }

  async function runPreview() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/invoices/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers, rows, mapping, options: buildOptions() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Preview failed");
        return;
      }
      setPreview(data.preview);
      setParseErrors(data.parseErrors ?? []);
      setTotalRevenue(data.totalRevenue ?? 0);
      if (data.suggestedInvoiceNumber && !invoiceNumber) {
        setInvoiceNumber(data.suggestedInvoiceNumber);
      }
      setStep("preview");
    } catch {
      setError("Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function runConfirm() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/invoices/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers, rows, mapping, options: buildOptions(), filename }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        return;
      }
      setImportResult(data);
      setStep("done");
    } catch {
      setError("Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {step === "upload" && (
        <section className="card p-6">
          <h2 className="mb-2 text-base font-semibold text-zinc-100">Upload CSV from Google Sheets</h2>
          <p className="mb-4 text-sm text-zinc-400">
            In Google Sheets: File → Download → Comma-separated values (.csv). Include columns for project #, SQFT, and fielders (one row per fielder, or Fielder 1 / Rate 1 columns).
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-white"
            disabled={loading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </section>
      )}

      {step === "map" && (
        <>
          <section className="card p-6 space-y-4">
            <h2 className="text-base font-semibold text-zinc-100">Map columns</h2>
            <p className="text-sm text-zinc-400">{rows.length} data rows · {filename}</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="px-2 py-2 text-zinc-400">
                        <div className="font-medium text-zinc-200">{h}</div>
                        <select
                          className="select mt-1 h-9 w-full min-w-[8rem] text-xs"
                          value={headerRoles[h] ?? ""}
                          onChange={(e) =>
                            setHeaderRoles((prev) => ({ ...prev, [h]: e.target.value }))
                          }
                        >
                          {ROLE_OPTIONS.map((o) => (
                            <option key={o.value + h} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, ri) => (
                    <tr key={ri} className="border-t border-zinc-800">
                      {row.map((cell, ci) => (
                        <td key={ci} className="max-w-[12rem] truncate px-2 py-1.5 text-zinc-300">
                          {cell || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card grid gap-4 p-6 md:grid-cols-2">
            <div className="space-y-1">
              <label className="label">Invoice number</label>
              <input className="input h-11 w-full" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="label">Default client (if column missing)</label>
              <input className="input h-11 w-full" value={defaultClientName} onChange={(e) => setDefaultClientName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="label">Default company rate</label>
              <input className="input h-11 w-full" value={defaultCompanyRate} onChange={(e) => setDefaultCompanyRate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="label">Issue date</label>
              <input type="date" className="input h-11 w-full" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="label">Existing projects</label>
              <select
                className="select h-11 w-full"
                value={projectConflict}
                onChange={(e) => setProjectConflict(e.target.value as typeof projectConflict)}
              >
                <option value="update">Update SQFT, client, rate</option>
                <option value="skip_project">Skip project row — add fielders only</option>
                <option value="skip">Skip existing projects entirely</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-300 md:col-span-2">
              <input type="checkbox" checked={syncBatch} onChange={(e) => setSyncBatch(e.target.checked)} />
              Set project billing batch to this invoice number
            </label>
          </section>

          <div className="flex gap-3">
            <button type="button" className="btn-primary px-4 py-2" disabled={loading} onClick={() => void runPreview()}>
              {loading ? "Loading…" : "Preview import"}
            </button>
            <button type="button" className="btn-secondary px-4 py-2" onClick={() => setStep("upload")}>
              Back
            </button>
          </div>
        </>
      )}

      {step === "preview" && (
        <>
          <section className="card p-6">
            <p className="text-sm text-zinc-400">
              {preview.length} projects · est. revenue ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {parseErrors.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-sm text-amber-300">
                {parseErrors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {parseErrors.length > 10 && <li>…and {parseErrors.length - 10} more</li>}
              </ul>
            )}
          </section>
          <section className="card overflow-x-auto">
            <table className="table-sticky min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">SQFT</th>
                  <th className="px-3 py-2">Rate</th>
                  <th className="px-3 py-2">Fielders</th>
                  <th className="px-3 py-2">Dashboard</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p) => (
                  <tr key={p.projectCode} className="border-t border-zinc-800">
                    <td className="px-3 py-2 font-medium">{p.projectCode}</td>
                    <td className="px-3 py-2">{p.clientName}</td>
                    <td className="px-3 py-2">{p.totalSqft.toLocaleString()}</td>
                    <td className="px-3 py-2">{p.companyRatePerSqft}</td>
                    <td className="px-3 py-2 text-xs">
                      {p.fielders.map((f) => f.name).join(", ") || "—"}
                      {p.assignmentsToAdd.length > 0 && (
                        <span className="mt-1 block text-emerald-400">
                          +{p.assignmentsToAdd.length} new assignment{p.assignmentsToAdd.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400">{p.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <div className="flex gap-3">
            <button type="button" className="btn-primary px-4 py-2" disabled={loading || preview.length === 0} onClick={() => void runConfirm()}>
              {loading ? "Importing…" : "Confirm import"}
            </button>
            <button type="button" className="btn-secondary px-4 py-2" onClick={() => setStep("map")}>
              Back
            </button>
          </div>
        </>
      )}

      {step === "done" && importResult && (
        <section className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-green-300">Import complete</h2>
          <ul className="text-sm text-zinc-300 space-y-1">
            <li>Invoice: <strong>{importResult.invoiceNumber}</strong></li>
            <li>{importResult.projectsCreated} projects created</li>
            <li>{importResult.projectsUpdated} projects updated</li>
            <li>{importResult.assignmentsAdded} assignments added</li>
          </ul>
          {importResult.errors.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-amber-300">
              {importResult.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-primary px-4 py-2"
              onClick={() => router.push(`/invoices/${importResult.invoiceId}`)}
            >
              View invoice
            </button>
            <a href="/projects" className="btn-secondary inline-flex items-center px-4 py-2">
              View projects
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
