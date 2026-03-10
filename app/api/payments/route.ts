import { NextResponse } from "next/server";
import {
  getAssignmentById,
  insertPayment,
  insertActivity,
  insertAuditLog,
} from "@/lib/db";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { validate, paymentPostSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.redirect(getRedirectUrl(request, "/login"));
  const actor = getAuditActor(session);

  const formData = await request.formData();

  const projectId = Number(formData.get("projectId"));
  const assignmentId = Number(formData.get("fielderAssignmentId"));
  const amountStr = String(formData.get("amount") ?? "").trim();
  const currency = String(formData.get("currency") ?? "");
  const method = String(formData.get("method") ?? "");
  const paymentDateStr = String(formData.get("paymentDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const redirectTo = String(formData.get("redirectTo") ?? "/payments");

  const parsed = validate(paymentPostSchema, {
    projectId: projectId || undefined,
    fielderAssignmentId: assignmentId || undefined,
    amount: amountStr ? Number(amountStr) : undefined,
    currency: currency || undefined,
    method: method || undefined,
    paymentDate: paymentDateStr || undefined,
    notes,
  });
  if (!parsed.success) {
    return NextResponse.redirect(getRedirectUrl(request, "/payments", { error: "invalid" }));
  }

  const paymentDate = new Date(parsed.data.paymentDate);

  // Ensure the assignment belongs to the project
  const assignment = await getAssignmentById(parsed.data.fielderAssignmentId);

  if (!assignment || assignment.projectId !== parsed.data.projectId) {
    return NextResponse.redirect(getRedirectUrl(request, "/payments", { error: "invalid-assignment" }));
  }

  try {
    const paymentId = await insertPayment({
      projectId: parsed.data.projectId,
      fielderAssignmentId: parsed.data.fielderAssignmentId,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      method: parsed.data.method,
      paymentDate: paymentDate.toISOString(),
      notes: parsed.data.notes,
    });

    const amountFormatted = parsed.data.amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    await insertActivity({
      type: "payment_logged",
      description: `Logged payment of ${parsed.data.currency} ${amountFormatted} to ${assignment.fielderName}`,
      metadata: { paymentId, projectId: parsed.data.projectId, fielderAssignmentId: parsed.data.fielderAssignmentId },
    });
    await insertAuditLog({
      ...actor,
      action: "payment.create",
      entityType: "payment",
      entityId: String(paymentId),
      details: { amount: parsed.data.amount, currency: parsed.data.currency, fielderName: assignment.fielderName },
    });

    const path = redirectTo.startsWith("http") ? new URL(redirectTo).pathname : (redirectTo.startsWith("/") ? redirectTo : "/payments");
    return NextResponse.redirect(getRedirectUrl(request, path, { success: "1" }));
  } catch (e) {
    console.error("Payment create failed:", e);
    return NextResponse.redirect(getRedirectUrl(request, "/payments", { error: "server" }));
  }
}

