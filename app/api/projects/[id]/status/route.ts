import { NextResponse } from "next/server";
import { getProjectById, updateProject, getAssignmentsByProjectId, insertAuditLog } from "@/lib/db";
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
  const newStatus = String(formData.get("status") ?? "").trim();
  if (!newStatus) {
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

  const actor = getAuditActor(session);
  await updateProject(id, { ...project, status: newStatus });
  await insertAuditLog({
    ...actor,
    action: "project.update",
    entityType: "project",
    entityId: String(id),
    details: { status: { old: project.status, new: newStatus } },
  });

  const redirectPath = session.role === "fielder" ? "/fielder/assignments" : `/projects/${id}`;
  return NextResponse.redirect(getRedirectUrl(request, redirectPath, { saved: "1" }));
}
