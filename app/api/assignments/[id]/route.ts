import { NextResponse } from "next/server";
import { getAssignmentById, updateAssignment, insertAuditLog } from "@/lib/db";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { validate, assignmentPatchSchema } from "@/lib/validations";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.redirect(getRedirectUrl(request, "/login"));
  const actor = getAuditActor(session);

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(getRedirectUrl(request, "/assignments"));
  }

  const formData = await request.formData();

  const rateStr = String(formData.get("ratePerSqft") ?? "").trim();
  const isInternal = String(formData.get("isInternal") ?? "") === "on";
  const commissionStr = String(
    formData.get("commissionPercentage") ?? "",
  ).trim();
  const managedByStr = String(formData.get("managedByFielderId") ?? "").trim();
  const managerRateStr = String(formData.get("managerRatePerSqft") ?? "").trim();
  const managerShareStr = String(formData.get("managerCommissionShare") ?? "").trim();
  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();
  const dueDate = dueDateRaw || null;

  const hasManagerFields =
    !isInternal &&
    managedByStr !== "" &&
    managerRateStr !== "" &&
    managerShareStr !== "";

  const parsed = validate(assignmentPatchSchema, {
    ratePerSqft: isInternal ? (rateStr ? Number(rateStr) : 0) : (rateStr ? Number(rateStr) : undefined),
    isInternal,
    commissionPercentage: commissionStr === "" ? null : Number(commissionStr) / 100,
    managedByFielderId: hasManagerFields ? Number(managedByStr) : null,
    managerRatePerSqft: hasManagerFields ? Number(managerRateStr) : null,
    managerCommissionShare: hasManagerFields ? Number(managerShareStr) / 100 : null,
    dueDate,
  });
  if (!parsed.success) {
    return NextResponse.redirect(getRedirectUrl(request, `/assignments/${id}`, { error: "invalid" }));
  }

  await updateAssignment(id, {
    ratePerSqft: parsed.data.ratePerSqft,
    commissionPercentage: parsed.data.commissionPercentage,
    isInternal: parsed.data.isInternal,
    managedByFielderId: parsed.data.managedByFielderId,
    managerRatePerSqft: parsed.data.managerRatePerSqft,
    managerCommissionShare: parsed.data.managerCommissionShare,
    dueDate: parsed.data.dueDate,
  });

  await insertAuditLog({
    ...actor,
    action: "assignment.update",
    entityType: "assignment",
    entityId: String(id),
  });

  const assignment = await getAssignmentById(id);
  const projectId = assignment?.projectId ?? id;
  return NextResponse.redirect(getRedirectUrl(request, "/assignments", {
    saved: "1",
    assignmentId: String(id),
    projectId: String(projectId),
  }));
}

