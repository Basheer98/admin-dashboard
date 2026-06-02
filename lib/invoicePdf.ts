import PDFDocument from "pdfkit";
import type { InvoiceLineItemRow, InvoiceRow } from "@/lib/db";
import { invoiceLineRevenue } from "@/lib/db";
import { amountInWordsInr } from "@/lib/amountInWordsInr";
import type { InvoicePdfIssuerSettings } from "@/lib/invoicePdfDefaults";

const MARGIN = 50;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 40;

function formatDateDDMMYYYY(iso: string): string {
  const parts = iso.slice(0, 10).split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function formatUsd(amount: number): string {
  return (
    "$ " +
    amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatInr(amount: number): string {
  return (
    "₹ " +
    amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function drawFooter(doc: PDFKit.PDFDocument, pageIndex: number, pageCount: number, invoiceNumber: string) {
  doc.font("Helvetica").fontSize(8).fillColor("#444444");
  doc.text(
    `Page ${pageIndex + 1} of ${pageCount} | Invoice #${invoiceNumber}`,
    MARGIN,
    FOOTER_Y,
    { width: CONTENT_W, align: "center" },
  );
  doc.fillColor("#000000");
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > FOOTER_Y - 20) {
    doc.addPage();
  }
}

export async function buildInvoiceRecordPdfBuffer(input: {
  invoice: InvoiceRow;
  lines: InvoiceLineItemRow[];
  issuer: InvoicePdfIssuerSettings;
}): Promise<Buffer> {
  const { invoice, lines, issuer } = input;
  const totalUsd = lines.reduce((sum, l) => sum + invoiceLineRevenue(l), 0);
  const totalInr = issuer.usdToInrRate ? totalUsd * issuer.usdToInrRate : null;

  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => {
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        drawFooter(doc, i - range.start, range.count, invoice.invoiceNumber);
      }
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);

    try {
      // --- Issuer header ---
      doc.font("Helvetica-Bold").fontSize(14).text(issuer.issuerName, { width: CONTENT_W });
      doc.font("Helvetica").fontSize(9);
      for (const line of issuer.issuerAddress.split(/\r?\n/)) {
        if (line.trim()) doc.text(line.trim());
      }
      doc.text(`GSTIN: ${issuer.issuerGstin}`);
      doc.text(`LUT Reference: ${issuer.issuerLut}`);
      doc.moveDown(0.8);

      doc.font("Helvetica-Bold").fontSize(12).text("INVOICE FOR EXPORT OF SERVICES", { align: "center" });
      doc.moveDown(0.6);

      // --- Invoice meta (two columns) ---
      const metaY = doc.y;
      const col2X = MARGIN + CONTENT_W / 2;
      doc.font("Helvetica").fontSize(9);
      doc.text(`Invoice Number: ${invoice.invoiceNumber}`, MARGIN, metaY, { width: CONTENT_W / 2 - 10 });
      doc.text(`Invoice Date:`, MARGIN, metaY + 14, { continued: true, width: 90 });
      doc.text(`\t${formatDateDDMMYYYY(invoice.issueDate)}`, { width: CONTENT_W / 2 - 100 });
      if (invoice.dueDate) {
        doc.text(`Due Date:`, MARGIN, metaY + 28, { continued: true, width: 90 });
        doc.text(`\t${formatDateDDMMYYYY(invoice.dueDate)}`, { width: CONTENT_W / 2 - 100 });
      }
      doc.text(`Place of Supply: ${issuer.placeOfSupply}`, col2X, metaY, { width: CONTENT_W / 2 });
      doc.text(`Currency:`, col2X, metaY + 14, { continued: true, width: 55 });
      doc.text(`\t${issuer.currencyLabel}`, { width: CONTENT_W / 2 - 60 });
      doc.y = metaY + (invoice.dueDate ? 48 : 34);
      doc.moveDown(0.8);

      // --- Bill to ---
      doc.font("Helvetica-Bold").fontSize(9).text("BILL TO");
      doc.font("Helvetica").fontSize(9);
      doc.text(invoice.clientName);
      if (invoice.billToAddress?.trim()) {
        for (const line of invoice.billToAddress.trim().split(/\r?\n/)) {
          if (line.trim()) doc.text(line.trim());
        }
      }
      if (invoice.billToEmail?.trim()) {
        doc.text(invoice.billToEmail.trim());
      }
      doc.moveDown(0.8);

      // --- Description ---
      doc.font("Helvetica-Bold").fontSize(9).text("DESCRIPTION");
      doc.font("Helvetica").fontSize(9).text(issuer.serviceDescription, { width: CONTENT_W });
      doc.moveDown(0.3);
      doc.text(issuer.sacLine);
      doc.moveDown(0.6);

      // --- Line items table ---
      const colProject = MARGIN;
      const colSqft = MARGIN + 280;
      const colAmount = MARGIN + 400;
      const headerY = doc.y;

      doc.font("Helvetica-Bold").fontSize(9);
      doc.text("Project", colProject, headerY);
      doc.text("SQFT", colSqft, headerY);
      doc.text("Amount", colAmount, headerY);
      doc
        .moveTo(MARGIN, headerY + 14)
        .lineTo(MARGIN + CONTENT_W, headerY + 14)
        .stroke();
      doc.y = headerY + 20;
      doc.font("Helvetica").fontSize(9);

      for (const line of lines) {
        ensureSpace(doc, 18);
        const y = doc.y;
        const revenue = invoiceLineRevenue(line);
        doc.text(line.projectCode, colProject, y, { width: 260 });
        doc.text(
          line.totalSqft.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          colSqft,
          y,
          { width: 100 },
        );
        doc.text(formatUsd(revenue), colAmount, y, { width: 120, align: "right" });
        doc.y = y + 16;
      }

      doc.moveDown(0.5);
      ensureSpace(doc, 120);
      doc
        .moveTo(MARGIN, doc.y)
        .lineTo(MARGIN + CONTENT_W, doc.y)
        .stroke();
      doc.moveDown(0.4);

      doc.font("Helvetica").fontSize(9);
      const subY = doc.y;
      doc.text("Subtotal:", MARGIN, subY, { width: CONTENT_W - 130, align: "right" });
      doc.text(formatUsd(totalUsd), colAmount, subY, { width: 120, align: "right" });
      doc.moveDown(0.8);

      if (totalInr != null) {
        ensureSpace(doc, 100);
        const tHeadY = doc.y;
        doc.font("Helvetica-Bold").fontSize(9);
        doc.text("Description", MARGIN, tHeadY, { width: 200 });
        doc.text("Amount (USD)", colSqft, tHeadY, { width: 100 });
        doc.text("Currency INR", colAmount, tHeadY, { width: 120, align: "right" });
        doc.y = tHeadY + 16;
        doc.font("Helvetica");

        const r1 = doc.y;
        doc.text("Service Charges", MARGIN, r1, { width: 200 });
        doc.text(formatUsd(totalUsd), colSqft, r1, { width: 100 });
        doc.text(formatInr(totalInr), colAmount, r1, { width: 120, align: "right" });
        doc.y = r1 + 16;

        const r2 = doc.y;
        doc.text("IGST @ 0%", MARGIN, r2, { width: 200 });
        doc.text("0.00", colAmount, r2, { width: 120, align: "right" });
        doc.y = r2 + 16;

        const r3 = doc.y;
        doc.font("Helvetica-Bold");
        doc.text("Total Invoice Value (INR)", MARGIN, r3, { width: 280 });
        doc.text(formatInr(totalInr), colAmount, r3, { width: 120, align: "right" });
        doc.font("Helvetica");
        doc.y = r3 + 18;

        doc.text(
          `Indian Currency: INR ${totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${amountInWordsInr(totalInr)})`,
          { width: CONTENT_W },
        );
        doc.moveDown(0.6);
      }

      ensureSpace(doc, 180);
      doc.font("Helvetica-Bold").fontSize(9).text("Export Declaration");
      doc.font("Helvetica").fontSize(9).text(issuer.exportDeclaration, { width: CONTENT_W });
      doc.moveDown(0.6);

      doc.font("Helvetica-Bold").fontSize(9).text("Bank Details");
      doc.font("Helvetica").fontSize(9);
      for (const line of issuer.bankDetails.split(/\r?\n/)) {
        if (line.trim()) doc.text(line.trim());
      }
      doc.moveDown(1.2);

      doc.text(issuer.signatureLabel);
      doc.moveDown(2);
      doc.text(issuer.signatureSubtext);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
