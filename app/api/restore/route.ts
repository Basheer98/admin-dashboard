import { NextResponse } from "next/server";
import {
  restoreBackup,
  type BackupPayload,
  isLegacyJsonShape,
  legacyJsonToBackupPayload,
} from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";

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
    return NextResponse.redirect(getRedirectUrl(request, "/settings", { restore: "error", message: "no-file" }));
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    return NextResponse.redirect(getRedirectUrl(request, "/settings", { restore: "error", message: "read" }));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.redirect(getRedirectUrl(request, "/settings", { restore: "error", message: "invalid-json" }));
  }
  let payload: BackupPayload;
  if (isValidBackupShape(parsed)) {
    payload = parsed;
  } else if (isLegacyJsonShape(parsed)) {
    payload = legacyJsonToBackupPayload(parsed);
  } else {
    return NextResponse.redirect(getRedirectUrl(request, "/settings", { restore: "error", message: "invalid-shape" }));
  }
  try {
    await restoreBackup(payload);
  } catch (e) {
    console.error("Restore failed:", e);
    return NextResponse.redirect(getRedirectUrl(request, "/settings", { restore: "error", message: "write" }));
  }
  return NextResponse.redirect(getRedirectUrl(request, "/settings", { restore: "ok" }));
}
