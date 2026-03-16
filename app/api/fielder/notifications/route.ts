import { NextResponse } from "next/server";
import { getMobileSession, unauthorized } from "@/lib/mobileAuth";
import { getFielderNotifications } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getMobileSession(request);
  if (!session || session.role !== "fielder") return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      50,
      Math.max(5, parseInt(searchParams.get("limit") ?? "30", 10)),
    );
    const items = await getFielderNotifications(session.fielderName, limit);
    return NextResponse.json({ items });
  } catch (e) {
    console.error("GET /api/fielder/notifications:", e);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}
