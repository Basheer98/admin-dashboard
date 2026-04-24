import Link from "next/link";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { getAllProjects, getAllTrips } from "@/lib/db";
import { formatCurrency } from "@/lib/currency";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function TripsPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const success = sp.success === "1";
  const error = sp.error === "invalid";
  const trips = await getAllTrips();
  const projects = await getAllProjects({ includeArchived: true });
  const stateTotals = new Map<string, number>();
  const projectTotals = new Map<string, { label: string; total: number }>();
  trips.forEach((t) => {
    stateTotals.set(t.state, (stateTotals.get(t.state) ?? 0) + t.totalExpense);
    if (t.project) {
      const key = String(t.project.id);
      const existing = projectTotals.get(key) ?? { label: t.project.projectCode, total: 0 };
      existing.total += t.totalExpense;
      projectTotals.set(key, existing);
    }
  });
  const stateRows = Array.from(stateTotals.entries())
    .map(([state, total]) => ({ state, total }))
    .sort((a, b) => b.total - a.total);
  const projectRows = Array.from(projectTotals.values()).sort((a, b) => b.total - a.total);
  const maxState = stateRows[0]?.total ?? 0;
  const maxProject = projectRows[0]?.total ?? 0;

  return (
    <SidebarLayout title="Trips & expenses" current="trips">
      <div className="flex flex-1 flex-col gap-6">
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Trip created successfully.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Please check trip details and try again.
          </div>
        )}

        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Create trip deployment</h2>
            <div className="flex flex-wrap items-center gap-2">
              <a href="/api/export/trips" className="btn-secondary px-3 py-2 text-sm">
                Export trips CSV
              </a>
              <a href="/api/export/trip-expenses" className="btn-secondary px-3 py-2 text-sm">
                Export expenses CSV
              </a>
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Create one trip when you send fielders to another state. Then log all car, stay, gas, and tool expenses inside that trip.
          </p>
          <form method="POST" action="/api/trips" className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label className="label">Trip name</label>
              <input name="name" required placeholder="e.g. Karnataka - Bengaluru week 2" className="input h-11" />
            </div>
            <div className="space-y-1">
              <label className="label">State</label>
              <input name="state" required placeholder="e.g. Karnataka" className="input h-11" />
            </div>
            <div className="space-y-1">
              <label className="label">City (optional)</label>
              <input name="city" placeholder="e.g. Bengaluru" className="input h-11" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="label">Team members (optional)</label>
              <input
                name="teamMembers"
                placeholder="e.g. Nivas, Naveen, Ashiq"
                className="input h-11"
              />
            </div>
            <div className="space-y-1">
              <label className="label">Budget - Car</label>
              <input name="budgetCar" type="number" min="0" step="0.01" className="input h-11" />
            </div>
            <div className="space-y-1">
              <label className="label">Budget - Accommodation</label>
              <input name="budgetAccommodation" type="number" min="0" step="0.01" className="input h-11" />
            </div>
            <div className="space-y-1">
              <label className="label">Budget - Gas</label>
              <input name="budgetGas" type="number" min="0" step="0.01" className="input h-11" />
            </div>
            <div className="space-y-1">
              <label className="label">Budget - Tools</label>
              <input name="budgetTools" type="number" min="0" step="0.01" className="input h-11" />
            </div>
            <div className="space-y-1">
              <label className="label">Project (optional)</label>
              <select name="projectId" className="select h-11">
                <option value="">Not linked</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode} - {p.clientName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="label">Status</label>
              <select name="status" defaultValue="PLANNED" className="select h-11">
                <option value="PLANNED">Planned</option>
                <option value="ACTIVE">Active</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="label">Start date</label>
              <input name="startDate" type="date" required className="input h-11" />
            </div>
            <div className="space-y-1">
              <label className="label">End date (optional)</label>
              <input name="endDate" type="date" className="input h-11" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="label">Notes</label>
              <textarea name="notes" rows={2} className="input py-2.5" />
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="btn-primary px-5 py-2.5">
                Create trip
              </button>
            </div>
          </form>
        </section>

        <section className="card overflow-x-auto">
          <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2">Trip</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Fielders</th>
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">Dates</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Budget</th>
                <th className="px-3 py-2">Total expenses</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => {
                return (
                  <tr key={t.id} className="border-t text-slate-800">
                    <td className="px-3 py-2 font-medium">{t.name}</td>
                    <td className="px-3 py-2">{t.state}{t.city ? `, ${t.city}` : ""}</td>
                    <td className="px-3 py-2">{t.teamMembers ?? "—"}</td>
                    <td className="px-3 py-2">{t.project ? t.project.projectCode : "—"}</td>
                    <td className="px-3 py-2">
                      {t.startDate} {t.endDate ? `to ${t.endDate}` : ""}
                    </td>
                    <td className="px-3 py-2">{t.status}</td>
                    <td className="px-3 py-2">
                      {formatCurrency(
                        Number(t.budgetCar ?? 0) +
                          Number(t.budgetAccommodation ?? 0) +
                          Number(t.budgetGas ?? 0) +
                          Number(t.budgetTools ?? 0),
                      )}
                    </td>
                    <td className="px-3 py-2">{formatCurrency(t.totalExpense)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/trips/${t.id}`} className="text-slate-700 underline hover:text-slate-900">
                        Open
                      </Link>
                      <Link href={`/trips/${t.id}/edit`} className="ml-3 text-slate-700 underline hover:text-slate-900">
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {trips.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-slate-500">
                    No trips yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="card p-6">
            <h3 className="text-base font-semibold text-slate-900">Spend by state</h3>
            <div className="mt-4 space-y-3">
              {stateRows.slice(0, 8).map((row) => {
                const pct = maxState > 0 ? Math.max((row.total / maxState) * 100, 4) : 0;
                return (
                  <div key={row.state}>
                    <div className="mb-1 flex items-center justify-between text-sm text-slate-700">
                      <span>{row.state}</span>
                      <span>{formatCurrency(row.total)}</span>
                    </div>
                    <div className="h-2 rounded bg-slate-200">
                      <div className="h-2 rounded bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {stateRows.length === 0 && <p className="text-sm text-slate-500">No state data yet.</p>}
            </div>
          </div>
          <div className="card p-6">
            <h3 className="text-base font-semibold text-slate-900">Trip cost by project</h3>
            <div className="mt-4 space-y-3">
              {projectRows.slice(0, 8).map((row) => {
                const pct = maxProject > 0 ? Math.max((row.total / maxProject) * 100, 4) : 0;
                return (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between text-sm text-slate-700">
                      <span>{row.label}</span>
                      <span>{formatCurrency(row.total)}</span>
                    </div>
                    <div className="h-2 rounded bg-slate-200">
                      <div className="h-2 rounded bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {projectRows.length === 0 && <p className="text-sm text-slate-500">No project-linked trip data yet.</p>}
            </div>
          </div>
        </section>
      </div>
    </SidebarLayout>
  );
}
