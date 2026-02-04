import { NextResponse } from "next/server";
import { getSettings, updateSettings, insertActivity } from "@/lib/db";
import { validate, settingsPostSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const formData = await request.formData();
  const rateStr = String(formData.get("usdToInrRate") ?? "").trim();
  const usdToInrRate = rateStr === "" ? null : Number(rateStr);

  const parsed = validate(settingsPostSchema, { usdToInrRate });
  if (!parsed.success) {
    const url = new URL("/settings", request.url);
    url.searchParams.set("error", "invalid");
    return NextResponse.redirect(url);
  }

  const oldSettings = getSettings();
  updateSettings({ usdToInrRate: parsed.data.usdToInrRate });
  if (oldSettings.usdToInrRate !== parsed.data.usdToInrRate) {
    insertActivity({
      type: "settings_changed",
      description: `Changed settings: USD→INR rate ${oldSettings.usdToInrRate ?? "—"} → ${parsed.data.usdToInrRate ?? "—"}`,
      metadata: { usdToInrRate: { old: oldSettings.usdToInrRate, new: parsed.data.usdToInrRate } },
    });
  }
  const url = new URL("/settings", request.url);
  url.searchParams.set("saved", "1");
  return NextResponse.redirect(url);
}
