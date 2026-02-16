import { getAllProjects, getProjectById, getAllAssignmentTemplates } from "@/lib/db";
import Link from "next/link";
import { Breadcrumbs } from "@/app/components/Breadcrumbs";
import { ClientNameField } from "./components/ClientNameField";
import { DeleteProjectButton } from "./components/DeleteProjectButton";
import { ArchiveProjectForm } from "./components/ArchiveProjectForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditProjectPage({ params }: PageProps) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const [project, allProjects, templates] = await Promise.all([
    getProjectById(id),
    getAllProjects({ includeArchived: true }),
    getAllAssignmentTemplates(),
  ]);
  const uniqueClientNames = Array.from(
    new Set(allProjects.map((p) => p.clientName).filter(Boolean))
  );

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-700">Project not found.</p>
      </div>
    );
  }

  const revenue =
    project.totalSqft * Number(project.companyRatePerSqft);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-900">
            Edit project
          </h1>
          <nav className="flex gap-3 text-sm">
            <Link href="/projects" className="text-slate-700 hover:underline hover:text-slate-900">
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
              <label className="block text-sm font-medium text-slate-700">
                Project ID
              </label>
              <input
                name="projectCode"
                defaultValue={project.projectCode}
                required
                placeholder="e.g. P.12345"
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
              <p className="mt-1 text-sm text-slate-500">
                Stored with P. prefix (e.g. 12345 → P.12345).
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Invoice / billing batch (optional)
              </label>
              <input
                name="invoiceNumber"
                defaultValue={project.invoiceNumber ?? ""}
                placeholder="e.g. 001, 002, Jan-001"
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
              <p className="mt-1 text-sm text-slate-500">
                Group projects by invoice for dashboard and report filters.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Client name
              </label>
              <ClientNameField
                uniqueClientNames={uniqueClientNames}
                defaultValue={project.clientName}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Location (optional)
              </label>
              <input
                name="location"
                defaultValue={project.location ?? ""}
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Total SQFT
              </label>
              <input
                name="totalSqft"
                type="number"
                min="0"
                step="1"
                defaultValue={project.totalSqft}
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
                defaultValue={Number(project.companyRatePerSqft)}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                QField
              </label>
              <select
                name="qfield"
                defaultValue={project.qfield ?? ""}
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
              <label className="block text-sm font-medium text-slate-700">
                Status
              </label>
              <select
                name="status"
                defaultValue={project.status}
                className="w-full h-11 rounded-md border border-slate-300 px-3 text-base leading-tight text-black focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="NOT_STARTED">Not started</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
              <p className="mt-1 text-sm text-slate-500">
                In progress when fielders are assigned; Completed when done.
              </p>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
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
                  className="h-11 rounded-md border border-slate-300 px-3 py-2 text-base text-black bg-white"
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
              <p className="mt-1 text-xs text-slate-500">
                Manage templates in Settings → Assignment templates.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                ECD (Estimated Completion Date)
              </label>
              <input
                name="ecd"
                type="date"
                defaultValue={project.ecd ?? ""}
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                name="notes"
                rows={3}
                defaultValue={project.notes ?? ""}
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Project revenue (calculated):{" "}
                <span className="font-medium text-slate-900">
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
      </main>
    </div>
  );
}

