import { NextResponse } from "next/server";
import { applyAssignmentTemplateToProject } from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";

export async function POST(request: Request) {
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
