import Link from "next/link";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { EmptyState } from "@/app/components/EmptyState";
import { getAllInvoiceSummaries } from "@/lib/db";
import { formatCurrency } from "@/lib/currency";
import { FileText, Plus, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const invoices = await getAllInvoiceSummaries();

  return (
    <SidebarLayout title="Invoices" subtitle="Create bills and import from your spreadsheet" current="invoices">
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-400">
            Client invoices (project #, SQFT, rate, total) for payment. Import CSV to sync your Project Tracker into the dashboard; rates come from Settings.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/clients" className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5">
              Clients
            </Link>
            <Link href="/invoices/import" className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5">
              <Upload className="h-4 w-4" aria-hidden />
              Import CSV
            </Link>
            <Link href="/invoices/new" className="btn-primary inline-flex items-center gap-2 px-4 py-2.5">
              <Plus className="h-4 w-4" aria-hidden />
              Create new invoice
            </Link>
          </div>
        </div>

        {invoices.length === 0 ? (
          <>
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              description="Create an invoice or import a CSV from Google Sheets to get started."
              action={{ href: "/invoices/import", label: "Import CSV" }}
            />
            <p className="text-center text-sm text-zinc-500">
              or{" "}
              <Link href="/invoices/new" className="text-zinc-300 hover:text-white hover:underline">
                create an invoice manually
              </Link>
            </p>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {invoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="card group block p-5 transition-colors hover:border-emerald-700/50 hover:bg-zinc-900/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold text-zinc-100 group-hover:text-white">
                    {inv.invoiceNumber}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      inv.status === "final"
                        ? "bg-emerald-950 text-emerald-300"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {inv.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">{inv.clientName}</p>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-zinc-500">Lines</dt>
                    <dd className="font-medium text-zinc-200">{inv.lineCount}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Total</dt>
                    <dd className="font-medium text-zinc-200">${formatCurrency(inv.totalRevenue)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Issued</dt>
                    <dd className="text-zinc-300">{inv.issueDate}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Source</dt>
                    <dd className="text-zinc-300 capitalize">{inv.source.replace(/_/g, " ")}</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
