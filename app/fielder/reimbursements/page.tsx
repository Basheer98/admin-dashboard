import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { formatCurrency } from "@/lib/currency";
import { getAllTrips, getTripReimbursementsForFielderWithTrip } from "@/lib/db";
import Link from "next/link";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function FielderReimbursementsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || session.role !== "fielder") redirect("/login");

  const sp = searchParams ? await searchParams : {};
  const success = sp.success === "1";
  const error = typeof sp.error === "string" ? sp.error : "";
  const idempotencyKey = randomUUID();

  const [trips, reimbursementRows] = await Promise.all([
    getAllTrips(),
    getTripReimbursementsForFielderWithTrip(session.fielderName.trim().toUpperCase()),
  ]);
  const totalPending = reimbursementRows
    .filter((r) => !r.reimbursedAt && !r.rejectedAt && !r.approvedAt)
    .reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-semibold text-zinc-100">My reimbursements</h2>
        <Link href="/fielder" className="text-sm text-zinc-400 underline hover:text-zinc-100">
          Back to statement
        </Link>
      </div>

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Reimbursement request submitted with receipt.
        </div>
      )}
      {error === "invalid" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Please fill trip, date, category and amount correctly.
        </div>
      )}
      {error === "missing-receipt" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Receipt file is required.
        </div>
      )}
      {error === "server" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Upload failed. Please retry.
        </div>
      )}

      <section className="card p-6">
        <h3 className="text-base font-semibold text-zinc-100">Submit reimbursement</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Upload fuel/tools/travel receipt. Allowed types: JPG, PNG, PDF. Max size: 10 MB.
        </p>
        <form method="POST" action="/api/fielder/reimbursements" encType="multipart/form-data" className="mt-4 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <div className="space-y-1">
            <label className="label">Trip</label>
            <select name="tripId" required className="select h-11">
              <option value="">Select trip</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.state})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="label">Date</label>
            <input name="expenseDate" type="date" required className="input h-11" />
          </div>
          <div className="space-y-1">
            <label className="label">Category</label>
            <select name="category" defaultValue="GAS" className="select h-11">
              <option value="GAS">Gas</option>
              <option value="CAR">Car</option>
              <option value="ACCOMMODATION">Accommodation</option>
              <option value="TOOLS">Tools</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="label">Amount</label>
            <input name="amount" type="number" min="0.01" step="0.01" required className="input h-11" />
          </div>
          <input type="hidden" name="currency" value="USD" />
          <div className="space-y-1">
            <label className="label">Vendor (optional)</label>
            <input name="vendor" className="input h-11" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="label">Receipt file</label>
            <input name="receipt" type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" required className="input h-11 py-2" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="label">Notes (optional)</label>
            <textarea name="notes" rows={2} className="input py-2.5" />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary px-5 py-2.5">Submit reimbursement</button>
          </div>
        </form>
      </section>

      <section className="card p-6">
        <h3 className="text-base font-semibold text-zinc-100">Pending reimbursement amount</h3>
        <p className="mt-2 text-2xl font-semibold text-zinc-100">{formatCurrency(totalPending)}</p>
      </section>

      <section className="card overflow-x-auto">
        <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Trip</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Receipt</th>
              <th className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {reimbursementRows.map((r) => (
              <tr key={r.id} className="border-t text-zinc-200">
                <td className="px-3 py-2">{r.expenseDate}</td>
                <td className="px-3 py-2">{r.trip.name}</td>
                <td className="px-3 py-2">{r.category}</td>
                <td className="px-3 py-2">{formatCurrency(Number(r.amount))}</td>
                <td className="px-3 py-2">
                  {r.reimbursedAt ? "PAID" : r.rejectedAt ? "REJECTED" : r.approvedAt ? "APPROVED" : "PENDING"}
                </td>
                <td className="px-3 py-2">
                  {r.receiptUrl ? (
                    <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="underline hover:text-zinc-100">
                      View
                    </a>
                  ) : "—"}
                </td>
                <td className="px-3 py-2">{r.notes ?? "—"}</td>
              </tr>
            ))}
            {reimbursementRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-zinc-500">
                  No reimbursements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
