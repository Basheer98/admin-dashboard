import { NextResponse } from "next/server";
import { getMobileSession, unauthorized } from "@/lib/mobileAuth";
import { getFielderLoginByFielderName, getSettings } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getMobileSession(request);
  if (!session || session.role !== "fielder") return unauthorized();

  const [login, settings] = await Promise.all([
    getFielderLoginByFielderName(session.fielderName),
    getSettings(),
  ]);
  if (!login) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    email: login.email,
    fielderName: login.fielderName,
    adminPhone: settings.adminPhone ?? null,
  });
}
