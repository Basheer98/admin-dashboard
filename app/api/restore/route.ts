import { NextResponse } from "next/server";
import {
  restoreBackup,
  insertAuditLog,
  type BackupPayload,
  isLegacyJsonShape,
  legacyJsonToBackupPayload,
} from "@/lib/db";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
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
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.redirect(getRedirectUrl(request, "/login"));
  const actor = getAuditActor(session);

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
    await insertAuditLog({
      ...actor,
      action: "backup.restore",
      entityType: "setting",
      details: { projectCount: payload.projects.length },
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("Restore failed:", e);
    const params: Record<string, string> = { restore: "error", message: "write" };
    const safeDetail = errMsg.slice(0, 120).replace(/[^a-zA-Z0-9 _-]/g, " ");
    if (safeDetail) params.detail = safeDetail;
    return NextResponse.redirect(getRedirectUrl(request, "/settings", params));
  }
  return NextResponse.redirect(getRedirectUrl(request, "/settings", { restore: "ok" }));
}
