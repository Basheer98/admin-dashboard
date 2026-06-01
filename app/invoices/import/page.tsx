import Link from "next/link";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { InvoiceImportWizard } from "../components/InvoiceImportWizard";
import { suggestNextInvoiceNumber } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ImportInvoicePage() {
  const suggested = await suggestNextInvoiceNumber();

  return (
    <SidebarLayout
      title="Import CSV"
      current="invoices"
      breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: "Import" }]}
    >
      <div className="flex flex-1 flex-col gap-6">
        <nav className="text-sm">
          <Link href="/invoices" className="text-zinc-300 hover:text-zinc-100 hover:underline">
            ← Back to invoices
          </Link>
        </nav>
        <InvoiceImportWizard suggestedInvoiceNumber={suggested} />
      </div>
    </SidebarLayout>
  );
}
