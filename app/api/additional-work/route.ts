import { NextResponse } from "next/server";
import { getProjectByCode, insertAdditionalWork } from "@/lib/db";
import { normalizeProjectCode } from "@/lib/normalize";
import { validate, additionalWorkPostSchema } from "@/lib/validations";

export async function POST(request: Request) {
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
    const url = new URL("/additional-work", request.url);
    url.searchParams.set("error", "invalid");
    return NextResponse.redirect(url);
  }

  const ourProject = getProjectByCode(parsed.data.projectNumber);
  const ourProjectId = ourProject?.id ?? null;

  insertAdditionalWork({
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

  const url = new URL("/additional-work", request.url);
  url.searchParams.set("success", "1");
  return NextResponse.redirect(url);
}
