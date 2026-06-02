"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { ClientSelectField, type ClientOption } from "./ClientSelectField";

type Step = "upload" | "map" | "review" | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "map", label: "Map columns" },
  { id: "review", label: "Review changes" },
  { id: "done", label: "Done" },
];

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "— Ignore —" },
  { value: "projectCode", label: "Project #" },
  { value: "clientName", label: "Client name" },
  { value: "totalSqft", label: "SQFT" },
  { value: "companyRate", label: "Company rate" },
  { value: "fielderName", label: "Fielder name" },
  { value: "fielderRate", label: "Fielder rate" },
  { value: "location", label: "Address / location" },
  { value: "status", label: "Status (fielding / data)" },
  { value: "qfield", label: "QField" },
  { value: "ecd", label: "ECD" },
  { value: "notes", label: "Notes" },
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

type PreviewSummary = {
  projectsToCreate: number;
  projectsToUpdate: number;
  projectsSkipped: number;
  assignmentsToAdd: number;
};

type ImportResult = {
  invoiceId: number;
  invoiceNumber: string;
  projectsCreated: number;
  projectsUpdated: number;
  projectsSkipped: number;
  assignmentsAdded: number;
  errors: string[];
};

type ModalState =
  | null
  | { kind: "success"; result: ImportResult }
  | { kind: "error"; title: string; message: string };

function actionLabel(action: string): { text: string; className: string } {
  switch (action) {
    case "create_project":
      return { text: "New project", className: "bg-emerald-950 text-emerald-300" };
    case "update_project":
      return { text: "Update", className: "bg-blue-950 text-blue-300" };
    case "skip_project":
      return { text: "Skip", className: "bg-zinc-800 text-zinc-400" };
    default:
      return { text: action, className: "bg-zinc-800 text-zinc-400" };
  }
}

