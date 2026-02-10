import { NextResponse } from "next/server";
import {
  getAssignmentsWithDetails,
  insertPayment,
  insertActivity,
} from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { validate, fielderPaymentPostSchema } from "@/lib/validations";

function getTotalRequiredAndPending(
  a: {
    project: { totalSqft: number };
    ratePerSqft: number | string;
    isInternal: boolean;
    managedByFielderId: number | null;
    managerRatePerSqft: number | string | null;
    commissionPercentage: number | string | null;
    payments: { amount: string | number }[];
  },
): { totalRequired: number; pending: number } {
  const sqft = a.project.totalSqft;
  const workerRate = Number(a.ratePerSqft);
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
  const pending = a.isInternal ? 0 : Math.max(totalRequired - paid, 0);
  return { totalRequired, pending };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name: encodedName } = await params;
  const fielderNameFromUrl = decodeURIComponent(encodedName);
  const fielderNameNormalized = fielderNameFromUrl.trim().toUpperCase();

  const formData = await request.formData();
  const amountStr = String(formData.get("amount") ?? "").trim();
  const currency = String(formData.get("currency") ?? "");
  const method = String(formData.get("method") ?? "");
  const paymentDateStr = String(formData.get("paymentDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const parsed = validate(fielderPaymentPostSchema, {
    amount: amountStr ? Number(amountStr) : undefined,
    currency: currency || undefined,
    method: method || undefined,
    paymentDate: paymentDateStr || undefined,
    notes,
  });
  if (!parsed.success) {
    return NextResponse.redirect(
      getRedirectUrl(request, `/fielders/${encodeURIComponent(encodedName)}`, {
        error: "invalid",
      }),
    );
  }

  const assignments = await getAssignmentsWithDetails({ includeArchived: true });
  const fielderAssignments = assignments.filter(
    (a) => a.fielderName.trim().toUpperCase() === fielderNameNormalized,
  );

  const assignmentIdToFielderName = new Map(
    assignments.map((a) => [a.id, a.fielderName.trim().toUpperCase()]),
  );
  let managerCommissionOwed = 0;
  for (const a of assignments) {
    if (!a.managedByFielderId || !a.managerRatePerSqft || a.isInternal) continue;
    const managerName = assignmentIdToFielderName.get(a.managedByFielderId);
    if (managerName !== fielderNameNormalized) continue;
    const sqft = a.project.totalSqft;
    const workerRate = Number(a.ratePerSqft);
    const managerRate = Number(a.managerRatePerSqft);
    const managerCommission = (managerRate - workerRate) * sqft;
    const managerShare = a.managerCommissionShare
      ? Number(a.managerCommissionShare)
      : 0;
    const companyShare = managerCommission * managerShare;
    const managerNetCommission = managerCommission - companyShare;
    managerCommissionOwed += managerNetCommission;
  }

  const assignmentsWithPending = fielderAssignments
    .map((a) => {
      const { totalRequired, pending } = getTotalRequiredAndPending(a);
      return { assignment: a, totalRequired, pending };
    })
    .filter((x) => x.pending > 0)
    .sort((a, b) => a.assignment.id - b.assignment.id);

  const assignmentsPendingOnly = assignmentsWithPending.reduce(
    (sum, x) => sum + x.pending,
    0,
  );
  const totalPending = assignmentsPendingOnly + managerCommissionOwed;

  if (totalPending <= 0) {
    return NextResponse.redirect(
      getRedirectUrl(request, `/fielders/${encodeURIComponent(encodedName)}`, {
        error: "no-pending",
      }),
    );
  }

  const amount = parsed.data.amount;
  if (amount > totalPending) {
    return NextResponse.redirect(
      getRedirectUrl(request, `/fielders/${encodeURIComponent(encodedName)}`, {
        error: "amount-exceeds",
      }),
    );
  }

  const paymentDate = new Date(parsed.data.paymentDate);
  let remainingToAllocate = amount;
  const created: { assignmentId: number; projectId: number; amount: number }[] = [];
  let lastAssignmentPaid: { assignment: (typeof fielderAssignments)[0]; amount: number } | null = null;

  for (const { assignment, pending } of assignmentsWithPending) {
    if (remainingToAllocate <= 0) break;
    const payThis = Math.min(remainingToAllocate, pending);
    await insertPayment({
      projectId: assignment.projectId,
      fielderAssignmentId: assignment.id,
      amount: payThis,
      currency: parsed.data.currency,
      method: parsed.data.method,
      paymentDate: paymentDate.toISOString(),
      notes: parsed.data.notes,
    });
    created.push({
      assignmentId: assignment.id,
      projectId: assignment.projectId,
      amount: payThis,
    });
    lastAssignmentPaid = { assignment, amount: payThis };
    remainingToAllocate -= payThis;
  }

  // If paying for manager commissions too, allocate remainder to an assignment (last one we paid, or any fielder assignment if they had no pending)
  if (remainingToAllocate > 0) {
    const targetAssignment = lastAssignmentPaid
      ? lastAssignmentPaid.assignment
      : fielderAssignments.sort((a, b) => a.id - b.id)[0];
    if (targetAssignment) {
      await insertPayment({
        projectId: targetAssignment.projectId,
        fielderAssignmentId: targetAssignment.id,
        amount: remainingToAllocate,
        currency: parsed.data.currency,
        method: parsed.data.method,
        paymentDate: paymentDate.toISOString(),
        notes: parsed.data.notes,
      });
      const existingEntry = created.find((c) => c.assignmentId === targetAssignment.id);
      if (existingEntry) existingEntry.amount += remainingToAllocate;
      else created.push({ assignmentId: targetAssignment.id, projectId: targetAssignment.projectId, amount: remainingToAllocate });
    }
  }

  const amountFormatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const displayName = fielderNameNormalized || fielderNameFromUrl;
  await insertActivity({
    type: "payment_logged",
    description: `Logged payment of ${parsed.data.currency} ${amountFormatted} to ${displayName} (fielder-level)`,
    metadata: {
      fielderName: displayName,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      allocations: created,
    },
  });

  return NextResponse.redirect(
    getRedirectUrl(request, `/fielders/${encodeURIComponent(encodedName)}`, {
      success: "1",
    }),
  );
}
