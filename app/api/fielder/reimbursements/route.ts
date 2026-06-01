import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getMobileSession, unauthorized } from "@/lib/mobileAuth";
import {
  getPendingTripReimbursementsForFielderWithTrip,
  getRecentAuditByIdempotencyKey,
  getTripReimbursementsForFielderWithTrip,
  getTripsForFielder,
  hasRecentIdempotencyKey,
  insertAuditLog,
  insertTripExpense,
} from "@/lib/db";
import { logError, logInfo, readRequestId } from "@/lib/observability";
import { uploadReceiptToDrive } from "@/lib/drive";
import { getRedirectUrl } from "@/lib/redirectUrl";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = readRequestId(request);
  const mobile = await getMobileSession(request);
  if (!mobile || mobile.role !== "fielder") return unauthorized();
  const rows = await getTripReimbursementsForFielderWithTrip(mobile.fielderName);
  logInfo({
    message: "Fielder reimbursements fetched",
    requestId,
    route: "/api/fielder/reimbursements",
    actor: mobile.fielderName,
    details: { count: rows.length },
  });
  return NextResponse.json({
    reimbursements: rows.map((r) => ({
      id: r.id,
      tripId: r.tripId,
      tripName: r.trip.name,
      expenseDate: r.expenseDate,
      category: r.category,
      amount: Number(r.amount),
      currency: r.currency,
      receiptUrl: r.receiptUrl,
      notes: r.notes,
      status: r.reimbursedAt ? "PAID" : r.rejectedAt ? "REJECTED" : r.approvedAt ? "APPROVED" : "PENDING",
    })),
  });
}

export async function POST(request: Request) {
  const requestId = readRequestId(request);
  const mobile = await getMobileSession(request);
  if (mobile && mobile.role === "fielder") {
    const formData = await request.formData();
    const idempotencyKey = (request.headers.get("Idempotency-Key")?.trim() || String(formData.get("idempotencyKey") ?? "").trim());
    const tripIdStr = String(formData.get("tripId") ?? "").trim();
    const expenseDate = String(formData.get("expenseDate") ?? "").trim();
    const categoryRaw = String(formData.get("category") ?? "").trim();
    const category =
      categoryRaw === "CAR" ||
      categoryRaw === "ACCOMMODATION" ||
      categoryRaw === "GAS" ||
      categoryRaw === "TOOLS" ||
      categoryRaw === "OTHER"
        ? categoryRaw
        : "OTHER";
    const amountStr = String(formData.get("amount") ?? "").trim();
    const currency = String(formData.get("currency") ?? "").trim() === "USD" ? "USD" : "INR";
    const vendor = String(formData.get("vendor") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const file = formData.get("receipt");
    const tripId = Number(tripIdStr);
    const amount = Number(amountStr);
    if (!tripId || Number.isNaN(tripId) || !expenseDate || !amount || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid reimbursement payload" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Receipt file is required" }, { status: 400 });
    }
    if (idempotencyKey) {
      const duplicate = await hasRecentIdempotencyKey({
        actorType: "fielder",
        actorName: mobile.fielderName,
        action: "trip_expense.create",
        idempotencyKey,
      });
      if (duplicate) {
        const existing = await getRecentAuditByIdempotencyKey({
          actorType: "fielder",
          actorName: mobile.fielderName,
          action: "trip_expense.create",
          idempotencyKey,
        });
        return NextResponse.json({
          ok: true,
          duplicate: true,
          id: existing?.entityId ? Number(existing.entityId) : undefined,
        });
      }
    }
    const trips = await getTripsForFielder(mobile.fielderName);
    if (!trips.some((t) => t.id === tripId)) {
      return NextResponse.json({ error: "Trip not assigned to you" }, { status: 403 });
    }
    try {
      const uploaded = await uploadReceiptToDrive({
        file,
        fielderName: mobile.fielderName,
        tripId,
        category,
        expenseDate,
      });
      const expense = await insertTripExpense({
        tripId,
        expenseDate,
        category,
        amount,
        currency,
        paidBy: mobile.fielderName.trim().toUpperCase(),
        receiptUrl: uploaded.receiptUrl,
        reimbursable: true,
        vendor,
        notes,
      });
      await insertAuditLog({
        actorType: "fielder",
        actorName: mobile.fielderName,
        action: "trip_expense.create",
        entityType: "trip_expense",
        entityId: String(expense.id),
        details: { tripId, category, amount, receiptUrl: uploaded.receiptUrl, idempotencyKey: idempotencyKey || undefined },
      });
      logInfo({
        message: "Fielder reimbursement submitted",
        requestId,
        route: "/api/fielder/reimbursements",
        actor: mobile.fielderName,
        details: { tripId, amount, category },
      });
      return NextResponse.json({ ok: true, id: expense.id, receiptUrl: uploaded.receiptUrl });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      logError({
        message: "Fielder reimbursement submission failed",
        requestId,
        route: "/api/fielder/reimbursements",
        actor: mobile.fielderName,
        details: { tripId, error: message },
      });
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "fielder") {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }

  const formData = await request.formData();
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();
  const tripIdStr = String(formData.get("tripId") ?? "").trim();
  const expenseDate = String(formData.get("expenseDate") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "").trim();
  const category =
    categoryRaw === "CAR" ||
    categoryRaw === "ACCOMMODATION" ||
    categoryRaw === "GAS" ||
    categoryRaw === "TOOLS" ||
    categoryRaw === "OTHER"
      ? categoryRaw
      : "OTHER";
  const amountStr = String(formData.get("amount") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim() === "USD" ? "USD" : "INR";
  const vendor = String(formData.get("vendor") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const file = formData.get("receipt");

  const tripId = Number(tripIdStr);
  const amount = Number(amountStr);
  if (!tripId || Number.isNaN(tripId) || !expenseDate || !amount || Number.isNaN(amount) || amount <= 0) {
    return NextResponse.redirect(getRedirectUrl(request, "/fielder/reimbursements", { error: "invalid" }));
  }
  if (!(file instanceof File)) {
    return NextResponse.redirect(getRedirectUrl(request, "/fielder/reimbursements", { error: "missing-receipt" }));
  }
  if (idempotencyKey) {
    const duplicate = await hasRecentIdempotencyKey({
      actorType: "fielder",
      actorName: session.fielderName,
      action: "trip_expense.create",
      idempotencyKey,
    });
    if (duplicate) {
      return NextResponse.redirect(getRedirectUrl(request, "/fielder/reimbursements", { success: "1" }));
    }
  }

  try {
    const uploaded = await uploadReceiptToDrive({
      file,
      fielderName: session.fielderName,
      tripId,
      category,
      expenseDate,
    });

    const expense = await insertTripExpense({
      tripId,
      expenseDate,
      category,
      amount,
      currency,
      paidBy: session.fielderName.trim().toUpperCase(),
      receiptUrl: uploaded.receiptUrl,
      reimbursable: true,
      vendor,
      notes,
    });

    await insertAuditLog({
      actorType: "fielder",
      actorName: session.fielderName,
      action: "trip_expense.create",
      entityType: "trip_expense",
      entityId: String(expense.id),
      details: {
        tripId,
        category,
        amount,
        receiptUrl: uploaded.receiptUrl,
        idempotencyKey: idempotencyKey || undefined,
      },
    });

    return NextResponse.redirect(getRedirectUrl(request, "/fielder/reimbursements", { success: "1" }));
  } catch {
    return NextResponse.redirect(getRedirectUrl(request, "/fielder/reimbursements", { error: "server" }));
  }
}
