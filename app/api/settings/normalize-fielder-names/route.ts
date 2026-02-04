import { NextResponse } from "next/server";
import { normalizeAllFielderNames, insertActivity } from "@/lib/db";

export async function POST(request: Request) {
  const count = await normalizeAllFielderNames();
  if (count > 0) {
    await insertActivity({
      type: "settings_changed",
      description: `Normalized ${count} fielder name(s) to uppercase.`,
      metadata: { action: "normalize_fielder_names", count },
    });
  }
  const url = new URL("/settings", request.url);
  url.searchParams.set("normalized", "1");
  url.searchParams.set("count", String(count));
  return NextResponse.redirect(url);
}
