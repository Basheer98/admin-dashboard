"use client";

import { useState } from "react";
import type { FielderAssignmentRow, ProjectRow, PaymentRow } from "@/lib/db";

type EditAssignmentFormProps = {
  assignment: FielderAssignmentRow & {
    project: ProjectRow;
    payments: PaymentRow[];
  };
  projectAssignments: FielderAssignmentRow[];
};

export function EditAssignmentForm({
  assignment,
  projectAssignments,
}: EditAssignmentFormProps) {
  const [hasManager, setHasManager] = useState(
    !!assignment.managedByFielderId,
  );
  const [isInternal, setIsInternal] = useState(assignment.isInternal ?? false);

  const sqft = assignment.project.totalSqft;
  const workerRate = Number(assignment.ratePerSqft);

  let totalPayoutBase = 0;
  let totalRequired = 0;
  let managerInfo = null;
  let companyShareBack = 0;

  if (isInternal) {
    totalPayoutBase = 0;
    totalRequired = 0;
  } else if (assignment.managedByFielderId && assignment.managerRatePerSqft) {
    const managerRate = Number(assignment.managerRatePerSqft);
    const managerCommission = (managerRate - workerRate) * sqft;
    const managerShare = assignment.managerCommissionShare
      ? Number(assignment.managerCommissionShare)
      : 0;
    companyShareBack = managerCommission * managerShare;
    const managerNetCommission = managerCommission - companyShareBack;

    totalPayoutBase = workerRate * sqft;
    totalRequired = workerRate * sqft;

    const managerAssignment = projectAssignments.find(
      (a) => a.id === assignment.managedByFielderId,
    );
    managerInfo = managerAssignment
      ? {
          name: managerAssignment.fielderName,
          rate: managerRate,
          netCommission: managerNetCommission,
          companyShare: companyShareBack,
        }
      : null;
  } else {
    totalPayoutBase = workerRate * sqft;
    const commissionFraction = assignment.commissionPercentage
      ? Number(assignment.commissionPercentage)
      : 0;
    const commissionAmount = totalPayoutBase * commissionFraction;
    totalRequired = totalPayoutBase + commissionAmount;
  }

  const totalPaid = assignment.payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const pending = isInternal ? 0 : Math.max(totalRequired - totalPaid, 0);

  return (
    <form
      method="POST"
      action={`/api/assignments/${assignment.id}`}
      className="grid gap-4 md:grid-cols-2"
    >
      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">
          Fielder name
        </label>
        <input
          name="fielderName"
          defaultValue={assignment.fielderName}
          disabled
          className="w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-2.5 text-base text-zinc-400"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">
          Due date (optional)
        </label>
        <input
          name="dueDate"
          type="date"
          defaultValue={assignment.dueDate ?? ""}
          className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">
          Rate per SQFT {isInternal && "(optional – for tracking owner earnings)"}
        </label>
        <input
          name="ratePerSqft"
          type="number"
          min="0"
          step="0.001"
          defaultValue={Number(assignment.ratePerSqft)}
          required={!isInternal}
          placeholder={isInternal ? "e.g. 0.02" : undefined}
          className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
        />
        {isInternal && (
          <p className="mt-1 text-sm text-zinc-500">
            Optional. Used to show &quot;Owner earnings&quot; / internal work value on your report.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">
          Commission %
        </label>
        <input
          name="commissionPercentage"
          type="number"
          min="0"
          step="0.01"
          defaultValue={
            assignment.commissionPercentage
              ? Number(assignment.commissionPercentage) * 100
              : 0
          }
          disabled={isInternal || hasManager}
          className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900 disabled:bg-zinc-800/50 disabled:text-zinc-500"
        />
        {hasManager && (
          <p className="mt-1 text-sm text-zinc-500">
            Commission not applicable when managed by another fielder
          </p>
        )}
      </div>

      <div className="space-y-1 md:col-span-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isInternal"
            checked={isInternal}
            onChange={(e) => {
              const next = e.target.checked;
              setIsInternal(next);
              if (next) setHasManager(false);
            }}
            className="rounded border-zinc-600"
          />
          <span className="text-sm font-medium text-zinc-300">
            Owner / company work (no payout)
          </span>
        </label>
        <p className="mt-1 text-sm text-zinc-500">
          When enabled, this assignment will not contribute to payouts/pending.
        </p>
      </div>

      <div className="space-y-1 md:col-span-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hasManager}
            onChange={(e) => setHasManager(e.target.checked)}
            className="rounded border-zinc-600"
            disabled={isInternal}
          />
          <span className="text-sm font-medium text-zinc-300">
            This fielder is managed by another fielder
          </span>
        </label>
      </div>

      {hasManager ? (
        <>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-300">
              Managed by
            </label>
            <select
              name="managedByFielderId"
              defaultValue={assignment.managedByFielderId ?? ""}
              className="w-full h-11 rounded-md border border-zinc-600 px-3 text-base leading-tight text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
            >
              <option value="">None</option>
              {projectAssignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fielderName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-300">
              Manager rate per SQFT
            </label>
            <input
              name="managerRatePerSqft"
              type="number"
              min="0"
              step="0.001"
              defaultValue={
                assignment.managerRatePerSqft
                  ? Number(assignment.managerRatePerSqft)
                  : ""
              }
              className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
            />
            <p className="mt-1 text-sm text-zinc-500">
              Worker rate + manager commission per SQFT. E.g. worker 0.020, manager commission 0.005 → enter 0.025.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-300">
              Company keeps % of manager commission
            </label>
            <input
              name="managerCommissionShare"
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue={
                assignment.managerCommissionShare
                  ? Number(assignment.managerCommissionShare) * 100
                  : ""
              }
              className="w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
            />
            <p className="mt-1 text-sm text-zinc-500">
              E.g. 50 = company keeps 50%, manager gets the other 50%.
            </p>
          </div>
        </>
      ) : (
        <>
          <input type="hidden" name="managedByFielderId" value="" />
          <input type="hidden" name="managerRatePerSqft" value="" />
          <input type="hidden" name="managerCommissionShare" value="" />
        </>
      )}

      <div className="md:col-span-2 flex items-center justify-between">
        <div className="text-sm text-zinc-400 space-y-1">
          {hasManager && managerInfo ? (
            <>
              <p>
                Manager rate:{" "}
                <span className="font-medium text-zinc-100">
                  {managerInfo.rate.toLocaleString(undefined, {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                  })}
                </span>
              </p>
              <p>
                Worker rate:{" "}
                <span className="font-medium text-zinc-100">
                  {workerRate.toLocaleString(undefined, {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                  })}
                </span>
              </p>
              <p>
                Manager commission:{" "}
                <span className="font-medium text-zinc-100">
                  {((managerInfo.rate - workerRate) * sqft).toLocaleString(
                    undefined,
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  )}
                </span>
              </p>
              <p>
                Company share back:{" "}
                <span className="font-medium text-zinc-100">
                  {companyShareBack.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </p>
              <p>
                Manager net commission:{" "}
                <span className="font-medium text-zinc-100">
                  {managerInfo.netCommission.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </p>
            </>
          ) : (
            <>
              <p>
                Base payout:{" "}
                <span className="font-medium text-zinc-100">
                  {totalPayoutBase.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </p>
              {assignment.commissionPercentage && (
                <p>
                  Commission amount:{" "}
                  <span className="font-medium text-zinc-100">
                    {(totalPayoutBase *
                      Number(assignment.commissionPercentage)).toLocaleString(
                      undefined,
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )}
                  </span>
                </p>
              )}
            </>
          )}
          <p>
            Total required payout:{" "}
            <span className="font-medium text-zinc-100">
              {totalRequired.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </p>
          <p>
            Total paid:{" "}
            <span className="font-medium text-zinc-100">
              {totalPaid.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </p>
          <p>
            Pending:{" "}
            <span className="font-medium text-zinc-100">
              {pending.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </p>
        </div>
        <button
          type="submit"
          className="rounded-md btn-primary px-4 py-2 text-sm font-medium text-white  focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          Save changes
        </button>
      </div>
    </form>
  );
}
