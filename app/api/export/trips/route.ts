import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getAllTrips } from "@/lib/db";

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

  const trips = await getAllTrips();
  const headers = [
    "Trip",
    "State",
    "City",
    "Team members",
    "Project",
    "Start date",
    "End date",
    "Status",
    "Budget car",
    "Budget accommodation",
    "Budget gas",
    "Budget tools",
    "Budget total",
    "Total expenses",
    "Budget variance",
  ];
  const rows = trips.map((t) => [
    // Keep this export self-contained for trip planning review.
    escapeCsvCell(t.name),
    escapeCsvCell(t.state),
    escapeCsvCell(t.city ?? ""),
    escapeCsvCell(t.teamMembers ?? ""),
    escapeCsvCell(t.project?.projectCode ?? ""),
    escapeCsvCell(t.startDate),
    escapeCsvCell(t.endDate ?? ""),
    escapeCsvCell(t.status),
    escapeCsvCell(Number(t.budgetCar ?? 0).toFixed(2)),
    escapeCsvCell(Number(t.budgetAccommodation ?? 0).toFixed(2)),
    escapeCsvCell(Number(t.budgetGas ?? 0).toFixed(2)),
    escapeCsvCell(Number(t.budgetTools ?? 0).toFixed(2)),
    escapeCsvCell(
      (
        Number(t.budgetCar ?? 0) +
        Number(t.budgetAccommodation ?? 0) +
        Number(t.budgetGas ?? 0) +
        Number(t.budgetTools ?? 0)
      ).toFixed(2),
    ),
    escapeCsvCell(Number(t.totalExpense).toFixed(2)),
    escapeCsvCell(
      (
        Number(t.budgetCar ?? 0) +
        Number(t.budgetAccommodation ?? 0) +
        Number(t.budgetGas ?? 0) +
        Number(t.budgetTools ?? 0) -
        Number(t.totalExpense)
      ).toFixed(2),
    ),
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  const filename = `trips-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
