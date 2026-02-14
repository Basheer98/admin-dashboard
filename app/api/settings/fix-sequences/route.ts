import { NextResponse } from "next/server";
import { resetSequences } from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";

export async function POST(request: Request) {
  try {
    await resetSequences();
    return NextResponse.redirect(getRedirectUrl(request, "/settings", { fixed: "1" }));
  } catch (e) {
    console.error("Fix sequences failed:", e);
    return NextResponse.redirect(getRedirectUrl(request, "/settings", { fixed: "error" }));
  }
}
