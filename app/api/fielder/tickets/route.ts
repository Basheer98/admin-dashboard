import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getMobileSession, unauthorized } from "@/lib/mobileAuth";
import {
  getAssignmentsForFielderByName,
  getRecentAuditByIdempotencyKey,
  hasRecentIdempotencyKey,
  getTicketsForFielder,
  getTripsForFielder,
  insertAuditLog,
  insertTicket,
} from "@/lib/db";
import { logError, logInfo, readRequestId } from "@/lib/observability";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { ticketPostSchema, validate } from "@/lib/validations";

export async function GET(request: Request) {
  const requestId = readRequestId(request);
  const mobile = await getMobileSession(request);
  if (!mobile || mobile.role !== "fielder") return unauthorized();
  const tickets = await getTicketsForFielder(mobile.fielderName);
  logInfo({
    message: "Fielder tickets fetched",
    requestId,
    route: "/api/fielder/tickets",
    actor: mobile.fielderName,
    details: { count: tickets.length },
  });
  return NextResponse.json({
    tickets: tickets.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      priority: t.priority,
      description: t.description,
      status: t.status,
      resolutionNote: t.resolutionNote,
      projectCode: t.project?.projectCode ?? null,
      tripName: t.trip?.name ?? null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
  });
}

export async function POST(request: Request) {
  const requestId = readRequestId(request);
  const mobile = await getMobileSession(request);
  if (mobile && mobile.role === "fielder") {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = validate(ticketPostSchema, {
      title: String(body.title ?? "").trim() || undefined,
      category: String(body.category ?? "OTHER"),
      priority: String(body.priority ?? "MEDIUM"),
      description: String(body.description ?? "").trim() || undefined,
      projectId: body.projectId != null ? Number(body.projectId) : null,
      tripId: body.tripId != null ? Number(body.tripId) : null,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() || "";
    if (idempotencyKey) {
      const duplicate = await hasRecentIdempotencyKey({
        actorType: "fielder",
        actorName: mobile.fielderName,
        action: "ticket.create",
        idempotencyKey,
      });
      if (duplicate) {
        const existing = await getRecentAuditByIdempotencyKey({
          actorType: "fielder",
          actorName: mobile.fielderName,
          action: "ticket.create",
          idempotencyKey,
        });
        return NextResponse.json({
          ok: true,
          duplicate: true,
          id: existing?.entityId ? Number(existing.entityId) : undefined,
        });
      }
    }
    const assignments = await getAssignmentsForFielderByName(mobile.fielderName);
    const allowedProjectIds = new Set(assignments.map((a) => a.projectId));
    const allowedTripIds = new Set((await getTripsForFielder(mobile.fielderName)).map((t) => t.id));
    if (parsed.data.projectId && !allowedProjectIds.has(parsed.data.projectId)) {
      return NextResponse.json({ error: "Project not assigned to you" }, { status: 403 });
    }
    if (parsed.data.tripId && !allowedTripIds.has(parsed.data.tripId)) {
      return NextResponse.json({ error: "Trip not assigned to you" }, { status: 403 });
    }
    const ticket = await insertTicket({
      fielderName: mobile.fielderName,
      ...parsed.data,
    });
    await insertAuditLog({
      actorType: "fielder",
      actorName: mobile.fielderName,
      action: "ticket.create",
      entityType: "ticket",
      entityId: String(ticket.id),
      details: { title: ticket.title, category: ticket.category, priority: ticket.priority, idempotencyKey: idempotencyKey || undefined },
    });
    logInfo({
      message: "Fielder ticket created",
      requestId,
      route: "/api/fielder/tickets",
      actor: mobile.fielderName,
      details: { id: ticket.id, category: ticket.category, priority: ticket.priority },
    });
    return NextResponse.json({ ok: true, id: ticket.id });
  }

  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "fielder") {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }

  const formData = await request.formData();
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "").trim();
  const category =
    categoryRaw === "PROJECT_BLOCKER" ||
    categoryRaw === "TRAVEL" ||
    categoryRaw === "TOOLS" ||
    categoryRaw === "PAYMENT" ||
    categoryRaw === "OTHER"
      ? categoryRaw
      : "OTHER";
  const priorityRaw = String(formData.get("priority") ?? "").trim();
  const priority =
    priorityRaw === "LOW" || priorityRaw === "MEDIUM" || priorityRaw === "HIGH" || priorityRaw === "URGENT"
      ? priorityRaw
      : "MEDIUM";
  const description = String(formData.get("description") ?? "").trim();
  const projectIdStr = String(formData.get("projectId") ?? "").trim();
  const tripIdStr = String(formData.get("tripId") ?? "").trim();

  const parsed = validate(ticketPostSchema, {
    title: title || undefined,
    category,
    priority,
    description: description || undefined,
    projectId: projectIdStr ? Number(projectIdStr) : null,
    tripId: tripIdStr ? Number(tripIdStr) : null,
  });
  if (!parsed.success) {
    return NextResponse.redirect(getRedirectUrl(request, "/fielder/tickets", { error: "invalid" }));
  }
  if (idempotencyKey) {
    const duplicate = await hasRecentIdempotencyKey({
      actorType: "fielder",
      actorName: session.fielderName,
      action: "ticket.create",
      idempotencyKey,
    });
    if (duplicate) {
      return NextResponse.redirect(getRedirectUrl(request, "/fielder/tickets", { success: "1" }));
    }
  }
  const assignments = await getAssignmentsForFielderByName(session.fielderName);
  const allowedProjectIds = new Set(assignments.map((a) => a.projectId));
  const allowedTripIds = new Set((await getTripsForFielder(session.fielderName)).map((t) => t.id));
  if (parsed.data.projectId && !allowedProjectIds.has(parsed.data.projectId)) {
    return NextResponse.redirect(getRedirectUrl(request, "/fielder/tickets", { error: "invalid" }));
  }
  if (parsed.data.tripId && !allowedTripIds.has(parsed.data.tripId)) {
    return NextResponse.redirect(getRedirectUrl(request, "/fielder/tickets", { error: "invalid" }));
  }

  try {
    const ticket = await insertTicket({
      fielderName: session.fielderName,
      ...parsed.data,
    });
    await insertAuditLog({
      actorType: "fielder",
      actorName: session.fielderName,
      action: "ticket.create",
      entityType: "ticket",
      entityId: String(ticket.id),
      details: { title: ticket.title, category: ticket.category, priority: ticket.priority, idempotencyKey: idempotencyKey || undefined },
    });
    logInfo({
      message: "Fielder ticket created (web)",
      requestId,
      route: "/api/fielder/tickets",
      actor: session.fielderName,
      details: { id: ticket.id, category: ticket.category, priority: ticket.priority },
    });
  } catch (error) {
    logError({
      message: "Fielder ticket creation failed",
      requestId,
      route: "/api/fielder/tickets",
      actor: session.fielderName,
      details: { error: error instanceof Error ? error.message : "Unknown error" },
    });
    return NextResponse.redirect(getRedirectUrl(request, "/fielder/tickets", { error: "server" }));
  }
  return NextResponse.redirect(getRedirectUrl(request, "/fielder/tickets", { success: "1" }));
}
