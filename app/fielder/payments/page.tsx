import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPaymentsWithDetails } from "@/lib/db";
import { formatCurrency } from "@/lib/currency";
import { PrintButton } from "@/app/components/PrintButton";
import Link from "next/link";

export default async function FielderPaymentsPage() {
  const session = await getSession();
  if (!session || session.role !== "fielder") redirect("/login");

  const fielderNameNormalized = session.fielderName.trim().toUpperCase();
  const allPayments = await getPaymentsWithDetails({ includeVoided: false });
  const payments = allPayments.filter(
    (p) => p.assignment.fielderName.trim().toUpperCase() === fielderNameNormalized,
  );

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="flex flex-1 flex-col gap-6 print-content">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-semibold text-zinc-100">
          My payments
        </h2>
        <PrintButton label="Print" />
      </div>

      <p className="text-sm text-zinc-400">
        Total received: {formatCurrency(totalPaid)}
      </p>

      <div className="card overflow-x-auto">
        <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Invoice</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Currency</th>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t text-zinc-200">
                <td className="px-3 py-2">
                  {new Date(p.paymentDate).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">{p.project.projectCode}</td>
                <td className="px-3 py-2">{p.project.invoiceNumber?.trim() ?? "—"}</td>
                <td className="px-3 py-2">
                  {formatCurrency(Number(p.amount))}
                </td>
                <td className="px-3 py-2">{p.currency}</td>
                <td className="px-3 py-2">{p.method}</td>
                <td className="px-3 py-2">{p.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payments.length === 0 && (
        <p className="text-zinc-400">No payments recorded yet.</p>
      )}

      <Link
        href="/fielder"
        className="text-sm text-zinc-400 underline hover:text-zinc-100"
      >
        ← My statement
      </Link>
    </div>
  );
}
