import { NextResponse } from "next/server";
import { getProjectByCode, getAdditionalWorkById, updateAdditionalWork, insertAuditLog } from "@/lib/db";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { normalizeProjectCode } from "@/lib/normalize";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.redirect(getRedirectUrl(request, "/login"));
  const actor = getAuditActor(session);

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(getRedirectUrl(request, "/additional-work"));
  }

  const existing = await getAdditionalWorkById(id);
  if (!existing) {
    return NextResponse.redirect(getRedirectUrl(request, "/additional-work"));
  }

  const formData = await request.formData();

  const type = String(formData.get("type") ?? "").trim() as "ADDITIONAL_FIELDING" | "CORRECTION";
  const projectNumberRaw = String(formData.get("projectNumber") ?? "").trim();
  const projectNumber = normalizeProjectCode(projectNumberRaw) || projectNumberRaw || "";
  const assignedFielderAssignmentIdStr = String(formData.get("assignedFielderAssignmentId") ?? "").trim();
  const assignedFielderAssignmentId = assignedFielderAssignmentIdStr
    ? Number(assignedFielderAssignmentIdStr)
    : null;
  const distanceStr = String(formData.get("distance") ?? "").trim();
  const distance = distanceStr ? Number(distanceStr) : null;
  const rateStr = String(formData.get("rateForEntireJob") ?? "").trim();
  const rateForEntireJob = rateStr ? Number(rateStr) : null;
  const amountStr = String(formData.get("amount") ?? "").trim();
  const amount = amountStr ? Number(amountStr) : null;
  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();
  const dueDate = dueDateRaw || null;
  const completedAtRaw = String(formData.get("completedAt") ?? "").trim();
  const completedAt = completedAtRaw || null;
  const status = String(formData.get("status") ?? "NOT_STARTED").trim() || "NOT_STARTED";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!projectNumber) {
    return NextResponse.redirect(getRedirectUrl(request, `/additional-work/${id}`, { error: "missing" }));
  }

  const ourProject = await getProjectByCode(projectNumber);
  const ourProjectId = ourProject?.id ?? null;

  try {
    await updateAdditionalWork(id, {
      type: type === "CORRECTION" ? "CORRECTION" : "ADDITIONAL_FIELDING",
      projectNumber,
      ourProjectId,
      assignedFielderAssignmentId: type === "CORRECTION" ? assignedFielderAssignmentId : null,
      distance,
      rateForEntireJob,
      amount,
      dueDate,
      completedAt,
      status,
      notes,
    });
    await insertAuditLog({
      ...actor,
      action: "additional_work.update",
      entityType: "additional_work",
      entityId: String(id),
      details: { projectNumber, status },
    });

    return NextResponse.redirect(getRedirectUrl(request, `/additional-work/${id}`, { saved: "1" }));
  } catch (e) {
    console.error("Additional work update failed:", e);
    return NextResponse.redirect(getRedirectUrl(request, `/additional-work/${id}`, { error: "server" }));
  }
}
