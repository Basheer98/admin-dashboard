import { NextResponse } from "next/server";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getAllFielderLogins, insertFielderLogin, insertAuditLog } from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { validate } from "@/lib/validations";
import { z } from "zod";

const createSchema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(6),
  fielderName: z.string().min(1),
});

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const logins = await getAllFielderLogins();
  return NextResponse.json(logins);
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fielderName = String(formData.get("fielderName") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const gdriveRootFolderUrl = String(formData.get("gdriveRootFolderUrl") ?? "").trim();

  const parsed = validate(createSchema, { email, password, fielderName });
  if (!parsed.success) {
    return NextResponse.redirect(
      getRedirectUrl(request, "/settings", { flError: "invalid" }),
    );
  }

  try {
    const id = await insertFielderLogin({
      ...parsed.data,
      role: role || null,
      region: region || null,
      gdriveRootFolderUrl: gdriveRootFolderUrl || null,
    });
    await insertAuditLog({
      ...getAuditActor(session),
      action: "fielder_login.create",
      entityType: "fielder_login",
      entityId: String(id),
      details: { email: parsed.data.email, fielderName: parsed.data.fielderName },
    });
    return NextResponse.redirect(
      getRedirectUrl(request, "/settings", { flCreated: "1" }),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.redirect(
        getRedirectUrl(request, "/settings", { flError: "email-taken" }),
      );
    }
    return NextResponse.redirect(
      getRedirectUrl(request, "/settings", { flError: "create" }),
    );
  }
}
