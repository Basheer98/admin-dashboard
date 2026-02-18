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

  const parsed = validate(settingsPostSchema, { usdToInrRate });
  if (!parsed.success) {
    return NextResponse.redirect(getRedirectUrl(request, "/settings", { error: "invalid" }));
  }

  const oldSettings = await getSettings();
  await updateSettings({ usdToInrRate: parsed.data.usdToInrRate });
  if (oldSettings.usdToInrRate !== parsed.data.usdToInrRate) {
    await insertActivity({
      type: "settings_changed",
      description: `Changed settings: USD→INR rate ${oldSettings.usdToInrRate ?? "—"} → ${parsed.data.usdToInrRate ?? "—"}`,
      metadata: { usdToInrRate: { old: oldSettings.usdToInrRate, new: parsed.data.usdToInrRate } },
    });
  }
  await insertAuditLog({
    ...actor,
    action: "setting.update",
    entityType: "setting",
    details: { usdToInrRate: parsed.data.usdToInrRate },
  });
  return NextResponse.redirect(getRedirectUrl(request, "/settings", { saved: "1" }));
}
