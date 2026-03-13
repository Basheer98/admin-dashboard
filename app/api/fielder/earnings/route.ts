import { NextResponse } from "next/server";
import { getAssignmentsForFielderByName } from "@/lib/db";
import { getMobileSession, unauthorized } from "@/lib/mobileAuth";
import { getProjectStatusLabel } from "@/lib/projectStatus";
import { calcAssignmentPayout } from "@/lib/payouts";

export async function GET(request: Request) {
  const session = await getMobileSession(request);
  if (!session || session.role !== "fielder") return unauthorized();

  const assignments = await getAssignmentsForFielderByName(session.fielderName);

  let totalOwed = 0;
  let totalPaid = 0;

  const list = assignments
    .filter((a) => !a.archivedAt)
    .map((a) => {
      const { totalRequired, paid, pending } = calcAssignmentPayout(a);
      totalOwed += totalRequired;
      totalPaid += paid;
      return {
        assignmentId: a.id,
        projectId: a.project.id,
        projectCode: a.project.projectCode,
        clientName: a.project.clientName,
        status: a.project.status,
        statusLabel: getProjectStatusLabel(a.project.status),
        totalSqft: a.project.totalSqft,
        ratePerSqft: Number(a.ratePerSqft),
        totalRequired,
        paid,
        pending,
        isInternal: a.isInternal,
      };
    });

  return NextResponse.json({
    totalOwed,
    totalPaid,
    pending: Math.max(totalOwed - totalPaid, 0),
    assignments: list,
  });
}
