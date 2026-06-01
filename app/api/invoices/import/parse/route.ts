import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { parseCsv } from "@/lib/csvParse";
import { guessColumnMapping } from "@/lib/invoiceCsvImport";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const text = await file.text();
  const { headers, rows } = parseCsv(text);
  if (headers.length === 0) {
    return NextResponse.json({ error: "CSV is empty or invalid" }, { status: 400 });
  }

  const mapping = guessColumnMapping(headers);
  const sampleRows = rows.slice(0, 8);

  let suggestedClient = "";
  const monthMatch = file.name.match(/\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\b/i);
  if (monthMatch) {
    const month = monthMatch[1]!.charAt(0).toUpperCase() + monthMatch[1]!.slice(1).toLowerCase();
    suggestedClient = `Project Tracker — ${month}`;
  }

  return NextResponse.json({
    filename: file.name,
    headers,
    rows,
    sampleRows,
    mapping,
    rowCount: rows.length,
    suggestedClientName: suggestedClient,
  });
}
