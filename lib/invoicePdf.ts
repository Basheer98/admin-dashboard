import PDFDocument from "pdfkit";
import type { InvoiceLineItemRow, InvoiceRow } from "@/lib/db";
import { invoiceLineRevenue } from "@/lib/db";
import type { InvoicePdfIssuerSettings } from "@/lib/invoicePdfDefaults";

const MARGIN = 54;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 48;

const INK = "#111827";
const MUTED = "#6B7280";
const RULE = "#D1D5DB";
const HEADER_BG = "#F3F4F6";
const ACCENT = "#059669";

function formatDateLong(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatUsd(amount: number): string {
  return (
    "$" +
    amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function drawFooter(doc: PDFKit.PDFDocument, pageIndex: number, pageCount: number) {
  doc.font("Helvetica").fontSize(8).fillColor(MUTED);
  doc.text(
    pageCount > 1 ? `Page ${pageIndex + 1} of ${pageCount}` : "",
    MARGIN,
    FOOTER_Y,
    { width: CONTENT_W, align: "center" },
  );
  doc.fillColor(INK);
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > FOOTER_Y - 24) doc.addPage();
}

function drawHeader(doc: PDFKit.PDFDocument, issuer: InvoicePdfIssuerSettings): number {
  const topY = MARGIN;
  const logoW = 132;
  const logoH = 52;
  let textX = MARGIN;

  if (issuer.logo && issuer.logo.length > 0) {
    try {
      doc.image(issuer.logo, MARGIN, topY, {
        fit: [logoW, logoH],
      });
      textX = MARGIN + logoW + 18;
    } catch {
      textX = MARGIN;
    }
  }

  const nameY = topY + (issuer.logo ? 4 : 0);
  doc.font("Helvetica-Bold").fontSize(15).fillColor(INK);
  doc.text(issuer.issuerName, textX, nameY, { width: CONTENT_W - (textX - MARGIN) });
  doc.font("Helvetica").fontSize(9.5).fillColor(MUTED);
  let ay = doc.y + 2;
  for (const line of issuer.issuerAddress.split(/\r?\n/)) {
    if (line.trim()) {
      doc.text(line.trim(), textX, ay, { width: CONTENT_W - (textX - MARGIN) });
      ay = doc.y + 1;
    }
  }

  const headerBottom = Math.max(ay, topY + logoH) + 18;
  doc
    .strokeColor(ACCENT)
    .lineWidth(2)
    .moveTo(MARGIN, headerBottom)
    .lineTo(MARGIN + CONTENT_W, headerBottom)
    .stroke();
  doc.strokeColor(RULE).lineWidth(1);

  return headerBottom + 22;
}

export async function buildInvoiceRecordPdfBuffer(input: {
  invoice: InvoiceRow;
  lines: InvoiceLineItemRow[];
  issuer: InvoicePdfIssuerSettings;
}): Promise<Buffer> {
  const { invoice, lines, issuer } = input;
  const totalUsd = lines.reduce((sum, l) => sum + invoiceLineRevenue(l), 0);

  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => {
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        drawFooter(doc, i - range.start, range.count);
      }
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);

    try {
      let y = drawHeader(doc, issuer);

      // Title
      doc.font("Helvetica-Bold").fontSize(22).fillColor(INK);
      doc.text("INVOICE", MARGIN, y, { width: CONTENT_W, align: "left" });
      y = doc.y + 22;

      // Two columns: invoice meta (left) | bill to (right)
      const colW = CONTENT_W / 2 - 12;
      const rightX = MARGIN + CONTENT_W / 2 + 12;
      const blockTop = y;

      doc.font("Helvetica").fontSize(9.5).fillColor(MUTED);
      doc.text("Invoice Number", MARGIN, blockTop, { width: colW });
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(INK);
      doc.text(invoice.invoiceNumber, MARGIN, blockTop + 13, { width: colW });

      doc.font("Helvetica").fontSize(9.5).fillColor(MUTED);
      doc.text("Invoice Date", MARGIN, blockTop + 36, { width: colW });
      doc.font("Helvetica").fontSize(10.5).fillColor(INK);
      doc.text(formatDateLong(invoice.issueDate), MARGIN, blockTop + 49, { width: colW });

      let leftBottom = blockTop + 68;
      if (invoice.dueDate) {
        doc.font("Helvetica").fontSize(9.5).fillColor(MUTED);
        doc.text("Due Date", MARGIN, blockTop + 68, { width: colW });
        doc.font("Helvetica").fontSize(10.5).fillColor(INK);
        doc.text(formatDateLong(invoice.dueDate), MARGIN, blockTop + 81, { width: colW });
        leftBottom = blockTop + 100;
      }

      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(MUTED);
      doc.text("BILL TO", rightX, blockTop, { width: colW });
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(INK);
      doc.text(invoice.clientName, rightX, blockTop + 14, { width: colW });

      doc.font("Helvetica").fontSize(10).fillColor(INK);
      let billY = doc.y + 4;
      if (invoice.billToAddress?.trim()) {
        for (const line of invoice.billToAddress.trim().split(/\r?\n/)) {
          if (line.trim()) {
            doc.text(line.trim(), rightX, billY, { width: colW });
            billY = doc.y + 2;
          }
        }
      }
      if (invoice.billToEmail?.trim()) {
        doc.fillColor(MUTED).text(invoice.billToEmail.trim(), rightX, billY, { width: colW });
        doc.fillColor(INK);
        billY = doc.y + 2;
      }

      y = Math.max(leftBottom, billY) + 28;

      // Line items table
      const colProject = MARGIN + 12;
      const colSqft = MARGIN + 300;
      const colAmount = MARGIN + CONTENT_W - 12;
      const amountColW = 100;
      const rowH = 26;
      const headerY = y;

      doc.rect(MARGIN, headerY, CONTENT_W, rowH).fill(HEADER_BG);
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(9);
      doc.text("Project", colProject, headerY + 8, { width: 260 });
      doc.text("SQFT", colSqft, headerY + 8, { width: 90 });
      doc.text("Amount", colAmount - amountColW, headerY + 8, {
        width: amountColW,
        align: "right",
      });

      y = headerY + rowH;
      doc.font("Helvetica").fontSize(10);

      lines.forEach((line, i) => {
        ensureSpace(doc, rowH + 8);
        if (doc.y > y) y = doc.y;
        const rowY = y;
        if (i % 2 === 1) {
          doc.rect(MARGIN, rowY, CONTENT_W, rowH).fill("#FAFAFA");
          doc.fillColor(INK);
        }
        const revenue = invoiceLineRevenue(line);
        doc.text(line.projectCode, colProject, rowY + 8, { width: 260 });
        doc.text(
          line.totalSqft.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
          colSqft,
          rowY + 8,
          { width: 90 },
        );
        doc.text(formatUsd(revenue), colAmount - amountColW, rowY + 8, {
          width: amountColW,
          align: "right",
        });
        y = rowY + rowH;
        doc
          .strokeColor(RULE)
          .moveTo(MARGIN, y)
          .lineTo(MARGIN + CONTENT_W, y)
          .stroke();
      });

      ensureSpace(doc, 44);
      y += 10;
      const totalY = y;
      doc.font("Helvetica-Bold").fontSize(11).fillColor(INK);
      doc.text("Total", colSqft, totalY, { width: 90, align: "left" });
      doc.text(formatUsd(totalUsd), colAmount - amountColW, totalY, {
        width: amountColW,
        align: "right",
      });

      if (invoice.notes?.trim()) {
        y = totalY + 36;
        ensureSpace(doc, 40);
        doc.font("Helvetica").fontSize(9).fillColor(MUTED);
        doc.text("Notes", MARGIN, y);
        doc.font("Helvetica").fontSize(9.5).fillColor(INK);
        doc.text(invoice.notes.trim(), MARGIN, y + 14, { width: CONTENT_W });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
