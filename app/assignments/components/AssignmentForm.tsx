"use client";

import { useState } from "react";
import type { ProjectRow, FielderAssignmentRow } from "@/lib/db";

type AssignmentFormProps = {
  projects: ProjectRow[];
  assignments: Array<FielderAssignmentRow & { project: ProjectRow }>;
};

export function AssignmentForm({ projects, assignments }: AssignmentFormProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [hasManager, setHasManager] = useState(false);
  const [isInternal, setIsInternal] = useState(false);

  const managerOptions = assignments;

  return (
    <form method="POST" action="/api/assignments" className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          Project
        </label>
        <select
          name="projectId"
          required
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full h-11 rounded-md border border-slate-300 px-3 text-base leading-tight text-black focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        >
          <option value="">Select project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.projectCode} – {p.clientName}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          Fielder name
        </label>
        <input
          name="fielderName"
          required
          placeholder="e.g. Naveen"
          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        />
        <p className="mt-1 text-sm text-slate-500">
          Stored in uppercase so Naveen and naveen are the same.
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          Rate per SQFT {isInternal && "(optional – for tracking owner earnings)"}
        </label>
        <input
          name="ratePerSqft"
          type="number"
          min="0"
          step="0.001"
          required={!isInternal}
          placeholder={isInternal ? "e.g. 0.02 for owner work value" : undefined}
          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        />
        {isInternal && (
          <p className="mt-1 text-sm text-slate-500">
            Optional. Used to show &quot;Owner earnings&quot; / internal work value on your report.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          Commission %
        </label>
        <input
          name="commissionPercentage"
          type="number"
          min="0"
          step="0.01"
          placeholder="Optional"
          disabled={isInternal || hasManager}
          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white disabled:bg-slate-100 disabled:text-slate-500"
        />
      </div>

      <div className="space-y-1 md:col-span-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isInternal"
            checked={isInternal}
            onChange={(e) => {
              const next = e.target.checked;
              setIsInternal(next);
              if (next) setHasManager(false);
            }}
            className="rounded border-slate-300"
          />
          <span className="text-sm font-medium text-slate-700">
            Owner / company work (no payout)
          </span>
        </label>
        <p className="mt-1 text-sm text-slate-500">
          Use this for Basheer (owner) or any internal work that should not count
          as a payout/pending payment.
        </p>
      </div>

      <div className="space-y-1 md:col-span-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hasManager}
            onChange={(e) => setHasManager(e.target.checked)}
            className="rounded border-slate-300"
            disabled={isInternal}
          />
          <span className="text-sm font-medium text-slate-700">
            This fielder is managed by another fielder
          </span>
        </label>
      </div>

      {hasManager ? (
        <>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">
              Managed by
            </label>
            <select
              name="managedByFielderId"
              required={hasManager}
              className="w-full h-11 rounded-md border border-slate-300 px-3 text-base leading-tight text-black focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              <option value="">Select manager</option>
              {managerOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fielderName}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-slate-500">
              Select the fielder who manages this one (e.g., Nivas manages Naveen)
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">
              Manager rate per SQFT
            </label>
            <input
              name="managerRatePerSqft"
              type="number"
              min="0"
              step="0.001"
              required={hasManager}
              placeholder="e.g., 0.025"
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            />
            <p className="mt-1 text-sm text-slate-500">
              Worker rate + manager commission per SQFT. E.g. worker 0.020, manager commission 0.005 → enter 0.025. Company pays worker 0.020; the 0.005 is split by the % below.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">
              Company keeps % of manager commission
            </label>
            <input
              name="managerCommissionShare"
              type="number"
              min="0"
              max="100"
              step="0.01"
              required={hasManager}
              placeholder="e.g., 50"
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            />
            <p className="mt-1 text-sm text-slate-500">
              E.g. 50 = company keeps 50%, manager gets the other 50%.
            </p>
          </div>
        </>
      ) : (
        <>
          <input type="hidden" name="managedByFielderId" value="" />
          <input type="hidden" name="managerRatePerSqft" value="" />
          <input type="hidden" name="managerCommissionShare" value="" />
        </>
      )}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          Due date (optional)
        </label>
        <input
          name="dueDate"
          type="date"
          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        />
      </div>

      <div className="md:col-span-2">
        <button
          type="submit"
          className="btn-primary mt-2 px-5 py-2.5"
        >
          Save assignment
        </button>
      </div>
    </form>
  );
}
