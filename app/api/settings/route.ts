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
  const hasUsd = formData.has("usdToInrRate");
  const hasCompanyRate = formData.has("companyRatePerSqft");
  const hasAdminPhone = formData.has("adminPhone");
  const hasEmailIngestEnabled = formData.has("emailIngestEnabled");
  const hasEmailIngestAutoApprove = formData.has("emailIngestAutoApprove");
  const hasWebhookSecret = formData.has("emailIngestWebhookSecret");
  const hasConfidence = formData.has("emailIngestAutoApproveMinConfidence");

  const rateStr = String(formData.get("usdToInrRate") ?? "").trim();
  const usdToInrRate = hasUsd ? (rateStr === "" ? null : Number(rateStr)) : undefined;
  const companyRateStr = String(formData.get("companyRatePerSqft") ?? "").trim();
  const companyRatePerSqft = hasCompanyRate
    ? (companyRateStr === "" ? null : Number(companyRateStr))
    : undefined;
  const adminPhoneRaw = String(formData.get("adminPhone") ?? "").trim();
  const adminPhone = hasAdminPhone ? (adminPhoneRaw || null) : undefined;
  const emailIngestEnabled = hasEmailIngestEnabled
    ? String(formData.get("emailIngestEnabled") ?? "") === "on"
    : undefined;
  const emailIngestAutoApprove = hasEmailIngestAutoApprove
    ? String(formData.get("emailIngestAutoApprove") ?? "") === "on"
    : undefined;
  const webhookSecretRaw = String(formData.get("emailIngestWebhookSecret") ?? "").trim();
  const emailIngestWebhookSecret = hasWebhookSecret ? (webhookSecretRaw || null) : undefined;
  const confidenceRaw = String(formData.get("emailIngestAutoApproveMinConfidence") ?? "").trim();
  const emailIngestAutoApproveMinConfidence = hasConfidence
    ? (confidenceRaw === "" ? undefined : Number(confidenceRaw))
    : undefined;

  const parsed = validate(settingsPostSchema, {
    usdToInrRate,
    companyRatePerSqft,
    adminPhone,
    emailIngestEnabled,
    emailIngestWebhookSecret,
    emailIngestAutoApprove,
    emailIngestAutoApproveMinConfidence,
  });
  if (!parsed.success) {
    return NextResponse.redirect(getRedirectUrl(request, "/settings", { error: "invalid" }));
  }

  const oldSettings = await getSettings();
  await updateSettings({
    usdToInrRate: parsed.data.usdToInrRate,
    companyRatePerSqft: parsed.data.companyRatePerSqft,
    adminPhone: parsed.data.adminPhone,
    emailIngestEnabled: parsed.data.emailIngestEnabled,
    emailIngestWebhookSecret: parsed.data.emailIngestWebhookSecret,
    emailIngestAutoApprove: parsed.data.emailIngestAutoApprove,
    emailIngestAutoApproveMinConfidence:
      parsed.data.emailIngestAutoApproveMinConfidence,
  });
  if (
    oldSettings.usdToInrRate !== parsed.data.usdToInrRate ||
    oldSettings.adminPhone !== parsed.data.adminPhone ||
    oldSettings.emailIngestEnabled !== parsed.data.emailIngestEnabled ||
    oldSettings.emailIngestWebhookSecret !== parsed.data.emailIngestWebhookSecret ||
    oldSettings.emailIngestAutoApprove !== parsed.data.emailIngestAutoApprove ||
    oldSettings.emailIngestAutoApproveMinConfidence !== parsed.data.emailIngestAutoApproveMinConfidence
  ) {
    const changes: string[] = [];
    if (oldSettings.usdToInrRate !== parsed.data.usdToInrRate) changes.push(`USD→INR ${oldSettings.usdToInrRate ?? "—"} → ${parsed.data.usdToInrRate ?? "—"}`);
    if (oldSettings.adminPhone !== parsed.data.adminPhone) changes.push(`Admin phone ${oldSettings.adminPhone ?? "—"} → ${parsed.data.adminPhone ?? "—"}`);
    if (oldSettings.emailIngestEnabled !== parsed.data.emailIngestEnabled) changes.push(`Email ingest ${oldSettings.emailIngestEnabled ? "enabled" : "disabled"} → ${parsed.data.emailIngestEnabled ? "enabled" : "disabled"}`);
    if (oldSettings.emailIngestAutoApprove !== parsed.data.emailIngestAutoApprove) changes.push(`Auto-approve ${oldSettings.emailIngestAutoApprove ? "on" : "off"} → ${parsed.data.emailIngestAutoApprove ? "on" : "off"}`);
    if (oldSettings.emailIngestAutoApproveMinConfidence !== parsed.data.emailIngestAutoApproveMinConfidence) changes.push(`Confidence ${oldSettings.emailIngestAutoApproveMinConfidence} → ${parsed.data.emailIngestAutoApproveMinConfidence}`);
    await insertActivity({
      type: "settings_changed",
      description: `Changed settings: ${changes.join("; ")}`,
      metadata: {
        usdToInrRate: { old: oldSettings.usdToInrRate, new: parsed.data.usdToInrRate },
        adminPhone: { old: oldSettings.adminPhone, new: parsed.data.adminPhone },
        emailIngestEnabled: { old: oldSettings.emailIngestEnabled, new: parsed.data.emailIngestEnabled },
        emailIngestAutoApprove: { old: oldSettings.emailIngestAutoApprove, new: parsed.data.emailIngestAutoApprove },
        emailIngestAutoApproveMinConfidence: { old: oldSettings.emailIngestAutoApproveMinConfidence, new: parsed.data.emailIngestAutoApproveMinConfidence },
      },
    });
  }
  await insertAuditLog({
    ...actor,
    action: "setting.update",
    entityType: "setting",
    details: {
      usdToInrRate: parsed.data.usdToInrRate,
      adminPhone: parsed.data.adminPhone,
      emailIngestEnabled: parsed.data.emailIngestEnabled,
      emailIngestAutoApprove: parsed.data.emailIngestAutoApprove,
      emailIngestAutoApproveMinConfidence: parsed.data.emailIngestAutoApproveMinConfidence,
    },
  });
  return NextResponse.redirect(getRedirectUrl(request, "/settings", { saved: "1" }));
}
