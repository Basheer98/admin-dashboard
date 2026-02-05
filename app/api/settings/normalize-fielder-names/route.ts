import { NextResponse } from "next/server";
import { normalizeAllFielderNames, insertActivity } from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";

export async function POST(request: Request) {
  const count = await normalizeAllFielderNames();
  if (count > 0) {
    await insertActivity({
      type: "settings_changed",
      description: `Normalized ${count} fielder name(s) to uppercase.`,
      metadata: { action: "normalize_fielder_names", count },
    });
  }
  return NextResponse.redirect(getRedirectUrl(request, "/settings", { normalized: "1", count: String(count) }));
}
