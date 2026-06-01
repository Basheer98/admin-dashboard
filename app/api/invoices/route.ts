import { NextResponse } from "next/server";
import {
  createInvoiceWithLines,
  getAssignmentsByProjectId,
  getProjectByCode,
  insertAssignment,
  insertAuditLog,
  insertProject,
  updateProject,
} from "@/lib/db";
import { getAuditActor, getSessionFromRequest } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { normalizeFielderName, normalizeProjectCode } from "@/lib/normalize";
import { invoicePostSchema, validate } from "@/lib/validations";
import { z } from "zod";

const manualCreateSchema = invoicePostSchema.extend({
  lines: z.array(
    invoicePostSchema.shape.lines.element.extend({
      fielders: z.array(z.string()).optional(),
      fielderRate: z.number().nonnegative().optional(),
      syncToDashboard: z.boolean().optional(),
    }),
  ),
});

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.redirect(getRedirectUrl(request, "/login"));
  const actor = getAuditActor(session);

  const body = await request.json();
  const parsed = validate(manualCreateSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  try {
    const linesForInvoice = parsed.data.lines.map((l) => ({
      projectCode: normalizeProjectCode(l.projectCode),
      clientName: l.clientName ?? null,
      totalSqft: l.totalSqft,
      ratePerSqft: l.ratePerSqft,
      projectId: null as number | null,
    }));

    for (let i = 0; i < parsed.data.lines.length; i++) {
      const line = parsed.data.lines[i]!;
      const code = normalizeProjectCode(line.projectCode);
      if (!line.syncToDashboard) continue;

      let project = await getProjectByCode(code);
      if (!project) {
        project = await insertProject({
          projectCode: code,
          clientName: line.clientName ?? parsed.data.clientName,
          location: "",
          totalSqft: line.totalSqft,
          companyRatePerSqft: line.ratePerSqft,
          status: "ASSIGNED",
          notes: null,
          invoiceNumber: parsed.data.syncProjectInvoiceNumber ? parsed.data.invoiceNumber : null,
        });
      } else {
        await updateProject(project.id, {
          ...project,
          totalSqft: line.totalSqft,
          companyRatePerSqft: line.ratePerSqft,
          clientName: line.clientName ?? project.clientName,
          invoiceNumber: parsed.data.syncProjectInvoiceNumber
            ? parsed.data.invoiceNumber
            : project.invoiceNumber,
        });
        project = (await getProjectByCode(code))!;
      }

      linesForInvoice[i]!.projectId = project.id;

      const existing = await getAssignmentsByProjectId(project.id);
      const names = new Set(existing.map((a) => a.fielderName.trim().toUpperCase()));
      const fielderRate = line.fielderRate ?? 0;
      for (const raw of line.fielders ?? []) {
        const name = normalizeFielderName(raw);
        if (!name || names.has(name)) continue;
        await insertAssignment({
          projectId: project.id,
          fielderName: name,
          ratePerSqft: fielderRate > 0 ? fielderRate : 0,
          commissionPercentage: null,
          isInternal: fielderRate <= 0,
        });
        names.add(name);
      }
    }

    const { invoice } = await createInvoiceWithLines({
      invoiceNumber: parsed.data.invoiceNumber,
      clientName: parsed.data.clientName,
      issueDate: parsed.data.issueDate,
      dueDate: parsed.data.dueDate,
      notes: parsed.data.notes,
      status: "final",
      source: "manual",
      lines: linesForInvoice,
    });

    if (parsed.data.syncProjectInvoiceNumber) {
      for (const line of linesForInvoice) {
        if (!line.projectId) continue;
        const project = await getProjectByCode(line.projectCode);
        if (project) {
          await updateProject(project.id, { ...project, invoiceNumber: parsed.data.invoiceNumber });
        }
      }
    }

    await insertAuditLog({
      ...actor,
      action: "invoice.create",
      entityType: "invoice",
      entityId: String(invoice.id),
      details: { invoiceNumber: invoice.invoiceNumber },
    });

    return NextResponse.json({ id: invoice.id });
  } catch (e) {
    console.error("Invoice create failed:", e);
    return NextResponse.json({ error: "Could not create invoice" }, { status: 500 });
  }
}
