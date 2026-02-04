import { NextResponse } from "next/server";
import { restoreBackup, type BackupPayload } from "@/lib/db";

function isValidBackupShape(obj: unknown): obj is BackupPayload {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (!o.settings || typeof o.settings !== "object") return false;
  if (!Array.isArray(o.projects)) return false;
  if (!Array.isArray(o.assignments)) return false;
  if (!Array.isArray(o.payments)) return false;
  if (!Array.isArray(o.additionalWork)) return false;
  if (!Array.isArray(o.activityLog)) return false;
  if (o.fielderLogins !== undefined && !Array.isArray(o.fielderLogins)) return false;
  return true;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || typeof file === "string") {
    const url = new URL("/settings", request.url);
    url.searchParams.set("restore", "error");
    url.searchParams.set("message", "no-file");
    return NextResponse.redirect(url);
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    const url = new URL("/settings", request.url);
    url.searchParams.set("restore", "error");
    url.searchParams.set("message", "read");
    return NextResponse.redirect(url);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const url = new URL("/settings", request.url);
    url.searchParams.set("restore", "error");
    url.searchParams.set("message", "invalid-json");
    return NextResponse.redirect(url);
  }
  if (!isValidBackupShape(parsed)) {
    const url = new URL("/settings", request.url);
    url.searchParams.set("restore", "error");
    url.searchParams.set("message", "invalid-shape");
    return NextResponse.redirect(url);
  }
  try {
    await restoreBackup(parsed);
  } catch (e) {
    console.error("Restore failed:", e);
    const url = new URL("/settings", request.url);
    url.searchParams.set("restore", "error");
    url.searchParams.set("message", "write");
    return NextResponse.redirect(url);
  }
  const url = new URL("/settings", request.url);
  url.searchParams.set("restore", "ok");
  return NextResponse.redirect(url);
}
