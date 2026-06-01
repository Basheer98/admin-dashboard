import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuditActor, getSessionFromRequest } from "@/lib/auth";
import { insertAuditLog } from "@/lib/db";
import {
  applyImportPreview,
  buildImportPreview,
  parseProjectsFromCsv,
  type ColumnMapping,
  type ImportOptions,
} from "@/lib/invoiceCsvImport";
import { invoiceImportPreviewSchema, validate } from "@/lib/validations";

const confirmSchema = invoiceImportPreviewSchema.extend({
  filename: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = getAuditActor(session);

  const body = await request.json();
  const parsed = validate(confirmSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const mapping = parsed.data.mapping as ColumnMapping;
  const { groups } = parseProjectsFromCsv(
    parsed.data.headers,
    parsed.data.rows,
    mapping,
    {
      defaultClientName: parsed.data.options.defaultClientName,
      defaultCompanyRate: parsed.data.options.defaultCompanyRate,
      defaultLocation: parsed.data.options.defaultLocation,
      defaultStatus: parsed.data.options.defaultStatus,
    },
  );

  const options: ImportOptions = {
    ...parsed.data.options,
    dueDate: parsed.data.options.dueDate ?? null,
    notes: parsed.data.options.notes ?? null,
  };

  const preview = await buildImportPreview(groups, options);

  try {
    const result = await applyImportPreview(preview, options, parsed.data.filename ?? null);

    await insertAuditLog({
      ...actor,
      action: "invoice.csv_import",
      entityType: "invoice",
      entityId: String(result.invoiceId),
      details: {
        invoiceNumber: result.invoiceNumber,
        projectsCreated: result.projectsCreated,
        projectsUpdated: result.projectsUpdated,
        assignmentsAdded: result.assignmentsAdded,
      },
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("Import confirm failed:", e);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
