import { NextResponse } from "next/server";
import { getAuditActor, getSessionFromRequest } from "@/lib/auth";
import { getTicketById, insertAuditLog, updateTicket } from "@/lib/db";
import { logError, logInfo, readRequestId } from "@/lib/observability";
import { sendPushToFielder } from "@/lib/push";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { ticketPatchSchema, validate } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = readRequestId(request);
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }
  const actor = getAuditActor(session);
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.redirect(getRedirectUrl(request, "/tickets"));

  const ticket = await getTicketById(id);
  if (!ticket) return NextResponse.redirect(getRedirectUrl(request, "/tickets"));

  const formData = await request.formData();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const status =
    statusRaw === "OPEN" || statusRaw === "IN_PROGRESS" || statusRaw === "RESOLVED" || statusRaw === "CLOSED"
      ? statusRaw
      : "OPEN";
  const resolutionNote = String(formData.get("resolutionNote") ?? "").trim() || null;

  const parsed = validate(ticketPatchSchema, { status, resolutionNote });
  if (!parsed.success) {
    return NextResponse.redirect(getRedirectUrl(request, "/tickets", { error: "invalid" }));
  }

  try {
    await updateTicket(id, parsed.data);
    if (ticket.status !== parsed.data.status) {
      sendPushToFielder(
        ticket.fielderName,
        "Ticket status updated",
        `#${ticket.id} ${ticket.title}: ${parsed.data.status.replaceAll("_", " ")}`,
        { ticketId: ticket.id, screen: "tickets" },
      ).catch(() => {});
    }
    await insertAuditLog({
      ...actor,
      action: "ticket.update",
      entityType: "ticket",
      entityId: String(id),
      details: { status: { old: ticket.status, new: parsed.data.status } },
    });
    logInfo({
      message: "Ticket updated by admin",
      requestId,
      route: "/api/tickets/[id]",
      actor: actor.actorName,
      details: { id, status: parsed.data.status },
    });
  } catch (error) {
    logError({
      message: "Ticket update failed",
      requestId,
      route: "/api/tickets/[id]",
      actor: actor.actorName,
      details: { id, error: error instanceof Error ? error.message : "Unknown error" },
    });
    return NextResponse.redirect(getRedirectUrl(request, "/tickets", { error: "invalid" }));
  }

  return NextResponse.redirect(getRedirectUrl(request, "/tickets", { saved: "1" }));
}
