import {
  getAllProjects,
  getAllAssignments,
  getAllPayments,
  getAssignmentsWithDetails,
  getPaymentsWithDetails,
  getSettings,
} from "@/lib/db";
import { getDueDateStatus, getProjectEcdStatus } from "@/lib/dueDate";
import { getProjectStatusLabel, PROJECT_STATUS_VALUES } from "@/lib/projectStatus";
import { formatCurrency, formatWithInr } from "@/lib/currency";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import Link from "next/link";
import { RevenueVsPayoutsChart } from "@/app/components/charts/RevenueVsPayoutsChart";
import { PayoutsByFielderChart } from "@/app/components/charts/PayoutsByFielderChart";
import { SqftByFielderChart } from "@/app/components/charts/SqftByFielderChart";

export const dynamic = "force-dynamic";

type MonthlyRow = {
  monthKey: string;
  label: string;
  revenue: number;
  payouts: number;
  profit: number;
};

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

function getDatePreset(preset: "last7" | "thisMonth" | "lastQuarter") {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  if (preset === "last7") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
  }
  if (preset === "thisMonth") {
    const from = `${y}-${pad(m + 1)}-01`;
    const to = today.toISOString().slice(0, 10);
    return { from, to };
  }
  // last quarter: 3 months ago to today
  const from = new Date(y, m - 2, 1);
  return { from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

function DatePresetLink({
  from,
  to,
  label,
  hasDateFilter,
  currentFrom,
  currentTo,
  filterStatus,
  filterInvoice,
}: {
  from: string;
  to: string;
  label: string;
  hasDateFilter: boolean;
  currentFrom: string | null;
  currentTo: string | null;
  filterStatus?: string | null;
  filterInvoice?: string | null;
}) {
  const isActive = hasDateFilter && currentFrom === from && currentTo === to;
  const statusQ = filterStatus ? `&status=${encodeURIComponent(filterStatus)}` : "";
  const invoiceQ = filterInvoice ? `&invoice=${encodeURIComponent(filterInvoice)}` : "";
  return (
    <Link
      href={`/?from=${from}&to=${to}${statusQ}${invoiceQ}`}
      className={`rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
        isActive
          ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
          : "bg-white/80 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
      }`}
    >
      {label}
    </Link>
  );
}

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function Home({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const from =
    typeof sp.from === "string" && sp.from ? sp.from : null;
  const to =
    typeof sp.to === "string" && sp.to ? sp.to : null;
  const filterStatus = typeof sp.status === "string" && sp.status ? sp.status : null;
  const filterInvoice = typeof sp.invoice === "string" && sp.invoice ? sp.invoice.trim() : null;
  const hasDateFilter = Boolean(from || to);
  const hasStatusFilter = Boolean(filterStatus);
  const hasInvoiceFilter = Boolean(filterInvoice);

  const [allProjects, allPayments, assignments, assignmentsWithDetails, settings, paymentsWithDetails] = await Promise.all([
    getAllProjects(),
    getAllPayments(),
    getAllAssignments(),
    getAssignmentsWithDetails(),
    getSettings(),
    getPaymentsWithDetails(),
  ]);
  let projects = hasDateFilter
    ? allProjects.filter((p) => inDateRange(p.createdAt, from, to))
    : allProjects;
  if (hasStatusFilter) {
    projects = projects.filter((p) => p.status === filterStatus);
  }
  if (hasInvoiceFilter) {
    projects = projects.filter((p) => (p.invoiceNumber ?? "").trim() === filterInvoice);
  }
  const projectIds = new Set(projects.map((p) => p.id));

  const uniqueInvoiceNumbers = Array.from(
    new Set(allProjects.map((p) => (p.invoiceNumber ?? "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  let payments = hasDateFilter
    ? allPayments.filter((p) => inDateRange(p.paymentDate, from, to))
    : allPayments;
  if (hasStatusFilter) {
    payments = payments.filter((p) => projectIds.has(p.projectId));
  }

  const totalRevenue = projects.reduce((sum, p) => {
    const projectRevenue = p.totalSqft * Number(p.companyRatePerSqft);
    return sum + projectRevenue;
  }, 0);

  // Calculate payouts accounting for manager relationships
  let totalPayoutsBase = 0;
  let totalCommissions = 0;
  let totalManagerCommissions = 0;
  let totalCompanyShareOfManagerCommissions = 0;

  assignments.forEach((a) => {
    const project = projects.find((p) => p.id === a.projectId);
    if (!project) return;
    if (a.isInternal) return;

    const sqft = project.totalSqft;
    const workerRate = Number(a.ratePerSqft);

    if (a.managedByFielderId && a.managerRatePerSqft) {
      // Worker (e.g. Naveen) is paid worker rate directly; manager (e.g. Nivas) gets 50% of commission after company keeps 50%
      const managerRate = Number(a.managerRatePerSqft);
      const managerCommission = (managerRate - workerRate) * sqft;
      const managerShare = a.managerCommissionShare
        ? Number(a.managerCommissionShare)
        : 0;
      const companyShare = managerCommission * managerShare;
      const managerNetCommission = managerCommission - companyShare;

      // Company pays worker directly at worker rate (worker does not see manager commission)
      totalPayoutsBase += workerRate * sqft;
      // Manager commission (net: manager gets the rest after company keeps its share)
      totalManagerCommissions += managerNetCommission;
      totalCompanyShareOfManagerCommissions += companyShare;
    } else {
      // Direct assignment - company pays worker directly
      totalPayoutsBase += workerRate * sqft;
      // Regular commission if any
      if (a.commissionPercentage) {
        const commission = workerRate * sqft * Number(a.commissionPercentage);
        totalCommissions += commission;
      }
    }
  });

  // Total required payouts = base payouts + regular commissions + manager net commissions - company share back
  const totalRequiredPayouts =
    totalPayoutsBase +
    totalCommissions +
    totalManagerCommissions -
    totalCompanyShareOfManagerCommissions;

  const totalPaid = payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );

  const totalPending = Math.max(totalRequiredPayouts - totalPaid, 0);
  // Owner / internal work value (e.g. Basheer): sum of rate*sqft for internal assignments
  const totalInternalWorkValue = assignments.reduce((sum, a) => {
    if (!a.isInternal) return sum;
    const project = projects.find((p) => p.id === a.projectId);
    if (!project) return sum;
    const rate = Number(a.ratePerSqft);
    return sum + rate * project.totalSqft;
  }, 0);
  // Company profit = revenue - (payouts - company share back)
  const totalCompanyProfit =
    totalRevenue - totalPayoutsBase - totalCommissions - totalManagerCommissions + totalCompanyShareOfManagerCommissions;

  const projectRows = projects.map((p) => {
    const revenue = p.totalSqft * Number(p.companyRatePerSqft);
    const projectAssignments = assignments.filter(
      (a) => a.projectId === p.id,
    );

    let payoutsBase = 0;
    let commissions = 0;
    let managerCommissions = 0;
    let companyShareBack = 0;

    projectAssignments.forEach((a) => {
      if (a.isInternal) return;
      const sqft = p.totalSqft;
      const workerRate = Number(a.ratePerSqft);

      if (a.managedByFielderId && a.managerRatePerSqft) {
        const managerRate = Number(a.managerRatePerSqft);
        const managerCommission = (managerRate - workerRate) * sqft;
        const managerShare = a.managerCommissionShare
          ? Number(a.managerCommissionShare)
          : 0;
        const companyShare = managerCommission * managerShare;
        const managerNetCommission = managerCommission - companyShare;

        payoutsBase += workerRate * sqft;
        managerCommissions += managerNetCommission;
        companyShareBack += companyShare;
      } else {
        payoutsBase += workerRate * sqft;
        if (a.commissionPercentage) {
          commissions += workerRate * sqft * Number(a.commissionPercentage);
        }
      }
    });

    const projectRequired =
      payoutsBase + commissions + managerCommissions - companyShareBack;

    const projectPayments = payments.filter((pay) => pay.projectId === p.id);
    const paidAmount = projectPayments.reduce(
      (sum, pay) => sum + Number(pay.amount),
      0,
    );

    const pending = Math.max(projectRequired - paidAmount, 0);
    const profit = revenue - projectRequired;

    return {
      projectId: p.id,
      projectCode: p.projectCode,
      clientName: p.clientName,
      qfield: p.qfield,
      revenue,
      payoutsBase,
      commissions,
      managerCommissions,
      companyShareBack,
      totalPaid: paidAmount,
      pending,
      profit,
    };
  });

  const monthlyMap = new Map<string, MonthlyRow>();

  const addMonthRevenue = (inputDate: string | Date, amount: number) => {
    const date = typeof inputDate === "string" ? new Date(inputDate) : inputDate;
    if (Number.isNaN(date.getTime())) return;
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${month + 1}`;
    const label = date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
    });
    const existing = monthlyMap.get(key) ?? {
      monthKey: key,
      label,
      revenue: 0,
      payouts: 0,
      profit: 0,
    };
    existing.revenue += amount;
    monthlyMap.set(key, existing);
  };

  const addMonthPayout = (inputDate: string | Date, amount: number) => {
    const date = typeof inputDate === "string" ? new Date(inputDate) : inputDate;
    if (Number.isNaN(date.getTime())) return;
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${month + 1}`;
    const label = date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
    });
    const existing = monthlyMap.get(key) ?? {
      monthKey: key,
      label,
      revenue: 0,
      payouts: 0,
      profit: 0,
    };
    existing.payouts += amount;
    monthlyMap.set(key, existing);
  };

  projects.forEach((p) => {
    const revenue = p.totalSqft * Number(p.companyRatePerSqft);
    addMonthRevenue(p.createdAt, revenue);
  });

  payments.forEach((pay) => {
    addMonthPayout(pay.paymentDate, Number(pay.amount));
  });

  const monthlyRows = Array.from(monthlyMap.values())
    .map((row) => ({
      ...row,
      profit: row.revenue - row.payouts,
    }))
    .sort((a, b) => (a.monthKey < b.monthKey ? -1 : 1));

  const dueSoonOrOverdue = assignmentsWithDetails.filter((a) => {
    const status = getDueDateStatus(a.dueDate ?? null);
    return status === "overdue" || status === "due-soon";
  });

  const showInr = settings.usdToInrRate != null;
  const payoutsByFielderMap = new Map<string, number>();
  paymentsWithDetails.forEach((p) => {
    const name = p.assignment.fielderName;
    const current = payoutsByFielderMap.get(name) ?? 0;
    payoutsByFielderMap.set(name, current + Number(p.amount));
  });
  // Include owner/internal work value (e.g. Basheer) so they appear in the chart and can compare with others
  assignments.forEach((a) => {
    if (!a.isInternal) return;
    const project = projects.find((p) => p.id === a.projectId);
    if (!project) return;
    const rate = Number(a.ratePerSqft);
    if (rate <= 0) return;
    const workValue = rate * project.totalSqft;
    const name = a.fielderName;
    const current = payoutsByFielderMap.get(name) ?? 0;
    payoutsByFielderMap.set(name, current + workValue);
  });
  const payoutsByFielder = Array.from(payoutsByFielderMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const sqftByFielderAssignments = assignmentsWithDetails.map((a) => ({
    fielderName: a.fielderName,
    createdAt: a.createdAt ?? new Date().toISOString(),
    totalSqft: a.project?.totalSqft ?? 0,
  }));

  const activeProjectsForEcd = allProjects;
  const projectsOverdue = activeProjectsForEcd.filter(
    (p) => getProjectEcdStatus(p.ecd ?? null, p.status) === "overdue",
  );
  const projectsDueThisWeek = activeProjectsForEcd.filter(
    (p) => getProjectEcdStatus(p.ecd ?? null, p.status) === "due-soon",
  );
  const hasProjectEcdSummary = projectsOverdue.length > 0 || projectsDueThisWeek.length > 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dataAsOf = new Date();

  return (
    <SidebarLayout
      title="Dashboard"
      current="dashboard"
    >
      <div className="flex flex-1 flex-col gap-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Revenue and payments at a glance. Use the filter below to narrow by date.
          </p>
          <p className="mt-0.5 text-xs text-slate-400" aria-label="Data timestamp">
            Data as of {dataAsOf.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="card-highlight p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Total revenue
            </p>
            <p className="stat-value mt-4 text-3xl font-bold tracking-tight text-slate-900">
              {showInr ? formatWithInr(totalRevenue, { showInr: true, usdToInrRate: settings.usdToInrRate }) : `$${formatCurrency(totalRevenue)}`}
            </p>
          </div>
          <div className="card-highlight p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Total payouts (base + commissions)
            </p>
            <p className="stat-value mt-4 text-3xl font-bold tracking-tight text-slate-900">
              {showInr ? formatWithInr(totalRequiredPayouts, { showInr: true, usdToInrRate: settings.usdToInrRate }) : `$${formatCurrency(totalRequiredPayouts)}`}
            </p>
          </div>
          <div className="card-highlight p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Company profit
            </p>
            <p className="stat-value mt-4 text-3xl font-bold tracking-tight text-slate-900">
              {showInr ? formatWithInr(totalCompanyProfit, { showInr: true, usdToInrRate: settings.usdToInrRate }) : `$${formatCurrency(totalCompanyProfit)}`}
            </p>
          </div>
          <div className="card-highlight p-7 md:col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Manager commissions (net)
            </p>
            <p className="stat-value mt-4 text-2xl font-bold tracking-tight text-slate-900">
              {showInr ? formatWithInr(totalManagerCommissions, { showInr: true, usdToInrRate: settings.usdToInrRate }) : `$${formatCurrency(totalManagerCommissions)}`}
            </p>
          </div>
          <div className="card-highlight p-7 md:col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Company share from managers
            </p>
            <p className="stat-value mt-4 text-2xl font-bold tracking-tight text-slate-900">
              {showInr ? formatWithInr(totalCompanyShareOfManagerCommissions, { showInr: true, usdToInrRate: settings.usdToInrRate }) : `$${formatCurrency(totalCompanyShareOfManagerCommissions)}`}
            </p>
          </div>
          <div className="card-highlight p-7 md:col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Total paid
            </p>
            <p className="stat-value mt-4 text-2xl font-bold tracking-tight text-slate-900">
              {showInr ? formatWithInr(totalPaid, { showInr: true, usdToInrRate: settings.usdToInrRate }) : `$${formatCurrency(totalPaid)}`}
            </p>
          </div>
          <div className="card-highlight p-7 md:col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Total pending payments
            </p>
            <p className="stat-value mt-4 text-2xl font-bold tracking-tight text-slate-900">
              {showInr ? formatWithInr(totalPending, { showInr: true, usdToInrRate: settings.usdToInrRate }) : `$${formatCurrency(totalPending)}`}
            </p>
          </div>
          {totalInternalWorkValue > 0 && (
            <div className="card-highlight p-7 md:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                Owner / internal work value
              </p>
              <p className="stat-value mt-4 text-2xl font-bold tracking-tight text-slate-900">
                {showInr ? formatWithInr(totalInternalWorkValue, { showInr: true, usdToInrRate: settings.usdToInrRate }) : `$${formatCurrency(totalInternalWorkValue)}`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Value of owner/internal work (not payouts)
              </p>
            </div>
          )}
        </section>

        <section className="card p-7">
          <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Date range filter
          </h2>
          <p className="mb-3 text-sm text-slate-600">
            Show revenue (by project creation) and payments in a date range.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <Link
              href={filterStatus ? `/?status=${encodeURIComponent(filterStatus)}` : filterInvoice ? `/?invoice=${encodeURIComponent(filterInvoice)}` : "/"}
              className={`rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
                !hasDateFilter
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "bg-white/80 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              All time
            </Link>
            <DatePresetLink from={getDatePreset("last7").from} to={getDatePreset("last7").to} label="Last 7 days" hasDateFilter={hasDateFilter} currentFrom={from} currentTo={to} filterStatus={filterStatus} filterInvoice={filterInvoice} />
            <DatePresetLink from={getDatePreset("thisMonth").from} to={getDatePreset("thisMonth").to} label="This month" hasDateFilter={hasDateFilter} currentFrom={from} currentTo={to} filterStatus={filterStatus} filterInvoice={filterInvoice} />
            <DatePresetLink from={getDatePreset("lastQuarter").from} to={getDatePreset("lastQuarter").to} label="Last quarter" hasDateFilter={hasDateFilter} currentFrom={from} currentTo={to} filterStatus={filterStatus} filterInvoice={filterInvoice} />
          </div>
          {uniqueInvoiceNumbers.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-sm text-slate-600">Filter by invoice / billing batch</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={[from && `from=${from}`, to && `to=${to}`, filterStatus && `status=${encodeURIComponent(filterStatus)}`].filter(Boolean).length
                    ? `/?${[from && `from=${from}`, to && `to=${to}`, filterStatus && `status=${encodeURIComponent(filterStatus)}`].filter(Boolean).join("&")}`
                    : "/"}
                  className={`rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
                    !filterInvoice
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                      : "bg-white/80 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                  }`}
                >
                  All invoices
                </Link>
                {uniqueInvoiceNumbers.map((inv) => {
                  const isActive = filterInvoice === inv;
                  const q = [from && `from=${from}`, to && `to=${to}`, filterStatus && `status=${encodeURIComponent(filterStatus)}`, `invoice=${encodeURIComponent(inv)}`].filter(Boolean).join("&");
                  return (
                    <Link
                      key={inv}
                      href={q ? `/?${q}` : `/?invoice=${encodeURIComponent(inv)}`}
                      className={`rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                          : "bg-white/80 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                      }`}
                    >
                      Invoice {inv}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          <form method="get" action="/" className="flex flex-wrap items-end gap-3">
            {filterInvoice != null && filterInvoice !== "" && (
              <input type="hidden" name="invoice" value={filterInvoice} />
            )}
            <div className="space-y-1">
              <label className="label">
                From
              </label>
              <input
                type="date"
                name="from"
                defaultValue={from ?? ""}
                className="input h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="label">
                To
              </label>
              <input
                type="date"
                name="to"
                defaultValue={to ?? ""}
                className="input h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="label">Project status</label>
              <select name="status" className="select h-11 rounded-xl" defaultValue={filterStatus ?? ""}>
                <option value="">All statuses</option>
                {PROJECT_STATUS_VALUES.map((v) => (
                  <option key={v} value={v}>{getProjectStatusLabel(v)}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="btn-primary h-11 px-5 text-sm"
            >
              Apply
            </button>
            {(hasDateFilter || hasStatusFilter || hasInvoiceFilter) && (
              <Link
                href="/"
                className="btn-secondary h-11 px-4 py-2"
              >
                Clear filter
              </Link>
            )}
          </form>
          {(hasDateFilter || hasStatusFilter) && (
            <p className="mt-2 text-sm text-slate-500">
              {hasDateFilter && `Showing revenue and payments from ${from ?? "start"} to ${to ?? "end"}.`}
              {hasDateFilter && hasStatusFilter && " "}
              {hasStatusFilter && `Projects filtered by status: ${getProjectStatusLabel(filterStatus!)}.`}
            </p>
          )}
        </section>

        <section className="space-y-6">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Charts</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="card p-7">
              <h3 className="mb-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Revenue vs payouts over time
              </h3>
              <RevenueVsPayoutsChart
                data={monthlyRows.map((r) => ({
                  monthKey: r.monthKey,
                  label: r.label,
                  revenue: r.revenue,
                  payouts: r.payouts,
                }))}
              />
            </div>
            <div className="card p-7">
              <h3 className="mb-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Payouts by fielder
              </h3>
              <p className="mb-3 text-xs text-slate-500">
                Includes actual payments and owner/internal work value (e.g. Basheer) so you can compare who’s earning what.
              </p>
              <PayoutsByFielderChart data={payoutsByFielder} />
            </div>
            <div className="card p-7 md:col-span-2">
              <h3 className="mb-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total SQFT by fielder (by week or month)
              </h3>
              <p className="mb-4 text-sm text-slate-600">
                Square footage from projects each fielder is assigned to, grouped by when the assignment was created.
              </p>
              <SqftByFielderChart assignments={sqftByFielderAssignments} />
            </div>
          </div>
        </section>

        {hasProjectEcdSummary && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Project ECD summary
            </h2>
            <div className="card border-amber-200/50 bg-amber-50/40 p-6">
              <p className="mb-4 text-sm font-medium text-slate-700">
                {projectsOverdue.length > 0 && (
                  <span>
                    <strong>{projectsOverdue.length}</strong> project{projectsOverdue.length !== 1 ? "s" : ""} overdue (past ECD)
                    {projectsDueThisWeek.length > 0 && " · "}
                  </span>
                )}
                {projectsDueThisWeek.length > 0 && (
                  <span>
                    <strong>{projectsDueThisWeek.length}</strong> due this week
                  </span>
                )}
              </p>
              <ul className="space-y-2">
                {[...projectsOverdue, ...projectsDueThisWeek].map((p) => {
                  const status = getProjectEcdStatus(p.ecd ?? null, p.status);
                  return (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <span
                        className={
                          status === "overdue"
                            ? "rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
                            : "rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                        }
                      >
                        {status === "overdue" ? "Overdue" : "Due soon"}
                      </span>
                      <span className="text-slate-700">
                        {p.projectCode} – {p.clientName}
                        {p.ecd && (
                          <span className="text-slate-500">
                            {" "}
                            (ECD {new Date(p.ecd).toLocaleDateString()})
                          </span>
                        )}
                      </span>
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-slate-700 underline hover:text-slate-900"
                      >
                        Edit
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {dueSoonOrOverdue.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Assignment due dates (due soon / overdue)
            </h2>
            <div className="card border-amber-200/50 bg-amber-50/40 p-6">
              <ul className="space-y-2">
                {dueSoonOrOverdue.map((a) => {
                  const status = getDueDateStatus(a.dueDate ?? null);
                  return (
                    <li key={a.id} className="flex items-center gap-2 text-sm">
                      <span
                        className={
                          status === "overdue"
                            ? "rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
                            : "rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                        }
                      >
                        {status === "overdue" ? "Overdue" : "Due soon"}
                      </span>
                      <span className="text-slate-700">
                        {a.fielderName} – {a.project.projectCode}
                        {a.dueDate && (
                          <span className="text-slate-500">
                            {" "}
                            (due {new Date(a.dueDate).toLocaleDateString()})
                          </span>
                        )}
                      </span>
                      <Link
                        href={`/assignments/${a.id}`}
                        className="text-slate-700 underline hover:text-slate-900"
                      >
                        Edit
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Projects overview
          </h2>
          <div className="card overflow-x-auto">
            <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">QField</th>
                  <th className="px-3 py-2">Revenue</th>
                  <th className="px-3 py-2">Payouts</th>
                  <th className="px-3 py-2">Commissions</th>
                  <th className="px-3 py-2">Paid</th>
                  <th className="px-3 py-2">Pending</th>
                  <th className="px-3 py-2">Profit</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map((row) => (
                  <tr key={row.projectCode} className="border-t text-slate-800">
                    <td className="px-3 py-2">{row.projectCode}</td>
                    <td className="px-3 py-2">{row.clientName}</td>
                    <td className="px-3 py-2">{row.qfield ?? "—"}</td>
                    <td className="px-3 py-2">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="px-3 py-2">
                      {formatCurrency(row.payoutsBase)}
                    </td>
                    <td className="px-3 py-2">
                      {formatCurrency(row.commissions)}
                    </td>
                    <td className="px-3 py-2">
                      {formatCurrency(row.totalPaid)}
                    </td>
                    <td className="px-3 py-2">
                      {formatCurrency(row.pending)}
                    </td>
                    <td className="px-3 py-2">
                      {formatCurrency(row.profit)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/payments?projectId=${row.projectId}`}
                        className="text-sm text-slate-700 underline hover:text-slate-900"
                      >
                        Log payment
                      </Link>
                    </td>
                  </tr>
                ))}
                {projectRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-3 py-4 text-center text-slate-500"
                    >
                      No projects yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            Monthly summary
          </h2>
          <div className="card overflow-x-auto">
            <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2">Revenue</th>
                  <th className="px-3 py-2">Payouts</th>
                  <th className="px-3 py-2">Profit</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((row) => (
                  <tr key={row.monthKey} className="border-t text-slate-800">
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="px-3 py-2">
                      {formatCurrency(row.payouts)}
                    </td>
                    <td className="px-3 py-2">
                      {formatCurrency(row.profit)}
                    </td>
                  </tr>
                ))}
                {monthlyRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-4 text-center text-slate-500"
                    >
                      No financial activity yet.
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
