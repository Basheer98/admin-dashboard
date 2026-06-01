import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { getInvoiceWithLines, invoiceLineRevenue } from "@/lib/db";
import { formatCurrency, formatRate } from "@/lib/currency";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function InvoiceDetailPage({ params, searchParams }: PageProps) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const data = await getInvoiceWithLines(id);
  if (!data) notFound();

  const sp = searchParams ? await searchParams : {};
  const success = sp.success === "1";

  const { invoice, lines } = data;
  const total = lines.reduce((sum, l) => sum + invoiceLineRevenue(l), 0);

  return (
    <SidebarLayout
      title={`Invoice ${invoice.invoiceNumber}`}
      current="invoices"
      breadcrumbs={[
        { label: "Invoices", href: "/invoices" },
        { label: invoice.invoiceNumber },
      ]}
      headerAction={
        <a
          href={`/api/invoice-records/${invoice.id}/pdf`}
          className="btn-primary inline-flex items-center px-4 py-2"
          download
        >
          Download PDF
        </a>
      }
    >
      <div className="flex flex-1 flex-col gap-6">
        <nav className="text-sm">
          <Link href="/invoices" className="text-zinc-300 hover:text-zinc-100 hover:underline">
            ← Back to invoices
          </Link>
        </nav>

        {success && (
          <div className="rounded-lg border border-green-800 bg-green-950/40 px-4 py-3 text-sm text-green-200">
            Invoice saved successfully.
          </div>
        )}

        <section className="card p-6">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-zinc-100">{invoice.invoiceNumber}</h1>
              <p className="mt-1 text-zinc-400">Bill to: {invoice.clientName}</p>
              <p className="text-sm text-zinc-500">
                Issued {invoice.issueDate}
                {invoice.dueDate ? ` · Due ${invoice.dueDate}` : ""}
              </p>
              {invoice.importFilename && (
                <p className="mt-1 text-xs text-zinc-500">Imported from {invoice.importFilename}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-500">Total</p>
              <p className="text-2xl font-bold text-zinc-100">${formatCurrency(total)}</p>
              <p className="mt-1 text-xs capitalize text-zinc-500">{invoice.source.replace(/_/g, " ")}</p>
            </div>
          </div>
          {invoice.notes && (
            <p className="mt-4 text-sm text-zinc-400 border-t border-zinc-800 pt-4">{invoice.notes}</p>
          )}
        </section>

        <section className="card overflow-x-auto">
          <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">SQFT</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Revenue</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const revenue = invoiceLineRevenue(line);
                return (
                  <tr key={line.id} className="border-b border-zinc-800">
                    <td className="px-3 py-2 font-medium">{line.projectCode}</td>
                    <td className="px-3 py-2">{line.clientName ?? "—"}</td>
                    <td className="px-3 py-2">{line.totalSqft.toLocaleString()}</td>
                    <td className="px-3 py-2">{formatRate(Number(line.ratePerSqft))}</td>
                    <td className="px-3 py-2">${formatCurrency(revenue)}</td>
                    <td className="px-3 py-2">
                      {line.projectId ? (
                        <Link href={`/projects/${line.projectId}`} className="text-emerald-400 hover:underline">
                          Project
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="px-3 py-3 text-right font-semibold text-zinc-300">
                  Total
                </td>
                <td className="px-3 py-3 font-semibold text-zinc-100">${formatCurrency(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </section>
      </div>
    </SidebarLayout>
  );
}
