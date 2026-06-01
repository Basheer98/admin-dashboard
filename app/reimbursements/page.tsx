import { SidebarLayout } from "@/app/components/SidebarLayout";
import { formatCurrency } from "@/lib/currency";
import { getPendingTripReimbursementsForAdminWithTrip } from "@/lib/db";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

function getStatusLabel(row: {
  reimbursedAt: string | null;
  rejectedAt: string | null;
  approvedAt: string | null;
}) {
  if (row.reimbursedAt) return "PAID";
  if (row.rejectedAt) return "REJECTED";
  if (row.approvedAt) return "APPROVED";
  return "PENDING";
}

export default async function ReimbursementsPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const saved = sp.saved === "1";
  const error = sp.error === "invalid" || sp.error === "server";
  const search = typeof sp.q === "string" ? sp.q.trim() : "";
  const statusFilter = typeof sp.status === "string" ? sp.status.trim().toUpperCase() : "";
  const monthFilter = typeof sp.month === "string" ? sp.month.trim() : "";
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : "1") || 1);
  const pageSize = 25;
  const rowsAll = await getPendingTripReimbursementsForAdminWithTrip();
  const filtered = rowsAll.filter((r) => {
    const status = getStatusLabel(r);
    if (statusFilter && statusFilter !== "ALL" && status !== statusFilter) return false;
    if (monthFilter && !String(r.expenseDate).startsWith(monthFilter)) return false;
    if (search) {
      const hay = `${r.paidBy ?? ""} ${r.trip.name} ${r.category} ${r.notes ?? ""}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);

  const paramsFor = (targetPage: number) => {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (statusFilter) qs.set("status", statusFilter);
    if (monthFilter) qs.set("month", monthFilter);
    qs.set("page", String(targetPage));
    return `/reimbursements?${qs.toString()}`;
  };

  return (
    <SidebarLayout
      title="Reimbursements"
      subtitle="Approve or reject fielder expense reimbursements"
      current="reimbursements"
    >
      <div className="flex flex-1 flex-col gap-6">
        {saved && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Reimbursement updated.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Could not update reimbursement.
          </div>
        )}
        <section className="card p-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="label">Search</label>
              <input name="q" defaultValue={search} placeholder="Fielder, trip, category" className="input h-11 w-60" />
            </div>
            <div className="space-y-1">
              <label className="label">Status</label>
              <select name="status" defaultValue={statusFilter || "ALL"} className="select h-11 w-40">
                <option value="ALL">ALL</option>
                <option value="PENDING">PENDING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="PAID">PAID</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="label">Month</label>
              <input type="month" name="month" defaultValue={monthFilter} className="input h-11 w-44" />
            </div>
            <button className="btn-primary h-11 px-4 py-2" type="submit">Apply</button>
          </form>
        </section>

        <section className="card overflow-x-auto">
          <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Fielder</th>
                <th className="px-3 py-2">Trip</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Receipt</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t text-zinc-200 align-top">
                  <td className="px-3 py-2">{r.expenseDate}</td>
                  <td className="px-3 py-2">{r.paidBy ?? "—"}</td>
                  <td className="px-3 py-2">{r.trip.name}</td>
                  <td className="px-3 py-2">{r.category}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(r.amount))}</td>
                  <td className="px-3 py-2">
                    {r.receiptUrl ? (
                      <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="underline hover:text-zinc-100">
                        View
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2">{getStatusLabel(r)}</td>
                  <td className="px-3 py-2">
                    <div className="space-y-2">
                      <form method="POST" action={`/api/reimbursements/${r.id}`}>
                        <input type="hidden" name="action" value="approve" />
                        <button type="submit" className="btn-primary px-3 py-1.5 text-xs">
                          Approve
                        </button>
                      </form>
                      <form method="POST" action={`/api/reimbursements/${r.id}`} className="space-y-2">
                        <input type="hidden" name="action" value="reject" />
                        <input
                          name="rejectionNote"
                          defaultValue={r.rejectionNote ?? ""}
                          placeholder="Rejection note"
                          className="input h-9 w-44"
                        />
                        <button type="submit" className="btn-secondary px-3 py-1.5 text-xs">
                          Reject
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-zinc-500">
                    No reimbursement requests waiting.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <p>
            Showing {rows.length === 0 ? 0 : start + 1}-{Math.min(start + rows.length, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            {safePage > 1 ? (
              <a href={paramsFor(safePage - 1)} className="btn-secondary inline-flex h-9 items-center px-3 py-1.5 text-xs">
                Previous
              </a>
            ) : (
              <span className="px-3 py-1.5 text-xs text-zinc-600">Previous</span>
            )}
            <span className="text-xs">Page {safePage} / {totalPages}</span>
            {safePage < totalPages ? (
              <a href={paramsFor(safePage + 1)} className="btn-secondary inline-flex h-9 items-center px-3 py-1.5 text-xs">
                Next
              </a>
            ) : (
              <span className="px-3 py-1.5 text-xs text-zinc-600">Next</span>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
