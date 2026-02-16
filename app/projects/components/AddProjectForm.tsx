"use client";

import { useState } from "react";
import type { FielderAssignmentRow, ProjectRow } from "@/lib/db";

const MAX_FIELDER_ROWS = 20;

type AddProjectFormProps = {
  assignments: Array<FielderAssignmentRow & { project: ProjectRow }>;
  uniqueFielderNames: string[];
  uniqueClientNames: string[];
};

export function AddProjectForm({
  assignments,
  uniqueFielderNames,
  uniqueClientNames,
}: AddProjectFormProps) {
  const [fielderRows, setFielderRows] = useState(2);
  const [clientChoice, setClientChoice] = useState<string>("");

  return (
    <form method="POST" action="/api/projects" className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">Project ID</label>
        <input
          name="projectCode"
          required
          placeholder="e.g. 12345 or P.12345"
          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        />
        <p className="mt-1 text-sm text-slate-500">
          Starts with P by default (e.g. 12345 → P.12345).
        </p>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">Client name</label>
        <select
          name="clientChoice"
          value={clientChoice}
          onChange={(e) => setClientChoice(e.target.value)}
          className="w-full h-11 rounded-md border border-slate-300 px-3 text-base leading-tight text-black focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        >
          <option value="">New client</option>
          {uniqueClientNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {clientChoice === "" && (
          <input
            name="newClientName"
            type="text"
            required
            placeholder="Enter new client name"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
          />
        )}
        <p className="mt-1 text-sm text-slate-500">
          Pick an existing client or choose &quot;New client&quot; to enter a new one.
        </p>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">Location (optional)</label>
        <input
          name="location"
          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">Total SQFT</label>
        <input
          name="totalSqft"
          type="number"
          min="0"
          step="1"
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          Company rate per SQFT
        </label>
        <input
          name="companyRatePerSqft"
          type="number"
          min="0"
          step="0.001"
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">QField</label>
        <select
          name="qfield"
          className="w-full h-11 rounded-md border border-slate-300 px-3 text-base leading-tight text-black focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        >
          <option value="">Not set</option>
          <option value="Qfield-1">Qfield-1</option>
          <option value="Qfield-2">Qfield-2</option>
        </select>
        <p className="mt-1 text-sm text-slate-500">
          Which QField this project is stored in.
        </p>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">Status</label>
        <select
          name="status"
          className="w-full h-11 rounded-md border border-slate-300 px-3 text-base leading-tight text-black focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
          defaultValue="NOT_STARTED"
        >
          <option value="NOT_STARTED">Not started</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          ECD (Estimated Completion Date)
        </label>
        <input
          name="ecd"
          type="date"
          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        />
        <p className="mt-1 text-sm text-slate-500">
          Optional. Mark as In progress when you assign fielders; mark Completed when done.
        </p>
      </div>
      <div className="space-y-1 md:col-span-2">
        <label className="block text-sm font-medium text-slate-700">Notes</label>
        <textarea
          name="notes"
          rows={2}
          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        />
      </div>

      <div className="md:col-span-2 mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Assign fielders (optional)
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Add one or more fielders for this project. Leave name blank to skip a row.
            </p>
          </div>
          {fielderRows < MAX_FIELDER_ROWS && (
            <button
              type="button"
              onClick={() => setFielderRows((n) => Math.min(n + 1, MAX_FIELDER_ROWS))}
              className="btn-secondary"
            >
              + Add row
            </button>
          )}
        </div>

        <div className="mt-4 space-y-4">
          {Array.from({ length: fielderRows }, (_, i) => (
            <FielderRow
              key={i}
              index={i}
              assignments={assignments}
              uniqueFielderNames={uniqueFielderNames}
            />
          ))}
        </div>
      </div>

      <div className="md:col-span-2">
        <button
          type="submit"
          className="btn-primary mt-2 px-6 py-3 text-base"
        >
          Save project
        </button>
      </div>
    </form>
  );
}

function FielderRow({
  index,
  assignments,
  uniqueFielderNames,
}: {
  index: number;
  assignments: Array<FielderAssignmentRow & { project: ProjectRow }>;
  uniqueFielderNames: string[];
}) {
  const prefix = `assignedFielder_${index}_`;
  const [hasManager, setHasManager] = useState(false);
  const [isInternal, setIsInternal] = useState(false);

  return (
    <div className="rounded border border-slate-200 bg-white p-4 grid gap-4 md:grid-cols-2">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">Fielder name (stored uppercase)</label>
        <input
          name={`${prefix}name`}
          list={`fielderNames-${index}`}
          placeholder="e.g. Nivas"
          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        />
        <datalist id={`fielderNames-${index}`}>
          {uniqueFielderNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          Rate per SQFT {isInternal && "(optional – owner earnings)"}
        </label>
        <input
          name={`${prefix}rate`}
          type="number"
          min="0"
          step="0.001"
          placeholder={isInternal ? "e.g. 0.02" : "e.g. 0.025"}
          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">Commission %</label>
        <input
          name={`${prefix}commission`}
          type="number"
          min="0"
          step="0.01"
          disabled={isInternal || hasManager}
          placeholder="Optional"
          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white disabled:bg-slate-100 disabled:text-slate-500"
        />
      </div>
      <div className="space-y-1 md:col-span-2 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name={`${prefix}isInternal`}
            checked={isInternal}
            onChange={(e) => {
              setIsInternal(e.target.checked);
              if (e.target.checked) setHasManager(false);
            }}
            className="rounded border-slate-300"
          />
          <span className="text-sm font-medium text-slate-700">Owner / company (no payout)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hasManager}
            onChange={(e) => setHasManager(e.target.checked)}
            disabled={isInternal}
            className="rounded border-slate-300"
          />
          <span className="text-sm font-medium text-slate-700">Managed by another fielder</span>
        </label>
      </div>
      {hasManager && (
        <>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Managed by</label>
            <select
              name={`${prefix}managedBy`}
              className="w-full h-11 rounded-md border border-slate-300 px-3 text-base leading-tight text-black focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              <option value="">Select manager</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fielderName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Manager rate per SQFT</label>
            <input
              name={`${prefix}managerRate`}
              type="number"
              min="0"
              step="0.001"
              placeholder="e.g. 0.025"
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            />
            <p className="mt-1 text-xs text-slate-500">
              Worker rate + manager commission per SQFT. E.g. Naveen 0.020, Nivas commission 0.005 → enter 0.025. Company pays worker 0.020; the 0.005 is split by the % below.
            </p>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">
              Company keeps % of manager commission
            </label>
            <input
              name={`${prefix}managerShare`}
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="e.g. 50"
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            />
            <p className="mt-1 text-xs text-slate-500">
              E.g. 50 = company keeps 50% of the manager commission, manager (Nivas) gets the other 50%.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
