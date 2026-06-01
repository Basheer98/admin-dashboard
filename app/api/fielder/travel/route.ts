import { NextResponse } from "next/server";
import { getTripsForFielder } from "@/lib/db";
import { getMobileSession, unauthorized } from "@/lib/mobileAuth";
import { logInfo, readRequestId } from "@/lib/observability";

export async function GET(request: Request) {
  const requestId = readRequestId(request);
  const session = await getMobileSession(request);
  if (!session || session.role !== "fielder") return unauthorized();

  const trips = await getTripsForFielder(session.fielderName);
  logInfo({
    message: "Fielder travel fetched",
    requestId,
    route: "/api/fielder/travel",
    actor: session.fielderName,
    details: { count: trips.length },
  });
  return NextResponse.json({
    trips: trips.map((t) => ({
      id: t.id,
      name: t.name,
      state: t.state,
      city: t.city,
      teamMembers: t.teamMembers,
      startDate: t.startDate,
      endDate: t.endDate,
      status: t.status,
      projectCode: t.project?.projectCode ?? null,
      totalExpense: Number(t.totalExpense),
    })),
  });
}
