import { NextResponse } from "next/server";
import { getProjectById, updateProject, insertActivity, insertAuditLog } from "@/lib/db";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { normalizeProjectCode } from "@/lib/normalize";
import { validate, projectPatchSchema } from "@/lib/validations";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }
  const actor = getAuditActor(session);

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(getRedirectUrl(request, "/projects"));
  }

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

  const parsed = validate(projectPatchSchema, {
    projectCode: projectCode || undefined,
    clientName: clientName || undefined,
    location,
    totalSqft: totalSqftStr ? Number(totalSqftStr) : undefined,
    companyRatePerSqft: rateStr ? Number(rateStr) : undefined,
    status: statusStr || "NOT_STARTED",
    ecd,
    notes,
    qfield,
    invoiceNumber,
  });
  if (!parsed.success) {
    return NextResponse.redirect(getRedirectUrl(request, `/projects/${id}`, { error: "invalid" }));
  }

  const oldProject = await getProjectById(id);
  await updateProject(id, {
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
  });

  if (oldProject) {
    const changes: string[] = [];
    const meta: Record<string, { old: unknown; new: unknown }> = {};
    if (oldProject.projectCode !== parsed.data.projectCode) {
      changes.push(`projectCode ${oldProject.projectCode} → ${parsed.data.projectCode}`);
      meta.projectCode = { old: oldProject.projectCode, new: parsed.data.projectCode };
    }
    if (oldProject.clientName !== parsed.data.clientName) {
      changes.push(`clientName ${oldProject.clientName} → ${parsed.data.clientName}`);
      meta.clientName = { old: oldProject.clientName, new: parsed.data.clientName };
    }
    if (oldProject.status !== parsed.data.status) {
      changes.push(`status ${oldProject.status} → ${parsed.data.status}`);
      meta.status = { old: oldProject.status, new: parsed.data.status };
    }
    if ((oldProject.ecd ?? null) !== (parsed.data.ecd ?? null)) {
      changes.push(`ECD ${oldProject.ecd ?? "—"} → ${parsed.data.ecd ?? "—"}`);
      meta.ecd = { old: oldProject.ecd, new: parsed.data.ecd };
    }
    if ((oldProject.qfield ?? null) !== (parsed.data.qfield ?? null)) {
      changes.push(`QField ${oldProject.qfield ?? "—"} → ${parsed.data.qfield ?? "—"}`);
      meta.qfield = { old: oldProject.qfield, new: parsed.data.qfield };
    }
    if ((oldProject.invoiceNumber ?? null) !== (parsed.data.invoiceNumber ?? null)) {
      changes.push(`Invoice ${oldProject.invoiceNumber ?? "—"} → ${parsed.data.invoiceNumber ?? "—"}`);
      meta.invoiceNumber = { old: oldProject.invoiceNumber, new: parsed.data.invoiceNumber };
    }
    if (Object.keys(meta).length > 0) {
      await insertActivity({
        type: "project_edited",
        description: `Edited project ${projectCode} (${clientName})${changes.length ? ": " + changes.join("; ") : ""}`,
        metadata: { projectId: id, changes: meta },
      });
    }
  }

  await insertAuditLog({
    ...actor,
    action: "project.update",
    entityType: "project",
    entityId: String(id),
    details: oldProject ? { projectCode: parsed.data.projectCode, clientName: parsed.data.clientName } : undefined,
  });

  return NextResponse.redirect(getRedirectUrl(request, `/projects/${id}`, { saved: "1" }));
}

