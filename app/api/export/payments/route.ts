import { NextResponse } from "next/server";
import { getPaymentsWithDetails } from "@/lib/db";

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const voided = searchParams.get("voided") === "1";
  const payments = getPaymentsWithDetails({ includeVoided: voided });

  const headers = [
    "Date",
    "Project",
    "Client",
    "Fielder",
    "Amount",
    "Currency",
    "Method",
    "Voided",
    "Notes",
  ];
  const rows = payments.map((p) => [
    escapeCsvCell(p.paymentDate.slice(0, 10)),
    escapeCsvCell(p.project.projectCode),
    escapeCsvCell(p.project.clientName),
    escapeCsvCell(p.assignment.fielderName),
    escapeCsvCell(Number(p.amount).toFixed(2)),
    escapeCsvCell(p.currency),
    escapeCsvCell(p.method),
    escapeCsvCell(p.voidedAt ? "Yes" : ""),
    escapeCsvCell(p.notes ?? ""),
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  const filename = `payments-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
