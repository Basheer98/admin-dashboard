import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAssignmentsForFielderByName, getAdditionalWorkForFielderByName } from "@/lib/db";
import { getDueDateStatus } from "@/lib/dueDate";
import { formatCurrency, formatRate } from "@/lib/currency";
import { PrintButton } from "@/app/components/PrintButton";
import Link from "next/link";

export default async function FielderAssignmentsPage() {
  const session = await getSession();
  if (!session || session.role !== "fielder") redirect("/login");

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
        <h2 className="font-display text-xl font-semibold text-slate-900">
          My assignments
        </h2>
        <PrintButton label="Print" />
      </div>

      <div className="card overflow-x-auto">
        <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Invoice</th>
              <th className="px-3 py-2">SQFT</th>
              <th className="px-3 py-2">Rate / SQFT</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Total payout</th>
              <th className="px-3 py-2">Paid</th>
              <th className="px-3 py-2">Pending</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ assignment: a, sqft, totalRequired, paid, pending: rowPending, dueStatus }) => (
              <tr key={a.id} className="border-t text-slate-800">
                <td className="px-3 py-2">
                  {a.project.projectCode}
                  {a.archivedAt && (
                    <span className="ml-2 text-xs text-slate-500">
                      (archived)
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{a.project.invoiceNumber?.trim() ?? "—"}</td>
                <td className="px-3 py-2">{sqft.toLocaleString()}</td>
                <td className="px-3 py-2">
                  {a.isInternal ? "—" : formatRate(Number(a.ratePerSqft))}
                </td>
                <td className="px-3 py-2">
                  {a.dueDate ? (
                    <span className="flex items-center gap-2">
                      {new Date(a.dueDate).toLocaleDateString()}
                      {dueStatus === "overdue" && (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          Overdue
                        </span>
                      )}
                      {dueStatus === "due-soon" && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Due soon
                        </span>
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  {formatCurrency(totalRequired)}
                </td>
                <td className="px-3 py-2">{formatCurrency(paid)}</td>
                <td className="px-3 py-2">{formatCurrency(rowPending)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="text-slate-600">No assignments yet.</p>
      )}

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-slate-900">
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
                  <tr key={w.id} className="border-t text-slate-800">
                    <td className="px-3 py-2">
                      {w.type === "ADDITIONAL_FIELDING" ? "Additional fielding" : "Correction"}
                    </td>
                    <td className="px-3 py-2">{w.projectNumber}</td>
                    <td className="px-3 py-2">
                      {w.project ? w.project.projectCode : "—"}
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
          <p className="text-slate-600">No additional work assigned yet.</p>
        )}
      </section>

      <Link
        href="/fielder"
        className="text-sm text-slate-600 underline hover:text-slate-900"
      >
        ← My statement
      </Link>
    </div>
  );
}
