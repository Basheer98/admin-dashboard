import { getAllProjects, getProjectById, getAllAssignmentTemplates, getProjectIssuesByProjectId } from "@/lib/db";
import Link from "next/link";
import { Breadcrumbs } from "@/app/components/Breadcrumbs";
import { ClientNameField } from "./components/ClientNameField";
import { DeleteProjectButton } from "./components/DeleteProjectButton";
import { ArchiveProjectForm } from "./components/ArchiveProjectForm";
import { PROJECT_STATUS_VALUES, getProjectStatusLabel } from "@/lib/projectStatus";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditProjectPage({ params }: PageProps) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const [project, allProjects, templates, issues] = await Promise.all([
    getProjectById(id),
    getAllProjects({ includeArchived: true }),
    getAllAssignmentTemplates(),
    getProjectIssuesByProjectId(id),
  ]);
  const uniqueClientNames = Array.from(
    new Set(allProjects.map((p) => p.clientName).filter(Boolean))
  );

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-900/50">
        <p className="text-sm text-zinc-300">Project not found.</p>
      </div>
    );
  }

  const revenue =
    project.totalSqft * Number(project.companyRatePerSqft);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-900/50">
      <header className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold text-zinc-100">
            Edit project
          </h1>
          <nav className="flex gap-3 text-sm">
            <Link href="/projects" className="text-zinc-300 hover:underline hover:text-zinc-100">
              Back to projects
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-6">
        <Breadcrumbs
          items={[
            { label: "Projects", href: "/projects" },
            { label: project.projectCode },
          ]}
        />
        <section className="card p-6">
          <form
            method="POST"
            action={`/api/projects/${project.id}`}
            className="grid gap-4 md:grid-cols-2"
          >
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-300">
                Project ID
              </label>
              <input
                name="projectCode"
                defaultValue={project.projectCode}
                required
                placeholder="e.g. P.12345"
                className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
              />
              <p className="mt-1 text-sm text-zinc-500">
                Stored with P. prefix (e.g. 12345 → P.12345).
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-300">
                Invoice / billing batch (optional)
              </label>
              <input
                name="invoiceNumber"
                defaultValue={project.invoiceNumber ?? ""}
                placeholder="e.g. 001, 002, Jan-001"
                className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
              />
              <p className="mt-1 text-sm text-zinc-500">
                Group projects by invoice for dashboard and report filters.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-300">
                Client name
              </label>
              <ClientNameField
                uniqueClientNames={uniqueClientNames}
                defaultValue={project.clientName}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-300">
                Address (optional)
              </label>
              <input
                name="location"
                defaultValue={project.location ?? ""}
                placeholder="e.g. 123 Main St, City, State"
                className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
              />
              <p className="mt-1 text-sm text-zinc-500">
                Full address shown to fielders in the app. Tappable to open in maps.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-300">
                Total SQFT
              </label>
              <input
                name="totalSqft"
                type="number"
                min="0"
                step="1"
                defaultValue={project.totalSqft}
                required
                className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-300">
                Company rate per SQFT
              </label>
              <input
                name="companyRatePerSqft"
                type="number"
                min="0"
                step="0.001"
                defaultValue={Number(project.companyRatePerSqft)}
                required
                className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-300">
                QField
              </label>
              <select
                name="qfield"
                defaultValue={project.qfield ?? ""}
                className="w-full h-11 rounded-md border border-zinc-600 px-3 text-base leading-tight text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
              >
                <option value="">Not set</option>
                <option value="Qfield-1">Qfield-1</option>
                <option value="Qfield-2">Qfield-2</option>
              </select>
              <p className="mt-1 text-sm text-zinc-500">
                QField-1 or Qfield-2. Shown to fielders in the app project details.
              </p>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-300">
                Work type (optional)
              </label>
              <input
                name="workType"
                defaultValue={project.workType ?? ""}
                placeholder="e.g. Fiber Verification, OSP Fielding"
                className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-300">
                Status
              </label>
              <select
                name="status"
                defaultValue={project.status}
                className="w-full h-11 rounded-md border border-zinc-600 px-3 text-base leading-tight text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
              >
                {PROJECT_STATUS_VALUES.map((v) => (
                  <option key={v} value={v}>{getProjectStatusLabel(v)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-zinc-300">
                Apply assignment template
              </label>
              <form
                method="POST"
                action="/api/assignment-templates/apply"
                className="flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="projectId" value={project.id} />
                <select
                  name="templateId"
                  className="h-11 rounded-md border border-zinc-600 px-3 py-2 text-base text-zinc-100 bg-zinc-900"
                >
                  <option value="">Select template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="btn-secondary h-11 px-4 py-2 text-sm"
                >
                  Apply
                </button>
              </form>
              <p className="mt-1 text-xs text-zinc-500">
                Manage templates in Settings → Assignment templates.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-300">
                ECD (Estimated Completion Date)
              </label>
              <input
                name="ecd"
                type="date"
                defaultValue={project.ecd ?? ""}
                className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-zinc-300">
                Notes
              </label>
              <textarea
                name="notes"
                rows={3}
                defaultValue={project.notes ?? ""}
                className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-between">
              <p className="text-sm text-zinc-400">
                Project revenue (calculated):{" "}
                <span className="font-medium text-zinc-100">
                  {revenue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </p>
                <button
                  type="submit"
                  className="btn-primary px-6 py-3 text-base"
                >
                  Save changes
                </button>
              </div>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5 no-print">
            <DeleteProjectButton projectId={project.id} />
            <ArchiveProjectForm projectId={project.id} archivedAt={project.archivedAt} />
          </div>
        </section>

        {/* Issues logged by fielders/admins */}
        <section className="card p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-zinc-100">Issues</h2>
            <p className="text-xs text-zinc-500">
              Logged from the fielder app or dashboard. Use this to track and resolve problems on site.
            </p>
          </div>

          {issues.length === 0 ? (
            <p className="text-sm text-zinc-400">No issues have been logged for this project.</p>
          ) : (
            <div className="space-y-3">
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm flex flex-col gap-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-200">
                        {issue.resolvedAt ? "Resolved" : "Open"}
                      </span>
                      <span className="text-xs text-zinc-400">
                        Reported by <span className="font-medium text-zinc-200">{issue.reportedBy}</span>
                        {" · "}
                        {new Date(issue.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {!issue.resolvedAt && (
                      <form
                        method="POST"
                        action={`/api/project-issues/${issue.id}/resolve`}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="projectId" value={project.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
                        >
                          Mark resolved
                        </button>
                      </form>
                    )}
                  </div>
                  <p className="text-zinc-100 whitespace-pre-wrap">{issue.description}</p>
                  {issue.resolvedAt && (
                    <p className="text-xs text-zinc-500 mt-1">
                      Resolved by <span className="font-medium text-zinc-200">{issue.resolvedBy ?? "Unknown"}</span>
                      {" · "}
                      {new Date(issue.resolvedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

