import { NextResponse } from "next/server";
import { applyAssignmentTemplateToProject, getAssignmentTemplateById, getProjectById, insertAuditLog } from "@/lib/db";
import { sendPushToFielder } from "@/lib/push";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.redirect(getRedirectUrl(request, "/login"));
  const actor = getAuditActor(session);

  const formData = await request.formData();
  const projectIdStr = String(formData.get("projectId") ?? "").trim();
  const templateIdStr = String(formData.get("templateId") ?? "").trim();
  const projectId = Number(projectIdStr);
  const templateId = Number(templateIdStr);
  if (!Number.isInteger(projectId) || projectId < 1) {
    return NextResponse.redirect(
      getRedirectUrl(request, "/projects", { error: "invalid-project" }),
    );
  }
  if (!Number.isInteger(templateId) || templateId < 1) {
    return NextResponse.redirect(
      getRedirectUrl(request, `/projects/${projectId}`, {
        error: "invalid-template",
      }),
    );
  }
  try {
    const { created } = await applyAssignmentTemplateToProject(
      projectId,
      templateId,
    );
    const [template, project] = await Promise.all([
      getAssignmentTemplateById(templateId),
      getProjectById(projectId),
    ]);
    if (template && project && created > 0) {
      for (const it of template.items) {
        sendPushToFielder(
          it.fielderName,
          "New job assigned",
          `${project.projectCode} – ${project.clientName}`,
          { projectId, screen: "project" },
        ).catch(() => {});
      }
    }
    await insertAuditLog({
      ...actor,
      action: "assignment_template.apply",
      entityType: "assignment_template",
      entityId: String(templateId),
      details: { projectId, created },
    });
    return NextResponse.redirect(
      getRedirectUrl(request, `/projects/${projectId}`, {
        templateApplied: "1",
        created: String(created),
      }),
    );
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(
      getRedirectUrl(request, `/projects/${projectId}`, {
        error: "apply-failed",
      }),
    );
  }
}
