import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { formatCurrency } from "@/lib/currency";
import { getTripsForFielder } from "@/lib/db";
import Link from "next/link";

export default async function FielderTravelPage() {
  const session = await getSession();
  if (!session || session.role !== "fielder") redirect("/login");

  const trips = await getTripsForFielder(session.fielderName);
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-semibold text-zinc-100">My travel details</h2>
        <Link href="/fielder" className="text-sm text-zinc-400 underline hover:text-zinc-100">
          Back to statement
        </Link>
      </div>
      <section className="card overflow-x-auto">
        <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2">Trip</th>
              <th className="px-3 py-2">State/City</th>
              <th className="px-3 py-2">Dates</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Trip expenses</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id} className="border-t text-zinc-200">
                <td className="px-3 py-2">{t.name}</td>
                <td className="px-3 py-2">{t.state}{t.city ? `, ${t.city}` : ""}</td>
                <td className="px-3 py-2">{t.startDate}{t.endDate ? ` to ${t.endDate}` : ""}</td>
                <td className="px-3 py-2">{t.status}</td>
                <td className="px-3 py-2">{t.project?.projectCode ?? "—"}</td>
                <td className="px-3 py-2">{formatCurrency(t.totalExpense)}</td>
              </tr>
            ))}
            {trips.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-zinc-500">
                  No assigned trips yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
