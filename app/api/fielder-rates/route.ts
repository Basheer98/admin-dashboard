import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuditActor, getSessionFromRequest } from "@/lib/auth";
import { insertAuditLog, upsertFielderRate } from "@/lib/db";
import { normalizeFielderName } from "@/lib/normalize";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { validate } from "@/lib/validations";

const upsertSchema = z.object({
  fielderName: z.string().min(1),
  ratePerSqft: z.number().nonnegative(),
});

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    const parsed = validate(upsertSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }
    await upsertFielderRate(parsed.data.fielderName, parsed.data.ratePerSqft);
    return NextResponse.json({ ok: true });
  }

  const formData = await request.formData();
  const fielderName = normalizeFielderName(String(formData.get("fielderName") ?? ""));
  const rateStr = String(formData.get("ratePerSqft") ?? "").trim();
  const parsed = validate(upsertSchema, {
    fielderName: fielderName || undefined,
    ratePerSqft: rateStr === "" ? undefined : Number(rateStr),
  });
  if (!parsed.success) {
    return NextResponse.redirect(getRedirectUrl(request, "/settings", { rateError: "invalid" }));
  }

  await upsertFielderRate(parsed.data.fielderName, parsed.data.ratePerSqft);
  await insertAuditLog({
    ...getAuditActor(session),
    action: "fielder_rate.upsert",
    entityType: "fielder_rate",
    entityId: parsed.data.fielderName,
    details: { ratePerSqft: parsed.data.ratePerSqft },
  });

  return NextResponse.redirect(getRedirectUrl(request, "/settings", { rateSaved: "1" }));
}
