import { NextResponse } from "next/server";
import { getPaymentById, voidPayment, insertActivity } from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(getRedirectUrl(request, "/payments"));
  }
  const payment = await getPaymentById(id);
  if (!payment) {
    return NextResponse.redirect(getRedirectUrl(request, "/payments", { void: "notfound" }));
  }
  if (payment.voidedAt) {
    return NextResponse.redirect(getRedirectUrl(request, "/payments", { void: "already" }));
  }
  const ok = await voidPayment(id);
  if (!ok) {
    return NextResponse.redirect(getRedirectUrl(request, "/payments", { void: "error" }));
  }
  const amountFormatted = Number(payment.amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  await insertActivity({
    type: "payment_voided",
    description: `Voided payment of ${payment.currency} ${amountFormatted} to ${payment.assignment.fielderName}`,
    metadata: { paymentId: id, amount: payment.amount, currency: payment.currency, fielderName: payment.assignment.fielderName },
  });
  return NextResponse.redirect(getRedirectUrl(request, "/payments", { voided: "1" }));
}
