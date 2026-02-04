import { getAssignmentsWithDetails } from "@/lib/db";
import { getDueDateStatus } from "@/lib/dueDate";
import { formatCurrency, formatRate } from "@/lib/currency";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { Breadcrumbs } from "@/app/components/Breadcrumbs";
import { PrintButton } from "@/app/components/PrintButton";
import Link from "next/link";

type PageProps = {
  params: Promise<{ name: string }>;
};

export default async function FielderReportPage({ params }: PageProps) {
  const { name: encodedName } = await params;
  const fielderNameFromUrl = decodeURIComponent(encodedName);
  const fielderNameNormalized = fielderNameFromUrl.trim().toUpperCase();

  const assignments = await getAssignmentsWithDetails({ includeArchived: true });
  const fielderAssignments = assignments.filter(
    (a) => a.fielderName.trim().toUpperCase() === fielderNameNormalized,
  );

  const displayName = fielderNameNormalized || fielderNameFromUrl;

  if (fielderAssignments.length === 0) {
    return (
      <SidebarLayout title="Fielder report" current="fielders" backLink={{ href: "/fielders", label: "Fielder reports" }}>
        <Breadcrumbs items={[{ label: "Fielder reports", href: "/fielders" }, { label: displayName }]} />
        <p className="mt-4 text-slate-600">
          No assignments found for fielder &quot;{displayName}&quot;.
        </p>
        <Link href="/fielders" className="mt-2 inline-block text-sm underline">
          Back to fielder reports
        </Link>
      </SidebarLayout>
    );
  }

  let totalOwed = 0;
  let totalPaid = 0;
  let internalWorkValue = 0;
  let totalSqft = 0;

  const rows = fielderAssignments.map((a) => {
    const sqft = a.project.totalSqft;
    totalSqft += sqft;
    const workerRate = Number(a.ratePerSqft);

    if (a.isInternal && workerRate > 0) {
      internalWorkValue += workerRate * sqft;
    }

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

    totalOwed += totalRequired;
    totalPaid += paid;

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

  const pending = Math.max(totalOwed - totalPaid, 0);

  return (
    <SidebarLayout title={`Fielder statement: ${displayName}`} current="fielders" backLink={{ href: "/fielders", label: "Fielder reports" }} headerAction={<PrintButton label="Print statement" />}>
      <div className="flex flex-1 flex-col gap-8 print-content">
        <Breadcrumbs items={[{ label: "Fielder reports", href: "/fielders" }, { label: displayName }]} />
        <div className="no-print flex items-center justify-between gap-4">
          <Link
            href="/fielders"
            className="text-sm text-slate-700 underline hover:text-slate-900"
          >
            ← Back to fielder reports
          </Link>
        </div>

        <section className={`card grid gap-4 p-6 ${internalWorkValue > 0 ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
          <div>
            <p className="text-sm font-medium text-slate-500">Total SQFT</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {totalSqft.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total owed</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {formatCurrency(totalOwed)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total paid</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {formatCurrency(totalPaid)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Pending</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {formatCurrency(pending)}
            </p>
          </div>
          {internalWorkValue > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-500">Owner / internal work value</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {formatCurrency(internalWorkValue)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Value of your internal work (not a payout)
              </p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            All assignments
          </h2>
          <div className="card overflow-x-auto">
            <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">SQFT</th>
                  <th className="px-3 py-2">Rate / SQFT</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="px-3 py-2">Total payout</th>
                  <th className="px-3 py-2">Paid</th>
                  <th className="px-3 py-2">Pending</th>
                  <th className="px-3 py-2 no-print"></th>
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
                    <td className="px-3 py-2">
                      {formatCurrency(paid)}
                    </td>
                    <td className="px-3 py-2">
                      {formatCurrency(rowPending)}
                    </td>
                    <td className="no-print px-3 py-2 flex flex-wrap gap-2">
                      <Link
                        href={`/assignments/${a.id}`}
                        className="text-slate-700 underline hover:text-slate-900"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/payments?projectId=${a.projectId}&assignmentId=${a.id}`}
                        className="text-slate-700 underline hover:text-slate-900"
                      >
                        Log payment
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SidebarLayout>
  );
}
