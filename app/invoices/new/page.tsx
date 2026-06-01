import Link from "next/link";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { InvoiceForm } from "../components/InvoiceForm";
import { suggestNextInvoiceNumber } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const suggested = await suggestNextInvoiceNumber();
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
          <h2 className="mb-2 text-base font-semibold text-zinc-100">New invoice</h2>
          <p className="mb-6 text-sm text-zinc-400">
            Enter project numbers, SQFT, and rates. Use Look up to pull data from existing projects. Enable sync to create or update projects and fielder assignments in the dashboard.
          </p>
          <InvoiceForm suggestedInvoiceNumber={suggested} defaultIssueDate={today} />
        </section>
      </div>
    </SidebarLayout>
  );
}
