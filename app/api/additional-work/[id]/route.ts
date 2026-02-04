import { NextResponse } from "next/server";
import { getProjectByCode, getAdditionalWorkById, updateAdditionalWork } from "@/lib/db";
import { normalizeProjectCode } from "@/lib/normalize";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(new URL("/additional-work", request.url));
  }

  const existing = getAdditionalWorkById(id);
  if (!existing) {
    return NextResponse.redirect(new URL("/additional-work", request.url));
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
    const url = new URL(`/additional-work/${id}`, request.url);
    url.searchParams.set("error", "missing");
    return NextResponse.redirect(url);
  }

  const ourProject = getProjectByCode(projectNumber);
  const ourProjectId = ourProject?.id ?? null;

  updateAdditionalWork(id, {
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

  const url = new URL(`/additional-work/${id}`, request.url);
  url.searchParams.set("saved", "1");
  return NextResponse.redirect(url);
}
