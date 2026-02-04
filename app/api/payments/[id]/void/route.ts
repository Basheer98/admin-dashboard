import { NextResponse } from "next/server";
import { getPaymentById, voidPayment, insertActivity } from "@/lib/db";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(new URL("/payments", request.url));
  }
  const payment = await getPaymentById(id);
  if (!payment) {
    const url = new URL("/payments", request.url);
    url.searchParams.set("void", "notfound");
    return NextResponse.redirect(url);
  }
  if (payment.voidedAt) {
    const url = new URL("/payments", request.url);
    url.searchParams.set("void", "already");
    return NextResponse.redirect(url);
  }
  const ok = await voidPayment(id);
  if (!ok) {
    const url = new URL("/payments", request.url);
    url.searchParams.set("void", "error");
    return NextResponse.redirect(url);
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
  const url = new URL("/payments", request.url);
  url.searchParams.set("voided", "1");
  return NextResponse.redirect(url);
}
