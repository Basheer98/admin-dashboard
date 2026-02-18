import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getProjectsByInvoiceNumber } from "@/lib/db";

function formatCurrency(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ invoiceNumber: string }> },
) {
  const { invoiceNumber: encoded } = await context.params;
  const invoiceNumber = decodeURIComponent(encoded ?? "").trim();
  if (!invoiceNumber) {
    return NextResponse.json({ error: "Invoice number required" }, { status: 400 });
  }

  const projects = await getProjectsByInvoiceNumber(invoiceNumber);
  if (projects.length === 0) {
    return NextResponse.json(
      { error: "No projects found for this invoice" },
      { status: 404 },
    );
  }

  const rows = projects.map((p) => {
    const revenue = p.totalSqft * Number(p.companyRatePerSqft);
    return {
      projectCode: p.projectCode,
      clientName: p.clientName,
      totalSqft: p.totalSqft,
      rate: Number(p.companyRatePerSqft),
      revenue,
    };
  });
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).font("Helvetica-Bold").text(`INVOICE #${invoiceNumber}`, { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").text(`Generated ${new Date().toLocaleDateString(undefined, { dateStyle: "long" })}`, { align: "left" });
    doc.moveDown(1.5);

    const tableTop = doc.y;
    const colWidths = { project: 80, client: 120, sqft: 55, rate: 55, revenue: 70 };
    const rowHeight = 22;
    const headerY = tableTop;

    doc.font("Helvetica-Bold").fontSize(9);
    doc.text("Project", 50, headerY, { width: colWidths.project });
    doc.text("Client", 50 + colWidths.project, headerY, { width: colWidths.client });
    doc.text("SQFT", 50 + colWidths.project + colWidths.client, headerY, { width: colWidths.sqft });
    doc.text("Rate", 50 + colWidths.project + colWidths.client + colWidths.sqft, headerY, { width: colWidths.rate });
    doc.text("Revenue", 50 + colWidths.project + colWidths.client + colWidths.sqft + colWidths.rate, headerY, { width: colWidths.revenue });

    doc.moveTo(50, headerY + rowHeight - 5).lineTo(50 + 380, headerY + rowHeight - 5).stroke();
    doc.font("Helvetica").fontSize(9);

    rows.forEach((r, i) => {
      const y = tableTop + rowHeight * (i + 1);
      doc.text(r.projectCode, 50, y, { width: colWidths.project });
      doc.text(r.clientName, 50 + colWidths.project, y, { width: colWidths.client });
      doc.text(r.totalSqft.toLocaleString(), 50 + colWidths.project + colWidths.client, y, { width: colWidths.sqft });
      doc.text(r.rate.toFixed(3), 50 + colWidths.project + colWidths.client + colWidths.sqft, y, { width: colWidths.rate });
      doc.text(`$${formatCurrency(r.revenue)}`, 50 + colWidths.project + colWidths.client + colWidths.sqft + colWidths.rate, y, { width: colWidths.revenue });
    });

    const totalY = tableTop + rowHeight * (rows.length + 1) + 10;
    doc.moveTo(50, totalY - 5).lineTo(50 + 380, totalY - 5).stroke();
    doc.font("Helvetica-Bold");
    doc.text("Total", 50, totalY, { width: colWidths.project + colWidths.client + colWidths.sqft + colWidths.rate });
    doc.text(`$${formatCurrency(totalRevenue)}`, 50 + colWidths.project + colWidths.client + colWidths.sqft + colWidths.rate, totalY, { width: colWidths.revenue });

    doc.end();
  });

  const filename = `invoice-${invoiceNumber.replace(/\s+/g, "-")}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
