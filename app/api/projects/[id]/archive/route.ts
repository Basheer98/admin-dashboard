import { NextResponse } from "next/server";
import { archiveProject, insertAuditLog } from "@/lib/db";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.redirect(getRedirectUrl(request, "/login"));
  const actor = getAuditActor(session);

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(getRedirectUrl(request, "/projects"));
  }
  await archiveProject(id);
  await insertAuditLog({ ...actor, action: "project.archive", entityType: "project", entityId: String(id) });
  return NextResponse.redirect(getRedirectUrl(request, "/projects", { archived: "1" }));
}
