import { SidebarLayout } from "@/app/components/SidebarLayout";
import { getAllTickets } from "@/lib/db";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function TicketsPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const saved = sp.saved === "1";
  const error = sp.error === "invalid";
  const tickets = await getAllTickets();

  return (
    <SidebarLayout title="Tickets" subtitle="Fielder issues and support requests" current="tickets">
      <div className="flex flex-1 flex-col gap-6">
        {saved && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Ticket updated.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Invalid ticket update.
          </div>
        )}
        <section className="card overflow-x-auto">
          <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Fielder</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Project/Trip</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Update</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t text-zinc-200 align-top">
                  <td className="px-3 py-2">#{t.id}</td>
                  <td className="px-3 py-2">{t.fielderName}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-zinc-400">{t.description}</div>
                  </td>
                  <td className="px-3 py-2">{t.category}</td>
                  <td className="px-3 py-2">{t.priority}</td>
                  <td className="px-3 py-2">
                    {t.project ? t.project.projectCode : "—"}
                    {t.trip ? ` / ${t.trip.name}` : ""}
                  </td>
                  <td className="px-3 py-2">{t.status}</td>
                  <td className="px-3 py-2">
                    <form method="POST" action={`/api/tickets/${t.id}`} className="space-y-2">
                      <select name="status" defaultValue={t.status} className="select h-9 w-40">
                        <option value="OPEN">OPEN</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                      <input
                        name="resolutionNote"
                        defaultValue={t.resolutionNote ?? ""}
                        placeholder="Resolution note"
                        className="input h-9 w-52"
                      />
                      <button type="submit" className="btn-secondary px-3 py-1.5 text-xs">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-zinc-500">
                    No tickets yet.
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
