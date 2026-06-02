import Link from "next/link";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { getAllClients } from "@/lib/db";
import { ClientRowActions } from "./ClientRowActions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ClientsPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const saved = sp.saved === "1";
  const clients = await getAllClients();

  return (
    <SidebarLayout
      title="Clients"
      subtitle="Bill-to names and addresses for invoices"
      current="clients"
      breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: "Clients" }]}
    >
      <div className="flex flex-1 flex-col gap-6">
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/invoices" className="text-zinc-300 hover:text-zinc-100 hover:underline">
            ← Invoices
          </Link>
        </nav>

        {saved && (
          <div className="rounded-lg border border-green-800 bg-green-950/40 px-4 py-3 text-sm text-green-200">
            Client saved.
          </div>
        )}

        <section className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-zinc-100">Add client</h2>
          <form method="POST" action="/api/clients" className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="label">Client name</label>
              <input name="name" required placeholder="e.g. DY TELE" className="input h-11" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="label">Email (optional)</label>
              <input name="email" type="email" placeholder="ops@client.com" className="input h-11" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="label">Address (optional)</label>
              <textarea
                name="address"
                rows={3}
                placeholder="Street, city, state, ZIP — shown on invoice PDF when selected"
                className="input py-2.5"
              />
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="btn-primary px-5 py-2.5">
                Save client
              </button>
            </div>
          </form>
        </section>

        <section className="card overflow-x-auto">
          <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Address</th>
                <th className="px-3 py-2 no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-zinc-800 text-zinc-200">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 whitespace-pre-wrap text-zinc-400">{c.address ?? "—"}</td>
                  <td className="no-print px-3 py-2">
                    <ClientRowActions client={c} />
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-zinc-500">
                    No clients yet. Add one above, then pick them when creating an invoice.
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
