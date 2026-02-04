import { NextResponse } from "next/server";
import fs from "node:fs";
import { getDataPath } from "@/lib/dataPath";

const LAST_BACKUP_COOKIE = "last_backup_at";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function GET() {
  const dataPath = getDataPath();
  if (!fs.existsSync(dataPath)) {
    return new NextResponse("No data to backup", { status: 404 });
  }
  const raw = fs.readFileSync(dataPath, "utf8");
  const now = new Date();
  const filename = `backup-${now.toISOString().slice(0, 10)}.json`;
  const cookieValue = encodeURIComponent(now.toISOString());
  return new NextResponse(raw, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Set-Cookie": `${LAST_BACKUP_COOKIE}=${cookieValue}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`,
    },
  });
}