function ImportModal({
  modal,
  onClose,
  onViewInvoice,
}: {
  modal: NonNullable<ModalState>;
  onClose: () => void;
  onViewInvoice?: () => void;
}) {
  const isSuccess = modal.kind === "success";
  const result = modal.kind === "success" ? modal.result : null;
  const hasWarnings = result != null && result.errors.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="card max-h-[90vh] w-full max-w-md overflow-y-auto p-6 shadow-xl">
        <div className="flex items-start gap-3">
          {isSuccess && !hasWarnings ? (
            <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-400" aria-hidden />
          ) : (
            <AlertCircle
              className={`h-8 w-8 shrink-0 ${isSuccess ? "text-amber-400" : "text-red-400"}`}
              aria-hidden
            />
          )}
          <div className="flex-1">
            <h2 id="import-modal-title" className="text-lg font-semibold text-zinc-100">
              {modal.kind === "success"
                ? hasWarnings
                  ? "Import completed with warnings"
                  : "Import completed successfully"
                : modal.title}
            </h2>
            {modal.kind === "success" && result ? (
              <div className="mt-3 space-y-2 text-sm text-zinc-300">
                <p>
                  Invoice <strong className="text-zinc-100">{result.invoiceNumber}</strong> was created.
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-zinc-400">
                  <li>{result.projectsCreated} project{result.projectsCreated !== 1 ? "s" : ""} created</li>
                  <li>{result.projectsUpdated} project{result.projectsUpdated !== 1 ? "s" : ""} updated</li>
                  {result.projectsSkipped > 0 && (
                    <li>{result.projectsSkipped} project{result.projectsSkipped !== 1 ? "s" : ""} skipped</li>
                  )}
                  <li>{result.assignmentsAdded} assignment{result.assignmentsAdded !== 1 ? "s" : ""} added</li>
                </ul>
                {hasWarnings && (
                  <ul className="mt-2 max-h-32 overflow-y-auto list-disc pl-5 text-amber-300">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : modal.kind === "error" ? (
              <p className="mt-2 text-sm text-zinc-400">{modal.message}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {isSuccess && result && onViewInvoice && (
            <button type="button" className="btn-primary px-4 py-2" onClick={onViewInvoice}>
              View invoice
            </button>
          )}
          <button type="button" className="btn-secondary px-4 py-2" onClick={onClose}>
            {isSuccess ? "Close" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="flex flex-wrap gap-2 text-sm">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = s.id === current;
        return (
          <li
            key={s.id}
            className={`rounded-full px-3 py-1 ${
              active
                ? "bg-emerald-600 text-white"
                : done
                  ? "bg-zinc-700 text-zinc-300"
                  : "bg-zinc-800/80 text-zinc-500"
            }`}
          >
            {i + 1}. {s.label}
          </li>
        );
      })}
    </ol>
  );
}

export function InvoiceImportWizard({
  suggestedInvoiceNumber,
  defaultCompanyRate,
  fielderRatesNote,
  clients,
}: {
  suggestedInvoiceNumber: string;
  defaultCompanyRate: number | null;
  fielderRatesNote: string;
  clients: ClientOption[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [headerRoles, setHeaderRoles] = useState<Record<string, string>>({});
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const [invoiceNumber, setInvoiceNumber] = useState(suggestedInvoiceNumber);
  const [clientId, setClientId] = useState("");
  const [defaultClientName, setDefaultClientName] = useState("");
  const [ratesHint, setRatesHint] = useState(fielderRatesNote);
  const defaultLocation = "";
  const defaultStatus = "COMPLETED";
  const [syncBatch, setSyncBatch] = useState(true);
  const [projectConflict, setProjectConflict] = useState<"update" | "skip_project" | "skip">("update");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);

  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [previewSummary, setPreviewSummary] = useState<PreviewSummary | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const mapping = useMemo(() => {
    const m: Record<string, string> = {};
    for (const [header, role] of Object.entries(headerRoles)) {
      if (role) m[role] = header;
    }
    return m;
  }, [headerRoles]);

  async function handleFile(file: File) {
    setBannerError(null);
    setModal(null);
    setReviewAcknowledged(false);
    setPreview([]);
    setPreviewSummary(null);
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/invoices/import/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setModal({
          kind: "error",
          title: "Could not read CSV",
          message: data.error ?? "The file could not be parsed. Check that it is a valid CSV export.",
        });
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
      if (data.suggestedClientName) setDefaultClientName(data.suggestedClientName);
      setStep("map");
    } catch {
      setModal({
        kind: "error",
        title: "Upload failed",
        message: "Network error while uploading the file. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  function buildOptions() {
    const selected = clients.find((c) => String(c.id) === clientId);
    return {
      invoiceNumber: invoiceNumber.trim(),
      clientId: clientId ? Number(clientId) : null,
      defaultClientName: (selected?.name ?? defaultClientName.trim()) || "Unknown",
      defaultCompanyRate: defaultCompanyRate ?? 0,
      defaultLocation: defaultLocation.trim(),
      defaultStatus: defaultStatus.trim() || "COMPLETED",
      syncProjectInvoiceNumber: syncBatch,
      projectConflict,
      issueDate,
      dueDate: null,
      notes: null,
    };
  }

  function computeSummary(rows: PreviewRow[]): PreviewSummary {
    let projectsToCreate = 0;
    let projectsToUpdate = 0;
    let projectsSkipped = 0;
    let assignmentsToAdd = 0;
    for (const p of rows) {
      if (p.action === "create_project") projectsToCreate++;
      else if (p.action === "update_project") projectsToUpdate++;
      else if (p.action === "skip_project") projectsSkipped++;
      assignmentsToAdd += p.assignmentsToAdd.length;
    }
    return { projectsToCreate, projectsToUpdate, projectsSkipped, assignmentsToAdd };
  }

  async function runReview() {
    setBannerError(null);
    setModal(null);
    setReviewAcknowledged(false);
    setLoading(true);
    try {
      const res = await fetch("/api/invoices/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers, rows, mapping, options: buildOptions() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModal({
          kind: "error",
          title: "Review could not be built",
          message: data.error ?? "Check column mapping and try again.",
        });
        return;
      }
      const previewRows = data.preview as PreviewRow[];
      setPreview(previewRows);
      setPreviewSummary(computeSummary(previewRows));
      setParseErrors(data.parseErrors ?? []);
      setTotalRevenue(data.totalRevenue ?? 0);
      if (data.companyRatePerSqft != null) {
        setRatesHint(
          `Client invoice will use $${data.companyRatePerSqft}/sqft. Fielder rates: ${data.fielderRatesConfigured ?? 0} name(s) in Settings.`,
        );
      }
      if (data.suggestedInvoiceNumber && !invoiceNumber) {
        setInvoiceNumber(data.suggestedInvoiceNumber);
      }
      if (previewRows.length === 0) {
        setModal({
          kind: "error",
          title: "No projects to import",
          message:
            (data.parseErrors as string[])?.join(" ") ||
            "No valid rows found. Fix mapping or CSV content.",
        });
        return;
      }
      setStep("review");
    } catch {
      setModal({
        kind: "error",
        title: "Review failed",
        message: "Network error. Nothing was changed in the dashboard.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function runImportChanges() {
    if (!reviewAcknowledged) {
      setBannerError("Check the box to confirm you have reviewed the changes below.");
      return;
    }
    setBannerError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/invoices/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers, rows, mapping, options: buildOptions(), filename }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModal({
          kind: "error",
          title: "Import failed",
          message: data.error ?? "Nothing was saved. Fix the issue and try again.",
        });
        return;
      }
      const result = data as ImportResult;
      setImportResult(result);
      setStep("done");
      setModal({ kind: "success", result });
    } catch {
      setModal({
        kind: "error",
        title: "Import failed",
        message: "Network error during import. Check the dashboard — partial changes may need manual review.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <StepIndicator current={step} />

      {bannerError && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-200">
          {bannerError}
        </div>
      )}

      {step === "upload" && (
        <section className="card p-6">
          <h2 className="mb-2 text-base font-semibold text-zinc-100">Upload Project Tracker CSV</h2>
          <p className="mb-3 text-sm text-zinc-400">
            Use the same sheet layout every month (PROJECT ID, SQFT, ADDRESS, FIELDER, QFIELD, ECD, Notes, status columns).
            Upload only reads the file — <strong className="text-zinc-200">nothing is changed</strong> until you review and click{" "}
            <strong className="text-zinc-200">Import changes</strong>.
          </p>
          <p className="mb-4 text-sm text-amber-200/90">{ratesHint}</p>
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
          {loading && <p className="mt-3 text-sm text-zinc-500">Reading file…</p>}
        </section>
      )}

      {step === "map" && (
        <>
          <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400">
            Step 2 of 4 — Adjust column mapping if needed, then continue to <strong className="text-zinc-200">Review changes</strong>.
            Still no data written to the dashboard.
          </div>
          <section className="card p-6 space-y-4">
            <h2 className="text-base font-semibold text-zinc-100">Map columns</h2>
            <p className="text-sm text-zinc-400">
              {rows.length} rows · {filename}. Project Tracker headers are auto-detected.
            </p>
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
            <ClientSelectField
              clients={clients}
              clientId={clientId}
              onClientIdChange={setClientId}
              onClientSelected={(c) => {
                if (c) setDefaultClientName(c.name);
              }}
            />
            <div className="space-y-1">
              <label className="label">Fallback client name (if no column / not selected)</label>
              <input
                className="input h-11 w-full"
                value={defaultClientName}
                onChange={(e) => setDefaultClientName(e.target.value)}
                disabled={!!clientId}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <p className="text-sm text-zinc-400">
                Billing rate: <strong className="text-zinc-200">${defaultCompanyRate ?? "—"}</strong> / sqft{" "}
                <a href="/settings" className="text-emerald-400 hover:underline">Settings</a>
              </p>
            </div>
            <div className="space-y-1">
              <label className="label">Issue date</label>
              <input type="date" className="input h-11 w-full" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="label">When project already exists</label>
              <select
                className="select h-11 w-full"
                value={projectConflict}
                onChange={(e) => setProjectConflict(e.target.value as typeof projectConflict)}
              >
                <option value="update">Update SQFT, client, rate</option>
                <option value="skip_project">Skip project — add fielders only</option>
                <option value="skip">Skip existing projects</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-300 md:col-span-2">
              <input type="checkbox" checked={syncBatch} onChange={(e) => setSyncBatch(e.target.checked)} />
              Tag projects with this invoice number (billing batch)
            </label>
          </section>

          <div className="flex gap-3">
            <button type="button" className="btn-primary px-4 py-2" disabled={loading} onClick={() => void runReview()}>
              {loading ? "Building review…" : "Review changes"}
            </button>
            <button type="button" className="btn-secondary px-4 py-2" onClick={() => setStep("upload")}>
              Back
            </button>
          </div>
        </>
      )}

      {step === "review" && previewSummary && (
        <>
          <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            <strong>Step 3 of 4 — Review only.</strong> Nothing has been imported yet. Check the table below, then click{" "}
            <strong>Import changes</strong> to update the dashboard and create the client invoice.
          </div>

          <section className="card p-6">
            <h2 className="mb-3 text-base font-semibold text-zinc-100">Summary of planned changes</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-lg bg-emerald-950/40 px-3 py-2">
                <dt className="text-zinc-500">New projects</dt>
                <dd className="text-xl font-semibold text-emerald-300">{previewSummary.projectsToCreate}</dd>
              </div>
              <div className="rounded-lg bg-blue-950/40 px-3 py-2">
                <dt className="text-zinc-500">Updates</dt>
                <dd className="text-xl font-semibold text-blue-300">{previewSummary.projectsToUpdate}</dd>
              </div>
              <div className="rounded-lg bg-zinc-800/60 px-3 py-2">
                <dt className="text-zinc-500">Skipped</dt>
                <dd className="text-xl font-semibold text-zinc-300">{previewSummary.projectsSkipped}</dd>
              </div>
              <div className="rounded-lg bg-zinc-800/60 px-3 py-2">
                <dt className="text-zinc-500">New assignments</dt>
                <dd className="text-xl font-semibold text-zinc-200">{previewSummary.assignmentsToAdd}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-zinc-400">
              Client invoice total (est.):{" "}
              <strong className="text-zinc-200">
                ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
              {" · "}
              {preview.length} line{preview.length !== 1 ? "s" : ""}
            </p>
            {parseErrors.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-sm text-amber-300">
                {parseErrors.slice(0, 8).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {parseErrors.length > 8 && <li>…and {parseErrors.length - 8} more row warnings</li>}
              </ul>
            )}
          </section>

          <section className="card overflow-x-auto">
            <table className="table-sticky min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">SQFT</th>
                  <th className="px-3 py-2">Rate</th>
                  <th className="px-3 py-2">Fielders</th>
                  <th className="px-3 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p) => {
                  const badge = actionLabel(p.action);
                  return (
                    <tr key={p.projectCode} className="border-t border-zinc-800">
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${badge.className}`}>
                          {badge.text}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium">{p.projectCode}</td>
                      <td className="px-3 py-2">{p.totalSqft.toLocaleString()}</td>
                      <td className="px-3 py-2">{p.companyRatePerSqft}</td>
                      <td className="px-3 py-2 text-xs">
                        {p.fielders.map((f) => f.name).join(", ") || "—"}
                        {p.assignmentsToAdd.length > 0 && (
                          <span className="mt-1 block text-emerald-400">
                            +{p.assignmentsToAdd.map((a) => a.name).join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-500">{p.message}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <label className="flex items-start gap-3 rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={reviewAcknowledged}
              onChange={(e) => {
                setReviewAcknowledged(e.target.checked);
                if (e.target.checked) setBannerError(null);
              }}
            />
            I have reviewed these changes and want to import them into the dashboard and create the client invoice.
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary px-5 py-2.5"
              disabled={loading || preview.length === 0}
              onClick={() => void runImportChanges()}
            >
              {loading ? "Importing…" : "Import changes"}
            </button>
            <button type="button" className="btn-secondary px-4 py-2" disabled={loading} onClick={() => setStep("map")}>
              Back to mapping
            </button>
          </div>
        </>
      )}

      {step === "done" && importResult && (
        <section className="card p-6 space-y-3">
          <h2 className="text-lg font-semibold text-green-300">Import finished</h2>
          <p className="text-sm text-zinc-400">
            Invoice {importResult.invoiceNumber} · {importResult.projectsCreated} created ·{" "}
            {importResult.projectsUpdated} updated · {importResult.assignmentsAdded} assignments added.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-primary px-4 py-2"
              onClick={() => router.push(`/invoices/${importResult.invoiceId}`)}
            >
              View invoice
            </button>
            <Link href="/projects" className="btn-secondary inline-flex items-center px-4 py-2">
              View projects
            </Link>
          </div>
        </section>
      )}

      {modal && (
        <ImportModal
          modal={modal}
          onClose={() => setModal(null)}
          onViewInvoice={
            modal.kind === "success"
              ? () => router.push(`/invoices/${modal.result.invoiceId}`)
              : undefined
          }
        />
      )}
    </div>
  );
}
