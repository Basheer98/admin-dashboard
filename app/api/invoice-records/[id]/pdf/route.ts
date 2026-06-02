import { NextResponse } from "next/server";
import { getInvoiceWithLines, getSettings, getInvoiceLogo } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { buildInvoiceRecordPdfBuffer } from "@/lib/invoicePdf";
import { mergeInvoiceIssuerSettings } from "@/lib/invoicePdfDefaults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: idStr } = await context.params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

  const data = await getInvoiceWithLines(id);
  if (!data) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  try {
    const [settings, logo] = await Promise.all([getSettings(), getInvoiceLogo()]);
    const issuer = mergeInvoiceIssuerSettings(settings, logo);
    const buffer = await buildInvoiceRecordPdfBuffer({ ...data, issuer });
    const filename = `invoice-${data.invoice.invoiceNumber.replace(/\s+/g, "-")}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("Invoice PDF generation failed:", e);
    return NextResponse.json(
      { error: "PDF generation failed on the server. Contact support if this persists." },
      { status: 500 },
    );
  }
}
