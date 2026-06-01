import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { getAllProjects, getAllTrips, getTicketsForFielder } from "@/lib/db";
import Link from "next/link";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function FielderTicketsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || session.role !== "fielder") redirect("/login");
  const sp = searchParams ? await searchParams : {};
  const success = sp.success === "1";
  const error = sp.error === "invalid";
  const idempotencyKey = randomUUID();

  const [tickets, projects, trips] = await Promise.all([
    getTicketsForFielder(session.fielderName),
    getAllProjects(),
    getAllTrips(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-semibold text-zinc-100">My tickets</h2>
        <Link href="/fielder" className="text-sm text-zinc-400 underline hover:text-zinc-100">
          Back to statement
        </Link>
      </div>
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Ticket raised successfully.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Please fill required ticket fields.
        </div>
      )}

      <section className="card p-6">
        <h3 className="text-base font-semibold text-zinc-100">Raise a ticket</h3>
        <form method="POST" action="/api/fielder/tickets" className="mt-4 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <div className="space-y-1 md:col-span-2">
            <label className="label">Title</label>
            <input name="title" required className="input h-11" />
          </div>
          <div className="space-y-1">
            <label className="label">Category</label>
            <select name="category" defaultValue="PROJECT_BLOCKER" className="select h-11">
              <option value="PROJECT_BLOCKER">Project blocker</option>
              <option value="TRAVEL">Travel</option>
              <option value="TOOLS">Tools</option>
              <option value="PAYMENT">Payment</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="label">Priority</label>
            <select name="priority" defaultValue="MEDIUM" className="select h-11">
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="label">Project (optional)</label>
            <select name="projectId" className="select h-11">
              <option value="">Not linked</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.projectCode} - {p.clientName}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="label">Trip (optional)</label>
            <select name="tripId" className="select h-11">
              <option value="">Not linked</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="label">Description</label>
            <textarea name="description" required rows={3} className="input py-2.5" />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary px-5 py-2.5">Submit ticket</button>
          </div>
        </form>
      </section>

      <section className="card overflow-x-auto">
        <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Resolution</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-t text-zinc-200">
                <td className="px-3 py-2">#{t.id}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-zinc-400">{t.description}</div>
                </td>
                <td className="px-3 py-2">{t.category}</td>
                <td className="px-3 py-2">{t.priority}</td>
                <td className="px-3 py-2">{t.status}</td>
                <td className="px-3 py-2">{t.resolutionNote ?? "—"}</td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-zinc-500">
                  No tickets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
