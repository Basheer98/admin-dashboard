import { getAllAdditionalWork, getAllAssignments } from "@/lib/db";
import { formatCurrency } from "@/lib/currency";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { EmptyState } from "@/app/components/EmptyState";
import Link from "next/link";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function AdditionalWorkPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const filterType = typeof sp.type === "string" ? sp.type : "";
  const success = sp.success === "1";

  const [all, assignments] = await Promise.all([
    getAllAdditionalWork(),
    getAllAssignments({ includeArchived: true }),
  ]);
  const assignmentNameById = Object.fromEntries(
    assignments.map((a) => [a.id, a.fielderName]),
  );
  const items = filterType
    ? all.filter((w) => w.type === filterType)
    : all;

  return (
    <SidebarLayout title="Additional work" current="additional">
      <div className="flex flex-1 flex-col gap-6">
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Additional work saved.
          </div>
        )}
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <form method="get" action="/additional-work" className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="label">Type</label>
                <select
                  name="type"
                  defaultValue={filterType}
                  className="select h-11 w-40"
                >
                  <option value="">All</option>
                  <option value="ADDITIONAL_FIELDING">Additional fielding</option>
                  <option value="CORRECTION">Correction</option>
                </select>
              </div>
              <button type="submit" className="btn-primary h-11 px-4 py-2">
                Filter
              </button>
            </form>
            <Link href="/additional-work/new" className="btn-primary inline-block px-4 py-2.5">
              Add additional fielding / correction
            </Link>
          </div>
        </div>

        {items.length > 0 ? (
        <section className="card overflow-x-auto">
          <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Project #</th>
                <th className="px-3 py-2">Our project?</th>
                <th className="px-3 py-2">Assigned to</th>
                <th className="px-3 py-2">Distance</th>
                <th className="px-3 py-2">Rate (job)</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
                {items.map((w) => (
                  <tr key={w.id} className="border-b border-zinc-700">
                    <td className="px-3 py-2">
                      <span
                        className={
                          w.type === "CORRECTION"
                            ? "rounded bg-amber-100 px-1.5 py-0.5 text-amber-800"
                            : "rounded bg-blue-100 px-1.5 py-0.5 text-blue-800"
                        }
                      >
                        {w.type === "CORRECTION" ? "Correction" : "Additional fielding"}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{w.projectNumber}</td>
                    <td className="px-3 py-2">{w.ourProjectId ? "Yes" : "—"}</td>
                    <td className="px-3 py-2">
                      {w.assignedFielderAssignmentId
                        ? assignmentNameById[w.assignedFielderAssignmentId] ?? "—"
                        : "—"}
                    </td>
                    <td className="px-3 py-2">{w.distance != null ? w.distance : "—"}</td>
                    <td className="px-3 py-2">{w.rateForEntireJob != null ? formatCurrency(w.rateForEntireJob) : "—"}</td>
                    <td className="px-3 py-2">{w.amount != null ? formatCurrency(w.amount) : "—"}</td>
                    <td className="px-3 py-2">{w.status}</td>
                    <td className="px-3 py-2">{w.dueDate ? w.dueDate.slice(0, 10) : "—"}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/additional-work/${w.id}`}
                        className="text-zinc-300 underline hover:text-zinc-100"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
        ) : (
          <EmptyState
            title="No additional work yet"
            description="Track additional fielding jobs or corrections for your projects or external references."
            action={{ label: "Add additional fielding / correction", href: "/additional-work/new" }}
          />
        )}
      </div>
    </SidebarLayout>
  );
}
