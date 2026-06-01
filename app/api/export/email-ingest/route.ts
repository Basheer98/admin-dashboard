import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { listEmailIngestRecords } from "@/lib/db";

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

  const rows = await listEmailIngestRecords({ status: "APPROVED", limit: 5000, offset: 0 });
  const headers = [
    "Ingest ID",
    "Received at",
    "Sender",
    "Subject",
    "Entity type",
    "Created entity type",
    "Created entity id",
    "Confidence",
    "Fielder",
    "Project code",
    "Trip name",
  ];
  const csvRows = rows.map((row) => [
    escapeCsvCell(row.id),
    escapeCsvCell(row.receivedAt),
    escapeCsvCell(row.senderEmail ?? row.senderName ?? ""),
    escapeCsvCell(row.subject ?? ""),
    escapeCsvCell(row.entityType ?? ""),
    escapeCsvCell(row.createdEntityType ?? ""),
    escapeCsvCell(row.createdEntityId ?? ""),
    escapeCsvCell(row.confidence ?? ""),
    escapeCsvCell(String(row.parsedPayload?.fielderName ?? "")),
    escapeCsvCell(String(row.parsedPayload?.projectCode ?? "")),
    escapeCsvCell(String(row.parsedPayload?.tripName ?? "")),
  ].join(","));

  const csv = [headers.join(","), ...csvRows].join("\n");
  const filename = `email-ingest-approved-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
