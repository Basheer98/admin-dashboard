import { NextResponse } from "next/server";
import { insertAssignment, insertProject, insertAuditLog } from "@/lib/db";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { normalizeProjectCode, normalizeFielderName } from "@/lib/normalize";
import { validate, projectPostSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.redirect(getRedirectUrl(request, "/login"));
    }
    const actor = getAuditActor(session);
    const formData = await request.formData();

    const projectCode = normalizeProjectCode(String(formData.get("projectCode") ?? ""));
    const clientChoice = String(formData.get("clientChoice") ?? "").trim();
    const newClientName = String(formData.get("newClientName") ?? "").trim();
    const clientName = clientChoice || newClientName;
    const location = String(formData.get("location") ?? "").trim();
    const totalSqftStr = String(formData.get("totalSqft") ?? "").trim();
    const rateStr = String(formData.get("companyRatePerSqft") ?? "").trim();
    const statusStr = String(formData.get("status") ?? "").trim();
    const ecdRaw = String(formData.get("ecd") ?? "").trim();
    const ecd = ecdRaw || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const qfieldRaw = String(formData.get("qfield") ?? "").trim();
    const qfield = qfieldRaw === "Qfield-1" || qfieldRaw === "Qfield-2" ? qfieldRaw : null;
    const invoiceNumberRaw = String(formData.get("invoiceNumber") ?? "").trim();
    const invoiceNumber = invoiceNumberRaw || null;
    const workTypeRaw = String(formData.get("workType") ?? "").trim();
    const workType = workTypeRaw || null;

    const redirectTo = String(formData.get("redirectTo") ?? "/projects");

    const parsed = validate(projectPostSchema, {
      projectCode: projectCode || undefined,
      clientName: clientName || undefined,
      location,
      totalSqft: totalSqftStr ? Number(totalSqftStr) : undefined,
      companyRatePerSqft: rateStr ? Number(rateStr) : undefined,
      status: statusStr || "ASSIGNED",
      ecd,
      notes,
      qfield,
      invoiceNumber,
      workType,
    });
    if (!parsed.success) {
      return NextResponse.redirect(getRedirectUrl(request, "/projects", { error: "invalid" }));
    }

    const project = await insertProject({
    projectCode: parsed.data.projectCode,
    clientName: parsed.data.clientName,
    location: parsed.data.location,
    totalSqft: parsed.data.totalSqft,
    companyRatePerSqft: parsed.data.companyRatePerSqft,
    status: parsed.data.status,
    ecd: parsed.data.ecd,
    notes: parsed.data.notes,
    qfield: parsed.data.qfield,
    invoiceNumber: parsed.data.invoiceNumber,
    workType: parsed.data.workType,
  });

    await insertAuditLog({
      ...actor,
      action: "project.create",
      entityType: "project",
      entityId: String(project.id),
      details: { projectCode: project.projectCode, clientName: project.clientName },
    });

  // Optional: create multiple fielder assignments (assignedFielder_0_name, etc.)
  for (let i = 0; i < 20; i++) {
    const prefix = `assignedFielder_${i}_`;
    const name = normalizeFielderName(String(formData.get(`${prefix}name`) ?? ""));
    if (!name) continue;

    const rateStr = String(formData.get(`${prefix}rate`) ?? "").trim();
    const isInternal = String(formData.get(`${prefix}isInternal`) ?? "") === "on";
    const commissionStr = String(formData.get(`${prefix}commission`) ?? "").trim();
    const managedByStr = String(formData.get(`${prefix}managedBy`) ?? "").trim();
    const managerRateStr = String(formData.get(`${prefix}managerRate`) ?? "").trim();
    const managerShareStr = String(formData.get(`${prefix}managerShare`) ?? "").trim();

    if (!isInternal && !rateStr) continue;

    const ratePerSqft = isInternal
      ? (rateStr ? Number(rateStr) : 0)
      : Number(rateStr);
    if (Number.isNaN(ratePerSqft)) continue;

    const commissionPercentage =
      isInternal || commissionStr === ""
        ? null
        : Number(commissionStr) / 100;

    const hasManager =
      !isInternal &&
      managedByStr !== "" &&
      managerRateStr !== "" &&
      managerShareStr !== "";

    const managedByFielderId = hasManager ? Number(managedByStr) : null;
    const managerRatePerSqft = hasManager ? Number(managerRateStr) : null;
    const managerCommissionShare = hasManager
      ? Number(managerShareStr) / 100
      : null;

    await insertAssignment({
      projectId: project.id,
      fielderName: name,
      ratePerSqft,
      commissionPercentage,
      isInternal,
      managedByFielderId,
      managerRatePerSqft,
      managerCommissionShare,
    });
  }

  const path = redirectTo?.startsWith("http")
    ? new URL(redirectTo).pathname
    : (redirectTo?.startsWith("/") ? redirectTo : "/projects");
  return NextResponse.redirect(getRedirectUrl(request, path, { success: "1" }));
  } catch (e) {
    console.error("POST /api/projects failed:", e);
    return NextResponse.redirect(getRedirectUrl(request, "/projects", { error: "server" }));
  }
}

