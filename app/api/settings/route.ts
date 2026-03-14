import { NextResponse } from "next/server";
import { getSettings, updateSettings, insertActivity, insertAuditLog } from "@/lib/db";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { validate, settingsPostSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.redirect(getRedirectUrl(request, "/login"));
  const actor = getAuditActor(session);

  const formData = await request.formData();
  const rateStr = String(formData.get("usdToInrRate") ?? "").trim();
  const usdToInrRate = rateStr === "" ? null : Number(rateStr);
  const adminPhoneRaw = String(formData.get("adminPhone") ?? "").trim();
  const adminPhone = adminPhoneRaw || null;

  const parsed = validate(settingsPostSchema, { usdToInrRate, adminPhone });
  if (!parsed.success) {
    return NextResponse.redirect(getRedirectUrl(request, "/settings", { error: "invalid" }));
  }

  const oldSettings = await getSettings();
  await updateSettings({ usdToInrRate: parsed.data.usdToInrRate, adminPhone: parsed.data.adminPhone });
  if (oldSettings.usdToInrRate !== parsed.data.usdToInrRate || oldSettings.adminPhone !== parsed.data.adminPhone) {
    const changes: string[] = [];
    if (oldSettings.usdToInrRate !== parsed.data.usdToInrRate) changes.push(`USD→INR ${oldSettings.usdToInrRate ?? "—"} → ${parsed.data.usdToInrRate ?? "—"}`);
    if (oldSettings.adminPhone !== parsed.data.adminPhone) changes.push(`Admin phone ${oldSettings.adminPhone ?? "—"} → ${parsed.data.adminPhone ?? "—"}`);
    await insertActivity({
      type: "settings_changed",
      description: `Changed settings: ${changes.join("; ")}`,
      metadata: { usdToInrRate: { old: oldSettings.usdToInrRate, new: parsed.data.usdToInrRate }, adminPhone: { old: oldSettings.adminPhone, new: parsed.data.adminPhone } },
    });
  }
  await insertAuditLog({
    ...actor,
    action: "setting.update",
    entityType: "setting",
    details: { usdToInrRate: parsed.data.usdToInrRate, adminPhone: parsed.data.adminPhone },
  });
  return NextResponse.redirect(getRedirectUrl(request, "/settings", { saved: "1" }));
}
