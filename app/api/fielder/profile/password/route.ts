import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { getMobileSession, unauthorized } from "@/lib/mobileAuth";
import { getFielderLoginByFielderName, updateFielderLoginPassword } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getMobileSession(request);
  if (!session || session.role !== "fielder") return unauthorized();

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Current password and new password required" },
      { status: 400 },
    );
  }

  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "New password must be at least 6 characters" },
      { status: 400 },
    );
  }

  const login = await getFielderLoginByFielderName(session.fielderName);
  if (!login) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, login.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 401 },
    );
  }

  await updateFielderLoginPassword(login.id, newPassword);
  return NextResponse.json({ ok: true });
}
