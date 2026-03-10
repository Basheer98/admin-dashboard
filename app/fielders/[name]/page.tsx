import { getAssignmentsWithDetails } from "@/lib/db";
import { getDueDateStatus } from "@/lib/dueDate";
import { formatCurrency, formatRate } from "@/lib/currency";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { Breadcrumbs } from "@/app/components/Breadcrumbs";
import { PrintButton } from "@/app/components/PrintButton";
import Link from "next/link";

type PageProps = {
  params: Promise<{ name: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function FielderReportPage({ params, searchParams }: PageProps) {
  const { name: encodedName } = await params;
  const sp = searchParams ? await searchParams : {};
  const success = sp.success === "1";
  const error = typeof sp.error === "string" ? sp.error : null;
  const fielderNameFromUrl = decodeURIComponent(encodedName);
  const fielderNameNormalized = fielderNameFromUrl.trim().toUpperCase();

  const assignments = await getAssignmentsWithDetails({ includeArchived: true });
  const fielderAssignments = assignments.filter(
    (a) => a.fielderName.trim().toUpperCase() === fielderNameNormalized,
  );

  // Map assignment id -> fielder name so we can find who is the manager for managed assignments
  const assignmentIdToFielderName = new Map(
    assignments.map((a) => [a.id, a.fielderName.trim().toUpperCase()]),
  );

  // Manager commissions owed to this fielder (from assignments where they manage other workers)
  let managerCommissionOwed = 0;
  for (const a of assignments) {
    if (!a.managedByFielderId || !a.managerRatePerSqft || a.isInternal) continue;
    const managerName = assignmentIdToFielderName.get(a.managedByFielderId);
    if (managerName !== fielderNameNormalized) continue;
    const sqft = a.project.totalSqft;
    const workerRate = Number(a.ratePerSqft);
    const managerRate = Number(a.managerRatePerSqft);
    const managerCommission = (managerRate - workerRate) * sqft;
    const managerShare = a.managerCommissionShare
      ? Number(a.managerCommissionShare)
      : 0;
    const companyShare = managerCommission * managerShare;
    const managerNetCommission = managerCommission - companyShare;
    managerCommissionOwed += managerNetCommission;
  }

  const displayName = fielderNameNormalized || fielderNameFromUrl;

  if (fielderAssignments.length === 0 && managerCommissionOwed <= 0) {
    return (
      <SidebarLayout title="Fielder report" current="fielders" backLink={{ href: "/fielders", label: "Fielder reports" }}>
        <Breadcrumbs items={[{ label: "Fielder reports", href: "/fielders" }, { label: displayName }]} />
        <p className="mt-4 text-zinc-400">
          No assignments found for fielder &quot;{displayName}&quot;.
        </p>
        <Link href="/fielders" className="mt-2 inline-block text-sm underline">
          Back to fielder reports
        </Link>
      </SidebarLayout>
    );
  }

  const rows = fielderAssignments.map((a) => {
    const sqft = a.project.totalSqft;
    const workerRate = Number(a.ratePerSqft);
    const internalValue =
      a.isInternal && workerRate > 0 ? workerRate * sqft : 0;

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
      internalValue,
    };
  });

  const totalSqft = rows.reduce((s, r) => s + r.sqft, 0);
  const totalOwedFromAssignments = rows.reduce(
    (s, r) => s + r.totalRequired,
    0,
  );
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const internalWorkValue = rows.reduce((s, r) => s + r.internalValue, 0);

  const totalOwed = totalOwedFromAssignments + managerCommissionOwed;
  const pending = Math.max(totalOwed - totalPaid, 0);

  return (
    <SidebarLayout title={`Fielder statement: ${displayName}`} current="fielders" backLink={{ href: "/fielders", label: "Fielder reports" }} headerAction={<PrintButton label="Print statement" />}>
      <div className="flex flex-1 flex-col gap-8 print-content">
        <Breadcrumbs items={[{ label: "Fielder reports", href: "/fielders" }, { label: displayName }]} />
        <div className="no-print flex items-center justify-between gap-4">
          <Link
            href="/fielders"
            className="text-sm text-zinc-300 underline hover:text-zinc-100"
          >
            ← Back to fielder reports
          </Link>
        </div>

        {success && (
          <div className="no-print rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Payment logged. Remaining owed: {formatCurrency(Math.max(pending, 0))}.
          </div>
        )}
        {error === "invalid" && (
          <div className="no-print rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Invalid payment details. Please check amount, date, and method.
          </div>
        )}
        {error === "no-pending" && (
          <div className="no-print rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This fielder has no pending balance to pay.
          </div>
        )}
        {error === "amount-exceeds" && (
          <div className="no-print rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Payment amount cannot exceed pending balance ({formatCurrency(pending)}).
          </div>
        )}

        <section className={`card grid gap-4 p-6 ${internalWorkValue > 0 || managerCommissionOwed > 0 ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
          <div>
            <p className="text-sm font-medium text-zinc-500">Total SQFT</p>
            <p className="mt-1 text-xl font-semibold text-zinc-100">
              {totalSqft.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Total owed</p>
            <p className="mt-1 text-xl font-semibold text-zinc-100">
              {formatCurrency(totalOwed)}
            </p>
            {managerCommissionOwed > 0 && (
              <p className="mt-1 text-xs text-zinc-500">
                {formatCurrency(totalOwedFromAssignments)} from assignments + {formatCurrency(managerCommissionOwed)} manager commissions
              </p>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Total paid</p>
            <p className="mt-1 text-xl font-semibold text-zinc-100">
              {formatCurrency(totalPaid)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Pending</p>
            <p className="mt-1 text-xl font-semibold text-zinc-100">
              {formatCurrency(pending)}
            </p>
          </div>
          {internalWorkValue > 0 && (
            <div>
              <p className="text-sm font-medium text-zinc-500">Owner / internal work value</p>
              <p className="mt-1 text-xl font-semibold text-zinc-100">
                {formatCurrency(internalWorkValue)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Value of your internal work (not a payout)
              </p>
            </div>
          )}
        </section>

        {pending > 0 && (
          <section className="card no-print p-6">
            <h2 className="mb-2 text-base font-semibold text-zinc-100">
              Log payment
            </h2>
            <p className="mb-4 text-sm text-zinc-400">
              Company owes this fielder {formatCurrency(pending)}. Enter the amount you paid; it will be applied to reduce the balance (oldest assignments first).
            </p>
            <form
              method="POST"
              action={`/api/fielders/${encodeURIComponent(encodedName)}/payments`}
              className="grid gap-4 md:grid-cols-2"
            >
              <div className="space-y-1">
                <label className="label">Amount</label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={pending}
                  required
                  placeholder={pending.toFixed(2)}
                  className="input"
                />
                <p className="text-xs text-zinc-500">Max: {formatCurrency(pending)}</p>
              </div>
              <div className="space-y-1">
                <label className="label">Currency</label>
                <select name="currency" required className="select">
                  <option value="USD">USD</option>
                  <option value="INR">INR</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="label">Payment method</label>
                <select name="method" required className="select">
                  <option value="BANK">BANK</option>
                  <option value="WISE">WISE</option>
                  <option value="CASH">CASH</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="label">Payment date</label>
                <input
                  name="paymentDate"
                  type="date"
                  required
                  className="input"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="label">Notes / reference (optional)</label>
                <input name="notes" type="text" className="input" placeholder="Optional" />
              </div>
              <div className="md:col-span-2">
                <button type="submit" className="btn-primary px-5 py-2.5">
                  Save payment
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">
            All assignments
          </h2>
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
                  <th className="px-3 py-2 no-print"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ assignment: a, sqft, totalRequired, paid, pending: rowPending, dueStatus }) => (
                  <tr key={a.id} className="border-t text-zinc-200">
                    <td className="px-3 py-2">
                      {a.project.projectCode}
                      {a.archivedAt && (
                        <span className="ml-2 text-xs text-zinc-500">
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
                    <td className="px-3 py-2">
                      {formatCurrency(paid)}
                    </td>
                    <td className="px-3 py-2">
                      {formatCurrency(rowPending)}
                    </td>
                    <td className="no-print px-3 py-2">
                      <Link
                        href={`/assignments/${a.id}`}
                        className="text-zinc-300 underline hover:text-zinc-100"
                      >
                        Edit
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
