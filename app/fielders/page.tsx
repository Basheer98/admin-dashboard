import { getAssignmentsWithDetails } from "@/lib/db";
import { formatCurrency } from "@/lib/currency";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import Link from "next/link";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function FieldersReportListPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const filterName = typeof sp.name === "string" ? sp.name.trim() : "";
  const hasPendingOnly = sp.pending === "1";
  const minSqftParam = typeof sp.minSqft === "string" ? sp.minSqft.trim() : "";
  const minSqft = minSqftParam !== "" ? Number(minSqftParam) : NaN;
  const hasMinSqft = !Number.isNaN(minSqft) && minSqft > 0;
  const assignments = await getAssignmentsWithDetails();

  const assignmentIdToFielderName = new Map(
    assignments.map((a) => [a.id, a.fielderName.trim().toUpperCase()]),
  );

  const byFielder = new Map<
    string,
    {
      totalOwed: number;
      totalPaid: number;
      pending: number;
      assignmentCount: number;
      totalSqft: number;
    }
  >();

  for (const a of assignments) {
    const name = a.fielderName;
    if (!name) continue;
    const key = name.trim().toUpperCase();

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

    const totalPaid = a.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const pending = a.isInternal ? 0 : Math.max(totalRequired - totalPaid, 0);

    const existing = byFielder.get(key) ?? {
      totalOwed: 0,
      totalPaid: 0,
      pending: 0,
      assignmentCount: 0,
      totalSqft: 0,
    };
    existing.totalOwed += totalRequired;
    existing.totalPaid += totalPaid;
    existing.pending += pending;
    existing.assignmentCount += 1;
    existing.totalSqft += sqft;
    byFielder.set(key, existing);
  }

  for (const a of assignments) {
    if (!a.managedByFielderId || !a.managerRatePerSqft || a.isInternal) continue;
    const managerName = assignmentIdToFielderName.get(a.managedByFielderId);
    if (!managerName) continue;
    const sqft = a.project.totalSqft;
    const workerRate = Number(a.ratePerSqft);
    const managerRate = Number(a.managerRatePerSqft);
    const managerCommission = (managerRate - workerRate) * sqft;
    const managerShare = a.managerCommissionShare
      ? Number(a.managerCommissionShare)
      : 0;
    const companyShare = managerCommission * managerShare;
    const managerNetCommission = managerCommission - companyShare;

    const existing = byFielder.get(managerName) ?? {
      totalOwed: 0,
      totalPaid: 0,
      pending: 0,
      assignmentCount: 0,
      totalSqft: 0,
    };
    existing.totalOwed += managerNetCommission;
    existing.pending += managerNetCommission;
    byFielder.set(managerName, existing);
  }

  let fielders = Array.from(byFielder.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (filterName) {
    fielders = fielders.filter((f) =>
      f.name.toLowerCase().includes(filterName.toLowerCase()),
    );
  }
  if (hasPendingOnly) {
    fielders = fielders.filter((f) => f.pending > 0);
  }
  if (hasMinSqft) {
    fielders = fielders.filter((f) => f.totalSqft >= minSqft);
  }

  return (
    <SidebarLayout title="Fielder reports" current="fielders">
      <div className="flex flex-1 flex-col gap-8">
        <p className="text-sm text-slate-600">
          One page per fielder with all assignments, total owed, total paid, and
          pending.
        </p>
        <section className="card p-6">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Filter fielders
          </h2>
          <form method="get" action="/fielders" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="label">Name</label>
              <input
                type="text"
                name="name"
                defaultValue={filterName}
                placeholder="Search by name"
                className="input h-11 w-48"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pending"
                name="pending"
                value="1"
                defaultChecked={hasPendingOnly}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="pending" className="label cursor-pointer">Has pending</label>
            </div>
            <div className="space-y-1">
              <label className="label">Min SQFT</label>
              <input
                type="number"
                name="minSqft"
                min={0}
                defaultValue={hasMinSqft ? minSqft : ""}
                placeholder="e.g. 10000"
                className="input h-11 w-32"
              />
            </div>
            <button type="submit" className="btn-primary h-11 px-4 py-2">
              Apply
            </button>
            {(filterName || hasPendingOnly || hasMinSqft) && (
              <Link
                href="/fielders"
                className="btn-secondary inline-flex h-11 items-center px-4 py-2"
              >
                Clear filter
              </Link>
            )}
          </form>
        </section>
        <section className="card overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2">Fielder</th>
                <th className="px-3 py-2">Assignments</th>
                <th className="px-3 py-2">Total SQFT</th>
                <th className="px-3 py-2">Total owed</th>
                <th className="px-3 py-2">Total paid</th>
                <th className="px-3 py-2">Pending</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {fielders.map((f) => (
                <tr key={f.name} className="border-t border-slate-200 text-slate-800">
                  <td className="px-3 py-2 font-medium">{f.name}</td>
                  <td className="px-3 py-2">{f.assignmentCount}</td>
                  <td className="px-3 py-2">{f.totalSqft.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    {formatCurrency(f.totalOwed)}
                  </td>
                  <td className="px-3 py-2">
                    {formatCurrency(f.totalPaid)}
                  </td>
                  <td className="px-3 py-2">
                    {formatCurrency(f.pending)}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/fielders/${encodeURIComponent(f.name)}`}
                      className="text-slate-700 underline hover:text-slate-900"
                    >
                      View report
                    </Link>
                  </td>
                </tr>
              ))}
              {fielders.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-4 text-center text-slate-500"
                  >
                    No fielders with assignments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </SidebarLayout>
  );
}
