import { NextResponse } from "next/server";
import { getAllProjects } from "@/lib/db";

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
  const archived = searchParams.get("archived") === "1";
  const projects = getAllProjects({ includeArchived: archived });

  const headers = [
    "Project ID",
    "Client",
    "Location",
    "Total SQFT",
    "Rate per SQFT",
    "Revenue",
    "Status",
    "ECD",
    "Created",
  ];
  const rows = projects.map((p) => {
    const revenue = p.totalSqft * Number(p.companyRatePerSqft);
    return [
      escapeCsvCell(p.projectCode),
      escapeCsvCell(p.clientName),
      escapeCsvCell(p.location),
      escapeCsvCell(p.totalSqft),
      escapeCsvCell(Number(p.companyRatePerSqft)),
      escapeCsvCell(revenue.toFixed(2)),
      escapeCsvCell(p.status),
      escapeCsvCell(p.ecd ? p.ecd.slice(0, 10) : ""),
      escapeCsvCell(p.createdAt.slice(0, 10)),
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const filename = `projects-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
