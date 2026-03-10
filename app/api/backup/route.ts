import { NextResponse } from "next/server";
import {
  getSettings,
  getAllProjects,
  getAllAssignments,
  getAllPayments,
  getAllAdditionalWork,
  getAllActivity,
  getAllFielderLogins,
} from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";

const LAST_BACKUP_COOKIE = "last_backup_at";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }
  const [settings, projects, assignments, payments, additionalWork, activityLog, fielderLogins] =
    await Promise.all([
      getSettings(),
      getAllProjects({ includeArchived: true }),
      getAllAssignments({ includeArchived: true }),
      getAllPayments({ includeVoided: true }),
      getAllAdditionalWork(),
      getAllActivity(),
      getAllFielderLogins(),
    ]);

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    projects,
    assignments,
    payments,
    additionalWork,
    activityLog,
    fielderLogins: fielderLogins.map((r) => ({
      id: r.id,
      email: r.email,
      passwordHash: r.passwordHash,
      fielderName: r.fielderName,
    })),
  };

  const raw = JSON.stringify(backup, null, 2);
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
