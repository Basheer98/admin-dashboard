import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getAuditEntries } from "@/lib/db";

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
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const actor = searchParams.get("actor")?.trim() || undefined;
  const action = searchParams.get("action")?.trim() || undefined;
  const entityType = searchParams.get("entityType")?.trim() || undefined;
  const from = searchParams.get("from")?.trim() || undefined;
  const to = searchParams.get("to")?.trim() || undefined;

  const entries = await getAuditEntries({
    actorName: actor,
    action,
    entityType,
    fromDate: from,
    toDate: to,
    limit: 50000,
  });

  const headers = [
    "Time",
    "Actor Type",
    "Actor Name",
    "Action",
    "Entity Type",
    "Entity ID",
    "Details",
  ];
  const rows = entries.map((e) =>
    [
      escapeCsvCell(e.createdAt),
      escapeCsvCell(e.actorType),
      escapeCsvCell(e.actorName),
      escapeCsvCell(e.action),
      escapeCsvCell(e.entityType),
      escapeCsvCell(e.entityId ?? ""),
      escapeCsvCell(
        e.details && Object.keys(e.details).length > 0
          ? Object.entries(e.details)
              .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
              .join("; ")
          : "",
      ),
    ].join(","),
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const filename = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
