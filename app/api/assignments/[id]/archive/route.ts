import { NextResponse } from "next/server";
import { archiveAssignment, getAssignmentById, insertAuditLog } from "@/lib/db";
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
    return NextResponse.redirect(getRedirectUrl(request, "/assignments"));
  }
  const assignment = await getAssignmentById(id);
  const projectId = assignment?.projectId;
  await archiveAssignment(id);
  await insertAuditLog({ ...actor, action: "assignment.archive", entityType: "assignment", entityId: String(id) });
  const paramsObj: Record<string, string> = { archived: "1" };
  if (projectId) paramsObj.projectId = String(projectId);
  return NextResponse.redirect(getRedirectUrl(request, "/assignments", paramsObj));
}
