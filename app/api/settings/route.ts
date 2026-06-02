import { NextResponse } from "next/server";
import { getSettings, updateSettings, insertActivity, insertAuditLog } from "@/lib/db";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { validate, settingsPatchSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.redirect(getRedirectUrl(request, "/login"));
  const actor = getAuditActor(session);

  const formData = await request.formData();
  const hasCompanyRate = formData.has("companyRatePerSqft");
  const hasAdminPhone = formData.has("adminPhone");
  const hasEmailIngestEnabled = formData.has("emailIngestEnabled");
  const hasEmailIngestAutoApprove = formData.has("emailIngestAutoApprove");
  const hasWebhookSecret = formData.has("emailIngestWebhookSecret");
  const hasConfidence = formData.has("emailIngestAutoApproveMinConfidence");
  const hasInvoicePdf = formData.has("invoicePdfSettings");

  const payload: Record<string, unknown> = {};
  const strOrNull = (key: string) => {
    const v = String(formData.get(key) ?? "").trim();
    return v === "" ? null : v;
  };
  const numOrNull = (key: string) => {
    const v = String(formData.get(key) ?? "").trim();
    return v === "" ? null : Number(v);
  };

  if (hasInvoicePdf) {
    payload.invoiceIssuerName = strOrNull("invoiceIssuerName");
    payload.invoiceIssuerAddress = strOrNull("invoiceIssuerAddress");
    payload.invoiceIssuerGstin = strOrNull("invoiceIssuerGstin");
    payload.invoiceIssuerLut = strOrNull("invoiceIssuerLut");
    payload.invoiceIssuerServiceDescription = strOrNull("invoiceIssuerServiceDescription");
    payload.invoiceIssuerSacLine = strOrNull("invoiceIssuerSacLine");
    payload.invoiceIssuerBankDetails = strOrNull("invoiceIssuerBankDetails");
    payload.invoiceIssuerExportDeclaration = strOrNull("invoiceIssuerExportDeclaration");
    payload.invoicePlaceOfSupply = strOrNull("invoicePlaceOfSupply");
    payload.usdToInrRate = numOrNull("usdToInrRate");
  }

  if (hasCompanyRate) {
    const companyRateStr = String(formData.get("companyRatePerSqft") ?? "").trim();
    payload.companyRatePerSqft = companyRateStr === "" ? null : Number(companyRateStr);
  }
  if (hasAdminPhone) {
    const adminPhoneRaw = String(formData.get("adminPhone") ?? "").trim();
    payload.adminPhone = adminPhoneRaw || null;
  }
  if (hasEmailIngestEnabled) {
    payload.emailIngestEnabled = String(formData.get("emailIngestEnabled") ?? "") === "on";
  }
  if (hasEmailIngestAutoApprove) {
    payload.emailIngestAutoApprove = String(formData.get("emailIngestAutoApprove") ?? "") === "on";
  }
  if (hasWebhookSecret) {
    const webhookSecretRaw = String(formData.get("emailIngestWebhookSecret") ?? "").trim();
    payload.emailIngestWebhookSecret = webhookSecretRaw || null;
  }
  if (hasConfidence) {
    const confidenceRaw = String(formData.get("emailIngestAutoApproveMinConfidence") ?? "").trim();
    payload.emailIngestAutoApproveMinConfidence =
      confidenceRaw === "" ? undefined : Number(confidenceRaw);
  }

  const parsed = validate(settingsPatchSchema, payload);
  if (!parsed.success) {
    const err = hasCompanyRate ? "billing" : hasInvoicePdf ? "invoicePdf" : "invalid";
    return NextResponse.redirect(getRedirectUrl(request, "/settings", { error: err }));
  }

  const oldSettings = await getSettings();
  await updateSettings(parsed.data);

  const changes: string[] = [];
  if (
    parsed.data.companyRatePerSqft !== undefined &&
    oldSettings.companyRatePerSqft !== parsed.data.companyRatePerSqft
  ) {
    changes.push(
      `Company rate ${oldSettings.companyRatePerSqft ?? "—"} → ${parsed.data.companyRatePerSqft ?? "—"}`,
    );
  }
  if (parsed.data.adminPhone !== undefined && oldSettings.adminPhone !== parsed.data.adminPhone) {
    changes.push(`Admin phone ${oldSettings.adminPhone ?? "—"} → ${parsed.data.adminPhone ?? "—"}`);
  }
  if (changes.length > 0) {
    await insertActivity({
      type: "settings_changed",
      description: `Changed settings: ${changes.join("; ")}`,
      metadata: { changes },
    });
  }

  await insertAuditLog({
    ...actor,
    action: "setting.update",
    entityType: "setting",
    details: parsed.data,
  });

  const onlyBilling =
    hasCompanyRate &&
    !hasAdminPhone &&
    !hasEmailIngestEnabled &&
    !hasEmailIngestAutoApprove &&
    !hasWebhookSecret &&
    !hasConfidence &&
    !hasInvoicePdf;

  const onlyInvoicePdf = hasInvoicePdf && !hasCompanyRate && !hasAdminPhone;

  return NextResponse.redirect(
    getRedirectUrl(
      request,
      "/settings",
      onlyBilling
        ? { billingSaved: "1" }
        : onlyInvoicePdf
          ? { invoicePdfSaved: "1" }
          : { saved: "1" },
    ),
  );
}
