import { NextResponse } from "next/server";
import { getAssignmentsForFielderByName } from "@/lib/db";
import { getMobileSession, unauthorized } from "@/lib/mobileAuth";
import { getProjectStatusLabel } from "@/lib/projectStatus";
import { calcAssignmentPayout } from "@/lib/payouts";

export async function GET(request: Request) {
  const session = await getMobileSession(request);
  if (!session || session.role !== "fielder") return unauthorized();

  const assignments = await getAssignmentsForFielderByName(session.fielderName);

  const projects = assignments
    .filter((a) => !a.archivedAt)
    .map((a) => {
      const { totalRequired, paid, pending } = calcAssignmentPayout(a);
      return {
        assignmentId: a.id,
        projectId: a.project.id,
        projectCode: a.project.projectCode,
        clientName: a.project.clientName,
        location: a.project.location ?? "",
        workType: a.project.workType ?? null,
        status: a.project.status,
        statusLabel: getProjectStatusLabel(a.project.status),
        ecd: a.project.ecd ?? null,
        totalSqft: a.project.totalSqft,
        ratePerSqft: Number(a.ratePerSqft),
        totalRequired,
        paid,
        pending,
        dueDate: a.dueDate ?? null,
        isInternal: a.isInternal,
      };
    });

  const counts = projects.reduce(
    (acc, p) => {
      if (p.status === "ASSIGNED" || p.status === "NOT_STARTED") acc.ASSIGNED++;
      else if (p.status === "IN_PROGRESS") acc.IN_PROGRESS++;
      else if (p.status === "SUBMITTED") acc.SUBMITTED++;
      else if (p.status === "COMPLETED") acc.COMPLETED++;
      return acc;
    },
    { ASSIGNED: 0, IN_PROGRESS: 0, SUBMITTED: 0, COMPLETED: 0 },
  );

  return NextResponse.json({ projects, counts });
}
