import { NextResponse } from "next/server";
import {
  getAssignmentById,
  insertPayment,
  insertActivity,
} from "@/lib/db";
import { validate, paymentPostSchema } from "@/lib/validations";

export async function POST(request: Request) {
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
    const url = new URL("/payments", request.url);
    url.searchParams.set("error", "invalid");
    return NextResponse.redirect(url);
  }

  const { amount, paymentDate: paymentDateStrValid } = parsed.data;
  const paymentDate = new Date(paymentDateStrValid);

  // Ensure the assignment belongs to the project
  const assignment = getAssignmentById(parsed.data.fielderAssignmentId);

  if (!assignment || assignment.projectId !== parsed.data.projectId) {
    const url = new URL("/payments", request.url);
    url.searchParams.set("error", "invalid-assignment");
    return NextResponse.redirect(url);
  }

  const paymentId = insertPayment({
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
  insertActivity({
    type: "payment_logged",
    description: `Logged payment of ${parsed.data.currency} ${amountFormatted} to ${assignment.fielderName}`,
    metadata: { paymentId, projectId: parsed.data.projectId, fielderAssignmentId: parsed.data.fielderAssignmentId },
  });

  const url = new URL(redirectTo || "/payments", request.url);
  url.searchParams.set("success", "1");
  return NextResponse.redirect(url);
}

