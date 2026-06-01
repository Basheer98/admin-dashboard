import { NextResponse } from "next/server";
import { getAuditActor, getSessionFromRequest } from "@/lib/auth";
import { insertAuditLog } from "@/lib/db";
import { testDriveConnection } from "@/lib/drive";
import { getRedirectUrl } from "@/lib/redirectUrl";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }
  const actor = getAuditActor(session);
  try {
    const result = await testDriveConnection();
    await insertAuditLog({
      ...actor,
      action: "setting.drive_test",
      entityType: "setting",
      details: { ok: true, folderName: result.folderName },
    });
    return NextResponse.redirect(
      getRedirectUrl(request, "/settings", { driveTest: "ok", driveFolder: result.folderName }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Drive test failed";
    await insertAuditLog({
      ...actor,
      action: "setting.drive_test",
      entityType: "setting",
      details: { ok: false, error: message },
    });
    return NextResponse.redirect(
      getRedirectUrl(request, "/settings", { driveTest: "error", driveError: message }),
    );
  }
}
