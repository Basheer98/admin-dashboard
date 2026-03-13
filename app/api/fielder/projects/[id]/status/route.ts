import { NextResponse } from "next/server";
import { getProjectById, getAssignmentsByProjectId, updateProject, insertAuditLog } from "@/lib/db";
import { getMobileSession, unauthorized } from "@/lib/mobileAuth";
import { PROJECT_STATUS_VALUES } from "@/lib/projectStatus";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await getMobileSession(request);
  if (!session || session.role !== "fielder") return unauthorized();

  const { id: idStr } = await params;
  const id = Number(idStr);

  const body = await request.json();
  const newStatus = String(body.status ?? "").trim();

  if (!PROJECT_STATUS_VALUES.includes(newStatus as never)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

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

  await updateProject(id, { ...project, status: newStatus });
  await insertAuditLog({
    actorType: "fielder",
    actorName: session.fielderName,
    action: "project.update",
    entityType: "project",
    entityId: String(id),
    details: { status: { old: project.status, new: newStatus }, source: "mobile" },
  });

  return NextResponse.json({ ok: true, status: newStatus });
}
