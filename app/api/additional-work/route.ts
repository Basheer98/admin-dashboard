import { NextResponse } from "next/server";
import { getProjectByCode, insertAdditionalWork, insertAuditLog } from "@/lib/db";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { normalizeProjectCode } from "@/lib/normalize";
import { validate, additionalWorkPostSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.redirect(getRedirectUrl(request, "/login"));
  const actor = getAuditActor(session);

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

  const parsed = validate(additionalWorkPostSchema, {
    type: type === "CORRECTION" ? "CORRECTION" : "ADDITIONAL_FIELDING",
    projectNumber: projectNumber || undefined,
    assignedFielderAssignmentId,
    distance,
    rateForEntireJob,
    amount,
    dueDate,
    completedAt,
    status,
    notes,
  });
  if (!parsed.success) {
    return NextResponse.redirect(getRedirectUrl(request, "/additional-work", { error: "invalid" }));
  }

  const ourProject = await getProjectByCode(parsed.data.projectNumber);
  const ourProjectId = ourProject?.id ?? null;

  const row = await insertAdditionalWork({
    type: parsed.data.type,
    projectNumber: parsed.data.projectNumber,
    ourProjectId,
    assignedFielderAssignmentId: parsed.data.type === "CORRECTION" ? parsed.data.assignedFielderAssignmentId : null,
    distance: parsed.data.distance,
    rateForEntireJob: parsed.data.rateForEntireJob,
    amount: parsed.data.amount,
    dueDate: parsed.data.dueDate,
    completedAt: parsed.data.completedAt,
    status: parsed.data.status,
    notes: parsed.data.notes,
  });
  await insertAuditLog({
    ...actor,
    action: "additional_work.create",
    entityType: "additional_work",
    entityId: String(row.id),
    details: { type: row.type, projectNumber: row.projectNumber },
  });

  return NextResponse.redirect(getRedirectUrl(request, "/additional-work", { success: "1" }));
}
