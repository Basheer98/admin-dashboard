import {
  getAllProjects,
  getAssignmentsWithDetails,
  getPaymentsWithDetails,
} from "@/lib/db";
import { formatCurrency } from "@/lib/currency";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { FilterChips } from "@/app/components/FilterChips";
import { PrintButton } from "@/app/components/PrintButton";
import { VoidPaymentButton } from "@/app/payments/components/VoidPaymentButton";
import Link from "next/link";

function inDateRange(
  dateStr: string,
  from: string | null,
  to: string | null,
): boolean {
  if (!from && !to) return true;
  const d = dateStr.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function PaymentsPage({ searchParams }: PageProps) {
  const [projects, assignments, allPayments] = await Promise.all([
    getAllProjects(),
    getAssignmentsWithDetails(),
    getPaymentsWithDetails({ includeVoided: true }),
  ]);

  const sp = searchParams ? await searchParams : {};
  const prefillProjectId = typeof sp.projectId === "string" ? sp.projectId : "";
  const prefillAssignmentId = typeof sp.assignmentId === "string" ? sp.assignmentId : "";
  const from = typeof sp.from === "string" && sp.from ? sp.from : null;
  const to = typeof sp.to === "string" && sp.to ? sp.to : null;
  const filterProjectId = typeof sp.project === "string" && sp.project ? sp.project : "";
  const filterFielder = typeof sp.fielder === "string" ? sp.fielder.trim() : "";
  const hasDateFilter = Boolean(from || to);
  const hasProjectFilter = filterProjectId !== "";
  const hasFielderFilter = filterFielder !== "";
  const hasAnyFilter = hasDateFilter || hasProjectFilter || hasFielderFilter;
  const voided = sp.voided === "1";
  const voidError = typeof sp.void === "string" ? sp.void : "";
  let payments = allPayments;
  if (hasDateFilter) {
    payments = payments.filter((p) => inDateRange(p.paymentDate, from, to));
  }
  if (hasProjectFilter) {
    payments = payments.filter((p) => String(p.projectId) === filterProjectId);
  }
  if (hasFielderFilter) {
    const fielderLower = filterFielder.toLowerCase();
    payments = payments.filter((p) =>
      p.assignment.fielderName.toLowerCase().includes(fielderLower),
    );
  }

  const totalPaid = payments
    .filter((p) => !p.voidedAt)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const hasData = projects.length > 0 && assignments.length > 0;

  const projectLabel =
    filterProjectId && projects.find((p) => String(p.id) === filterProjectId)
      ? `${projects.find((p) => String(p.id) === filterProjectId)!.projectCode} – ${projects.find((p) => String(p.id) === filterProjectId)!.clientName}`
      : filterProjectId;
  const paymentFilterChips = hasAnyFilter
    ? [
        from && { key: "from", label: "From", value: from },
        to && { key: "to", label: "To", value: to },
        hasProjectFilter && { key: "project", label: "Project", value: projectLabel },
        hasFielderFilter && { key: "fielder", label: "Fielder", value: filterFielder },
      ].filter(Boolean) as { key: string; label: string; value: string }[]
    : [];
  const paymentPreserveParams: Record<string, string> = {
    ...(from && { from }),
    ...(to && { to }),
    ...(filterProjectId && { project: filterProjectId }),
    ...(filterFielder && { fielder: filterFielder }),
    ...(prefillProjectId && { projectId: prefillProjectId }),
    ...(prefillAssignmentId && { assignmentId: prefillAssignmentId }),
  };

  return (
    <SidebarLayout title="Payments" current="payments" headerAction={<PrintButton />}>
      <div className="flex flex-1 flex-col gap-8">
        {voided && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Payment voided. It is hidden from totals but remains in the activity log.
          </div>
        )}
        {voidError === "already" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            That payment is already voided.
          </div>
        )}
        {voidError === "notfound" && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Payment not found.
          </div>
        )}
        <section className="card no-print p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Log payment
          </h2>

          {!hasData ? (
            <p className="text-base text-slate-600">
              Add at least one project and one fielder assignment before logging
              payments.
            </p>
          ) : (
            <form method="POST" action="/api/payments" className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 md:col-span-1">
                <label className="label">
                  Project
                </label>
                <select
                  name="projectId"
                  required
                  defaultValue={prefillProjectId}
                  className="select"
                >
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectCode} – {p.clientName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 md:col-span-1">
                <label className="label">
                  Fielder assignment
                </label>
                <select
                  name="fielderAssignmentId"
                  required
                  defaultValue={prefillAssignmentId}
                  className="select"
                >
                  <option value="">Select fielder</option>
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.fielderName}
                      {a.isInternal ? " (owner)" : ""} – {a.project.projectCode}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="label">
                  Amount
                </label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="input"
                />
              </div>

              <div className="space-y-1">
                <label className="label">
                  Currency
                </label>
                <select
                  name="currency"
                  required
                  className="select"
                >
                  <option value="USD">USD</option>
                  <option value="INR">INR</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="label">
                  Payment method
                </label>
                <select
                  name="method"
                  required
                  className="select"
                >
                  <option value="BANK">BANK</option>
                  <option value="WISE">WISE</option>
                  <option value="CASH">CASH</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="label">
                  Payment date
                </label>
                <input
                  name="paymentDate"
                  type="date"
                  required
                  className="input"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="label">
                  Notes / reference number
                </label>
                <input
                  name="notes"
                  type="text"
                  className="input"
                  placeholder="Optional"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="mt-2 btn-primary mt-2 px-5 py-2.5"
                >
                  Save payment
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="card no-print p-6">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Filters
          </h2>
          <form method="get" action="/payments" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="projectId" value={prefillProjectId} />
            <input type="hidden" name="assignmentId" value={prefillAssignmentId} />
            <div className="space-y-1">
              <label className="label">From</label>
              <input
                type="date"
                name="from"
                defaultValue={from ?? ""}
                className="input h-11"
              />
            </div>
            <div className="space-y-1">
              <label className="label">To</label>
              <input
                type="date"
                name="to"
                defaultValue={to ?? ""}
                className="input h-11"
              />
            </div>
            <div className="space-y-1">
              <label className="label">Project</label>
              <select
                name="project"
                defaultValue={filterProjectId}
                className="select h-11 w-48"
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode} – {p.clientName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="label">Fielder</label>
              <input
                type="text"
                name="fielder"
                defaultValue={filterFielder}
                placeholder="Filter by name"
                className="input h-11 w-48"
              />
            </div>
            <button type="submit" className="btn-primary h-11 px-4 py-2">
              Apply
            </button>
            {hasAnyFilter && (
              <Link
                href={prefillProjectId || prefillAssignmentId ? `/payments?projectId=${prefillProjectId}&assignmentId=${prefillAssignmentId}` : "/payments"}
                className="btn-secondary h-11 px-4 py-2"
              >
                Clear filter
              </Link>
            )}
          </form>
          {hasAnyFilter && (
            <p className="mt-2 text-sm text-slate-500">
              {hasDateFilter && `Date: ${from ?? "start"} – ${to ?? "end"}`}
              {hasDateFilter && (hasProjectFilter || hasFielderFilter) && " · "}
              {hasProjectFilter && `Project: ${projectLabel}`}
              {hasProjectFilter && hasFielderFilter && " · "}
              {hasFielderFilter && `Fielder: ${filterFielder}`}
            </p>
          )}
        </section>

        {hasAnyFilter && (
          <FilterChips
            chips={paymentFilterChips}
            basePath="/payments"
            preserveParams={paymentPreserveParams}
            className="no-print"
          />
        )}
        <section className="space-y-3 print-content">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Recent payments
              </h2>
              <p className="text-sm text-slate-600">
                Total paid{hasAnyFilter ? " (filtered)" : ""} (excl. voided): {formatCurrency(totalPaid)}
              </p>
            </div>
            <a
              href="/api/export/payments"
              download
              className="btn-secondary no-print"
            >
              Export CSV
            </a>
          </div>
          <div className="card overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Fielder</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Currency</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2 no-print"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className={`border-t border-slate-200 text-slate-800 ${p.voidedAt ? "bg-slate-50 text-slate-500" : ""}`}>
                    <td className="px-3 py-2">
                      {new Date(p.paymentDate).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">{p.project.projectCode}</td>
                    <td className="px-3 py-2">
                      {p.assignment.fielderName}
                      {p.voidedAt && (
                        <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                          Voided
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {formatCurrency(Number(p.amount))}
                    </td>
                    <td className="px-3 py-2">{p.currency}</td>
                    <td className="px-3 py-2">{p.method}</td>
                    <td className="px-3 py-2">{p.notes}</td>
                    <td className="no-print px-3 py-2">
                      {!p.voidedAt && (
                        <VoidPaymentButton paymentId={p.id} />
                      )}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-4 text-center text-slate-500"
                    >
                      No payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SidebarLayout>
  );
}

