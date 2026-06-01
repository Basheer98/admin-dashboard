import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { suggestNextInvoiceNumber } from "@/lib/db";
import {
  buildImportPreview,
  parseProjectsFromCsv,
  type ColumnMapping,
  type ImportOptions,
} from "@/lib/invoiceCsvImport";
import { invoiceImportPreviewSchema, validate } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = validate(invoiceImportPreviewSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const mapping = parsed.data.mapping as ColumnMapping;
  if (!mapping.projectCode) {
    return NextResponse.json({ error: "Map a column to Project #" }, { status: 400 });
  }
  if (!mapping.totalSqft) {
    return NextResponse.json({ error: "Map a column to SQFT" }, { status: 400 });
  }

  const { groups, errors: parseErrors } = parseProjectsFromCsv(
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
  const suggestedInvoice = await suggestNextInvoiceNumber();

  const totalRevenue = groups.reduce(
    (sum, g) => sum + g.totalSqft * g.companyRatePerSqft,
    0,
  );

  return NextResponse.json({
    preview: preview.map((p) => ({
      projectCode: p.group.projectCode,
      clientName: p.group.clientName,
      totalSqft: p.group.totalSqft,
      companyRatePerSqft: p.group.companyRatePerSqft,
      fielders: p.group.fielders,
      action: p.action,
      message: p.message,
      assignmentsToAdd: p.assignmentsToAdd,
      assignmentsSkipped: p.assignmentsSkipped,
      rowNumbers: p.group.rowNumbers,
    })),
    parseErrors,
    projectCount: groups.length,
    totalRevenue,
    suggestedInvoiceNumber: options.invoiceNumber || suggestedInvoice,
  });
}
