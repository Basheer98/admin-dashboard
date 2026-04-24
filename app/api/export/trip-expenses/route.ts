import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getTripExpensesWithTrip } from "@/lib/db";

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expenses = await getTripExpensesWithTrip();
  const headers = [
    "Date",
    "Trip",
    "State",
    "Category",
    "Amount",
    "Currency",
    "Paid by",
    "Vendor",
    "Notes",
  ];
  const rows = expenses.map((e) => [
    escapeCsvCell(e.expenseDate),
    escapeCsvCell(e.trip.name),
    escapeCsvCell(e.trip.state),
    escapeCsvCell(e.category),
    escapeCsvCell(Number(e.amount).toFixed(2)),
    escapeCsvCell(e.currency),
    escapeCsvCell(e.paidBy ?? ""),
    escapeCsvCell(e.vendor ?? ""),
    escapeCsvCell(e.notes ?? ""),
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  const filename = `trip-expenses-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
