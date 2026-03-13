import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAssignmentsForFielderByName, getAdditionalWorkForFielderByName } from "@/lib/db";
import { getDueDateStatus } from "@/lib/dueDate";
import { formatCurrency, formatRate } from "@/lib/currency";
import { getProjectStatusLabel, PROJECT_STATUS_VALUES } from "@/lib/projectStatus";
import { PrintButton } from "@/app/components/PrintButton";
import Link from "next/link";

export default async function FielderAssignmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | undefined }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "fielder") redirect("/login");

  const sp = searchParams ? await searchParams : {};
  const saved = sp.saved === "1";
  const issueSaved = sp.issue === "logged";
  const errorMsg = sp.error;

  const fielderName = session.fielderName;
  const [fielderAssignments, additionalWork] = await Promise.all([
    getAssignmentsForFielderByName(fielderName),
    getAdditionalWorkForFielderByName(fielderName),
  ]);

  const rows = fielderAssignments.map((a) => {
    const sqft = a.project.totalSqft;
    const workerRate = Number(a.ratePerSqft);
    let totalRequired = 0;
    if (!a.isInternal) {
      if (a.managedByFielderId && a.managerRatePerSqft) {
        totalRequired = workerRate * sqft;
      } else {
        const base = workerRate * sqft;
        const commission = a.commissionPercentage
          ? base * Number(a.commissionPercentage)
          : 0;
        totalRequired = base + commission;
      }
    }
    const paid = a.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const pending = a.isInternal ? 0 : Math.max(totalRequired - paid, 0);
    const dueStatus = getDueDateStatus(a.dueDate ?? null);
    return {
      assignment: a,
      sqft,
      totalRequired,
      paid,
      pending,
      dueStatus,
    };
  });

  return (
    <div className="flex flex-1 flex-col gap-6 print-content">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-semibold text-zinc-100">
          My assignments
        </h2>
        <PrintButton label="Print" />
      </div>

      {saved && (
        <div className="rounded-2xl border border-emerald-500/40 bg-zinc-900 px-5 py-4 text-sm font-semibold text-emerald-300 shadow-lg">
          Status updated successfully.
        </div>
      )}
      {issueSaved && (
        <div className="rounded-2xl border border-amber-500/40 bg-zinc-900 px-5 py-4 text-sm font-semibold text-amber-300 shadow-lg">
          Issue logged. Project has been moved to In Progress.
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg border border-red-500/40 bg-zinc-900 px-4 py-3 text-sm text-red-400">
          {errorMsg === "unauthorized" ? "You are not assigned to that project." : "Something went wrong. Please try again."}
        </div>
      )}

      <div className="space-y-4">
        {rows.map(({ assignment: a, sqft, totalRequired, pending: rowPending, dueStatus }) => (
          <div key={a.id} className="card p-5 space-y-4">
            {/* Project header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="font-semibold text-emerald-400 text-base">{a.project.projectCode}</span>
                <span className="ml-2 text-zinc-400 text-sm">{a.project.clientName}</span>
                {a.project.location && (
                  <span className="ml-2 text-zinc-500 text-sm">· {a.project.location}</span>
                )}
                {a.project.workType && (
                  <span className="ml-2 text-zinc-500 text-sm">· {a.project.workType}</span>
                )}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                a.project.status === "COMPLETED"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : a.project.status === "SUBMITTED"
                  ? "bg-blue-500/20 text-blue-300"
                  : a.project.status === "IN_PROGRESS"
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-zinc-700 text-zinc-300"
              }`}>
                {getProjectStatusLabel(a.project.status)}
              </span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
              <div>
                <p className="text-zinc-500">SQFT</p>
                <p className="font-medium text-zinc-100">{sqft.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-zinc-500">Rate / SQFT</p>
                <p className="font-medium text-zinc-100">{a.isInternal ? "—" : formatRate(Number(a.ratePerSqft))}</p>
              </div>
              <div>
                <p className="text-zinc-500">Total payout</p>
                <p className="font-medium text-zinc-100">{formatCurrency(totalRequired)}</p>
              </div>
              <div>
                <p className="text-zinc-500">Pending</p>
                <p className="font-medium text-zinc-100">{formatCurrency(rowPending)}</p>
              </div>
            </div>

            {a.dueDate && (
              <p className="text-sm text-zinc-400">
                Due: {new Date(a.dueDate).toLocaleDateString()}
                {dueStatus === "overdue" && (
                  <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Overdue</span>
                )}
                {dueStatus === "due-soon" && (
                  <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Due soon</span>
                )}
              </p>
            )}

            {a.archivedAt && (
              <p className="text-xs text-zinc-500">(archived)</p>
            )}

            {/* Actions */}
            {!a.archivedAt && (
              <div className="flex flex-wrap gap-4 border-t border-zinc-700/50 pt-4">
                {/* Status update */}
                <form method="POST" action={`/api/projects/${a.project.id}/status`} className="flex items-center gap-2">
                  <select
                    name="status"
                    defaultValue={a.project.status}
                    className="h-9 rounded-md border border-zinc-600 bg-zinc-900 px-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  >
                    {PROJECT_STATUS_VALUES.map((v) => (
                      <option key={v} value={v}>{getProjectStatusLabel(v)}</option>
                    ))}
                  </select>
                  <button type="submit" className="btn-secondary h-9 px-3 text-sm">
                    Update status
                  </button>
                </form>

                {/* Issue logging */}
                <details className="group">
                  <summary className="cursor-pointer list-none text-sm font-medium text-amber-400 hover:text-amber-300 select-none">
                    + Log an issue
                  </summary>
                  <form
                    method="POST"
                    action={`/api/projects/${a.project.id}/issues`}
                    className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
                  >
                    <textarea
                      name="description"
                      required
                      rows={2}
                      placeholder="Describe the issue…"
                      className="w-full min-w-[240px] rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                    />
                    <button type="submit" className="h-9 shrink-0 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 text-sm font-medium text-amber-300 hover:bg-amber-500/20 transition-colors">
                      Submit issue
                    </button>
                  </form>
                </details>
              </div>
            )}
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="text-zinc-400">No assignments yet.</p>
      )}

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-zinc-100">
          Additional work assigned to me
        </h3>
        {additionalWork.length > 0 ? (
          <div className="card overflow-x-auto">
            <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Project #</th>
                  <th className="px-3 py-2">Our project</th>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Due</th>
                </tr>
              </thead>
              <tbody>
                {additionalWork.map((w) => (
                  <tr key={w.id} className="border-t text-zinc-200">
                    <td className="px-3 py-2">
                      {w.type === "ADDITIONAL_FIELDING" ? "Additional fielding" : "Correction"}
                    </td>
                    <td className="px-3 py-2">{w.projectNumber}</td>
                    <td className="px-3 py-2">
                      {w.project ? (
                        <span className="font-medium text-emerald-400">{w.project.projectCode}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">{w.project?.invoiceNumber?.trim() ?? "—"}</td>
                    <td className="px-3 py-2">
                      {w.amount != null ? formatCurrency(w.amount) : "—"}
                    </td>
                    <td className="px-3 py-2">{w.status}</td>
                    <td className="px-3 py-2">
                      {w.dueDate ? new Date(w.dueDate).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-zinc-400">No additional work assigned yet.</p>
        )}
      </section>

      <Link
        href="/fielder"
        className="text-sm text-zinc-400 underline hover:text-zinc-100"
      >
        ← My statement
      </Link>
    </div>
  );
}
