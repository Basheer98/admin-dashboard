"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { AddProjectForm } from "./AddProjectForm";
import type { FielderAssignmentRow, ProjectRow } from "@/lib/db";

type AddProjectSectionProps = {
  assignments: Array<FielderAssignmentRow & { project: ProjectRow }>;
  uniqueFielderNames: string[];
  uniqueClientNames: string[];
  /** When true, form opens on mount (e.g. from hash #add-project) */
  defaultOpen?: boolean;
};

export function AddProjectSection({
  assignments,
  uniqueFielderNames,
  uniqueClientNames,
  defaultOpen = false,
}: AddProjectSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#add-project") {
      setOpen(true);
    }
  }, []);

  return (
    <section id="add-project" className="card p-6 no-print">
      {open ? (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Add project
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
          </div>
          <AddProjectForm
            assignments={assignments}
            uniqueFielderNames={uniqueFielderNames}
            uniqueClientNames={uniqueClientNames}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-600 py-8 text-sm font-medium text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200 transition-colors"
        >
          <Plus className="h-5 w-5" strokeWidth={2} />
          Add project
        </button>
      )}
    </section>
  );
}
