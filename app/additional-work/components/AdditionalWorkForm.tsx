"use client";

import { useState } from "react";

type LookupAssignment = { id: number; fielderName: string };
type LookupProject = {
  id: number;
  projectCode: string;
  clientName: string;
  status: string;
  ecd: string | null;
};

type AdditionalWorkFormProps = {
  /** For add: no initial data. For edit: existing row + optional project + assignments. */
  mode: "add" | "edit";
  initialType?: "ADDITIONAL_FIELDING" | "CORRECTION";
  initialProjectNumber?: string;
  initialOurProjectId?: number | null;
  initialAssignedFielderAssignmentId?: number | null;
  initialDistance?: number | null;
  initialRateForEntireJob?: number | null;
  initialAmount?: number | null;
  initialDueDate?: string | null;
  initialCompletedAt?: string | null;
  initialStatus?: string;
  initialNotes?: string | null;
  /** Pre-fetched for edit: project and assignments when ourProjectId is set */
  prefetchedProject?: LookupProject | null;
  prefetchedAssignments?: LookupAssignment[];
  action: string;
  submitLabel: string;
};

export function AdditionalWorkForm({
  mode,
  initialType = "ADDITIONAL_FIELDING",
  initialProjectNumber = "",
  initialOurProjectId = null,
  initialAssignedFielderAssignmentId = null,
  initialDistance = null,
  initialRateForEntireJob = null,
  initialAmount = null,
  initialDueDate = null,
  initialCompletedAt = null,
  initialStatus = "NOT_STARTED",
  initialNotes = null,
  prefetchedProject = null,
  prefetchedAssignments = [],
  action,
  submitLabel,
}: AdditionalWorkFormProps) {
  void mode; // reserved for future use (e.g. conditional edit-only fields)
  void initialOurProjectId; // used by parent for prefetch key; form uses lookup state
  const [type, setType] = useState<"ADDITIONAL_FIELDING" | "CORRECTION">(initialType);
  const [projectNumber, setProjectNumber] = useState(initialProjectNumber);
  const [lookupProject, setLookupProject] = useState<LookupProject | null>(prefetchedProject);
  const [lookupAssignments, setLookupAssignments] = useState<LookupAssignment[]>(prefetchedAssignments);
  const [lookupLoading, setLookupLoading] = useState(false);

  async function doLookup() {
    const code = projectNumber.trim();
    if (!code) {
      setLookupProject(null);
      setLookupAssignments([]);
      return;
    }
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/additional-work/lookup?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      setLookupProject(data.project ?? null);
      setLookupAssignments(data.assignments ?? []);
    } catch {
      setLookupProject(null);
      setLookupAssignments([]);
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <form method="POST" action={action} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">Type</label>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as "ADDITIONAL_FIELDING" | "CORRECTION")}
          className="w-full h-11 rounded-md border border-zinc-600 px-3 text-base leading-tight text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
        >
          <option value="ADDITIONAL_FIELDING">Additional fielding</option>
          <option value="CORRECTION">Correction</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">Project number</label>
        <div className="flex gap-2">
          <input
            name="projectNumber"
            type="text"
            required
            value={projectNumber}
            onChange={(e) => setProjectNumber(e.target.value)}
            onBlur={doLookup}
            placeholder="e.g. P.12345 or external ref"
            className="flex-1 rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
          />
          <button
            type="button"
            onClick={doLookup}
            disabled={lookupLoading}
            className="rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-900/50 disabled:opacity-50"
          >
            {lookupLoading ? "…" : "Look up"}
          </button>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Enter our project code or an external reference. Use Look up to see who did the project (for corrections).
        </p>
      </div>

      {lookupProject && (
        <div className="md:col-span-2 rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="text-sm font-semibold text-green-900">Our project</h3>
          <p className="mt-1 text-sm text-green-800">
            {lookupProject.projectCode} – {lookupProject.clientName} – {lookupProject.status}
            {lookupProject.ecd ? ` – ECD: ${lookupProject.ecd.slice(0, 10)}` : ""}
          </p>
          {lookupAssignments.length > 0 && (
            <p className="mt-1 text-sm text-green-800">
              Completed by: {lookupAssignments.map((a) => a.fielderName).join(", ")}
            </p>
          )}
        </div>
      )}

      {type === "CORRECTION" && lookupAssignments.length > 0 && (
        <div className="space-y-1 md:col-span-2">
          <label className="block text-sm font-medium text-zinc-300">Assign correction to fielder</label>
          <select
            name="assignedFielderAssignmentId"
            defaultValue={initialAssignedFielderAssignmentId ?? ""}
            className="w-full h-11 rounded-md border border-zinc-600 px-3 text-base leading-tight text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
          >
            <option value="">— Select fielder —</option>
            {lookupAssignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fielderName}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-zinc-500">
            Who did the original work (for follow-up on this correction).
          </p>
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">Distance</label>
        <input
          name="distance"
          type="number"
          min="0"
          step="0.01"
          defaultValue={initialDistance ?? ""}
          placeholder="Optional"
          className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">Rate for entire job</label>
        <input
          name="rateForEntireJob"
          type="number"
          min="0"
          step="0.001"
          defaultValue={initialRateForEntireJob ?? ""}
          placeholder="Optional"
          className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">Amount</label>
        <input
          name="amount"
          type="number"
          min="0"
          step="0.01"
          defaultValue={initialAmount ?? ""}
          placeholder="Optional"
          className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">Due date</label>
        <input
          name="dueDate"
          type="date"
          defaultValue={initialDueDate?.slice(0, 10) ?? ""}
          className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">Completed at</label>
        <input
          name="completedAt"
          type="date"
          defaultValue={initialCompletedAt?.slice(0, 10) ?? ""}
          className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">Status</label>
        <select
          name="status"
          defaultValue={initialStatus}
          className="w-full h-11 rounded-md border border-zinc-600 px-3 text-base leading-tight text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
        >
          <option value="NOT_STARTED">NOT STARTED</option>
          <option value="IN_PROGRESS">IN PROGRESS</option>
          <option value="COMPLETED">COMPLETED</option>
        </select>
      </div>

      <div className="space-y-1 md:col-span-2">
        <label className="block text-sm font-medium text-zinc-300">Notes</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={initialNotes ?? ""}
          className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
        />
      </div>

      <div className="md:col-span-2">
        <button
          type="submit"
          className="btn-primary px-5 py-2.5"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
