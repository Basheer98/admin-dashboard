import { NextResponse } from "next/server";
import { normalizeAllFielderNames, insertActivity, insertAuditLog } from "@/lib/db";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.redirect(getRedirectUrl(request, "/login"));
  const actor = getAuditActor(session);

  const count = await normalizeAllFielderNames();
  if (count > 0) {
    await insertActivity({
      type: "settings_changed",
      description: `Normalized ${count} fielder name(s) to uppercase.`,
      metadata: { action: "normalize_fielder_names", count },
    });
  }
  await insertAuditLog({
    ...actor,
    action: "settings.normalize_fielder_names",
    entityType: "setting",
    details: { count },
  });
  return NextResponse.redirect(getRedirectUrl(request, "/settings", { normalized: "1", count: String(count) }));
}
