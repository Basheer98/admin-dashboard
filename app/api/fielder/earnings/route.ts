import { NextResponse } from "next/server";
import { getAssignmentsForFielderByName, getAssignmentsWithDetails } from "@/lib/db";
import { getMobileSession, unauthorized } from "@/lib/mobileAuth";
import { getProjectStatusLabel } from "@/lib/projectStatus";
import { calcAssignmentPayout } from "@/lib/payouts";

export async function GET(request: Request) {
  const session = await getMobileSession(request);
  if (!session || session.role !== "fielder") return unauthorized();

  const fielderName = session.fielderName.trim().toUpperCase();
  const assignments = await getAssignmentsForFielderByName(session.fielderName);
  const activeAssignments = assignments.filter((a) => !a.archivedAt);

  // Manager commission owed (from assignments where this fielder manages other workers)
  const allAssignments = await getAssignmentsWithDetails({ includeArchived: true });
  const assignmentIdToFielderName = new Map(
    allAssignments.map((a) => [a.id, a.fielderName.trim().toUpperCase()]),
  );
  let managerCommissionOwed = 0;
  for (const a of allAssignments) {
    if (!a.managedByFielderId || !a.managerRatePerSqft || a.isInternal) continue;
    const managerName = assignmentIdToFielderName.get(a.managedByFielderId);
    if (managerName !== fielderName) continue;
    const sqft = a.project.totalSqft;
    const workerRate = Number(a.ratePerSqft);
    const managerRate = Number(a.managerRatePerSqft);
    const managerCommission = (managerRate - workerRate) * sqft;
    const managerShare = a.managerCommissionShare ? Number(a.managerCommissionShare) : 0;
    const companyShare = managerCommission * managerShare;
    managerCommissionOwed += managerCommission - companyShare;
  }

  let totalOwedFromAssignments = 0;
  let totalPaid = 0;

  const list = activeAssignments.map((a) => {
    const { totalRequired, paid, pending } = calcAssignmentPayout(a);
    totalOwedFromAssignments += totalRequired;
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

  const totalOwed = totalOwedFromAssignments + managerCommissionOwed;
  const pending = Math.max(totalOwed - totalPaid, 0);

  return NextResponse.json({
    totalOwed,
    totalPaid,
    pending,
    assignments: list,
  });
}
