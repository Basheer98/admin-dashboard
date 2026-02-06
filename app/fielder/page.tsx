import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAssignmentsForFielderByName } from "@/lib/db";
import { formatCurrency } from "@/lib/currency";
import { PrintButton } from "@/app/components/PrintButton";
import Link from "next/link";

export default async function FielderStatementPage() {
  const session = await getSession();
  if (!session || session.role !== "fielder") redirect("/login");

  const fielderName = session.fielderName;
  const fielderAssignments = await getAssignmentsForFielderByName(fielderName);

  let totalOwed = 0;
  let totalPaid = 0;
  let internalWorkValue = 0;
  let totalSqft = 0;

  for (const a of fielderAssignments) {
    const sqft = a.project.totalSqft;
    totalSqft += sqft;
    const workerRate = Number(a.ratePerSqft);
    if (a.isInternal && workerRate > 0) {
      internalWorkValue += workerRate * sqft;
    }
    let totalRequired = 0;
    if (!a.isInternal) {
      if (a.managedByFielderId && a.managerRatePerSqft) {
        totalRequired = workerRate * sqft;
      } else {
        const base = workerRate * sqft;
        const commission = a.commissionPercentage
          ? base * Number(a.commissionPercentage)
          : 0;
        totalRequired = base + commission;
      }
    }
    const paid = a.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    totalOwed += totalRequired;
    totalPaid += paid;
  }

  const pending = Math.max(totalOwed - totalPaid, 0);

  return (
    <div className="flex flex-1 flex-col gap-6 print-content">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-semibold text-slate-900">
          My statement
        </h2>
        <PrintButton label="Print" />
      </div>

      <section
        className={`card grid gap-4 p-6 ${internalWorkValue > 0 ? "md:grid-cols-5" : "md:grid-cols-4"}`}
      >
        <div>
          <p className="text-sm font-medium text-slate-500">Total SQFT</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {totalSqft.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Total owed</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {formatCurrency(totalOwed)}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Total paid</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {formatCurrency(totalPaid)}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Pending</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {formatCurrency(pending)}
          </p>
        </div>
        {internalWorkValue > 0 && (
          <div>
            <p className="text-sm font-medium text-slate-500">
              Owner / internal work value
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {formatCurrency(internalWorkValue)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Value of internal work (not a payout)
            </p>
          </div>
        )}
      </section>

      <div className="flex gap-3 text-sm">
        <Link
          href="/fielder/assignments"
          className="text-slate-600 underline hover:text-slate-900"
        >
          View my assignments →
        </Link>
        <Link
          href="/fielder/payments"
          className="text-slate-600 underline hover:text-slate-900"
        >
          View my payments →
        </Link>
      </div>
    </div>
  );
}
