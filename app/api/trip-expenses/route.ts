import { NextResponse } from "next/server";
import { getAuditActor, getSessionFromRequest } from "@/lib/auth";
import { getTripById, insertAuditLog, insertTripExpense } from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { tripExpensePostSchema, validate } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }
  const actor = getAuditActor(session);
  const formData = await request.formData();

  const tripIdRaw = String(formData.get("tripId") ?? "").trim();
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
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const currencyRaw = String(formData.get("currency") ?? "").trim();
  const currency = currencyRaw === "USD" ? "USD" : "INR";
  const paidBy = String(formData.get("paidBy") ?? "").trim() || null;
  const vendor = String(formData.get("vendor") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const parsed = validate(tripExpensePostSchema, {
    tripId: tripIdRaw ? Number(tripIdRaw) : undefined,
    expenseDate: expenseDate || undefined,
    category,
    amount: amountRaw ? Number(amountRaw) : undefined,
    currency,
    paidBy,
    vendor,
    notes,
  });
  if (!parsed.success) {
    return NextResponse.redirect(getRedirectUrl(request, "/trips", { error: "invalid" }));
  }

  const trip = await getTripById(parsed.data.tripId);
  if (!trip) {
    return NextResponse.redirect(getRedirectUrl(request, "/trips", { error: "invalid" }));
  }

  const expense = await insertTripExpense(parsed.data);
  await insertAuditLog({
    ...actor,
    action: "trip_expense.create",
    entityType: "trip_expense",
    entityId: String(expense.id),
    details: {
      tripId: trip.id,
      category: expense.category,
      amount: expense.amount,
    },
  });

  return NextResponse.redirect(getRedirectUrl(request, `/trips/${trip.id}`, { expenseSaved: "1" }));
}
