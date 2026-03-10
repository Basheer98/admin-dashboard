import { getAssignmentsWithDetails, getSettings } from "@/lib/db";
import { formatCurrency, formatWithInr } from "@/lib/currency";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { PrintButton } from "@/app/components/PrintButton";
import Link from "next/link";

type ManagerCommissionRow = {
  managerName: string;
  projectId: number;
  projectCode: string;
  invoiceNumber: string | null;
  clientName: string;
  monthKey: string;
  monthLabel: string;
  workerName: string;
  sqft: number;
  netCommission: number;
  companyShare: number;
};

function monthKeyFromDate(dateStr: string): string {
  const d = dateStr.slice(0, 10);
  return d.slice(0, 7);
}

function monthLabelFromKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ManagerCommissionsReportPage({
  searchParams,
}: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const filterManager = typeof sp.manager === "string" ? sp.manager.trim() : "";
  const filterProject = typeof sp.project === "string" ? sp.project.trim() : "";
  const filterMonth = typeof sp.month === "string" ? sp.month.trim() : "";

  const [assignments, settings] = await Promise.all([
    getAssignmentsWithDetails({ includeArchived: true }),
    getSettings(),
  ]);

  const assignmentIdToFielderName = new Map(
    assignments.map((a) => [a.id, a.fielderName.trim().toUpperCase()]),
  );
  const rows: ManagerCommissionRow[] = [];
  for (const a of assignments) {
    if (!a.managedByFielderId || !a.managerRatePerSqft || a.isInternal) continue;
    const project = a.project;
    const managerName =
      assignmentIdToFielderName.get(a.managedByFielderId) ?? "?";
    const sqft = project.totalSqft;
    const workerRate = Number(a.ratePerSqft);
    const managerRate = Number(a.managerRatePerSqft);
    const managerCommission = (managerRate - workerRate) * sqft;
    const managerShare = a.managerCommissionShare
      ? Number(a.managerCommissionShare)
      : 0;
    const companyShare = managerCommission * managerShare;
    const netCommission = managerCommission - companyShare;
    const monthKey = monthKeyFromDate(project.createdAt);
    rows.push({
      managerName,
      projectId: project.id,
      projectCode: project.projectCode,
      invoiceNumber: project.invoiceNumber,
      clientName: project.clientName,
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      workerName: a.fielderName,
      sqft,
      netCommission,
      companyShare,
    });
  }

  let filtered = rows;
  if (filterManager) {
    filtered = filtered.filter(
      (r) => r.managerName.toUpperCase() === filterManager.toUpperCase(),
    );
  }
  if (filterProject) {
    filtered = filtered.filter(
      (r) =>
        r.projectCode.toLowerCase().includes(filterProject.toLowerCase()) ||
        r.clientName.toLowerCase().includes(filterProject.toLowerCase()),
    );
  }
  if (filterMonth) {
    filtered = filtered.filter((r) => r.monthKey === filterMonth);
  }

  const byManager = new Map<string, number>();
  const byProject = new Map<string, { code: string; client: string; total: number }>();
  const byMonth = new Map<string, number>();
  for (const r of filtered) {
    byManager.set(r.managerName, (byManager.get(r.managerName) ?? 0) + r.netCommission);
    const projKey = String(r.projectId);
    const existing = byProject.get(projKey);
    if (!existing) {
      byProject.set(projKey, {
        code: r.projectCode,
        client: r.clientName,
        total: r.netCommission,
      });
    } else {
      existing.total += r.netCommission;
    }
    byMonth.set(r.monthKey, (byMonth.get(r.monthKey) ?? 0) + r.netCommission);
  }

  const totalCommission = filtered.reduce((s, r) => s + r.netCommission, 0);
  const uniqueManagers = Array.from(new Set(rows.map((r) => r.managerName))).sort();
  const uniqueMonths = Array.from(new Set(rows.map((r) => r.monthKey))).sort().reverse();
  const showInr = settings.usdToInrRate != null;

  return (
    <SidebarLayout
      title="Manager commissions"
      current="reports-manager-commissions"
      headerAction={<PrintButton />}
    >
      <div className="flex flex-1 flex-col gap-8">
        <p className="text-sm text-zinc-400">
          All manager net commissions from managed assignments. Filter by manager, project, or month for reconciliation.
        </p>

        <section className="card no-print p-6">
          <h2 className="mb-3 text-base font-semibold text-zinc-100">
            Filters
          </h2>
          <form method="get" action="/reports/manager-commissions" className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="label">Manager</label>
              <select name="manager" className="select h-11 w-48" defaultValue={filterManager}>
                <option value="">All managers</option>
                {uniqueManagers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="label">Month</label>
              <select name="month" className="select h-11 w-40" defaultValue={filterMonth}>
                <option value="">All months</option>
                {uniqueMonths.map((key) => (
                  <option key={key} value={key}>
                    {monthLabelFromKey(key)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="label">Project (code or client)</label>
              <input
                type="text"
                name="project"
                defaultValue={filterProject}
                placeholder="Search..."
                className="input h-11 w-48"
              />
            </div>
            <button type="submit" className="btn-primary h-11 px-4 py-2">
              Apply
            </button>
            {(filterManager || filterProject || filterMonth) && (
              <Link
                href="/reports/manager-commissions"
                className="btn-secondary inline-flex h-11 items-center px-4 py-2"
              >
                Clear
              </Link>
            )}
          </form>
        </section>

        <div className="card p-6 print:shadow-none">
          <h1 className="text-xl font-bold text-zinc-100">
            Manager commissions report
          </h1>
          {(filterManager || filterProject || filterMonth) && (
            <p className="mt-1 text-sm text-zinc-500">
              Filtered by
              {filterManager && ` manager: ${filterManager}`}
              {filterMonth && ` month: ${monthLabelFromKey(filterMonth)}`}
              {filterProject && ` project: ${filterProject}`}
            </p>
          )}

          <section className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm font-medium text-zinc-500">Total net commissions</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">
                {showInr
                  ? formatWithInr(totalCommission, {
                      showInr: true,
                      usdToInrRate: settings.usdToInrRate,
                    })
                  : `$${formatCurrency(totalCommission)}`}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Managers</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">
                {byManager.size}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Projects</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">
                {byProject.size}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Rows</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">
                {filtered.length}
              </p>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-base font-semibold text-zinc-100">
              By manager
            </h2>
            <div className="mt-2 overflow-x-auto">
              <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2">Manager</th>
                    <th className="px-3 py-2">Net commissions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(byManager.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, total]) => (
                      <tr key={name} className="border-t text-zinc-200">
                        <td className="px-3 py-2 font-medium">{name}</td>
                        <td className="px-3 py-2">
                          {showInr
                            ? formatWithInr(total, {
                                showInr: true,
                                usdToInrRate: settings.usdToInrRate,
                              })
                            : `$${formatCurrency(total)}`}
                        </td>
                      </tr>
                    ))}
                  {byManager.size === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-zinc-500">
                        No manager commissions in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-base font-semibold text-zinc-100">
              By project
            </h2>
            <div className="mt-2 overflow-x-auto">
              <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Net commissions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(byProject.entries())
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([id, { code, client, total }]) => (
                      <tr key={id} className="border-t text-zinc-200">
                        <td className="px-3 py-2">
                          <Link
                            href={`/projects/${id}`}
                            className="font-medium text-emerald-400 hover:underline"
                          >
                            {code}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{client}</td>
                        <td className="px-3 py-2">
                          {showInr
                            ? formatWithInr(total, {
                                showInr: true,
                                usdToInrRate: settings.usdToInrRate,
                              })
                            : `$${formatCurrency(total)}`}
                        </td>
                      </tr>
                    ))}
                  {byProject.size === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-zinc-500">
                        No manager commissions in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-base font-semibold text-zinc-100">
              By month
            </h2>
            <div className="mt-2 overflow-x-auto">
              <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2">Month</th>
                    <th className="px-3 py-2">Net commissions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(byMonth.entries())
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .map(([monthKey, total]) => (
                      <tr key={monthKey} className="border-t text-zinc-200">
                        <td className="px-3 py-2">{monthLabelFromKey(monthKey)}</td>
                        <td className="px-3 py-2">
                          {showInr
                            ? formatWithInr(total, {
                                showInr: true,
                                usdToInrRate: settings.usdToInrRate,
                              })
                            : `$${formatCurrency(total)}`}
                        </td>
                      </tr>
                    ))}
                  {byMonth.size === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-zinc-500">
                        No manager commissions in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-base font-semibold text-zinc-100">
              Detail (all rows)
            </h2>
            <div className="mt-2 overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2">Manager</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2">Month</th>
                    <th className="px-3 py-2">Worker</th>
                    <th className="px-3 py-2">SQFT</th>
                    <th className="px-3 py-2">Net commission</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered
                    .sort(
                      (a, b) =>
                        b.monthKey.localeCompare(a.monthKey) ||
                        a.managerName.localeCompare(b.managerName) ||
                        a.projectCode.localeCompare(b.projectCode),
                    )
                    .map((r, i) => (
                      <tr key={i} className="border-t text-zinc-200">
                        <td className="px-3 py-2 font-medium">{r.managerName}</td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/projects/${r.projectId}`}
                            className="text-emerald-400 hover:underline"
                          >
                            {r.projectCode}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{r.invoiceNumber?.trim() ?? "—"}</td>
                        <td className="px-3 py-2">{r.monthLabel}</td>
                        <td className="px-3 py-2">{r.workerName}</td>
                        <td className="px-3 py-2">{r.sqft.toLocaleString()}</td>
                        <td className="px-3 py-2">
                          {showInr
                            ? formatWithInr(r.netCommission, {
                                showInr: true,
                                usdToInrRate: settings.usdToInrRate,
                              })
                            : `$${formatCurrency(r.netCommission)}`}
                        </td>
                      </tr>
                    ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-2 text-zinc-500">
                        No manager commissions in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mt-6 text-xs text-zinc-500">
            Generated {new Date().toLocaleString()}. Month is based on project creation date.
          </p>
        </div>

        <div className="no-print flex gap-3 text-sm">
          <Link
            href="/reports/monthly"
            className="text-zinc-400 underline hover:text-zinc-100"
          >
            ← Monthly summary
          </Link>
        </div>
      </div>
    </SidebarLayout>
  );
}
