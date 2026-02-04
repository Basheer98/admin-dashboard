import { NextResponse } from "next/server";
import fs from "node:fs";
import { getDataPath } from "@/lib/dataPath";

function isValidDbShape(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  if (!Array.isArray(o.projects)) return false;
  if (!Array.isArray(o.assignments)) return false;
  if (!Array.isArray(o.payments)) return false;
  if (typeof o.nextProjectId !== "number" && o.nextProjectId !== undefined) return false;
  if (typeof o.nextAssignmentId !== "number" && o.nextAssignmentId !== undefined) return false;
  if (typeof o.nextPaymentId !== "number" && o.nextPaymentId !== undefined) return false;
  return true;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || typeof file === "string") {
    const url = new URL("/settings", request.url);
    url.searchParams.set("restore", "error");
    url.searchParams.set("message", "no-file");
    return NextResponse.redirect(url);
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    const url = new URL("/settings", request.url);
    url.searchParams.set("restore", "error");
    url.searchParams.set("message", "read");
    return NextResponse.redirect(url);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const url = new URL("/settings", request.url);
    url.searchParams.set("restore", "error");
    url.searchParams.set("message", "invalid-json");
    return NextResponse.redirect(url);
  }
  if (!isValidDbShape(parsed)) {
    const url = new URL("/settings", request.url);
    url.searchParams.set("restore", "error");
    url.searchParams.set("message", "invalid-shape");
    return NextResponse.redirect(url);
  }
  try {
    fs.writeFileSync(getDataPath(), JSON.stringify(parsed, null, 2), "utf8");
  } catch {
    const url = new URL("/settings", request.url);
    url.searchParams.set("restore", "error");
    url.searchParams.set("message", "write");
    return NextResponse.redirect(url);
  }
  const url = new URL("/settings", request.url);
  url.searchParams.set("restore", "ok");
  return NextResponse.redirect(url);
}
