import { NextResponse } from "next/server";
import { getAuditActor, getSessionFromRequest } from "@/lib/auth";
import { insertAuditLog, insertTrip } from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { tripPostSchema, validate } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }
  const actor = getAuditActor(session);
  const formData = await request.formData();

  const name = String(formData.get("name") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim() || null;
  const teamMembers = String(formData.get("teamMembers") ?? "").trim() || null;
  const budgetCarRaw = String(formData.get("budgetCar") ?? "").trim();
  const budgetAccommodationRaw = String(formData.get("budgetAccommodation") ?? "").trim();
  const budgetGasRaw = String(formData.get("budgetGas") ?? "").trim();
  const budgetToolsRaw = String(formData.get("budgetTools") ?? "").trim();
  const projectIdRaw = String(formData.get("projectId") ?? "").trim();
  const projectId = projectIdRaw ? Number(projectIdRaw) : null;
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim() || null;
  const statusRaw = String(formData.get("status") ?? "PLANNED").trim();
  const status = statusRaw === "ACTIVE" || statusRaw === "CLOSED" ? statusRaw : "PLANNED";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const parsed = validate(tripPostSchema, {
    name: name || undefined,
    state: state || undefined,
    city,
    teamMembers,
    budgetCar: budgetCarRaw ? Number(budgetCarRaw) : null,
    budgetAccommodation: budgetAccommodationRaw ? Number(budgetAccommodationRaw) : null,
    budgetGas: budgetGasRaw ? Number(budgetGasRaw) : null,
    budgetTools: budgetToolsRaw ? Number(budgetToolsRaw) : null,
    projectId,
    startDate: startDate || undefined,
    endDate,
    status,
    notes,
  });
  if (!parsed.success) {
    return NextResponse.redirect(getRedirectUrl(request, "/trips", { error: "invalid" }));
  }

  const trip = await insertTrip(parsed.data);
  await insertAuditLog({
    ...actor,
    action: "trip.create",
    entityType: "trip",
    entityId: String(trip.id),
    details: {
      name: trip.name,
      state: trip.state,
      teamMembers: trip.teamMembers,
      budgetCar: trip.budgetCar,
      budgetAccommodation: trip.budgetAccommodation,
      budgetGas: trip.budgetGas,
      budgetTools: trip.budgetTools,
      status: trip.status,
    },
  });

  return NextResponse.redirect(getRedirectUrl(request, `/trips/${trip.id}`, { success: "1" }));
}
