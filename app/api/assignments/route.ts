import { NextResponse } from "next/server";
import { insertAssignment } from "@/lib/db";
import { normalizeFielderName } from "@/lib/normalize";
import { validate, assignmentPostSchema } from "@/lib/validations";

export async function POST(request: Request) {
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
    const url = new URL("/assignments", request.url);
    url.searchParams.set("error", "invalid");
    return NextResponse.redirect(url);
  }

  const { projectId, ratePerSqft, commissionPercentage, managedByFielderId, managerRatePerSqft, managerCommissionShare } = parsed.data;

  const newId = insertAssignment({
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

  const url = new URL(redirectTo || "/assignments", request.url);
  url.searchParams.set("success", "1");
  url.searchParams.set("assignmentId", String(newId));
  url.searchParams.set("projectId", String(projectId));
  return NextResponse.redirect(url);
}

