import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createInvoiceWithLines,
  getProjectByCode,
  insertAuditLog,
  insertProject,
  resolveClientBillTo,
  updateProject,
} from "@/lib/db";
import { getAuditActor, getSessionFromRequest } from "@/lib/auth";
import { normalizeProjectCode } from "@/lib/normalize";
import { invoicePostSchema, validate } from "@/lib/validations";

const manualInvoiceSchema = invoicePostSchema.extend({
  syncProjectsToDashboard: z.boolean().optional(),
});

/** Client-facing invoice only (project #, SQFT, rate, total). */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = getAuditActor(session);

  const body = await request.json();
  const parsed = validate(manualInvoiceSchema, body);
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

    if (parsed.data.syncProjectsToDashboard) {
      for (let i = 0; i < parsed.data.lines.length; i++) {
        const line = parsed.data.lines[i]!;
        const code = normalizeProjectCode(line.projectCode);
        let project = await getProjectByCode(code);
        if (!project) {
          project = await insertProject({
            projectCode: code,
            clientName: line.clientName ?? parsed.data.clientName,
            location: "",
            totalSqft: line.totalSqft,
            companyRatePerSqft: line.ratePerSqft,
            status: "COMPLETED",
            notes: null,
            invoiceNumber: parsed.data.syncProjectInvoiceNumber ? parsed.data.invoiceNumber : null,
          });
        } else {
          await updateProject(project.id, {
            ...project,
            totalSqft: line.totalSqft,
            companyRatePerSqft: line.ratePerSqft,
            invoiceNumber: parsed.data.syncProjectInvoiceNumber
              ? parsed.data.invoiceNumber
              : project.invoiceNumber,
          });
          project = (await getProjectByCode(code))!;
        }
        linesForInvoice[i]!.projectId = project.id;
      }
    }

    const billTo = await resolveClientBillTo({
      clientId: parsed.data.clientId ?? null,
      clientName: parsed.data.clientName,
      billToAddress: parsed.data.billToAddress ?? null,
    });
    if (parsed.data.billToEmail?.trim()) {
      billTo.billToEmail = parsed.data.billToEmail.trim();
    }

    const { invoice } = await createInvoiceWithLines({
      invoiceNumber: parsed.data.invoiceNumber,
      clientId: billTo.clientId,
      clientName: billTo.clientName,
      billToAddress: billTo.billToAddress,
      billToEmail: billTo.billToEmail,
      issueDate: parsed.data.issueDate,
      dueDate: parsed.data.dueDate,
      notes: parsed.data.notes,
      status: "final",
      source: "manual",
      lines: linesForInvoice,
    });

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
