import {
  getAllProjects,
  getAllAssignments,
  getAllPayments,
  getAssignmentsWithDetails,
  getSettings,
  getTripExpensesWithTrip,
} from "@/lib/db";
import { getDueDateStatus, getProjectEcdStatus } from "@/lib/dueDate";
import { getProjectStatusLabel, PROJECT_STATUS_VALUES } from "@/lib/projectStatus";
import { formatWithInr, formatUsdSmart } from "@/lib/currency";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import Link from "next/link";
import { RevenueVsPayoutsChart } from "@/app/components/charts/RevenueVsPayoutsChart";
import { PayoutsByFielderChart } from "@/app/components/charts/PayoutsByFielderChart";
import { SqftByFielderChart } from "@/app/components/charts/SqftByFielderChart";
import { EmptyState } from "@/app/components/EmptyState";
import { FolderOpen, FileText } from "lucide-react";
import { ProgressBar } from "@/app/components/ProgressBar";

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
          ? "bg-white/10 text-white border border-zinc-600"
          : "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700/50 border border-zinc-700"
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

  const [allProjects, allPayments, assignments, assignmentsWithDetails, settings, tripExpensesWithTrip] = await Promise.all([
    getAllProjects(),
    getAllPayments(),
    getAllAssignments(),
    getAssignmentsWithDetails(),
    getSettings(),
    getTripExpensesWithTrip(),
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
  // Always scope payments to filtered projects so totals and charts match (date / status / invoice filter)
  payments = payments.filter((p) => projectIds.has(p.projectId));

  const filteredTripExpenses = hasDateFilter
    ? tripExpensesWithTrip.filter((e) => inDateRange(e.expenseDate, from, to))
    : tripExpensesWithTrip;
  const totalTripExpenses = filteredTripExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

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

  // Previous period (for comparison): same-length window before current period, or "last month" when no date filter
  type PeriodTotals = { revenue: number; payouts: number; profit: number; label: string };
  let currentLabel = "Current period";
  let prevLabel = "Previous period";
  let prevProjects: typeof projects = [];
  if (hasDateFilter && from && to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const days = Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const prevToDate = new Date(fromDate);
    prevToDate.setDate(prevToDate.getDate() - 1);
    const prevFromDate = new Date(prevToDate);
    prevFromDate.setDate(prevFromDate.getDate() - days + 1);
    const prevFrom = prevFromDate.toISOString().slice(0, 10);
    const prevTo = prevToDate.toISOString().slice(0, 10);
    currentLabel = `${from} – ${to}`;
    prevLabel = `${prevFrom} – ${prevTo}`;
    prevProjects = allProjects.filter((p) => inDateRange(p.createdAt, prevFrom, prevTo));
    if (hasStatusFilter) prevProjects = prevProjects.filter((p) => p.status === filterStatus);
    if (hasInvoiceFilter) prevProjects = prevProjects.filter((p) => (p.invoiceNumber ?? "").trim() === filterInvoice);
  } else {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const lastMonthEnd = new Date(y, m, 0);
    const lastMonthStart = new Date(y, m - 1, 1);
    const lastMonthFrom = lastMonthStart.toISOString().slice(0, 10);
    const lastMonthTo = lastMonthEnd.toISOString().slice(0, 10);
    currentLabel = "This month (to date)";
    prevLabel = "Last month";
    prevProjects = allProjects.filter((p) => inDateRange(p.createdAt, lastMonthFrom, lastMonthTo));
    if (hasStatusFilter) prevProjects = prevProjects.filter((p) => p.status === filterStatus);
    if (hasInvoiceFilter) prevProjects = prevProjects.filter((p) => (p.invoiceNumber ?? "").trim() === filterInvoice);
  }

  const prevRevenue = prevProjects.reduce((sum, p) => sum + p.totalSqft * Number(p.companyRatePerSqft), 0);
  let prevPayoutsBase = 0;
  let prevCommissions = 0;
  let prevManagerCommissions = 0;
  let prevCompanyShare = 0;
  prevProjects.forEach((proj) => {
    assignments.forEach((a) => {
      if (a.projectId !== proj.id) return;
      if (a.isInternal) return;
      const sqft = proj.totalSqft;
      const workerRate = Number(a.ratePerSqft);
      if (a.managedByFielderId && a.managerRatePerSqft) {
        const managerRate = Number(a.managerRatePerSqft);
        const managerCommission = (managerRate - workerRate) * sqft;
        const managerShare = a.managerCommissionShare ? Number(a.managerCommissionShare) : 0;
        prevPayoutsBase += workerRate * sqft;
        prevManagerCommissions += managerCommission - managerCommission * managerShare;
        prevCompanyShare += managerCommission * managerShare;
      } else {
        prevPayoutsBase += workerRate * sqft;
        if (a.commissionPercentage) prevCommissions += workerRate * sqft * Number(a.commissionPercentage);
      }
    });
  });
  const prevRequiredPayouts = prevPayoutsBase + prevCommissions + prevManagerCommissions - prevCompanyShare;
  const prevProfit = prevRevenue - prevRequiredPayouts;

  const periodComparison: { current: PeriodTotals; prev: PeriodTotals } = {
    current: { revenue: totalRevenue, payouts: totalRequiredPayouts, profit: totalCompanyProfit, label: currentLabel },
    prev: { revenue: prevRevenue, payouts: prevRequiredPayouts, profit: prevProfit, label: prevLabel },
  };

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
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      projectId: p.id,
      projectCode: p.projectCode,
      clientName: p.clientName,
      invoiceNumber: p.invoiceNumber,
      qfield: p.qfield,
      revenue,
      payoutsBase,
      commissions,
      managerCommissions,
      companyShareBack,
      totalPaid: paidAmount,
      pending,
      profit,
      marginPct,
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
    // Use ECD month when available, otherwise fall back to createdAt.
    const baseDate = p.ecd && p.ecd !== "" ? p.ecd : p.createdAt;
    addMonthRevenue(baseDate, revenue);
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

  const monthlyTripExpenseMap = new Map<string, { monthKey: string; label: string; total: number }>();
  filteredTripExpenses.forEach((e) => {
    const date = new Date(e.expenseDate);
    if (Number.isNaN(date.getTime())) return;
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${month + 1}`;
    const label = date.toLocaleDateString(undefined, { year: "numeric", month: "short" });
    const existing = monthlyTripExpenseMap.get(key) ?? { monthKey: key, label, total: 0 };
    existing.total += Number(e.amount);
    monthlyTripExpenseMap.set(key, existing);
  });
  const monthlyTripExpenseRows = Array.from(monthlyTripExpenseMap.values()).sort((a, b) =>
    a.monthKey < b.monthKey ? -1 : 1,
  );

  const dueSoonOrOverdue = assignmentsWithDetails.filter((a) => {
    const status = getDueDateStatus(a.dueDate ?? null);
    return status === "overdue" || status === "due-soon";
  });

  const showInr = settings.usdToInrRate != null;
  // Payouts-by-fielder chart: use EXPECTED amounts (from assignment rates) so every fielder with work in the filter appears (Basheer, Naveen, Nivas), even before any payment is logged
  const payoutsByFielderMap = new Map<string, number>();
  assignments.forEach((a) => {
    const project = projects.find((p) => p.id === a.projectId);
    if (!project) return;
    const sqft = project.totalSqft;
    if (a.isInternal) {
      const rate = Number(a.ratePerSqft);
      if (rate <= 0) return;
      const workValue = rate * sqft;
      payoutsByFielderMap.set(a.fielderName, (payoutsByFielderMap.get(a.fielderName) ?? 0) + workValue);
      return;
    }
    const workerRate = Number(a.ratePerSqft);
    const workerExpected = workerRate * sqft;
    payoutsByFielderMap.set(a.fielderName, (payoutsByFielderMap.get(a.fielderName) ?? 0) + workerExpected);
    if (a.managedByFielderId && a.managerRatePerSqft) {
      const managerRate = Number(a.managerRatePerSqft);
      const managerCommission = (managerRate - workerRate) * sqft;
      const managerShare = a.managerCommissionShare ? Number(a.managerCommissionShare) : 0;
      const companyShare = managerCommission * managerShare;
      const managerNetCommission = managerCommission - companyShare;
      const managerAssignment = assignments.find((m) => m.id === a.managedByFielderId);
      const managerName = managerAssignment?.fielderName;
      if (managerName) {
        payoutsByFielderMap.set(managerName, (payoutsByFielderMap.get(managerName) ?? 0) + managerNetCommission);
      }
    }
  });
  const payoutsByFielder = Array.from(payoutsByFielderMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Only assignments for filtered projects so SQFT chart shows whole data when no filter, filtered when filtered
  const assignmentsWithDetailsFiltered = assignmentsWithDetails.filter((a) =>
    projectIds.has(a.projectId),
  );
  const sqftByFielderAssignments = assignmentsWithDetailsFiltered.map((a) => ({
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

  const activeProjects = allProjects.filter((p) => !p.archivedAt);
  const statusCounts = {
    ASSIGNED: activeProjects.filter((p) => p.status === "ASSIGNED" || p.status === "NOT_STARTED").length,
    IN_PROGRESS: activeProjects.filter((p) => p.status === "IN_PROGRESS").length,
    SUBMITTED: activeProjects.filter((p) => p.status === "SUBMITTED").length,
    COMPLETED: activeProjects.filter((p) => p.status === "COMPLETED").length,
  };

  return (
    <SidebarLayout
      title="Dashboard"
      subtitle="Revenue and payments at a glance"
      current="dashboard"
    >
      <div className="flex flex-1 flex-col gap-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-100">
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Revenue and payments at a glance. Use the filter below to narrow by date or invoice.
          </p>
          <p className="mt-0.5 text-xs text-zinc-500" aria-label="Data timestamp">
            Data as of {dataAsOf.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </p>
          {/* So you always know what data is included (e.g. new projects can be hidden by date/invoice filter) */}
          <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-900/50/80 px-4 py-2 text-sm text-zinc-300">
            <strong>Showing:</strong>{" "}
            {!hasDateFilter && !hasStatusFilter && !hasInvoiceFilter ? (
              <>All projects and all payments (no filter). New projects and logged payments appear here immediately.</>
            ) : (
              <>
                {projects.length} project{projects.length !== 1 ? "s" : ""}
                {hasDateFilter && from && to && ` created ${from}–${to}`}
                {hasInvoiceFilter && ` in invoice "${filterInvoice}"`}
                {hasStatusFilter && ` with status "${filterStatus}"`}
                . Payments below are only for these projects.
                {" "}
                <Link href="/" className="font-medium text-zinc-300 hover:text-white transition-colors">
                  Show all data
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Project status overview — always reflects current state, not filtered */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Project status overview
          </h2>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <Link href="/projects?status=ASSIGNED" className="card p-5 hover:border-zinc-600 transition-colors">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Assigned</p>
              <p className="mt-2 text-3xl font-bold text-zinc-100">{statusCounts.ASSIGNED}</p>
            </Link>
            <Link href="/projects?status=IN_PROGRESS" className="card p-5 hover:border-zinc-600 transition-colors">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-500">In Progress</p>
              <p className="mt-2 text-3xl font-bold text-zinc-100">{statusCounts.IN_PROGRESS}</p>
            </Link>
            <Link href="/projects?status=SUBMITTED" className="card p-5 hover:border-zinc-600 transition-colors">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Submitted</p>
              <p className="mt-2 text-3xl font-bold text-zinc-100">{statusCounts.SUBMITTED}</p>
              {statusCounts.SUBMITTED > 0 && (
                <p className="mt-1 text-xs text-blue-400">Pending review</p>
              )}
            </Link>
            <Link href="/projects?status=COMPLETED" className="card p-5 hover:border-zinc-600 transition-colors">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Completed</p>
              <p className="mt-2 text-3xl font-bold text-zinc-100">{statusCounts.COMPLETED}</p>
            </Link>
            <Link href="/projects" className="card p-5 hover:border-zinc-600 transition-colors">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total active</p>
              <p className="mt-2 text-3xl font-bold text-zinc-100">{activeProjects.length}</p>
            </Link>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="card-highlight p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Total revenue
            </p>
            <p className="stat-value mt-4 text-3xl font-bold tracking-tight text-zinc-100">
              {showInr ? formatWithInr(totalRevenue, { showInr: true, usdToInrRate: settings.usdToInrRate }) : formatUsdSmart(totalRevenue)}
            </p>
          </div>
          <div className="card-highlight p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Total payouts (expected from rates)
            </p>
            <p className="stat-value mt-4 text-3xl font-bold tracking-tight text-zinc-100">
              {showInr ? formatWithInr(totalRequiredPayouts, { showInr: true, usdToInrRate: settings.usdToInrRate }) : formatUsdSmart(totalRequiredPayouts)}
            </p>
            {totalRequiredPayouts > 0 && (
              <div className="mt-3">
                <ProgressBar value={totalPaid} max={totalRequiredPayouts} showLabel />
              </div>
            )}
            <p className="mt-2 text-xs text-zinc-500">From fielder rates × SQFT (not from logged payments)</p>
          </div>
          <div className="card-highlight p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Company profit
            </p>
            <p className="stat-value mt-4 text-3xl font-bold tracking-tight text-zinc-100">
              {showInr ? formatWithInr(totalCompanyProfit, { showInr: true, usdToInrRate: settings.usdToInrRate }) : formatUsdSmart(totalCompanyProfit)}
            </p>
          </div>
          <div className="card-highlight p-7 md:col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Manager commissions (net)
            </p>
            <p className="stat-value mt-4 text-2xl font-bold tracking-tight text-zinc-100">
              {showInr ? formatWithInr(totalManagerCommissions, { showInr: true, usdToInrRate: settings.usdToInrRate }) : formatUsdSmart(totalManagerCommissions)}
            </p>
          </div>
          <div className="card-highlight p-7 md:col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Company share from managers
            </p>
            <p className="stat-value mt-4 text-2xl font-bold tracking-tight text-zinc-100">
              {showInr ? formatWithInr(totalCompanyShareOfManagerCommissions, { showInr: true, usdToInrRate: settings.usdToInrRate }) : formatUsdSmart(totalCompanyShareOfManagerCommissions)}
            </p>
          </div>
          <div className="card-highlight p-7 md:col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Total paid
            </p>
            <p className="stat-value mt-4 text-2xl font-bold tracking-tight text-zinc-100">
              {showInr ? formatWithInr(totalPaid, { showInr: true, usdToInrRate: settings.usdToInrRate }) : formatUsdSmart(totalPaid)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">From payments you logged (Payments → Log payment)</p>
          </div>
          <div className="card-highlight p-7 md:col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Total pending payments
            </p>
            <p className="stat-value mt-4 text-2xl font-bold tracking-tight text-zinc-100">
              {showInr ? formatWithInr(totalPending, { showInr: true, usdToInrRate: settings.usdToInrRate }) : formatUsdSmart(totalPending)}
            </p>
          </div>
          <div className="card-highlight p-7 md:col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Trip expenses
            </p>
            <p className="stat-value mt-4 text-2xl font-bold tracking-tight text-zinc-100">
              {showInr ? formatWithInr(totalTripExpenses, { showInr: true, usdToInrRate: settings.usdToInrRate }) : formatUsdSmart(totalTripExpenses)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Car, accommodation, gas, tools and other trip spends</p>
          </div>
          {totalInternalWorkValue > 0 && (
            <div className="card-highlight p-7 md:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                Owner / internal work value
              </p>
              <p className="stat-value mt-4 text-2xl font-bold tracking-tight text-zinc-100">
                {showInr ? formatWithInr(totalInternalWorkValue, { showInr: true, usdToInrRate: settings.usdToInrRate }) : formatUsdSmart(totalInternalWorkValue)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Value of owner/internal work (not payouts)
              </p>
            </div>
          )}
        </section>

        <section className="card p-7">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Period comparison — are we doing better?
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/50/50 p-4">
              <p className="text-xs font-medium text-zinc-500">{periodComparison.current.label}</p>
              <p className="mt-1 text-lg font-semibold text-zinc-100">{showInr ? formatWithInr(periodComparison.current.revenue, { showInr: true, usdToInrRate: settings.usdToInrRate }) : formatUsdSmart(periodComparison.current.revenue)} revenue</p>
              <p className="text-sm text-zinc-400">{showInr ? formatWithInr(periodComparison.current.payouts, { showInr: true, usdToInrRate: settings.usdToInrRate }) : formatUsdSmart(periodComparison.current.payouts)} payouts</p>
              <p className="text-sm font-medium text-zinc-200">{showInr ? formatWithInr(periodComparison.current.profit, { showInr: true, usdToInrRate: settings.usdToInrRate }) : formatUsdSmart(periodComparison.current.profit)} profit</p>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/50/50 p-4">
              <p className="text-xs font-medium text-zinc-500">{periodComparison.prev.label}</p>
              <p className="mt-1 text-lg font-semibold text-zinc-100">{showInr ? formatWithInr(periodComparison.prev.revenue, { showInr: true, usdToInrRate: settings.usdToInrRate }) : formatUsdSmart(periodComparison.prev.revenue)} revenue</p>
              <p className="text-sm text-zinc-400">{showInr ? formatWithInr(periodComparison.prev.payouts, { showInr: true, usdToInrRate: settings.usdToInrRate }) : formatUsdSmart(periodComparison.prev.payouts)} payouts</p>
              <p className="text-sm font-medium text-zinc-200">{showInr ? formatWithInr(periodComparison.prev.profit, { showInr: true, usdToInrRate: settings.usdToInrRate }) : formatUsdSmart(periodComparison.prev.profit)} profit</p>
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4">
              <p className="text-xs font-medium text-zinc-500">Change vs previous</p>
              {[
                { name: "Revenue", curr: periodComparison.current.revenue, prev: periodComparison.prev.revenue },
                { name: "Payouts", curr: periodComparison.current.payouts, prev: periodComparison.prev.payouts },
                { name: "Profit", curr: periodComparison.current.profit, prev: periodComparison.prev.profit },
              ].map(({ name, curr, prev }) => {
                const pct = prev !== 0 ? ((curr - prev) / prev) * 100 : (curr !== 0 ? 100 : 0);
                const up = pct > 0;
                const down = pct < 0;
                return (
                  <p key={name} className={`mt-1 text-sm ${up ? "text-green-700" : down ? "text-red-700" : "text-zinc-400"}`}>
                    {name}: {up ? "+" : ""}{pct.toFixed(1)}%
                  </p>
                );
              })}
            </div>
          </div>
        </section>

        <section className="card p-7">
          <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Date range filter
          </h2>
          <p className="mb-3 text-sm text-zinc-400">
            Show revenue (by project creation) and payments in a date range.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <Link
              href={filterStatus ? `/?status=${encodeURIComponent(filterStatus)}` : filterInvoice ? `/?invoice=${encodeURIComponent(filterInvoice)}` : "/"}
              className={`rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
                !hasDateFilter
                  ? "bg-white/10 text-white border border-zinc-600"
                  : "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700/50 border border-zinc-700"
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
              <p className="mb-2 text-sm text-zinc-400">Filter by invoice / billing batch</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={[from && `from=${from}`, to && `to=${to}`, filterStatus && `status=${encodeURIComponent(filterStatus)}`].filter(Boolean).length
                    ? `/?${[from && `from=${from}`, to && `to=${to}`, filterStatus && `status=${encodeURIComponent(filterStatus)}`].filter(Boolean).join("&")}`
                    : "/"}
                  className={`rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
                    !filterInvoice
                      ? "bg-white/10 text-white border border-zinc-600"
                      : "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700/50 border border-zinc-700"
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
                          ? "bg-white/10 text-white border border-zinc-600"
                          : "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700/50 border border-zinc-700"
                      }`}
                    >
                      Invoice {inv}
                    </Link>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {uniqueInvoiceNumbers.map((inv) => (
                  <a
                    key={inv}
                    href={`/api/invoices/${encodeURIComponent(inv)}/pdf`}
                    download
                    className="text-zinc-300 hover:text-white mr-3"
                  >
                    Download PDF for {inv}
                  </a>
                ))}
              </p>
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
            <p className="mt-2 text-sm text-zinc-500">
              {hasDateFilter && `Showing revenue and payments from ${from ?? "start"} to ${to ?? "end"}.`}
              {hasDateFilter && hasStatusFilter && " "}
              {hasStatusFilter && `Projects filtered by status: ${getProjectStatusLabel(filterStatus!)}.`}
            </p>
          )}
        </section>

        <section className="space-y-6">
          <h2 className="text-lg font-bold tracking-tight text-zinc-100">Charts</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="card p-7">
              <h3 className="mb-5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
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
              <h3 className="mb-5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Payouts by fielder
              </h3>
              <p className="mb-3 text-xs text-zinc-500">
                Expected payouts from rates × SQFT and manager commissions. All fielders with work in the current filter appear (e.g. Basheer, Naveen, Nivas).
              </p>
              <PayoutsByFielderChart data={payoutsByFielder} />
            </div>
            <div className="card p-7 md:col-span-2">
              <h3 className="mb-5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Total SQFT by fielder (by week or month)
              </h3>
              <p className="mb-4 text-sm text-zinc-400">
                Square footage from projects each fielder is assigned to, grouped by when the assignment was created.
              </p>
              <SqftByFielderChart assignments={sqftByFielderAssignments} />
            </div>
          </div>
        </section>

        {hasProjectEcdSummary && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold tracking-tight text-zinc-100">
              Project ECD summary
            </h2>
            <div className="card p-6 border-l-4 border-l-amber-500/80">
              <p className="mb-4 text-sm font-medium text-zinc-400">
                {projectsOverdue.length > 0 && (
                  <span>
                    <strong className="text-zinc-100">{projectsOverdue.length}</strong> project{projectsOverdue.length !== 1 ? "s" : ""} overdue
                    {projectsDueThisWeek.length > 0 && " · "}
                  </span>
                )}
                {projectsDueThisWeek.length > 0 && (
                  <span>
                    <strong className="text-zinc-100">{projectsDueThisWeek.length}</strong> due this week
                  </span>
                )}
              </p>
              <ul className="space-y-2">
                {[...projectsOverdue, ...projectsDueThisWeek].map((p) => {
                  const status = getProjectEcdStatus(p.ecd ?? null, p.status);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span
                        className={
                          status === "overdue"
                            ? "rounded-md bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400"
                            : "rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400"
                        }
                      >
                        {status === "overdue" ? "Overdue" : "Due soon"}
                      </span>
                      <span className="text-zinc-300">
                        <Link href={`/projects/${p.id}`} className="font-medium text-zinc-300 hover:text-white transition-colors">
                          {p.projectCode}
                        </Link>
                        {" – "}{p.clientName}
                        {p.ecd && (
                          <span className="text-zinc-500">
                            {" "}
                            (ECD {new Date(p.ecd).toLocaleDateString()})
                          </span>
                        )}
                      </span>
                      <Link
                        href={`/projects/${p.id}`}
                        className="link-action link-action-edit ml-auto"
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
            <h2 className="text-lg font-bold tracking-tight text-zinc-100">
              Assignment due dates (due soon / overdue)
            </h2>
            <div className="card p-6 border-l-4 border-l-amber-500/80">
              <ul className="space-y-2">
                {dueSoonOrOverdue.map((a) => {
                  const status = getDueDateStatus(a.dueDate ?? null);
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span
                        className={
                          status === "overdue"
                            ? "rounded-md bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400"
                            : "rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400"
                        }
                      >
                        {status === "overdue" ? "Overdue" : "Due soon"}
                      </span>
                      <span className="text-zinc-300">
                        {a.fielderName}{" – "}
                        <Link href={`/projects/${a.projectId}`} className="font-medium text-zinc-300 hover:text-white transition-colors">
                          {a.project.projectCode}
                        </Link>
                        {a.dueDate && (
                          <span className="text-zinc-500">
                            {" "}
                            (due {new Date(a.dueDate).toLocaleDateString()})
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2 ml-auto">
                        <Link
                          href={`/assignments/${a.id}`}
                          className="link-action link-action-edit"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/payments?projectId=${a.projectId}&assignmentId=${a.id}`}
                          className="link-action link-action-payment"
                        >
                          Log payment
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        <section className="section-separator space-y-4">
          <h2 className="text-lg font-bold tracking-tight text-zinc-100">
            Projects overview
          </h2>
          {projectRows.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No projects yet"
              description="Add your first project to start tracking revenue, payouts, and fielders."
              action={{ href: "/projects", label: "Add project" }}
            />
          ) : (
          <div className="card card-table overflow-x-auto">
            <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Project</th>
                  <th className="px-3 py-2 text-left">Client</th>
                  <th className="px-3 py-2 text-left">Invoice</th>
                  <th className="px-3 py-2 text-left">QField</th>
                  <th className="px-3 py-2 text-right" title="USD">Revenue</th>
                  <th className="px-3 py-2 text-right" title="USD">Payouts</th>
                  <th className="px-3 py-2 text-right" title="USD">Commissions</th>
                  <th className="px-3 py-2 text-right" title="USD">Paid</th>
                  <th className="px-3 py-2 text-right" title="USD">Pending</th>
                  <th className="px-3 py-2 text-right" title="USD">Profit</th>
                  <th className="px-3 py-2 text-right">Margin %</th>
                  <th className="px-3 py-2 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map((row) => (
                  <tr key={row.projectCode} className="border-t border-zinc-700/50 text-zinc-200">
                    <td className="px-3 py-2">
                      <Link
                        href={`/projects/${row.projectId}`}
                        className="font-medium text-zinc-300 hover:text-white transition-colors"
                      >
                        {row.projectCode}
                      </Link>
                    </td>
                    <td className="px-3 py-2 max-w-[10rem]">
                      <span className="block truncate" title={row.clientName ?? ""}>{row.clientName ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2">{row.invoiceNumber?.trim() ?? "—"}</td>
                    <td className="px-3 py-2">{row.qfield ?? "—"}</td>
                    <td className="cell-numeric px-3 py-2">
                      {formatUsdSmart(row.revenue)}
                    </td>
                    <td className="cell-numeric px-3 py-2">
                      {formatUsdSmart(row.payoutsBase)}
                    </td>
                    <td className="cell-numeric px-3 py-2">
                      {formatUsdSmart(row.commissions)}
                    </td>
                    <td className="cell-numeric px-3 py-2">
                      {formatUsdSmart(row.totalPaid)}
                    </td>
                    <td className="cell-numeric px-3 py-2">
                      {formatUsdSmart(row.pending)}
                    </td>
                    <td className="cell-numeric px-3 py-2">
                      {formatUsdSmart(row.profit)}
                    </td>
                    <td className="cell-numeric px-3 py-2">
                      {row.revenue > 0 ? `${row.marginPct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/projects/${row.projectId}`}
                        className="link-action link-action-edit mr-1.5"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/payments?projectId=${row.projectId}`}
                        className="link-action link-action-payment"
                      >
                        Log payment
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </section>

        <section className="section-separator space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">
            Monthly trip expenses
          </h2>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              Track deployment spending trends by month.
            </p>
            <Link href="/trips" className="text-sm text-zinc-300 underline hover:text-white">
              Open trips
            </Link>
          </div>
          {monthlyTripExpenseRows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No trip expenses yet"
              description="Create a trip and log car, stay, gas, and tools expenses."
              action={{ href: "/trips", label: "Create trip" }}
            />
          ) : (
            <div className="card card-table overflow-x-auto">
              <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left">Month</th>
                    <th className="px-3 py-2 text-right">Trip expenses</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyTripExpenseRows.map((row) => (
                    <tr key={row.monthKey} className="border-t border-zinc-700/50 text-zinc-200">
                      <td className="px-3 py-2">{row.label}</td>
                      <td className="cell-numeric px-3 py-2">{formatUsdSmart(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="section-separator space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">
            Monthly summary
          </h2>
          {monthlyRows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No financial activity yet"
              description="Revenue and payouts will appear here once you add projects and log payments."
              action={{ href: "/projects", label: "Add project" }}
            />
          ) : (
          <div className="card card-table overflow-x-auto">
            <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Month</th>
                  <th className="px-3 py-2 text-right">Revenue</th>
                  <th className="px-3 py-2 text-right">Payouts</th>
                  <th className="px-3 py-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((row) => (
                  <tr key={row.monthKey} className="border-t border-zinc-700/50 text-zinc-200">
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="cell-numeric px-3 py-2">
                      {formatUsdSmart(row.revenue)}
                    </td>
                    <td className="cell-numeric px-3 py-2">
                      {formatUsdSmart(row.payouts)}
                    </td>
                    <td className="cell-numeric px-3 py-2">
                      {formatUsdSmart(row.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </section>
      </div>
    </SidebarLayout>
  );
}
