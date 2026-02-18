import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { searchGlobal } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const result = await searchGlobal(q);
  return NextResponse.json(result);
}
