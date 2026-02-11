import { getAllAssignmentTemplates, getAllAssignments } from "@/lib/db";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { AddAssignmentTemplateForm } from "./AddAssignmentTemplateForm";
import Link from "next/link";

export default async function AssignmentTemplatesSettingsPage() {
  const [templates, assignments] = await Promise.all([
    getAllAssignmentTemplates(),
    getAllAssignments({ includeArchived: true }),
  ]);
  const uniqueFielderNames = Array.from(
    new Set(assignments.map((a) => a.fielderName).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <SidebarLayout title="Assignment templates" current="settings">
      <div className="flex flex-1 flex-col gap-8">
        <p className="text-sm text-slate-600">
          Save common fielder + rate + manager setups, then apply them to new
          projects in one click.
        </p>

        <section className="card p-6">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Existing templates
          </h2>
          {templates.length === 0 ? (
            <p className="text-sm text-slate-500">
              No templates yet. Create your first one below.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-sticky table-hover min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Rows</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className="border-t text-slate-800">
                      <td className="px-3 py-2 font-medium">{t.name}</td>
                      <td className="px-3 py-2">{t.items.length}</td>
                      <td className="px-3 py-2">
                        {new Date(t.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <form
                          method="POST"
                          action={`/api/assignment-templates/${t.id}/delete`}
                          onSubmit={(e) => {
                            if (
                              !confirm(
                                `Delete template "${t.name}"? This cannot be undone.`,
                              )
                            ) {
                              e.preventDefault();
                            }
                          }}
                          className="inline"
                        >
                          <button
                            type="submit"
                            className="text-sm text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card p-6">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Add template
          </h2>
          <AddAssignmentTemplateForm uniqueFielderNames={uniqueFielderNames} />
        </section>

        <div className="no-print flex gap-3 text-sm">
          <Link
            href="/projects"
            className="text-slate-600 underline hover:text-slate-900"
          >
            ← Back to projects
          </Link>
        </div>
      </div>
    </SidebarLayout>
  );
}

