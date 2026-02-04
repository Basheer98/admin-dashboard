import { NextResponse } from "next/server";
import { getAssignmentById, updateAssignment } from "@/lib/db";
import { validate, assignmentPatchSchema } from "@/lib/validations";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(new URL("/assignments", request.url));
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
    const url = new URL(`/assignments/${id}`, request.url);
    url.searchParams.set("error", "invalid");
    return NextResponse.redirect(url);
  }

  updateAssignment(id, {
    ratePerSqft: parsed.data.ratePerSqft,
    commissionPercentage: parsed.data.commissionPercentage,
    isInternal: parsed.data.isInternal,
    managedByFielderId: parsed.data.managedByFielderId,
    managerRatePerSqft: parsed.data.managerRatePerSqft,
    managerCommissionShare: parsed.data.managerCommissionShare,
    dueDate: parsed.data.dueDate,
  });

  const assignment = getAssignmentById(id);
  const projectId = assignment?.projectId ?? id;
  const url = new URL("/assignments", request.url);
  url.searchParams.set("saved", "1");
  url.searchParams.set("assignmentId", String(id));
  url.searchParams.set("projectId", String(projectId));
  return NextResponse.redirect(url);
}

