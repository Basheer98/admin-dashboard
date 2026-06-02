import Link from "next/link";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { InvoiceImportWizard } from "../components/InvoiceImportWizard";
import { getAllClients, getSettings, suggestNextInvoiceNumber } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ImportInvoicePage() {
  const [suggested, settings, clients] = await Promise.all([
    suggestNextInvoiceNumber(),
    getSettings(),
    getAllClients(),
  ]);

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
        <InvoiceImportWizard
          suggestedInvoiceNumber={suggested}
          defaultCompanyRate={settings.companyRatePerSqft}
          clients={clients.map((c) => ({ id: c.id, name: c.name, address: c.address }))}
          fielderRatesNote={
            settings.companyRatePerSqft != null
              ? `Company billing rate: $${settings.companyRatePerSqft}/sqft from Settings.`
              : "Set company billing rate in Settings before import."
          }
        />
      </div>
    </SidebarLayout>
  );
}
