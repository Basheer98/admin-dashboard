import { SidebarLayout } from "@/app/components/SidebarLayout";
import {
  countEmailIngestRecords,
  getEmailIngestQueueStats,
  listEmailIngestRecords,
  type EmailIngestStatus,
} from "@/lib/db";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function EmailIngestPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const status = typeof sp.status === "string" ? (sp.status as EmailIngestStatus | "ALL") : "ALL";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : "1") || 1);
  const pageSize = 25;
  const saved = sp.saved === "1";
  const error = typeof sp.error === "string" ? sp.error : "";
  const detail = typeof sp.detail === "string" ? sp.detail : "";

  const offset = (page - 1) * pageSize;
  const [rows, total, stats] = await Promise.all([
    listEmailIngestRecords({ status, q, limit: pageSize, offset }),
    countEmailIngestRecords({ status, q }),
    getEmailIngestQueueStats(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const makeUrl = (targetPage: number) => {
    const qs = new URLSearchParams();
    if (status && status !== "ALL") qs.set("status", status);
    if (q) qs.set("q", q);
    qs.set("page", String(targetPage));
    return `/email-ingest?${qs.toString()}`;
  };

  return (
    <SidebarLayout
      title="Email ingest queue"
      subtitle="Review incoming email records before writing into dashboard entities"
      current="email-ingest"
    >
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex justify-end">
          <a href="/api/export/email-ingest" className="btn-secondary px-4 py-2 text-sm">
            Export approved to CSV (Sheets)
          </a>
        </div>
        {saved && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Queue item updated successfully.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error === "approve-failed" ? "Approval failed." : "Could not update queue item."}
            {detail ? <p className="mt-1 text-xs">{detail}</p> : null}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Pending review</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">{stats.pendingReview}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Retry backlog</p>
            <p className="mt-1 text-2xl font-semibold text-amber-400">{stats.failedRetryable}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Fatal failures</p>
            <p className="mt-1 text-2xl font-semibold text-red-400">{stats.failedFatal}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Approved (24h)</p>
            <p className="mt-1 text-2xl font-semibold text-green-400">{stats.processedLast24h}</p>
          </div>
        </section>

        <section className="card p-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="label">Search</label>
              <input
                name="q"
                defaultValue={q}
                placeholder="Subject, sender, fielder, project"
                className="input h-11 w-72"
              />
            </div>
            <div className="space-y-1">
              <label className="label">Status</label>
              <select name="status" defaultValue={status} className="select h-11 w-52">
                <option value="ALL">ALL</option>
                <option value="PENDING_REVIEW">PENDING_REVIEW</option>
                <option value="FAILED_RETRYABLE">FAILED_RETRYABLE</option>
                <option value="FAILED_FATAL">FAILED_FATAL</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
            <button className="btn-primary h-11 px-4 py-2" type="submit">Apply</button>
          </form>
        </section>

        <section className="card overflow-x-auto">
          <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2">Received</th>
                <th className="px-3 py-2">Sender</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t text-zinc-200 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(row.receivedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{row.senderEmail ?? row.senderName ?? "—"}</td>
                  <td className="px-3 py-2 max-w-[320px]">
                    <p className="truncate">{row.subject ?? "—"}</p>
                    {row.lastError ? <p className="mt-1 text-xs text-red-400">{row.lastError}</p> : null}
                  </td>
                  <td className="px-3 py-2">{row.entityType ?? "—"}</td>
                  <td className="px-3 py-2">
                    {row.confidence == null ? "—" : `${Math.round(row.confidence * 100)}%`}
                  </td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">
                    {(row.status === "PENDING_REVIEW" || row.status === "FAILED_RETRYABLE" || row.status === "FAILED_FATAL") ? (
                      <div className="space-y-2">
                        <form method="POST" action={`/api/ingest/email/${row.id}`} className="space-y-2">
                          <input type="hidden" name="action" value="approve" />
                          <details>
                            <summary className="cursor-pointer text-xs text-zinc-400">Edit payload (optional)</summary>
                            <textarea
                              name="correctedPayload"
                              className="input mt-2 min-h-32 w-md"
                              defaultValue={JSON.stringify(row.parsedPayload, null, 2)}
                            />
                          </details>
                          <button type="submit" className="btn-primary px-3 py-1.5 text-xs">Approve & create</button>
                        </form>
                        <form method="POST" action={`/api/ingest/email/${row.id}`} className="space-y-2">
                          <input type="hidden" name="action" value="reject" />
                          <input
                            name="rejectionReason"
                            defaultValue={row.rejectionReason ?? ""}
                            placeholder="Reason"
                            className="input h-9 w-56"
                          />
                          <button type="submit" className="btn-secondary px-3 py-1.5 text-xs">Reject</button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-zinc-500">No actions</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-zinc-500">
                    No email records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <div className="flex items-center justify-between text-sm text-zinc-400">
          <p>
            Showing {rows.length === 0 ? 0 : offset + 1}-{Math.min(offset + rows.length, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            {safePage > 1 ? (
              <a href={makeUrl(safePage - 1)} className="btn-secondary inline-flex h-9 items-center px-3 py-1.5 text-xs">
                Previous
              </a>
            ) : (
              <span className="px-3 py-1.5 text-xs text-zinc-600">Previous</span>
            )}
            <span className="text-xs">Page {safePage} / {totalPages}</span>
            {safePage < totalPages ? (
              <a href={makeUrl(safePage + 1)} className="btn-secondary inline-flex h-9 items-center px-3 py-1.5 text-xs">
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
