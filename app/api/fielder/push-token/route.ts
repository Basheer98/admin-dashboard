import { NextResponse } from "next/server";
import { getMobileSession, unauthorized } from "@/lib/mobileAuth";
import { savePushToken } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getMobileSession(request);
  if (!session || session.role !== "fielder") return unauthorized();

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token || !token.startsWith("ExponentPushToken[")) {
    return NextResponse.json(
      { error: "Valid Expo push token required" },
      { status: 400 },
    );
  }

  await savePushToken(session.fielderName, token);
  return NextResponse.json({ ok: true });
}
