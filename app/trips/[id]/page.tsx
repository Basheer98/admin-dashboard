import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { formatCurrency } from "@/lib/currency";
import { getTripById } from "@/lib/db";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function TripDetailsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const tripId = Number(id);
  const sp = searchParams ? await searchParams : {};
  const success = sp.success === "1";
  const expenseSaved = sp.expenseSaved === "1";
  const trip = await getTripById(tripId);

  if (!trip) notFound();

  const categoryTotals: Record<string, number> = {
    CAR: 0,
    ACCOMMODATION: 0,
    GAS: 0,
    TOOLS: 0,
    OTHER: 0,
  };
  const paidByTotals = new Map<string, number>();
  trip.expenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + Number(e.amount);
    const paidBy = (e.paidBy ?? "Company").trim() || "Company";
    paidByTotals.set(paidBy, (paidByTotals.get(paidBy) ?? 0) + Number(e.amount));
  });
  const paidByRows = Array.from(paidByTotals.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
  const totalBudget =
    Number(trip.budgetCar ?? 0) +
    Number(trip.budgetAccommodation ?? 0) +
    Number(trip.budgetGas ?? 0) +
    Number(trip.budgetTools ?? 0);
  const budgetDelta = totalBudget - trip.totalExpense;
  const budgetPct = totalBudget > 0 ? Math.min((trip.totalExpense / totalBudget) * 100, 100) : 0;

  return (
    <SidebarLayout
      title={trip.name}
      subtitle={`${trip.state}${trip.city ? `, ${trip.city}` : ""}`}
      current="trips"
      backLink={{ href: "/trips", label: "Trips & expenses" }}
    >
      <div className="flex flex-1 flex-col gap-6">
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Trip created successfully.
          </div>
        )}
        {expenseSaved && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Expense added successfully.
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">Status</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{trip.status}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">Start date</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{trip.startDate}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">End date</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{trip.endDate ?? "—"}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">Total expenses</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(trip.totalExpense)}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">Total budget</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(totalBudget)}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">Budget status</p>
            <p className={`mt-2 text-lg font-semibold ${budgetDelta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {budgetDelta >= 0 ? "Under budget" : "Over budget"}
            </p>
            <p className="text-sm text-slate-600">{formatCurrency(Math.abs(budgetDelta))}</p>
          </div>
          <div className="card p-5 md:col-span-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Fielders</p>
            <p className="mt-2 text-sm font-medium text-slate-900">{trip.teamMembers ?? "Not set"}</p>
          </div>
          <div className="card p-5 md:col-span-4">
            <div className="mb-2 flex items-center justify-between text-sm text-slate-700">
              <span>Budget usage</span>
              <span>{totalBudget > 0 ? `${budgetPct.toFixed(1)}%` : "—"}</span>
            </div>
            <div className="h-2 rounded bg-slate-200">
              <div className="h-2 rounded bg-indigo-500" style={{ width: `${budgetPct}%` }} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          {Object.entries(categoryTotals).map(([category, total]) => (
            <div key={category} className="card p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">{category}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(total)}</p>
              <p className="mt-1 text-xs text-slate-500">
                Budget: {formatCurrency(
                  category === "CAR"
                    ? Number(trip.budgetCar ?? 0)
                    : category === "ACCOMMODATION"
                      ? Number(trip.budgetAccommodation ?? 0)
                      : category === "GAS"
                        ? Number(trip.budgetGas ?? 0)
                        : category === "TOOLS"
                          ? Number(trip.budgetTools ?? 0)
                          : 0,
                )}
              </p>
            </div>
          ))}
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900">Add expense</h2>
          <p className="mt-1 text-sm text-slate-600">
            Log car, accommodation, gas, tools or other spending for this trip.
          </p>
          <form method="POST" action="/api/trip-expenses" className="mt-4 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="tripId" value={trip.id} />
            <div className="space-y-1">
              <label className="label">Expense date</label>
              <input name="expenseDate" type="date" required className="input h-11" />
            </div>
            <div className="space-y-1">
              <label className="label">Category</label>
              <select name="category" defaultValue="CAR" className="select h-11">
                <option value="CAR">Car</option>
                <option value="ACCOMMODATION">Accommodation</option>
                <option value="GAS">Gas</option>
                <option value="TOOLS">Tools</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="label">Amount</label>
              <input name="amount" type="number" min="0" step="0.01" required className="input h-11" />
            </div>
            <div className="space-y-1">
              <label className="label">Currency</label>
              <select name="currency" defaultValue="INR" className="select h-11">
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="label">Paid by (optional)</label>
              <input name="paidBy" placeholder="Company or fielder name" className="input h-11" />
            </div>
            <div className="space-y-1">
              <label className="label">Vendor (optional)</label>
              <input name="vendor" placeholder="Hotel, fuel station, etc." className="input h-11" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="label">Notes</label>
              <textarea name="notes" rows={2} className="input py-2.5" />
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="btn-primary px-5 py-2.5">
                Save expense
              </button>
            </div>
          </form>
        </section>

        <section className="card overflow-x-auto">
          <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Currency</th>
                <th className="px-3 py-2">Paid by</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {trip.expenses.map((e) => (
                <tr key={e.id} className="border-t text-slate-800">
                  <td className="px-3 py-2">{e.expenseDate}</td>
                  <td className="px-3 py-2">{e.category}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(e.amount))}</td>
                  <td className="px-3 py-2">{e.currency}</td>
                  <td className="px-3 py-2">{e.paidBy ?? "—"}</td>
                  <td className="px-3 py-2">{e.vendor ?? "—"}</td>
                  <td className="px-3 py-2">{e.notes ?? "—"}</td>
                </tr>
              ))}
              {trip.expenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                    No expenses logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card overflow-x-auto">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Spend by payer</h3>
          </div>
          <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2">Paid by</th>
                <th className="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {paidByRows.map((row) => (
                <tr key={row.name} className="border-t text-slate-800">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{formatCurrency(row.amount)}</td>
                </tr>
              ))}
              {paidByRows.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-3 py-4 text-center text-slate-500">
                    No payer data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <div>
          <Link href="/trips" className="text-sm text-slate-700 underline hover:text-slate-900">
            Back to all trips
          </Link>
          <Link href={`/trips/${trip.id}/edit`} className="ml-4 text-sm text-slate-700 underline hover:text-slate-900">
            Edit trip
          </Link>
        </div>
      </div>
    </SidebarLayout>
  );
}
