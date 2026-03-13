import { NextResponse } from "next/server";
import { getProjectById, getAssignmentsByProjectId, getProjectIssuesByProjectId } from "@/lib/db";
import { getMobileSession, unauthorized } from "@/lib/mobileAuth";
import { getProjectStatusLabel } from "@/lib/projectStatus";
import { calcAssignmentPayout } from "@/lib/payouts";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const session = await getMobileSession(request);
  if (!session || session.role !== "fielder") return unauthorized();

  const { id: idStr } = await params;
  const id = Number(idStr);

  const [project, assignments, issues] = await Promise.all([
    getProjectById(id),
    getAssignmentsByProjectId(id),
    getProjectIssuesByProjectId(id),
  ]);

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fielderName = session.fielderName.trim().toUpperCase();
  const myAssignment = assignments.find(
    (a) => a.fielderName.trim().toUpperCase() === fielderName && !a.archivedAt,
  );
  if (!myAssignment) {
    return NextResponse.json({ error: "Not assigned" }, { status: 403 });
  }

  const { totalRequired } = calcAssignmentPayout({ ...myAssignment, project, payments: [] });

  return NextResponse.json({
    assignmentId: myAssignment.id,
    projectId: project.id,
    projectCode: project.projectCode,
    clientName: project.clientName,
    location: project.location ?? "",
    workType: project.workType ?? null,
    status: project.status,
    statusLabel: getProjectStatusLabel(project.status),
    ecd: project.ecd ?? null,
    notes: project.notes ?? null,
    invoiceNumber: project.invoiceNumber ?? null,
    totalSqft: project.totalSqft,
    ratePerSqft: Number(myAssignment.ratePerSqft),
    totalRequired,
    dueDate: myAssignment.dueDate ?? null,
    isInternal: myAssignment.isInternal,
    issues: issues.map((i) => ({
      id: i.id,
      description: i.description,
      reportedBy: i.reportedBy,
      createdAt: i.createdAt,
    })),
  });
}
