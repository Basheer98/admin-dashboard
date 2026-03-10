import { NextResponse } from "next/server";
import { resetSequences } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }
  try {
    await resetSequences();
    return NextResponse.redirect(getRedirectUrl(request, "/settings", { fixed: "1" }));
  } catch (e) {
    console.error("Fix sequences failed:", e);
    return NextResponse.redirect(getRedirectUrl(request, "/settings", { fixed: "error" }));
  }
}
