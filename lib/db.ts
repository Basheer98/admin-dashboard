import bcrypt from "bcrypt";
import { query, queryOne, queryOneRow, getPool, runSchema } from "./pg";
import { normalizeProjectCode } from "./normalize";

// Postgres implementation; DATABASE_URL is required.

export type SettingsRow = {
  usdToInrRate: number | null;
};

export type ActivityRow = {
  id: number;
  type: string;
  description: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type AdditionalWorkRow = {
  id: number;
  type: "ADDITIONAL_FIELDING" | "CORRECTION";
  projectNumber: string;
  ourProjectId: number | null;
  assignedFielderAssignmentId: number | null;
  distance: number | null;
  rateForEntireJob: number | null;
  amount: number | null;
  dueDate: string | null;
  completedAt: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRow = {
  id: number;
  projectCode: string;
  clientName: string;
  location: string;
  totalSqft: number;
  companyRatePerSqft: number;
  status: string;
  ecd: string | null;
  notes: string | null;
  qfield: string | null;
  invoiceNumber: string | null;
  workType: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type ProjectIssueRow = {
  id: number;
  projectId: number;
  reportedBy: string;
  description: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
};

export type FielderAssignmentRow = {
  id: number;
  projectId: number;
  fielderName: string;
  ratePerSqft: number;
  commissionPercentage: number | null;
  isInternal: boolean;
  managedByFielderId: number | null;
  managerRatePerSqft: number | null;
  managerCommissionShare: number | null;
  dueDate: string | null;
  archivedAt: string | null;
  createdAt?: string;
};

export type PaymentRow = {
  id: number;
  projectId: number;
  fielderAssignmentId: number;
  amount: number;
  currency: string;
  method: string;
  paymentDate: string;
  notes: string | null;
  createdAt: string;
  voidedAt: string | null;
};

export type ListProjectsOptions = { includeArchived?: boolean };
export type ListAssignmentsOptions = { includeArchived?: boolean };
export type ListPaymentsOptions = { includeVoided?: boolean };

const projectCols = `
  id, project_code AS "projectCode", client_name AS "clientName", location,
  total_sqft AS "totalSqft", company_rate_per_sqft AS "companyRatePerSqft",
  status, ecd, notes, qfield, invoice_number AS "invoiceNumber", work_type AS "workType",
  created_at::text AS "createdAt", updated_at::text AS "updatedAt", archived_at::text AS "archivedAt"
`;

const assignmentCols = `
  id, project_id AS "projectId", fielder_name AS "fielderName", rate_per_sqft AS "ratePerSqft",
  commission_percentage AS "commissionPercentage", is_internal AS "isInternal",
  managed_by_fielder_id AS "managedByFielderId", manager_rate_per_sqft AS "managerRatePerSqft",
  manager_commission_share AS "managerCommissionShare", due_date AS "dueDate",
  archived_at::text AS "archivedAt", created_at::text AS "createdAt"
`;

const paymentCols = `
  id, project_id AS "projectId", fielder_assignment_id AS "fielderAssignmentId",
  amount, currency, method, payment_date AS "paymentDate", notes,
  created_at::text AS "createdAt", voided_at::text AS "voidedAt"
`;

export async function getAllProjects(options?: ListProjectsOptions): Promise<ProjectRow[]> {
  const includeArchived = options?.includeArchived ?? false;
  const rows = await query<ProjectRow>(
    `SELECT ${projectCols} FROM projects
     WHERE ($1::boolean OR archived_at IS NULL)
     ORDER BY created_at DESC`,
    [includeArchived],
  );
  return rows as ProjectRow[];
}

export async function getAllAssignments(options?: ListAssignmentsOptions): Promise<FielderAssignmentRow[]> {
  const includeArchived = options?.includeArchived ?? false;
  const rows = await query<FielderAssignmentRow>(
    `SELECT ${assignmentCols} FROM assignments
     WHERE ($1::boolean OR archived_at IS NULL)
     ORDER BY id DESC`,
    [includeArchived],
  );
  return rows as FielderAssignmentRow[];
}

export async function getAllPayments(options?: ListPaymentsOptions): Promise<PaymentRow[]> {
  const includeVoided = options?.includeVoided ?? false;
  const rows = await query<PaymentRow>(
    `SELECT ${paymentCols} FROM payments
     WHERE ($1::boolean OR voided_at IS NULL)
     ORDER BY payment_date ASC`,
    [includeVoided],
  );
  return rows as PaymentRow[];
}

export async function getProjectById(id: number): Promise<ProjectRow | undefined> {
  const row = await queryOne<ProjectRow>(
    `SELECT ${projectCols} FROM projects WHERE id = $1`,
    [id],
  );
  return row as ProjectRow | undefined;
}

export async function getProjectByCode(projectCode: string): Promise<ProjectRow | undefined> {
  const normalized = normalizeProjectCode(projectCode.trim());
  if (!normalized) return undefined;
  const row = await queryOne<ProjectRow>(
    `SELECT ${projectCols} FROM projects WHERE project_code = $1`,
    [normalized],
  );
  return row as ProjectRow | undefined;
}

export async function getProjectsByInvoiceNumber(invoiceNumber: string): Promise<ProjectRow[]> {
  const trimmed = invoiceNumber.trim();
  if (!trimmed) return [];
  const rows = await query<ProjectRow>(
    `SELECT ${projectCols} FROM projects
     WHERE TRIM(COALESCE(invoice_number, '')) = $1 AND archived_at IS NULL
     ORDER BY project_code ASC`,
    [trimmed],
  );
  return rows as ProjectRow[];
}

const SEARCH_LIMIT = 8;

export type GlobalSearchResult = {
  projects: { id: number; projectCode: string; clientName: string; invoiceNumber: string | null }[];
  fielders: string[];
  invoices: string[];
};

export async function searchGlobal(q: string): Promise<GlobalSearchResult> {
  const trimmed = q.trim();
  if (!trimmed) {
    return { projects: [], fielders: [], invoices: [] };
  }
  const pattern = `%${trimmed.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

  const [projectRows, fielderRows, invoiceRows] = await Promise.all([
    query<{ id: number; projectCode: string; clientName: string; invoiceNumber: string | null }>(
      `SELECT id, project_code AS "projectCode", client_name AS "clientName", invoice_number AS "invoiceNumber"
       FROM projects
       WHERE archived_at IS NULL
         AND (project_code ILIKE $1 OR client_name ILIKE $1 OR COALESCE(invoice_number, '') ILIKE $1)
       ORDER BY project_code ASC
       LIMIT ${SEARCH_LIMIT}`,
      [pattern],
    ),
    query<{ fielderName: string }>(
      `SELECT DISTINCT fielder_name AS "fielderName"
       FROM assignments
       WHERE archived_at IS NULL AND fielder_name ILIKE $1
       ORDER BY fielder_name ASC
       LIMIT ${SEARCH_LIMIT}`,
      [pattern],
    ),
    query<{ invoiceNumber: string }>(
      `SELECT DISTINCT invoice_number AS "invoiceNumber"
       FROM projects
       WHERE archived_at IS NULL AND invoice_number IS NOT NULL AND TRIM(invoice_number) <> '' AND invoice_number ILIKE $1
       ORDER BY invoice_number ASC
       LIMIT ${SEARCH_LIMIT}`,
      [pattern],
    ),
  ]);

  return {
    projects: projectRows as { id: number; projectCode: string; clientName: string; invoiceNumber: string | null }[],
    fielders: (fielderRows as { fielderName: string }[]).map((r) => r.fielderName),
    invoices: (invoiceRows as { invoiceNumber: string }[]).map((r) => r.invoiceNumber),
  };
}

export async function insertProject(input: {
  projectCode: string;
  clientName: string;
  location: string;
  totalSqft: number;
  companyRatePerSqft: number;
  status: string;
  ecd?: string | null;
  notes: string | null;
  qfield?: string | null;
  invoiceNumber?: string | null;
  workType?: string | null;
}): Promise<ProjectRow> {
  const row = await queryOneRow<ProjectRow>(
    `INSERT INTO projects (project_code, client_name, location, total_sqft, company_rate_per_sqft, status, ecd, notes, qfield, invoice_number, work_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${projectCols}`,
    [
      input.projectCode,
      input.clientName,
      input.location,
      input.totalSqft,
      input.companyRatePerSqft,
      input.status,
      input.ecd ?? null,
      input.notes,
      input.qfield ?? null,
      input.invoiceNumber ?? null,
      input.workType ?? null,
    ],
  );
  if (!row) throw new Error("insertProject failed");
  const project = row as ProjectRow;
  await insertActivity({
    type: "project_created",
    description: `Created project ${project.projectCode} (${project.clientName})`,
    metadata: { projectId: project.id },
  });
  return project;
}

export async function updateProject(
  id: number,
  input: {
    projectCode: string;
    clientName: string;
    location: string;
    totalSqft: number;
    companyRatePerSqft: number;
    status: string;
    ecd?: string | null;
    notes: string | null;
    qfield?: string | null;
    invoiceNumber?: string | null;
    workType?: string | null;
    archivedAt?: string | null;
  },
): Promise<void> {
  await query(
    `UPDATE projects SET
       project_code = $2, client_name = $3, location = $4, total_sqft = $5,
       company_rate_per_sqft = $6, status = $7, ecd = $8, notes = $9, qfield = $10, invoice_number = $11,
       work_type = $12,
       updated_at = NOW(),
       archived_at = COALESCE($13, archived_at)
     WHERE id = $1`,
    [
      id,
      input.projectCode,
      input.clientName,
      input.location,
      input.totalSqft,
      input.companyRatePerSqft,
      input.status,
      input.ecd ?? null,
      input.notes,
      input.qfield ?? null,
      input.invoiceNumber ?? null,
      input.workType ?? null,
      input.archivedAt ?? null,
    ],
  );
}

export async function insertProjectIssue(input: {
  projectId: number;
  reportedBy: string;
  description: string;
}): Promise<void> {
  await query(
    `INSERT INTO project_issues (project_id, reported_by, description) VALUES ($1, $2, $3)`,
    [input.projectId, input.reportedBy, input.description],
  );
}

export async function getProjectIssuesByProjectId(projectId: number): Promise<ProjectIssueRow[]> {
  const rows = await query<ProjectIssueRow>(
    `SELECT id, project_id AS "projectId", reported_by AS "reportedBy", description,
            created_at::text AS "createdAt", resolved_at::text AS "resolvedAt", resolved_by AS "resolvedBy"
     FROM project_issues WHERE project_id = $1 ORDER BY created_at DESC`,
    [projectId],
  );
  return rows as ProjectIssueRow[];
}

export async function archiveProject(id: number): Promise<void> {
  const before = await getProjectById(id);
  if (before) {
    await updateProject(id, {
      ...before,
      archivedAt: new Date().toISOString(),
    });
    await insertActivity({
      type: "project_archived",
      description: `Archived project ${before.projectCode} (${before.clientName})`,
      metadata: { projectId: id },
    });
  }
}

export async function unarchiveProject(id: number): Promise<void> {
  const p = await getProjectById(id);
  if (!p) return;
  await query(
    `UPDATE projects SET archived_at = NULL, updated_at = NOW() WHERE id = $1`,
    [id],
  );
  await insertActivity({
    type: "project_unarchived",
    description: `Unarchived project ${p.projectCode} (${p.clientName})`,
    metadata: { projectId: id },
  });
}

export async function deleteProject(id: number): Promise<void> {
  await query("DELETE FROM projects WHERE id = $1", [id]);
}

export async function getAssignmentsByProjectId(
  projectId: number,
  options?: { includeArchived?: boolean },
): Promise<FielderAssignmentRow[]> {
  const includeArchived = options?.includeArchived ?? false;
  const rows = await query<FielderAssignmentRow>(
    `SELECT ${assignmentCols} FROM assignments
     WHERE project_id = $1 AND ($2::boolean OR archived_at IS NULL)`,
    [projectId, includeArchived],
  );
  return rows as FielderAssignmentRow[];
}

export async function getAssignmentById(
  id: number,
): Promise<(FielderAssignmentRow & { project: ProjectRow; payments: PaymentRow[] }) | undefined> {
  const assignment = await queryOne<FielderAssignmentRow>(
    `SELECT ${assignmentCols} FROM assignments WHERE id = $1`,
    [id],
  );
  if (!assignment) return undefined;
  const project = await getProjectById((assignment as FielderAssignmentRow).projectId);
  if (!project) return undefined;
  const payments = await query<PaymentRow>(
    `SELECT ${paymentCols} FROM payments WHERE fielder_assignment_id = $1 AND voided_at IS NULL ORDER BY payment_date ASC`,
    [id],
  );
  return {
    ...(assignment as FielderAssignmentRow),
    project,
    payments: payments as PaymentRow[],
  };
}

export async function getAssignmentsWithDetails(
  options?: ListAssignmentsOptions,
): Promise<Array<FielderAssignmentRow & { project: ProjectRow; payments: PaymentRow[] }>> {
  const assignments = await getAllAssignments(options);
  const result: Array<FielderAssignmentRow & { project: ProjectRow; payments: PaymentRow[] }> = [];
  for (const a of assignments) {
    const detail = await getAssignmentById(a.id);
    if (detail) result.push(detail);
  }
  return result;
}

export async function insertAssignment(input: {
  projectId: number;
  fielderName: string;
  ratePerSqft: number;
  commissionPercentage: number | null;
  isInternal?: boolean;
  managedByFielderId?: number | null;
  managerRatePerSqft?: number | null;
  managerCommissionShare?: number | null;
  dueDate?: string | null;
}): Promise<number> {
  const row = await queryOneRow<{ id: number }>(
    `INSERT INTO assignments (project_id, fielder_name, rate_per_sqft, commission_percentage, is_internal, managed_by_fielder_id, manager_rate_per_sqft, manager_commission_share, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      input.projectId,
      input.fielderName,
      input.ratePerSqft,
      input.commissionPercentage,
      input.isInternal ?? false,
      input.managedByFielderId ?? null,
      input.managerRatePerSqft ?? null,
      input.managerCommissionShare ?? null,
      input.dueDate ?? null,
    ],
  );
  if (!row) throw new Error("insertAssignment failed");
  return row.id;
}

export async function updateAssignment(
  id: number,
  input: {
    ratePerSqft: number;
    commissionPercentage: number | null;
    isInternal?: boolean;
    managedByFielderId?: number | null;
    managerRatePerSqft?: number | null;
    managerCommissionShare?: number | null;
    dueDate?: string | null;
    archivedAt?: string | null;
  },
): Promise<void> {
  const existing = await queryOne<FielderAssignmentRow>(
    `SELECT ${assignmentCols} FROM assignments WHERE id = $1`,
    [id],
  );
  if (!existing) return;
  const e = existing as FielderAssignmentRow;
  await query(
    `UPDATE assignments SET
       rate_per_sqft = $2, commission_percentage = $3, is_internal = $4,
       managed_by_fielder_id = $5, manager_rate_per_sqft = $6, manager_commission_share = $7,
       due_date = $8, archived_at = COALESCE($9, archived_at)
     WHERE id = $1`,
    [
      id,
      input.ratePerSqft,
      input.commissionPercentage,
      input.isInternal ?? e.isInternal,
      input.managedByFielderId ?? e.managedByFielderId,
      input.managerRatePerSqft ?? e.managerRatePerSqft,
      input.managerCommissionShare ?? e.managerCommissionShare,
      input.dueDate !== undefined ? input.dueDate : e.dueDate,
      input.archivedAt !== undefined ? input.archivedAt : e.archivedAt,
    ],
  );
}

export async function archiveAssignment(id: number): Promise<void> {
  const a = await getAssignmentById(id);
  if (!a) return;
  const project = await getProjectById(a.projectId);
  await query(
    `UPDATE assignments SET archived_at = NOW() WHERE id = $1`,
    [id],
  );
  await insertActivity({
    type: "assignment_archived",
    description: `Archived assignment: ${a.fielderName} (${project?.projectCode ?? "project"})`,
    metadata: { assignmentId: id, fielderName: a.fielderName, projectId: a.projectId },
  });
}

export async function unarchiveAssignment(id: number): Promise<void> {
  const a = await getAssignmentById(id);
  if (!a) return;
  const project = await getProjectById(a.projectId);
  await query(
    `UPDATE assignments SET archived_at = NULL WHERE id = $1`,
    [id],
  );
  await insertActivity({
    type: "assignment_unarchived",
    description: `Unarchived assignment: ${a.fielderName} (${project?.projectCode ?? "project"})`,
    metadata: { assignmentId: id, fielderName: a.fielderName, projectId: a.projectId },
  });
}

export async function deleteAssignment(id: number): Promise<void> {
  await query("DELETE FROM assignments WHERE id = $1", [id]);
}

// Assignment templates
export type AssignmentTemplateRow = {
  id: number;
  name: string;
  createdAt: string;
};

export type AssignmentTemplateItemRow = {
  id: number;
  templateId: number;
  fielderName: string;
  ratePerSqft: number;
  commissionPercentage: number | null;
  isInternal: boolean;
  managerFielderName: string | null;
  managerRatePerSqft: number | null;
  managerCommissionShare: number | null;
  sortOrder: number;
};

const templateCols = `id, name AS "name", created_at::text AS "createdAt"`;
const templateItemCols = `
  id, template_id AS "templateId", fielder_name AS "fielderName", rate_per_sqft AS "ratePerSqft",
  commission_percentage AS "commissionPercentage", is_internal AS "isInternal",
  manager_fielder_name AS "managerFielderName", manager_rate_per_sqft AS "managerRatePerSqft",
  manager_commission_share AS "managerCommissionShare", sort_order AS "sortOrder"
`;

export async function getAllAssignmentTemplates(): Promise<
  (AssignmentTemplateRow & { items: AssignmentTemplateItemRow[] })[]
> {
  const templates = await query<AssignmentTemplateRow>(
    `SELECT ${templateCols} FROM assignment_templates ORDER BY name`,
  );
  const result: (AssignmentTemplateRow & { items: AssignmentTemplateItemRow[] })[] = [];
  for (const t of templates as AssignmentTemplateRow[]) {
    const items = await query<AssignmentTemplateItemRow>(
      `SELECT ${templateItemCols} FROM assignment_template_items WHERE template_id = $1 ORDER BY sort_order, id`,
      [t.id],
    );
    result.push({ ...t, items: items as AssignmentTemplateItemRow[] });
  }
  return result;
}

export async function getAssignmentTemplateById(
  id: number,
): Promise<(AssignmentTemplateRow & { items: AssignmentTemplateItemRow[] }) | undefined> {
  const t = await queryOne<AssignmentTemplateRow>(
    `SELECT ${templateCols} FROM assignment_templates WHERE id = $1`,
    [id],
  );
  if (!t) return undefined;
  const items = await query<AssignmentTemplateItemRow>(
    `SELECT ${templateItemCols} FROM assignment_template_items WHERE template_id = $1 ORDER BY sort_order, id`,
    [id],
  );
  return { ...(t as AssignmentTemplateRow), items: items as AssignmentTemplateItemRow[] };
}

export async function createAssignmentTemplate(input: {
  name: string;
  items: {
    fielderName: string;
    ratePerSqft: number;
    commissionPercentage: number | null;
    isInternal?: boolean;
    managerFielderName?: string | null;
    managerRatePerSqft?: number | null;
    managerCommissionShare?: number | null;
  }[];
}): Promise<number> {
  const row = await queryOneRow<{ id: number }>(
    `INSERT INTO assignment_templates (name) VALUES ($1) RETURNING id`,
    [input.name.trim()],
  );
  if (!row) throw new Error("createAssignmentTemplate failed");
  const templateId = (row as { id: number }).id;
  for (let i = 0; i < input.items.length; i++) {
    const it = input.items[i];
    await query(
      `INSERT INTO assignment_template_items (template_id, fielder_name, rate_per_sqft, commission_percentage, is_internal, manager_fielder_name, manager_rate_per_sqft, manager_commission_share, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        templateId,
        it.fielderName.trim(),
        it.ratePerSqft,
        it.commissionPercentage ?? null,
        it.isInternal ?? false,
        it.managerFielderName?.trim() || null,
        it.managerRatePerSqft ?? null,
        it.managerCommissionShare ?? null,
        i,
      ],
    );
  }
  return templateId;
}

export async function deleteAssignmentTemplate(id: number): Promise<void> {
  await query("DELETE FROM assignment_templates WHERE id = $1", [id]);
}

export async function applyAssignmentTemplateToProject(
  projectId: number,
  templateId: number,
): Promise<{ created: number }> {
  const template = await getAssignmentTemplateById(templateId);
  if (!template) throw new Error("Template not found");
  const project = await getProjectById(projectId);
  if (!project) throw new Error("Project not found");

  const createdIds: { assignmentId: number; managerFielderName: string | null }[] = [];
  for (const it of template.items) {
    const assignmentId = await insertAssignment({
      projectId,
      fielderName: it.fielderName,
      ratePerSqft: it.ratePerSqft,
      commissionPercentage: it.commissionPercentage,
      isInternal: it.isInternal ?? false,
      managedByFielderId: null,
      managerRatePerSqft: it.managerRatePerSqft ?? null,
      managerCommissionShare: it.managerCommissionShare ?? null,
    });
    createdIds.push({
      assignmentId,
      managerFielderName: it.managerFielderName ?? null,
    });
  }

  const projectAssignments = await getAssignmentsByProjectId(projectId, {
    includeArchived: true,
  });
  const fielderNameToAssignmentId = new Map(
    projectAssignments.map((a) => [a.fielderName.trim().toUpperCase(), a.id]),
  );

  for (let i = 0; i < createdIds.length; i++) {
    const { assignmentId, managerFielderName } = createdIds[i]!;
    const it = template.items[i];
    if (!managerFielderName || !it) continue;
    const managerAssignmentId = fielderNameToAssignmentId.get(
      managerFielderName.trim().toUpperCase(),
    );
    if (managerAssignmentId != null) {
      const assignment = projectAssignments.find((a) => a.id === assignmentId);
      if (assignment) {
        await updateAssignment(assignmentId, {
          ratePerSqft: Number(assignment.ratePerSqft),
          commissionPercentage: assignment.commissionPercentage ?? null,
          managedByFielderId: managerAssignmentId,
          managerRatePerSqft: it.managerRatePerSqft ?? null,
          managerCommissionShare: it.managerCommissionShare ?? null,
        });
      }
    }
  }

  await insertActivity({
    type: "template_applied",
    description: `Applied template "${template.name}" to project ${project.projectCode} (${createdIds.length} assignments)`,
    metadata: { projectId, templateId, created: createdIds.length },
  });

  return { created: createdIds.length };
}

export async function insertPayment(input: {
  projectId: number;
  fielderAssignmentId: number;
  amount: number;
  currency: string;
  method: string;
  paymentDate: string;
  notes: string | null;
}): Promise<number> {
  const row = await queryOneRow<{ id: number }>(
    `INSERT INTO payments (project_id, fielder_assignment_id, amount, currency, method, payment_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.projectId,
      input.fielderAssignmentId,
      input.amount,
      input.currency,
      input.method,
      input.paymentDate,
      input.notes,
    ],
  );
  if (!row) throw new Error("insertPayment failed");
  return row.id;
}

export async function getPaymentsWithDetails(
  options?: ListPaymentsOptions,
): Promise<Array<PaymentRow & { project: ProjectRow; assignment: FielderAssignmentRow }>> {
  const includeVoided = options?.includeVoided ?? false;
  const payments = await query<PaymentRow>(
    `SELECT ${paymentCols} FROM payments WHERE ($1::boolean OR voided_at IS NULL) ORDER BY payment_date ASC`,
    [includeVoided],
  );
  const result: Array<PaymentRow & { project: ProjectRow; assignment: FielderAssignmentRow }> = [];
  for (const p of payments as PaymentRow[]) {
    const project = await getProjectById(p.projectId);
    const assignment = await queryOne<FielderAssignmentRow>(
      `SELECT ${assignmentCols} FROM assignments WHERE id = $1`,
      [p.fielderAssignmentId],
    );
    if (project && assignment) result.push({ ...p, project, assignment: assignment as FielderAssignmentRow });
  }
  return result;
}

export async function voidPayment(id: number): Promise<boolean> {
  const row = await queryOne<{ voided_at: string | null }>(
    "SELECT voided_at FROM payments WHERE id = $1",
    [id],
  );
  if (!row || row.voided_at) return false;
  await query("UPDATE payments SET voided_at = NOW() WHERE id = $1", [id]);
  return true;
}

export async function getPaymentById(
  id: number,
): Promise<(PaymentRow & { project: ProjectRow; assignment: FielderAssignmentRow }) | undefined> {
  const payment = await queryOne<PaymentRow>(
    `SELECT ${paymentCols} FROM payments WHERE id = $1`,
    [id],
  );
  if (!payment) return undefined;
  const p = payment as PaymentRow;
  const project = await getProjectById(p.projectId);
  const assignment = await queryOne<FielderAssignmentRow>(
    `SELECT ${assignmentCols} FROM assignments WHERE id = $1`,
    [p.fielderAssignmentId],
  );
  if (!project || !assignment) return undefined;
  return { ...p, project, assignment: assignment as FielderAssignmentRow };
}

const additionalWorkCols = `
  id, type, project_number AS "projectNumber", our_project_id AS "ourProjectId",
  assigned_fielder_assignment_id AS "assignedFielderAssignmentId", distance,
  rate_for_entire_job AS "rateForEntireJob", amount, due_date AS "dueDate",
  completed_at AS "completedAt", status, notes,
  created_at::text AS "createdAt", updated_at::text AS "updatedAt"
`;

export async function getAllAdditionalWork(): Promise<AdditionalWorkRow[]> {
  const rows = await query<AdditionalWorkRow>(
    `SELECT ${additionalWorkCols} FROM additional_work ORDER BY created_at DESC`,
  );
  return rows as AdditionalWorkRow[];
}

/** Additional work items assigned to a fielder (via their assignment ids). */
export async function getAdditionalWorkForFielderByName(
  fielderName: string,
): Promise<Array<AdditionalWorkRow & { project?: ProjectRow }>> {
  const assignments = await getAssignmentsForFielderByName(fielderName);
  const assignmentIds = assignments.map((a) => a.id);
  if (assignmentIds.length === 0) return [];

  const placeholders = assignmentIds.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await query<AdditionalWorkRow>(
    `SELECT ${additionalWorkCols} FROM additional_work WHERE assigned_fielder_assignment_id IN (${placeholders}) ORDER BY created_at DESC`,
    assignmentIds,
  );
  const result: Array<AdditionalWorkRow & { project?: ProjectRow }> = [];
  for (const w of rows as AdditionalWorkRow[]) {
    let project: ProjectRow | undefined;
    if (w.ourProjectId) project = await getProjectById(w.ourProjectId);
    result.push({ ...w, project });
  }
  return result;
}

export async function getAdditionalWorkById(
  id: number,
): Promise<(AdditionalWorkRow & { project?: ProjectRow; assignedAssignment?: FielderAssignmentRow }) | undefined> {
  const row = await queryOne<AdditionalWorkRow>(
    `SELECT ${additionalWorkCols} FROM additional_work WHERE id = $1`,
    [id],
  );
  if (!row) return undefined;
  const w = row as AdditionalWorkRow;
  let project: ProjectRow | undefined;
  let assignedAssignment: FielderAssignmentRow | undefined;
  if (w.ourProjectId) project = await getProjectById(w.ourProjectId);
  if (w.assignedFielderAssignmentId)
    assignedAssignment = (await queryOne<FielderAssignmentRow>(
      `SELECT ${assignmentCols} FROM assignments WHERE id = $1`,
      [w.assignedFielderAssignmentId],
    )) as FielderAssignmentRow | undefined;
  return { ...w, project, assignedAssignment };
}

export async function insertAdditionalWork(input: {
  type: "ADDITIONAL_FIELDING" | "CORRECTION";
  projectNumber: string;
  ourProjectId: number | null;
  assignedFielderAssignmentId: number | null;
  distance: number | null;
  rateForEntireJob: number | null;
  amount: number | null;
  dueDate: string | null;
  completedAt: string | null;
  status: string;
  notes: string | null;
}): Promise<AdditionalWorkRow> {
  const row = await queryOneRow<AdditionalWorkRow>(
    `INSERT INTO additional_work (type, project_number, our_project_id, assigned_fielder_assignment_id, distance, rate_for_entire_job, amount, due_date, completed_at, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${additionalWorkCols}`,
    [
      input.type,
      input.projectNumber,
      input.ourProjectId,
      input.assignedFielderAssignmentId,
      input.distance,
      input.rateForEntireJob,
      input.amount,
      input.dueDate,
      input.completedAt,
      input.status,
      input.notes,
    ],
  );
  if (!row) throw new Error("insertAdditionalWork failed");
  const r = row as AdditionalWorkRow;
  await insertActivity({
    type: "additional_work_created",
    description: `${input.type === "CORRECTION" ? "Correction" : "Additional fielding"} for project ${input.projectNumber}`,
    metadata: { additionalWorkId: r.id, type: input.type },
  });
  return r;
}

export async function updateAdditionalWork(
  id: number,
  input: {
    type?: "ADDITIONAL_FIELDING" | "CORRECTION";
    projectNumber?: string;
    ourProjectId?: number | null;
    assignedFielderAssignmentId?: number | null;
    distance?: number | null;
    rateForEntireJob?: number | null;
    amount?: number | null;
    dueDate?: string | null;
    completedAt?: string | null;
    status?: string;
    notes?: string | null;
  },
): Promise<void> {
  const existing = await queryOne<AdditionalWorkRow>(
    `SELECT ${additionalWorkCols} FROM additional_work WHERE id = $1`,
    [id],
  );
  if (!existing) return;
  const e = existing as AdditionalWorkRow;
  await query(
    `UPDATE additional_work SET
       type = COALESCE($2, type), project_number = COALESCE($3, project_number),
       our_project_id = COALESCE($4, our_project_id), assigned_fielder_assignment_id = COALESCE($5, assigned_fielder_assignment_id),
       distance = COALESCE($6, distance), rate_for_entire_job = COALESCE($7, rate_for_entire_job),
       amount = COALESCE($8, amount), due_date = COALESCE($9, due_date), completed_at = COALESCE($10, completed_at),
       status = COALESCE($11, status), notes = COALESCE($12, notes), updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      input.type ?? e.type,
      input.projectNumber ?? e.projectNumber,
      input.ourProjectId ?? e.ourProjectId,
      input.assignedFielderAssignmentId ?? e.assignedFielderAssignmentId,
      input.distance ?? e.distance,
      input.rateForEntireJob ?? e.rateForEntireJob,
      input.amount ?? e.amount,
      input.dueDate ?? e.dueDate,
      input.completedAt ?? e.completedAt,
      input.status ?? e.status,
      input.notes ?? e.notes,
    ],
  );
}

export async function normalizeAllFielderNames(): Promise<number> {
  const assignments = await query<{ id: number; fielder_name: string }>(
    "SELECT id, fielder_name FROM assignments",
  );
  let count = 0;
  for (const a of assignments) {
    const normalized = a.fielder_name.trim().toUpperCase();
    if (a.fielder_name !== normalized) {
      await query("UPDATE assignments SET fielder_name = $2 WHERE id = $1", [
        a.id,
        normalized,
      ]);
      count++;
    }
  }
  return count;
}

export type FielderLoginRow = {
  id: number;
  email: string;
  passwordHash: string;
  fielderName: string;
};

export async function getAllFielderLogins(): Promise<FielderLoginRow[]> {
  const rows = await query<FielderLoginRow>(
    'SELECT id, email, password_hash AS "passwordHash", fielder_name AS "fielderName" FROM fielder_logins ORDER BY id',
  );
  return rows as FielderLoginRow[];
}

/** Assignments for one fielder by name (matches assignment.fielderName after normalizing). */
export async function getAssignmentsForFielderByName(fielderName: string): Promise<Array<FielderAssignmentRow & { project: ProjectRow; payments: PaymentRow[] }>> {
  const all = await getAssignmentsWithDetails({ includeArchived: true });
  const normalized = fielderName.trim().toUpperCase();
  return all.filter((a) => a.fielderName.trim().toUpperCase() === normalized);
}

export async function getFielderLoginByEmail(email: string): Promise<FielderLoginRow | null> {
  const row = await queryOne<FielderLoginRow>(
    'SELECT id, email, password_hash AS "passwordHash", fielder_name AS "fielderName" FROM fielder_logins WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))',
    [email],
  );
  return row as FielderLoginRow | null ?? null;
}

export async function getFielderLoginByFielderName(fielderName: string): Promise<FielderLoginRow | null> {
  const normalized = fielderName.trim().toUpperCase();
  const row = await queryOne<FielderLoginRow>(
    'SELECT id, email, password_hash AS "passwordHash", fielder_name AS "fielderName" FROM fielder_logins WHERE UPPER(TRIM(fielder_name)) = $1',
    [normalized],
  );
  return row as FielderLoginRow | null ?? null;
}

const BCRYPT_ROUNDS = 10;

export async function insertFielderLogin(input: {
  email: string;
  password: string;
  fielderName: string;
}): Promise<number> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const row = await queryOneRow<{ id: number }>(
    `INSERT INTO fielder_logins (email, password_hash, fielder_name) VALUES ($1, $2, $3) RETURNING id`,
    [input.email.trim().toLowerCase(), passwordHash, input.fielderName.trim()],
  );
  if (!row) throw new Error("insertFielderLogin failed");
  return row.id;
}

export async function updateFielderLoginPassword(id: number, newPassword: string): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await query(
    "UPDATE fielder_logins SET password_hash = $2 WHERE id = $1",
    [id, passwordHash],
  );
}

export async function savePushToken(fielderName: string, expoPushToken: string): Promise<void> {
  const normalized = fielderName.trim().toUpperCase();
  await query(
    `INSERT INTO fielder_push_tokens (fielder_name, expo_push_token, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (fielder_name) DO UPDATE SET expo_push_token = $2, updated_at = NOW()`,
    [normalized, expoPushToken],
  );
}

export async function getPushTokenForFielder(fielderName: string): Promise<string | null> {
  const normalized = fielderName.trim().toUpperCase();
  const row = await queryOne<{ expo_push_token: string }>(
    "SELECT expo_push_token FROM fielder_push_tokens WHERE fielder_name = $1",
    [normalized],
  );
  return (row as { expo_push_token: string } | undefined)?.expo_push_token ?? null;
}

export async function getSettings(): Promise<SettingsRow> {
  const row = await queryOne<{ usdToInrRate: number | null }>(
    'SELECT usd_to_inr_rate AS "usdToInrRate" FROM settings WHERE id = 1',
  );
  return { usdToInrRate: row?.usdToInrRate ?? null };
}

export async function updateSettings(input: { usdToInrRate?: number | null }): Promise<void> {
  const current = await getSettings();
  const value = input.usdToInrRate !== undefined ? input.usdToInrRate : current.usdToInrRate;
  await query(
    "UPDATE settings SET usd_to_inr_rate = $1 WHERE id = 1",
    [value],
  );
}

export async function insertActivity(input: {
  type: string;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await query(
    "INSERT INTO activity_log (type, description, metadata) VALUES ($1, $2, $3)",
    [input.type, input.description, input.metadata ? JSON.stringify(input.metadata) : null],
  );
}

export async function getAllActivity(limit?: number): Promise<ActivityRow[]> {
  const sql = limit
    ? `SELECT id, type, description, created_at::text AS "createdAt", metadata FROM activity_log ORDER BY created_at DESC LIMIT $1`
    : `SELECT id, type, description, created_at::text AS "createdAt", metadata FROM activity_log ORDER BY created_at DESC`;
  const rows = await (limit ? query<ActivityRow>(sql, [limit]) : query<ActivityRow>(sql));
  return rows as ActivityRow[];
}

export type AuditLogRow = {
  id: number;
  actorType: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export type GetAuditEntriesFilters = {
  actorName?: string;
  action?: string;
  entityType?: string;
  fromDate?: string; // ISO date
  toDate?: string;   // ISO date
  limit?: number;
};

export async function insertAuditLog(input: {
  actorType: "admin" | "fielder";
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
}): Promise<void> {
  await query(
    `INSERT INTO audit_log (actor_type, actor_name, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.actorType,
      input.actorName,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.details ? JSON.stringify(input.details) : null,
    ],
  );
}

export async function getAuditEntries(filters: GetAuditEntriesFilters = {}): Promise<AuditLogRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (filters.actorName) {
    conditions.push(`actor_name ILIKE $${idx}`);
    params.push(`%${filters.actorName}%`);
    idx++;
  }
  if (filters.action) {
    conditions.push(`action = $${idx}`);
    params.push(filters.action);
    idx++;
  }
  if (filters.entityType) {
    conditions.push(`entity_type = $${idx}`);
    params.push(filters.entityType);
    idx++;
  }
  if (filters.fromDate) {
    conditions.push(`created_at >= $${idx}::timestamptz`);
    params.push(filters.fromDate);
    idx++;
  }
  if (filters.toDate) {
    conditions.push(`created_at <= $${idx}::timestamptz`);
    params.push(filters.toDate + "T23:59:59.999Z");
    idx++;
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit ?? 500;
  params.push(limit);
  const sql = `SELECT id, actor_type AS "actorType", actor_name AS "actorName", action, entity_type AS "entityType",
    entity_id AS "entityId", details, created_at::text AS "createdAt"
    FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${idx}`;
  const rows = await query<AuditLogRow>(sql, params);
  return rows as AuditLogRow[];
}

/** Shape of a backup JSON file (version 1) from GET /api/backup */
export type BackupPayload = {
  version: number;
  exportedAt?: string;
  settings: SettingsRow;
  projects: ProjectRow[];
  assignments: FielderAssignmentRow[];
  payments: PaymentRow[];
  additionalWork: AdditionalWorkRow[];
  activityLog: ActivityRow[];
  fielderLogins?: Array<{ id: number; email: string; passwordHash: string; fielderName: string }>;
};

/** Old data.json shape (before Postgres). Used to import legacy backups into Postgres. */
export type LegacyJsonShape = {
  projects: Array<Record<string, unknown>>;
  assignments: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  settings?: { usdToInrRate?: number | null };
};

export function isLegacyJsonShape(obj: unknown): obj is LegacyJsonShape {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return Array.isArray(o.projects) && Array.isArray(o.assignments) && Array.isArray(o.payments);
}

/** Coerce to ISO timestamp string or null for Postgres. Handles legacy dates. */
function toTimestamp(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/** Convert legacy data.json content to BackupPayload so restoreBackup can import it. */
export function legacyJsonToBackupPayload(legacy: LegacyJsonShape): BackupPayload {
  const now = new Date().toISOString();
  const projects: ProjectRow[] = legacy.projects.map((p, i) => {
    const row = p as Record<string, unknown>;
    return {
      id: Number(row.id ?? i + 1),
      projectCode: String(row.projectCode ?? row.project_code ?? ""),
      clientName: String(row.clientName ?? row.client_name ?? ""),
      location: String(row.location ?? ""),
      totalSqft: Number(row.totalSqft ?? row.total_sqft ?? 0),
      companyRatePerSqft: Number(row.companyRatePerSqft ?? row.company_rate_per_sqft ?? 0),
      status: String(row.status ?? "NOT_STARTED"),
      ecd: row.ecd != null ? String(row.ecd) : null,
      notes: row.notes != null ? String(row.notes) : null,
      qfield: row.qfield != null ? String(row.qfield) : null,
      invoiceNumber: row.invoiceNumber != null ? String(row.invoiceNumber) : row.invoice_number != null ? String(row.invoice_number) : null,
      workType: row.workType != null ? String(row.workType) : row.work_type != null ? String(row.work_type) : null,
      createdAt: toTimestamp(row.createdAt ?? row.created_at) ?? now,
      updatedAt: toTimestamp(row.updatedAt ?? row.updated_at) ?? now,
      archivedAt: toTimestamp(row.archivedAt ?? row.archived_at),
    };
  });
  const projectIds = new Set(projects.map((x) => x.id));
  const assignments: FielderAssignmentRow[] = legacy.assignments
    .filter((a) => projectIds.has(Number((a as Record<string, unknown>).projectId ?? (a as Record<string, unknown>).project_id ?? 0)))
    .map((a, i) => {
      const row = a as Record<string, unknown>;
      return {
        id: Number(row.id ?? i + 1),
        projectId: Number(row.projectId ?? row.project_id ?? 0),
        fielderName: String(row.fielderName ?? row.fielder_name ?? ""),
        ratePerSqft: Number(row.ratePerSqft ?? row.rate_per_sqft ?? 0),
        commissionPercentage: row.commissionPercentage != null ? Number(row.commissionPercentage) : row.commission_percentage != null ? Number(row.commission_percentage) : null,
        isInternal: Boolean(row.isInternal ?? row.is_internal ?? false),
        managedByFielderId: row.managedByFielderId != null ? Number(row.managedByFielderId) : row.managed_by_fielder_id != null ? Number(row.managed_by_fielder_id) : null,
        managerRatePerSqft: row.managerRatePerSqft != null ? Number(row.managerRatePerSqft) : row.manager_rate_per_sqft != null ? Number(row.manager_rate_per_sqft) : null,
        managerCommissionShare: row.managerCommissionShare != null ? Number(row.managerCommissionShare) : row.manager_commission_share != null ? Number(row.manager_commission_share) : null,
        dueDate: row.dueDate != null ? String(row.dueDate) : row.due_date != null ? String(row.due_date) : null,
        archivedAt: toTimestamp(row.archivedAt ?? row.archived_at),
        createdAt: toTimestamp(row.createdAt ?? row.created_at) ?? now,
      };
    });
  const assignmentIds = new Set(assignments.map((x) => x.id));
  const payments: PaymentRow[] = legacy.payments
    .filter((p) => {
      const r = p as Record<string, unknown>;
      const pid = Number(r.projectId ?? r.project_id ?? 0);
      const aid = Number(r.fielderAssignmentId ?? r.fielder_assignment_id ?? 0);
      return projectIds.has(pid) && assignmentIds.has(aid);
    })
    .map((p, i) => {
      const row = p as Record<string, unknown>;
      return {
        id: Number(row.id ?? i + 1),
        projectId: Number(row.projectId ?? row.project_id ?? 0),
        fielderAssignmentId: Number(row.fielderAssignmentId ?? row.fielder_assignment_id ?? 0),
        amount: Number(row.amount ?? 0),
        currency: String(row.currency ?? "USD"),
        method: String(row.method ?? ""),
        paymentDate: String(row.paymentDate ?? row.payment_date ?? ""),
        notes: row.notes != null ? String(row.notes) : null,
        createdAt: toTimestamp(row.createdAt ?? row.created_at) ?? now,
        voidedAt: toTimestamp(row.voidedAt ?? row.voided_at),
      };
    });
  return {
    version: 1,
    exportedAt: now,
    settings: { usdToInrRate: legacy.settings?.usdToInrRate ?? null },
    projects,
    assignments,
    payments,
    additionalWork: [],
    activityLog: [],
  };
}

/** Restore database from a backup payload. Deletes existing data and inserts backup data. Uses a transaction for atomicity. */
export async function restoreBackup(backup: BackupPayload): Promise<void> {
  await runSchema();
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM payments");
    await client.query("DELETE FROM additional_work");
    await client.query("DELETE FROM assignments");
    await client.query("DELETE FROM audit_log");
    await client.query("DELETE FROM activity_log");
    await client.query("DELETE FROM projects");
    await client.query("DELETE FROM fielder_logins");

    const ts = (v: string | null | undefined): string | null => (v != null && v !== "" ? v : null);
    const now = new Date().toISOString();

    for (const p of backup.projects) {
      await client.query(
      `INSERT INTO projects (id, project_code, client_name, location, total_sqft, company_rate_per_sqft, status, ecd, notes, qfield, invoice_number, created_at, updated_at, archived_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz, $13::timestamptz, $14::timestamptz)`,
      [
        p.id,
        p.projectCode,
        p.clientName,
        p.location,
        p.totalSqft,
        p.companyRatePerSqft,
        p.status,
        p.ecd ?? null,
        p.notes ?? null,
        p.qfield ?? null,
        p.invoiceNumber ?? null,
        p.createdAt ?? now,
        p.updatedAt ?? now,
        ts(p.archivedAt ?? null),
      ],
    );
  }
    for (const a of backup.assignments) {
      await client.query(
      `INSERT INTO assignments (id, project_id, fielder_name, rate_per_sqft, commission_percentage, is_internal, managed_by_fielder_id, manager_rate_per_sqft, manager_commission_share, due_date, archived_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz)`,
      [
        a.id,
        a.projectId,
        a.fielderName,
        a.ratePerSqft,
        a.commissionPercentage ?? null,
        a.isInternal,
        a.managedByFielderId ?? null,
        a.managerRatePerSqft ?? null,
        a.managerCommissionShare ?? null,
        a.dueDate ?? null,
        ts(a.archivedAt ?? null),
        a.createdAt ?? now,
      ],
    );
  }
    for (const p of backup.payments) {
      await client.query(
      `INSERT INTO payments (id, project_id, fielder_assignment_id, amount, currency, method, payment_date, notes, created_at, voided_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10::timestamptz)`,
      [
        p.id,
        p.projectId,
        p.fielderAssignmentId,
        p.amount,
        p.currency,
        p.method,
        p.paymentDate,
        p.notes ?? null,
        p.createdAt ?? now,
        ts(p.voidedAt ?? null),
      ],
    );
  }
    for (const w of backup.additionalWork) {
      await client.query(
      `INSERT INTO additional_work (id, type, project_number, our_project_id, assigned_fielder_assignment_id, distance, rate_for_entire_job, amount, due_date, completed_at, status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14::timestamptz)`,
      [
        w.id,
        w.type,
        w.projectNumber,
        w.ourProjectId,
        w.assignedFielderAssignmentId,
        w.distance,
        w.rateForEntireJob,
        w.amount,
        w.dueDate,
        w.completedAt,
        w.status,
        w.notes,
        w.createdAt,
        w.updatedAt,
      ],
    );
  }
    for (const a of backup.activityLog) {
      await client.query(
      `INSERT INTO activity_log (id, type, description, created_at, metadata)
       VALUES ($1, $2, $3, $4::timestamptz, $5::jsonb)`,
      [
        a.id,
        a.type,
        a.description,
        a.createdAt,
        a.metadata ? JSON.stringify(a.metadata) : null,
      ],
    );
  }

    await client.query("UPDATE settings SET usd_to_inr_rate = $1 WHERE id = 1", [
      backup.settings.usdToInrRate,
    ]);

    const logins = backup.fielderLogins ?? [];
    for (const f of logins) {
      await client.query(
      `INSERT INTO fielder_logins (id, email, password_hash, fielder_name)
       VALUES ($1, $2, $3, $4)`,
      [f.id, f.email, f.passwordHash, f.fielderName],
    );
  }

    const seqQueries = [
      "SELECT setval(pg_get_serial_sequence('projects', 'id'), COALESCE((SELECT MAX(id) FROM projects), 1))",
      "SELECT setval(pg_get_serial_sequence('assignments', 'id'), COALESCE((SELECT MAX(id) FROM assignments), 1))",
      "SELECT setval(pg_get_serial_sequence('payments', 'id'), COALESCE((SELECT MAX(id) FROM payments), 1))",
      "SELECT setval(pg_get_serial_sequence('additional_work', 'id'), COALESCE((SELECT MAX(id) FROM additional_work), 1))",
      "SELECT setval(pg_get_serial_sequence('activity_log', 'id'), COALESCE((SELECT MAX(id) FROM activity_log), 1))",
      "SELECT setval(pg_get_serial_sequence('audit_log', 'id'), COALESCE((SELECT MAX(id) FROM audit_log), 1))",
      "SELECT setval(pg_get_serial_sequence('fielder_logins', 'id'), COALESCE((SELECT MAX(id) FROM fielder_logins), 1))",
    ];
    for (const sql of seqQueries) {
      await client.query(sql);
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Reset all ID sequences to match current MAX(id). Use after restore or if you see "duplicate key" on insert. */
export async function resetSequences(): Promise<void> {
  await runSchema();
  const pool = getPool();
  const seqQueries = [
    "SELECT setval(pg_get_serial_sequence('projects', 'id'), COALESCE((SELECT MAX(id) FROM projects), 1))",
    "SELECT setval(pg_get_serial_sequence('assignments', 'id'), COALESCE((SELECT MAX(id) FROM assignments), 1))",
    "SELECT setval(pg_get_serial_sequence('payments', 'id'), COALESCE((SELECT MAX(id) FROM payments), 1))",
    "SELECT setval(pg_get_serial_sequence('additional_work', 'id'), COALESCE((SELECT MAX(id) FROM additional_work), 1))",
    "SELECT setval(pg_get_serial_sequence('activity_log', 'id'), COALESCE((SELECT MAX(id) FROM activity_log), 1))",
    "SELECT setval(pg_get_serial_sequence('audit_log', 'id'), COALESCE((SELECT MAX(id) FROM audit_log), 1))",
    "SELECT setval(pg_get_serial_sequence('fielder_logins', 'id'), COALESCE((SELECT MAX(id) FROM fielder_logins), 1))",
  ];
  for (const sql of seqQueries) {
    await pool.query(sql);
  }
}
