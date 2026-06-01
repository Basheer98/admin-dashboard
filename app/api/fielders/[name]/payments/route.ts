import { NextResponse } from "next/server";
import {
  getAssignmentsWithDetails,
  insertPayment,
  insertActivity,
  insertAuditLog,
  getApprovedTripReimbursementsForFielder,
  markTripReimbursementsPaid,
} from "@/lib/db";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { validate, fielderPaymentPostSchema } from "@/lib/validations";
import { calcAssignmentPayout } from "@/lib/payouts";
import { sendPushToFielder } from "@/lib/push";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.redirect(getRedirectUrl(request, "/login"));
  const actor = getAuditActor(session);

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
      const { totalRequired, pending } = calcAssignmentPayout(a);
      return { assignment: a, totalRequired, pending };
    })
    .filter((x) => x.pending > 0)
    .sort((a, b) => a.assignment.id - b.assignment.id);

  const assignmentsPendingOnly = assignmentsWithPending.reduce(
    (sum, x) => sum + x.pending,
    0,
  );
  const pendingReimbursements = await getApprovedTripReimbursementsForFielder(fielderNameNormalized);
  const reimbursementPending = pendingReimbursements.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalPending = assignmentsPendingOnly + managerCommissionOwed + reimbursementPending;

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

  try {
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

    // If paying for manager commissions and/or reimbursements too, allocate remainder to an assignment.
    if (remainingToAllocate > 0) {
      const targetAssignment = lastAssignmentPaid
        ? lastAssignmentPaid.assignment
        : fielderAssignments.sort((a, b) => a.id - b.id)[0];
      if (!targetAssignment) {
        return NextResponse.redirect(
          getRedirectUrl(request, `/fielders/${encodeURIComponent(encodedName)}`, {
            error: "no-assignment",
          }),
        );
      }

      // Settle pending reimbursements first from remaining amount.
      const reimbursementSettlement: { expenseId: number; amount: number; paymentId: number }[] = [];
      let reimbursedAmount = 0;
      for (const expense of pendingReimbursements) {
        if (remainingToAllocate <= 0) break;
        const expenseAmount = Number(expense.amount);
        if (remainingToAllocate < expenseAmount) break;
        const payThis = expenseAmount;
        const reimbursementPaymentId = await insertPayment({
          projectId: targetAssignment.projectId,
          fielderAssignmentId: targetAssignment.id,
          amount: payThis,
          currency: parsed.data.currency,
          method: parsed.data.method,
          paymentDate: paymentDate.toISOString(),
          notes: parsed.data.notes ? `${parsed.data.notes} | reimbursement` : "Trip reimbursement",
        });
        reimbursementSettlement.push({
          expenseId: expense.id,
          amount: payThis,
          paymentId: reimbursementPaymentId,
        });
        created.push({
          assignmentId: targetAssignment.id,
          projectId: targetAssignment.projectId,
          amount: payThis,
        });
        remainingToAllocate -= payThis;
        reimbursedAmount += payThis;
      }

      for (const s of reimbursementSettlement) {
        // Mark as reimbursed only when full amount is covered.
        const expense = pendingReimbursements.find((x) => x.id === s.expenseId);
        if (expense && Number(s.amount) >= Number(expense.amount)) {
          await markTripReimbursementsPaid([s.expenseId], s.paymentId);
        }
      }
      if (reimbursedAmount > 0) {
        sendPushToFielder(
          fielderNameNormalized,
          "Reimbursement paid",
          `${parsed.data.currency} ${reimbursedAmount.toFixed(2)} reimbursement marked paid`,
          { screen: "reimbursements" },
        ).catch(() => {});
      }

      if (targetAssignment) {
        if (remainingToAllocate > 0) {
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
    await insertAuditLog({
      ...actor,
      action: "payment.create",
      entityType: "payment",
      details: { fielderName: displayName, amount: parsed.data.amount, currency: parsed.data.currency, allocations: created.length },
    });

    return NextResponse.redirect(
      getRedirectUrl(request, `/fielders/${encodeURIComponent(encodedName)}`, {
        success: "1",
      }),
    );
  } catch (e) {
    console.error("Fielder payment failed:", e);
    return NextResponse.redirect(
      getRedirectUrl(request, `/fielders/${encodeURIComponent(encodedName)}`, {
        error: "server",
      }),
    );
  }
}
