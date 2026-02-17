import { getAllProjects, getAllPayments, getPaymentsWithDetails, getSettings } from "@/lib/db";
import { formatCurrency, formatWithInr } from "@/lib/currency";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { PrintButton } from "@/app/components/PrintButton";

function monthStartEnd(monthKey: string): { start: string; end: string } {
  const [y, m] = monthKey.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function MonthlySummaryPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const monthParam = typeof sp.month === "string" ? sp.month : "";

  const [allProjects, allPayments, paymentsWithDetails, settings] = await Promise.all([
    getAllProjects(),
    getAllPayments(),
    getPaymentsWithDetails(),
    getSettings(),
  ]);
  const showInr = settings.usdToInrRate != null;

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthKey = monthParam || defaultMonth;

  const { start, end } = monthStartEnd(monthKey);
  const monthLabel = new Date(monthKey + "-01").toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const projectsInMonth = allProjects.filter((p) => {
    const d = p.createdAt.slice(0, 10);
    return d >= start && d <= end;
  });
  const paymentsInMonth = allPayments.filter((p) => {
    const d = p.paymentDate.slice(0, 10);
    return d >= start && d <= end;
  });

  const revenue = projectsInMonth.reduce(
    (sum, p) => sum + p.totalSqft * Number(p.companyRatePerSqft),
    0,
  );
  const payouts = paymentsInMonth.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const profit = revenue - payouts;

  const paymentsWithDetailsInMonth = paymentsWithDetails.filter((p) => {
    const d = p.paymentDate.slice(0, 10);
    return d >= start && d <= end;
  });

  return (
    <SidebarLayout title="Monthly summary" current="reports-monthly" headerAction={<PrintButton />}>
      <div className="flex flex-1 flex-col gap-8">
        <section className="card no-print p-6">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Select month
          </h2>
          <form method="get" action="/reports/monthly" className="flex items-end gap-3">
            <div className="space-y-1">
              <label className="label">Month</label>
              <input
                type="month"
                name="month"
                defaultValue={monthKey}
                className="input h-11"
              />
            </div>
            <button type="submit" className="btn-primary h-11 px-4 py-2">
              Show
            </button>
          </form>
        </section>

        <div className="card print-content p-6 print:shadow-none">
          <h1 className="text-xl font-bold text-slate-900">
            Monthly summary — {monthLabel}
          </h1>
          <p className="mt-1 text-sm text-slate-500 no-print">
            Revenue from projects created this month; payouts from payments recorded this month.
          </p>

          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Revenue</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {showInr
                  ? formatWithInr(revenue, { showInr: true })
                  : `$${formatCurrency(revenue)}`}
              </p>
              <p className="text-xs text-slate-500">(projects created in {monthLabel})</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Payouts</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {showInr
                  ? formatWithInr(payouts, { showInr: true })
                  : `$${formatCurrency(payouts)}`}
              </p>
              <p className="text-xs text-slate-500">(payments in {monthLabel})</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Profit</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {showInr
                  ? formatWithInr(profit, { showInr: true })
                  : `$${formatCurrency(profit)}`}
              </p>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-base font-semibold text-slate-900">
              Projects created in {monthLabel}
            </h2>
            <div className="mt-2 overflow-x-auto">
              <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {projectsInMonth.map((p) => {
                    const rev = p.totalSqft * Number(p.companyRatePerSqft);
                    return (
                      <tr key={p.id} className="border-t text-slate-800">
                        <td className="px-3 py-2">{p.projectCode}</td>
                        <td className="px-3 py-2">{p.clientName}</td>
                        <td className="px-3 py-2">{p.invoiceNumber?.trim() ?? "—"}</td>
                        <td className="px-3 py-2">{formatCurrency(rev)}</td>
                      </tr>
                    );
                  })}
                  {projectsInMonth.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-slate-500">
                        None
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-base font-semibold text-slate-900">
              Payments in {monthLabel}
            </h2>
            <div className="mt-2 overflow-x-auto">
              <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2">Fielder</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Currency</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsWithDetailsInMonth.map((p) => (
                    <tr key={p.id} className="border-t text-slate-800">
                      <td className="px-3 py-2">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">{p.project.projectCode}</td>
                      <td className="px-3 py-2">{p.project.invoiceNumber?.trim() ?? "—"}</td>
                      <td className="px-3 py-2">{p.assignment.fielderName}</td>
                      <td className="px-3 py-2">{formatCurrency(Number(p.amount))}</td>
                      <td className="px-3 py-2">{p.currency}</td>
                    </tr>
                  ))}
                  {paymentsWithDetailsInMonth.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-slate-500">
                        None
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mt-6 text-xs text-slate-500">
            Generated {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </SidebarLayout>
  );
}
