import { NextResponse } from "next/server";
import { insertAssignment, insertAuditLog } from "@/lib/db";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { normalizeFielderName } from "@/lib/normalize";
import { validate, assignmentPostSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.redirect(getRedirectUrl(request, "/login"));
  const actor = getAuditActor(session);

  const formData = await request.formData();

  const projectIdStr = String(formData.get("projectId") ?? "").trim();
  const fielderName = normalizeFielderName(String(formData.get("fielderName") ?? ""));
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

  const redirectTo = String(formData.get("redirectTo") ?? "/assignments");

  const parsed = validate(assignmentPostSchema, {
    projectId: projectIdStr ? Number(projectIdStr) : undefined,
    fielderName: fielderName || undefined,
    ratePerSqft: isInternal ? (rateStr ? Number(rateStr) : 0) : (rateStr ? Number(rateStr) : undefined),
    isInternal,
    commissionPercentage: commissionStr === "" ? null : Number(commissionStr) / 100,
    managedByFielderId: managedByStr ? Number(managedByStr) : null,
    managerRatePerSqft: managerRateStr ? Number(managerRateStr) : null,
    managerCommissionShare: managerShareStr ? Number(managerShareStr) / 100 : null,
    dueDate,
  });
  if (!parsed.success) {
    return NextResponse.redirect(getRedirectUrl(request, "/assignments", { error: "invalid" }));
  }

  try {
    const { projectId, ratePerSqft, commissionPercentage, managedByFielderId, managerRatePerSqft, managerCommissionShare } = parsed.data;

    const newId = await insertAssignment({
      projectId,
      fielderName: parsed.data.fielderName,
      ratePerSqft,
      commissionPercentage,
      isInternal: parsed.data.isInternal,
      managedByFielderId,
      managerRatePerSqft,
      managerCommissionShare,
      dueDate: parsed.data.dueDate,
    });

    await insertAuditLog({
      ...actor,
      action: "assignment.create",
      entityType: "assignment",
      entityId: String(newId),
      details: { projectId, fielderName: parsed.data.fielderName },
    });

    const path = redirectTo.startsWith("http") ? new URL(redirectTo).pathname : (redirectTo.startsWith("/") ? redirectTo : "/assignments");
    return NextResponse.redirect(getRedirectUrl(request, path, {
      success: "1",
      assignmentId: String(newId),
      projectId: String(projectId),
    }));
  } catch (e) {
    console.error("Assignment create failed:", e);
    return NextResponse.redirect(getRedirectUrl(request, "/assignments", { error: "server" }));
  }
}

