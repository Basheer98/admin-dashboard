import { NextResponse } from "next/server";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { queryOne, query } from "@/lib/pg";
import { insertActivity, insertAuditLog } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(getRedirectUrl(request, "/projects", { error: "invalid-issue" }));
  }

  const formData = await request.formData();
  const projectIdRaw = String(formData.get("projectId") ?? "").trim();
  const projectId = Number(projectIdRaw) || null;

  const row = await queryOne<{ project_id: number }>(
    "SELECT project_id FROM project_issues WHERE id = $1",
    [id],
  );
  if (!row) {
    return NextResponse.redirect(getRedirectUrl(request, "/projects", { error: "issue-not-found" }));
  }

  const effectiveProjectId = projectId ?? row.project_id;
  const actor = getAuditActor(session);

  await query(
    "UPDATE project_issues SET resolved_at = NOW(), resolved_by = $2 WHERE id = $1",
    [id, actor.actorName],
  );

  await insertActivity({
    type: "project_issue_resolved",
    description: `Resolved issue #${id} on project ${effectiveProjectId}`,
    metadata: { issueId: id, projectId: effectiveProjectId, resolvedBy: session.name ?? "Admin" },
  });
  await insertAuditLog({
    ...actor,
    action: "project.issue.resolve",
    entityType: "project_issue",
    entityId: String(id),
    details: { projectId: effectiveProjectId },
  });

  return NextResponse.redirect(
    getRedirectUrl(request, `/projects/${effectiveProjectId}`, { issue: "resolved" }),
  );
}

