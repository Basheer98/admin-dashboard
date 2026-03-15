import { getAllProjects, getAssignmentsWithDetails } from "@/lib/db";
import { getDueDateStatus } from "@/lib/dueDate";
import { formatCurrency, formatRate } from "@/lib/currency";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import Link from "next/link";
import { AssignmentForm } from "./components/AssignmentForm";
import { EmptyState } from "@/app/components/EmptyState";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function AssignmentsPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const showArchived = sp.archived === "1";
  const unarchived = sp.unarchived === "1";
  const saved = sp.saved === "1" || sp.success === "1";
  const assignmentId = typeof sp.assignmentId === "string" ? sp.assignmentId : "";
  const projectId = typeof sp.projectId === "string" ? sp.projectId : "";
  const showLogPaymentLink = saved && assignmentId && projectId;
  const filterName = typeof sp.name === "string" ? sp.name.trim() : "";
  const filterProject = typeof sp.project === "string" ? sp.project : "";

  const [projects, assignments] = await Promise.all([
    getAllProjects(),
    getAssignmentsWithDetails({ includeArchived: showArchived }),
  ]);
  let assignmentsFiltered = showArchived
    ? assignments.filter((a) => a.archivedAt)
    : assignments;
  if (filterName) {
    assignmentsFiltered = assignmentsFiltered.filter((a) =>
      a.fielderName.toLowerCase().includes(filterName.toLowerCase()),
    );
  }
  if (filterProject) {
    assignmentsFiltered = assignmentsFiltered.filter(
      (a) => String(a.projectId) === filterProject,
    );
  }

  const hasProjects = projects.length > 0;

  return (
    <SidebarLayout title="Fielders" current="assignments">
      <div className="flex flex-1 flex-col gap-8">
        {showLogPaymentLink && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Assignment saved.{" "}
            <Link
              href={`/payments?projectId=${projectId}&assignmentId=${assignmentId}`}
              className="font-medium underline hover:no-underline"
            >
              Log a payment for this fielder
            </Link>
            .
          </div>
        )}
        {unarchived && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Assignment unarchived.
          </div>
        )}
        <div className="flex items-center gap-3">
          {showArchived ? (
            <Link
              href="/assignments"
              className="text-sm font-medium text-zinc-300 underline hover:text-zinc-100"
            >
              ← Back to active fielders
            </Link>
          ) : (
            <Link
              href="/assignments?archived=1"
              className="text-sm font-medium text-zinc-300 underline hover:text-zinc-100"
            >
              View archived assignments
            </Link>
          )}
        </div>
        <section className="card p-6">
          <h2 className="mb-3 text-base font-semibold text-zinc-100">
            Filter fielders
          </h2>
          <form method="get" action="/assignments" className="flex flex-wrap items-end gap-3">
            {showArchived && <input type="hidden" name="archived" value="1" />}
            <div className="space-y-1">
              <label className="label">Fielder name</label>
              <input
                type="text"
                name="name"
                defaultValue={filterName}
                placeholder="Filter by name"
                className="input h-11 w-48"
              />
            </div>
            <div className="space-y-1">
              <label className="label">Project</label>
              <select
                name="project"
                defaultValue={filterProject}
                className="select w-48"
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode} – {p.clientName}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary h-11 px-4 py-2">
              Apply
            </button>
            {(filterName || filterProject) && (
              <Link
                href={showArchived ? "/assignments?archived=1" : "/assignments"}
                className="btn-secondary inline-flex h-11 items-center px-4 py-2"
              >
                Clear filter
              </Link>
            )}
          </form>
        </section>

        {!showArchived && (
          <section id="assign" className="card p-6">
            <h2 className="mb-4 text-base font-semibold text-zinc-100">
              Assign fielder to project
            </h2>

            {!hasProjects ? (
              <p className="text-base text-zinc-400">
                Add a project first before assigning fielders.
              </p>
            ) : (
              <AssignmentForm projects={projects} assignments={assignments} />
            )}
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">
            {showArchived ? "Archived assignments" : "Fielder assignments"}
          </h2>
          {assignmentsFiltered.length === 0 ? (
            <EmptyState
              title={showArchived ? "No archived assignments" : "No fielder assignments yet"}
              description={showArchived ? "Archived assignments will appear here." : "Assign fielders to projects to track payouts and commissions."}
              action={!showArchived ? { href: "/assignments#assign", label: "Assign fielder" } : undefined}
            />
          ) : (
          <div className="card overflow-x-auto">
            <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Fielder</th>
                  <th className="px-3 py-2 text-left">Project</th>
                  <th className="px-3 py-2 text-left">Invoice</th>
                  <th className="px-3 py-2 text-right">Rate / SQFT</th>
                  <th className="px-3 py-2 text-right">Commission %</th>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-right">Total payout</th>
                  <th className="px-3 py-2 text-right">Total paid</th>
                  <th className="px-3 py-2 text-right">Pending</th>
                  <th className="px-3 py-2 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {assignmentsFiltered.map((a) => {
                  const sqft = a.project.totalSqft;
                  const workerRate = Number(a.ratePerSqft);

                  let totalPayoutBase = 0;
                  let totalRequired = 0;
                  let managerInfo = null;

                  if (a.isInternal) {
                    totalPayoutBase = 0;
                    totalRequired = 0;
                  } else if (a.managedByFielderId && a.managerRatePerSqft) {
                    // Managed assignment: company pays worker (e.g. Naveen) worker rate directly; manager gets commission separately
                    const managerRate = Number(a.managerRatePerSqft);
                    const managerCommission = (managerRate - workerRate) * sqft;
                    const managerShare = a.managerCommissionShare
                      ? Number(a.managerCommissionShare)
                      : 0;
                    const companyShare = managerCommission * managerShare;
                    const managerNetCommission = managerCommission - companyShare;

                    totalPayoutBase = workerRate * sqft;
                    totalRequired = workerRate * sqft;

                    const managerAssignment = assignments.find(
                      (m) => m.id === a.managedByFielderId,
                    );
                    managerInfo = managerAssignment
                      ? {
                          name: managerAssignment.fielderName,
                          rate: managerRate,
                          netCommission: managerNetCommission,
                          companyShare,
                        }
                      : null;
                  } else {
                    // Direct assignment
                    totalPayoutBase = workerRate * sqft;
                    const commissionFraction = a.commissionPercentage
                      ? Number(a.commissionPercentage)
                      : 0;
                    const commissionAmount = totalPayoutBase * commissionFraction;
                    totalRequired = totalPayoutBase + commissionAmount;
                  }

                  const totalPaid = a.payments.reduce(
                    (sum, p) => sum + Number(p.amount),
                    0,
                  );

                  const pending = a.isInternal ? 0 : Math.max(totalRequired - totalPaid, 0);
                  const dueStatus = getDueDateStatus(a.dueDate ?? null);

                  return (
                    <tr key={a.id} className="border-t border-zinc-700/50 text-zinc-200">
                      <td className="px-3 py-2">
                        {a.fielderName}
                        {a.isInternal && (
                          <span className="ml-2 text-sm text-zinc-500">
                            (owner/company)
                          </span>
                        )}
                        {a.archivedAt && (
                          <span className="ml-2 text-xs text-zinc-500">
                            (archived)
                          </span>
                        )}
                        {managerInfo && (
                          <span className="ml-2 text-sm text-zinc-500">
                            (managed by {managerInfo.name})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/projects/${a.projectId}`}
                          className="font-medium text-emerald-400 hover:underline"
                        >
                          {a.project.projectCode}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{a.project.invoiceNumber?.trim() ?? "—"}</td>
                      <td className="px-3 py-2">
                        {a.isInternal ? "-" : formatRate(workerRate)}
                        {managerInfo && (
                          <span className="block text-sm text-zinc-500">
                            Manager: {formatRate(managerInfo.rate)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {a.isInternal
                          ? "-"
                          : managerInfo
                          ? `${(managerInfo.companyShare / (managerInfo.rate * sqft - workerRate * sqft)) * 100}%`
                          : a.commissionPercentage
                            ? `${Number(a.commissionPercentage) * 100}%`
                            : "0"}
                      </td>
                      <td className="px-3 py-2">
                        {a.dueDate ? (
                          <span className="flex items-center gap-2">
                            {new Date(a.dueDate).toLocaleDateString()}
                            {dueStatus === "overdue" && (
                              <span className="rounded-md bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                                Overdue
                              </span>
                            )}
                            {dueStatus === "due-soon" && (
                              <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                                Due soon
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="cell-numeric px-3 py-2">
                        {formatCurrency(totalRequired)}
                      </td>
                      <td className="cell-numeric px-3 py-2">
                        {formatCurrency(totalPaid)}
                      </td>
                      <td className="cell-numeric px-3 py-2">
                        {formatCurrency(pending)}
                      </td>
                      <td className="px-3 py-2 flex flex-wrap gap-2">
                        <Link
                          href={`/assignments/${a.id}`}
                          className="link-action link-action-edit"
                        >
                          Edit
                        </Link>
                        {!showArchived && (
                          <Link
                            href={`/payments?projectId=${a.projectId}&assignmentId=${a.id}`}
                            className="link-action link-action-payment"
                          >
                            Log payment
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </section>
      </div>
    </SidebarLayout>
  );
}

