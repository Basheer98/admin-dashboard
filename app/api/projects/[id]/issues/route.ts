import { NextResponse } from "next/server";
import { getProjectById, updateProject, getAssignmentsByProjectId, insertProjectIssue, insertAuditLog } from "@/lib/db";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(getRedirectUrl(request, "/fielder/assignments", { error: "invalid" }));
  }

  const formData = await request.formData();
  const description = String(formData.get("description") ?? "").trim();
  if (!description) {
    return NextResponse.redirect(getRedirectUrl(request, "/fielder/assignments", { error: "invalid" }));
  }

  const project = await getProjectById(id);
  if (!project) {
    return NextResponse.redirect(getRedirectUrl(request, "/fielder/assignments", { error: "not_found" }));
  }

  // If fielder, verify they have an assignment on this project
  if (session.role === "fielder") {
    const fielderName = (session.fielderName ?? "").trim().toUpperCase();
    const assignments = await getAssignmentsByProjectId(id);
    const isAssigned = assignments.some(
      (a) => a.fielderName.trim().toUpperCase() === fielderName && !a.archivedAt,
    );
    if (!isAssigned) {
      return NextResponse.redirect(getRedirectUrl(request, "/fielder/assignments", { error: "unauthorized" }));
    }
  }

  const reportedBy = session.role === "fielder"
    ? (session.fielderName ?? "Unknown")
    : "Admin";

  await insertProjectIssue({ projectId: id, reportedBy, description });

  // Auto-set project to IN_PROGRESS when an issue is logged
  if (project.status !== "IN_PROGRESS" && project.status !== "COMPLETED") {
    await updateProject(id, { ...project, status: "IN_PROGRESS" });
  }

  const actor = getAuditActor(session);
  await insertAuditLog({
    ...actor,
    action: "project.update",
    entityType: "project",
    entityId: String(id),
    details: { issue: description },
  });

  const redirectPath = session.role === "fielder" ? "/fielder/assignments" : `/projects/${id}`;
  return NextResponse.redirect(getRedirectUrl(request, redirectPath, { issue: "logged" }));
}
