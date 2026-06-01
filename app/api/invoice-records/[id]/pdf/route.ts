import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getInvoiceWithLines, invoiceLineRevenue } from "@/lib/db";

function formatCurrency(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await context.params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

  const data = await getInvoiceWithLines(id);
  if (!data) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const { invoice, lines } = data;
  const totalRevenue = lines.reduce((sum, l) => sum + invoiceLineRevenue(l), 0);

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).font("Helvetica-Bold").text(`INVOICE #${invoice.invoiceNumber}`, { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Bill to: ${invoice.clientName}`);
    doc.text(`Issue date: ${invoice.issueDate}`);
    if (invoice.dueDate) doc.text(`Due date: ${invoice.dueDate}`);
    doc.text(`Generated ${new Date().toLocaleDateString(undefined, { dateStyle: "long" })}`);
    if (invoice.notes) {
      doc.moveDown(0.5);
      doc.text(`Notes: ${invoice.notes}`);
    }
    doc.moveDown(1.5);

    const tableTop = doc.y;
    const colWidths = { project: 80, client: 100, sqft: 55, rate: 55, revenue: 70 };
    const rowHeight = 22;
    const headerY = tableTop;

    doc.font("Helvetica-Bold").fontSize(9);
    doc.text("Project", 50, headerY, { width: colWidths.project });
    doc.text("Client", 50 + colWidths.project, headerY, { width: colWidths.client });
    doc.text("SQFT", 50 + colWidths.project + colWidths.client, headerY, { width: colWidths.sqft });
    doc.text("Rate", 50 + colWidths.project + colWidths.client + colWidths.sqft, headerY, { width: colWidths.rate });
    doc.text("Revenue", 50 + colWidths.project + colWidths.client + colWidths.sqft + colWidths.rate, headerY, {
      width: colWidths.revenue,
    });

    doc.moveTo(50, headerY + rowHeight - 5).lineTo(50 + 380, headerY + rowHeight - 5).stroke();
    doc.font("Helvetica").fontSize(9);

    lines.forEach((r, i) => {
      const y = tableTop + rowHeight * (i + 1);
      const revenue = invoiceLineRevenue(r);
      doc.text(r.projectCode, 50, y, { width: colWidths.project });
      doc.text(r.clientName ?? "—", 50 + colWidths.project, y, { width: colWidths.client });
      doc.text(r.totalSqft.toLocaleString(), 50 + colWidths.project + colWidths.client, y, { width: colWidths.sqft });
      doc.text(Number(r.ratePerSqft).toFixed(3), 50 + colWidths.project + colWidths.client + colWidths.sqft, y, {
        width: colWidths.rate,
      });
      doc.text(`$${formatCurrency(revenue)}`, 50 + colWidths.project + colWidths.client + colWidths.sqft + colWidths.rate, y, {
        width: colWidths.revenue,
      });
    });

    const totalY = tableTop + rowHeight * (lines.length + 1) + 10;
    doc.moveTo(50, totalY - 5).lineTo(50 + 380, totalY - 5).stroke();
    doc.font("Helvetica-Bold");
    doc.text("Total", 50, totalY, { width: colWidths.project + colWidths.client + colWidths.sqft + colWidths.rate });
    doc.text(`$${formatCurrency(totalRevenue)}`, 50 + colWidths.project + colWidths.client + colWidths.sqft + colWidths.rate, totalY, {
      width: colWidths.revenue,
    });

    doc.end();
  });

  const filename = `invoice-${invoice.invoiceNumber.replace(/\s+/g, "-")}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
