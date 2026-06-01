import Link from "next/link";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { InvoiceForm } from "../components/InvoiceForm";
import { getSettings, suggestNextInvoiceNumber } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const [suggested, settings] = await Promise.all([
    suggestNextInvoiceNumber(),
    getSettings(),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <SidebarLayout
      title="Create invoice"
      current="invoices"
      breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: "Create" }]}
    >
      <div className="flex flex-1 flex-col gap-6">
        <nav className="text-sm">
          <Link href="/invoices" className="text-zinc-300 hover:text-zinc-100 hover:underline">
            ← Back to invoices
          </Link>
        </nav>
        <section className="card p-6">
          <h2 className="mb-2 text-base font-semibold text-zinc-100">Client invoice</h2>
          <p className="mb-6 text-sm text-zinc-400">
            Bill your client: project number, SQFT, rate, and line total. Use CSV import to sync fielders and projects from your tracker; use this form for a quick client bill.
          </p>
          <InvoiceForm
            suggestedInvoiceNumber={suggested}
            defaultIssueDate={today}
            defaultCompanyRate={settings.companyRatePerSqft}
          />
        </section>
      </div>
    </SidebarLayout>
  );
}
