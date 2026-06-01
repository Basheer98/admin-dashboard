import { NextResponse } from "next/server";
import { getAuditActor, getSessionFromRequest } from "@/lib/auth";
import {
  approveTripReimbursement,
  getTripExpensesWithTrip,
  insertAuditLog,
  rejectTripReimbursement,
} from "@/lib/db";
import { logError, logInfo, readRequestId } from "@/lib/observability";
import { getRedirectUrl } from "@/lib/redirectUrl";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = readRequestId(request);
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }
  const actor = getAuditActor(session);
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.redirect(getRedirectUrl(request, "/reimbursements", { error: "invalid" }));

  const formData = await request.formData();
  const action = String(formData.get("action") ?? "").trim();
  const rejectionNote = String(formData.get("rejectionNote") ?? "").trim() || null;

  const all = await getTripExpensesWithTrip();
  const expense = all.find((x) => x.id === id);
  if (!expense || !expense.reimbursable || expense.reimbursedAt) {
    return NextResponse.redirect(getRedirectUrl(request, "/reimbursements", { error: "invalid" }));
  }

  try {
    if (action === "approve") {
      await approveTripReimbursement(id, actor.actorName);
      await insertAuditLog({
        ...actor,
        action: "reimbursement.approve",
        entityType: "trip_expense",
        entityId: String(id),
        details: { amount: expense.amount, paidBy: expense.paidBy },
      });
      logInfo({ message: "Reimbursement approved", requestId, route: "/api/reimbursements/[id]", actor: actor.actorName, details: { id } });
      return NextResponse.redirect(getRedirectUrl(request, "/reimbursements", { saved: "1" }));
    }
    if (action === "reject") {
      await rejectTripReimbursement(id, actor.actorName, rejectionNote);
      await insertAuditLog({
        ...actor,
        action: "reimbursement.reject",
        entityType: "trip_expense",
        entityId: String(id),
        details: { amount: expense.amount, paidBy: expense.paidBy, rejectionNote },
      });
      logInfo({ message: "Reimbursement rejected", requestId, route: "/api/reimbursements/[id]", actor: actor.actorName, details: { id } });
      return NextResponse.redirect(getRedirectUrl(request, "/reimbursements", { saved: "1" }));
    }
    return NextResponse.redirect(getRedirectUrl(request, "/reimbursements", { error: "invalid" }));
  } catch (error) {
    logError({
      message: "Reimbursement update failed",
      requestId,
      route: "/api/reimbursements/[id]",
      actor: actor.actorName,
      details: { id, action, error: error instanceof Error ? error.message : "Unknown error" },
    });
    return NextResponse.redirect(getRedirectUrl(request, "/reimbursements", { error: "server" }));
  }
}
