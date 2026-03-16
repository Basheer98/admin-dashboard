import { NextResponse } from "next/server";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { updateFielderLoginMeta, insertAuditLog } from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const actor = getAuditActor(session);

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum < 1) {
    return NextResponse.redirect(
      getRedirectUrl(request, "/settings", { flError: "invalid-id" }),
    );
  }

  const formData = await request.formData();
  const role = String(formData.get("role") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();

  try {
    await updateFielderLoginMeta(idNum, role || null, region || null);
    await insertAuditLog({
      ...actor,
      action: "fielder_login.update_meta",
      entityType: "fielder_login",
      entityId: String(idNum),
      details: { role: role || null, region: region || null },
    });
    return NextResponse.redirect(
      getRedirectUrl(request, "/settings", { flUpdated: "1" }),
    );
  } catch {
    return NextResponse.redirect(
      getRedirectUrl(request, "/settings", { flError: "update" }),
    );
  }
}

