import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { updateFielderLoginPassword } from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum < 1) {
    return NextResponse.redirect(
      getRedirectUrl(request, "/settings", { flError: "invalid-id" }),
    );
  }

  const formData = await request.formData();
  const newPassword = String(formData.get("newPassword") ?? "").trim();
  if (newPassword.length < 6) {
    return NextResponse.redirect(
      getRedirectUrl(request, "/settings", { flError: "password-short" }),
    );
  }

  try {
    await updateFielderLoginPassword(idNum, newPassword);
    return NextResponse.redirect(
      getRedirectUrl(request, "/settings", { flReset: "1" }),
    );
  } catch {
    return NextResponse.redirect(
      getRedirectUrl(request, "/settings", { flError: "reset" }),
    );
  }
}
