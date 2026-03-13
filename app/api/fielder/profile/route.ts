import { NextResponse } from "next/server";
import { getMobileSession, unauthorized } from "@/lib/mobileAuth";
import { getFielderLoginByFielderName } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getMobileSession(request);
  if (!session || session.role !== "fielder") return unauthorized();

  const login = await getFielderLoginByFielderName(session.fielderName);
  if (!login) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    email: login.email,
    fielderName: login.fielderName,
  });
}
