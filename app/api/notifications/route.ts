import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getRecentNotifications } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get("limit") ?? "25", 10)));
    const items = await getRecentNotifications(limit);
    return NextResponse.json({ items });
  } catch (e) {
    console.error("GET /api/notifications:", e);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}
