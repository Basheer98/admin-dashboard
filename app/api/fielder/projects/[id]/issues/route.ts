import { NextResponse } from "next/server";
import { getProjectById, getAssignmentsByProjectId, insertProjectIssue, updateProject, insertAuditLog } from "@/lib/db";
import { getMobileSession, unauthorized } from "@/lib/mobileAuth";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await getMobileSession(request);
  if (!session || session.role !== "fielder") return unauthorized();

  const { id: idStr } = await params;
  const id = Number(idStr);

  const body = await request.json();
  const description = String(body.description ?? "").trim();
  if (!description) return NextResponse.json({ error: "Description required" }, { status: 400 });

  const [project, assignments] = await Promise.all([
    getProjectById(id),
    getAssignmentsByProjectId(id),
  ]);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fielderName = session.fielderName.trim().toUpperCase();
  const isAssigned = assignments.some(
    (a) => a.fielderName.trim().toUpperCase() === fielderName && !a.archivedAt,
  );
  if (!isAssigned) return NextResponse.json({ error: "Not assigned" }, { status: 403 });

  await insertProjectIssue({ projectId: id, reportedBy: session.fielderName, description });

  if (project.status !== "IN_PROGRESS" && project.status !== "COMPLETED") {
    await updateProject(id, { ...project, status: "IN_PROGRESS" });
  }

  await insertAuditLog({
    actorType: "fielder",
    actorName: session.fielderName,
    action: "project.update",
    entityType: "project",
    entityId: String(id),
    details: { issue: description, source: "mobile" },
  });

  return NextResponse.json({ ok: true });
}
