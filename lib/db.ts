import bcrypt from "bcrypt";
import { query, queryOne, queryOneRow, getPool, runSchema } from "./pg";
import { normalizeProjectCode } from "./normalize";
import type { CanonicalEmailPayload, CanonicalEntityType } from "./emailIngest";

// Postgres implementation; DATABASE_URL is required.

export type SettingsRow = {
  usdToInrRate: number | null;
  adminPhone: string | null;
  emailIngestEnabled: boolean;
  emailIngestWebhookSecret: string | null;
  emailIngestAutoApprove: boolean;
  emailIngestAutoApproveMinConfidence: number;
};

export type EmailIngestStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PROCESSING"
  | "FAILED_RETRYABLE"
  | "FAILED_FATAL";

export type EmailIngestRecordRow = {
  id: number;
  source: string;
  externalMessageId: string;
  fingerprint: string;
  senderEmail: string | null;
  senderName: string | null;
  subject: string | null;
  receivedAt: string;
  rawPayload: Record<string, unknown>;
  parsedPayload: CanonicalEmailPayload;
  normalizedPayload: Record<string, unknown> | null;
  entityType: CanonicalEntityType | null;
  confidence: number | null;
  status: EmailIngestStatus;
  retries: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  lastProcessedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  createdEntityType: string | null;
  createdEntityId: string | null;
  createdAt: string;
  updatedAt: string;
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
  gdriveFolderUrl: string | null;
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

export type TripRow = {
  id: number;
  name: string;
  state: string;
  city: string | null;
  teamMembers: string | null;
  budgetCar: number | null;
  budgetAccommodation: number | null;
  budgetGas: number | null;
  budgetTools: number | null;
  projectId: number | null;
  startDate: string;
  endDate: string | null;
  status: "PLANNED" | "ACTIVE" | "CLOSED";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TripExpenseRow = {
  id: number;
  tripId: number;
  expenseDate: string;
  category: "CAR" | "ACCOMMODATION" | "GAS" | "TOOLS" | "OTHER";
  amount: number;
  currency: "USD" | "INR";
  paidBy: string | null;
  receiptUrl: string | null;
  reimbursable: boolean;
  reimbursedAt: string | null;
  reimbursedByPaymentId: number | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionNote: string | null;
  trip?: TripRow;
  vendor: string | null;
  notes: string | null;
  createdAt: string;
};

export type TripFielderRow = {
  id: number;
  tripId: number;
  fielderName: string;
  createdAt: string;
};

export type TicketRow = {
  id: number;
  fielderName: string;
  title: string;
  category: "PROJECT_BLOCKER" | "TRAVEL" | "TOOLS" | "PAYMENT" | "OTHER";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  description: string;
  projectId: number | null;
  tripId: number | null;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListProjectsOptions = { includeArchived?: boolean };
export type ListAssignmentsOptions = { includeArchived?: boolean };
export type ListPaymentsOptions = { includeVoided?: boolean };

const projectCols = `
  id, project_code AS "projectCode", client_name AS "clientName", location,
  gdrive_folder_url AS "gdriveFolderUrl",
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

const tripCols = `
  id, name, state, city, team_members AS "teamMembers",
  budget_car AS "budgetCar", budget_accommodation AS "budgetAccommodation",
  budget_gas AS "budgetGas", budget_tools AS "budgetTools",
  project_id AS "projectId", start_date AS "startDate",
  end_date AS "endDate", status, notes, created_at::text AS "createdAt",
  updated_at::text AS "updatedAt"
`;

const tripExpenseCols = `
  id, trip_id AS "tripId", expense_date AS "expenseDate", category, amount,
  currency, paid_by AS "paidBy", receipt_url AS "receiptUrl", reimbursable,
  reimbursed_at::text AS "reimbursedAt", reimbursed_by_payment_id AS "reimbursedByPaymentId",
  approved_at::text AS "approvedAt", approved_by AS "approvedBy",
  rejected_at::text AS "rejectedAt", rejected_by AS "rejectedBy", rejection_note AS "rejectionNote",
  vendor, notes, created_at::text AS "createdAt"
`;

const tripFielderCols = `
  id, trip_id AS "tripId", fielder_name AS "fielderName", created_at::text AS "createdAt"
`;

const ticketCols = `
  id, fielder_name AS "fielderName", title, category, priority, description,
  project_id AS "projectId", trip_id AS "tripId", status, resolution_note AS "resolutionNote",
  created_at::text AS "createdAt", updated_at::text AS "updatedAt"
`;

const emailIngestCols = `
  id, source, external_message_id AS "externalMessageId", fingerprint,
  sender_email AS "senderEmail", sender_name AS "senderName", subject,
  received_at::text AS "receivedAt", raw_payload AS "rawPayload", parsed_payload AS "parsedPayload",
  normalized_payload AS "normalizedPayload", entity_type AS "entityType", confidence,
  status, retries, next_attempt_at::text AS "nextAttemptAt", last_error AS "lastError",
  last_processed_at::text AS "lastProcessedAt", approved_at::text AS "approvedAt", approved_by AS "approvedBy",
  rejected_at::text AS "rejectedAt", rejected_by AS "rejectedBy", rejection_reason AS "rejectionReason",
  created_entity_type AS "createdEntityType", created_entity_id AS "createdEntityId",
  created_at::text AS "createdAt", updated_at::text AS "updatedAt"
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
  gdriveFolderUrl?: string | null;
}): Promise<ProjectRow> {
  const row = await queryOneRow<ProjectRow>(
    `INSERT INTO projects (project_code, client_name, location, total_sqft, company_rate_per_sqft, status, ecd, notes, qfield, invoice_number, work_type, gdrive_folder_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      input.gdriveFolderUrl ?? null,
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
    gdriveFolderUrl?: string | null;
    archivedAt?: string | null;
  },
): Promise<void> {
  await query(
    `UPDATE projects SET
       project_code = $2, client_name = $3, location = $4, total_sqft = $5,
       company_rate_per_sqft = $6, status = $7, ecd = $8, notes = $9, qfield = $10, invoice_number = $11,
       work_type = $12, gdrive_folder_url = $13,
       updated_at = NOW(),
       archived_at = COALESCE($14, archived_at)
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
      input.gdriveFolderUrl ?? null,
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

export async function getAllTrips(): Promise<Array<TripRow & { project?: ProjectRow; totalExpense: number }>> {
  const rows = await query<TripRow>(
    `SELECT ${tripCols} FROM trips ORDER BY start_date DESC, created_at DESC`,
  );
  const result: Array<TripRow & { project?: ProjectRow; totalExpense: number }> = [];
  for (const row of rows as TripRow[]) {
    const project = row.projectId ? await getProjectById(row.projectId) : undefined;
    const totalRow = await queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM trip_expenses WHERE trip_id = $1`,
      [row.id],
    );
    result.push({ ...row, project, totalExpense: Number(totalRow?.total ?? 0) });
  }
  return result;
}

export async function getTripById(
  id: number,
): Promise<(TripRow & { project?: ProjectRow; expenses: TripExpenseRow[]; totalExpense: number }) | undefined> {
  const trip = await queryOne<TripRow>(`SELECT ${tripCols} FROM trips WHERE id = $1`, [id]);
  if (!trip) return undefined;
  const t = trip as TripRow;
  const project = t.projectId ? await getProjectById(t.projectId) : undefined;
  const expenses = await query<TripExpenseRow>(
    `SELECT ${tripExpenseCols} FROM trip_expenses WHERE trip_id = $1 ORDER BY expense_date DESC, id DESC`,
    [id],
  );
  const totalExpense = (expenses as TripExpenseRow[]).reduce((sum, e) => sum + Number(e.amount), 0);
  return { ...t, project, expenses: expenses as TripExpenseRow[], totalExpense };
}

export async function insertTrip(input: {
  name: string;
  state: string;
  city: string | null;
  teamMembers: string | null;
  budgetCar: number | null;
  budgetAccommodation: number | null;
  budgetGas: number | null;
  budgetTools: number | null;
  projectId: number | null;
  startDate: string;
  endDate: string | null;
  status: "PLANNED" | "ACTIVE" | "CLOSED";
  notes: string | null;
}): Promise<TripRow> {
  const row = await queryOneRow<TripRow>(
    `INSERT INTO trips (name, state, city, team_members, budget_car, budget_accommodation, budget_gas, budget_tools, project_id, start_date, end_date, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING ${tripCols}`,
    [
      input.name,
      input.state,
      input.city,
      input.teamMembers,
      input.budgetCar,
      input.budgetAccommodation,
      input.budgetGas,
      input.budgetTools,
      input.projectId,
      input.startDate,
      input.endDate,
      input.status,
      input.notes,
    ],
  );
  if (!row) throw new Error("insertTrip failed");
  const trip = row as TripRow;
  await syncTripFielders(trip.id, input.teamMembers);
  return trip;
}

export async function updateTrip(
  id: number,
  input: {
    name: string;
    state: string;
    city: string | null;
    teamMembers: string | null;
    budgetCar: number | null;
    budgetAccommodation: number | null;
    budgetGas: number | null;
    budgetTools: number | null;
    projectId: number | null;
    startDate: string;
    endDate: string | null;
    status: "PLANNED" | "ACTIVE" | "CLOSED";
    notes: string | null;
  },
): Promise<void> {
  await query(
    `UPDATE trips SET
       name = $2,
       state = $3,
       city = $4,
       team_members = $5,
       budget_car = $6,
       budget_accommodation = $7,
       budget_gas = $8,
       budget_tools = $9,
       project_id = $10,
       start_date = $11,
       end_date = $12,
       status = $13,
       notes = $14,
       updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      input.name,
      input.state,
      input.city,
      input.teamMembers,
      input.budgetCar,
      input.budgetAccommodation,
      input.budgetGas,
      input.budgetTools,
      input.projectId,
      input.startDate,
      input.endDate,
      input.status,
      input.notes,
    ],
  );
  await syncTripFielders(id, input.teamMembers);
}

function parseTeamMembers(teamMembers: string | null): string[] {
  if (!teamMembers) return [];
  return Array.from(
    new Set(
      teamMembers
        .split(",")
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

export async function syncTripFielders(tripId: number, teamMembers: string | null): Promise<void> {
  const names = parseTeamMembers(teamMembers);
  await query("DELETE FROM trip_fielders WHERE trip_id = $1", [tripId]);
  for (const name of names) {
    await query(
      `INSERT INTO trip_fielders (trip_id, fielder_name) VALUES ($1, $2)
       ON CONFLICT (trip_id, fielder_name) DO NOTHING`,
      [tripId, name],
    );
  }
}

export async function getTripsForFielder(
  fielderName: string,
): Promise<Array<TripRow & { project?: ProjectRow; totalExpense: number }>> {
  const normalized = fielderName.trim().toUpperCase();
  const links = await query<TripFielderRow>(
    `SELECT ${tripFielderCols} FROM trip_fielders WHERE fielder_name = $1 ORDER BY created_at DESC`,
    [normalized],
  );
  const tripIds = Array.from(new Set((links as TripFielderRow[]).map((l) => l.tripId)));
  const allTrips = await getAllTrips();
  if (tripIds.length === 0) {
    // Backward compatibility: support older trips that only stored comma-separated teamMembers.
    return allTrips.filter((t) => parseTeamMembers(t.teamMembers).includes(normalized));
  }
  return allTrips.filter((t) => tripIds.includes(t.id) || parseTeamMembers(t.teamMembers).includes(normalized));
}

export async function getTripFielderNames(tripId: number): Promise<string[]> {
  const rows = await query<{ fielderName: string }>(
    `SELECT fielder_name AS "fielderName" FROM trip_fielders WHERE trip_id = $1 ORDER BY fielder_name ASC`,
    [tripId],
  );
  return (rows as { fielderName: string }[]).map((r) => r.fielderName);
}

export async function insertTicket(input: {
  fielderName: string;
  title: string;
  category: "PROJECT_BLOCKER" | "TRAVEL" | "TOOLS" | "PAYMENT" | "OTHER";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  description: string;
  projectId: number | null;
  tripId: number | null;
}): Promise<TicketRow> {
  const row = await queryOneRow<TicketRow>(
    `INSERT INTO tickets (fielder_name, title, category, priority, description, project_id, trip_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN')
     RETURNING ${ticketCols}`,
    [
      input.fielderName.trim().toUpperCase(),
      input.title.trim(),
      input.category,
      input.priority,
      input.description.trim(),
      input.projectId,
      input.tripId,
    ],
  );
  if (!row) throw new Error("insertTicket failed");
  return row as TicketRow;
}

export async function getAllTickets(): Promise<Array<TicketRow & { project?: ProjectRow; trip?: TripRow }>> {
  const rows = await query<TicketRow>(`SELECT ${ticketCols} FROM tickets ORDER BY created_at DESC`);
  const out: Array<TicketRow & { project?: ProjectRow; trip?: TripRow }> = [];
  for (const row of rows as TicketRow[]) {
    const project = row.projectId ? await getProjectById(row.projectId) : undefined;
    const trip = row.tripId ? (await queryOne<TripRow>(`SELECT ${tripCols} FROM trips WHERE id = $1`, [row.tripId])) as TripRow | undefined : undefined;
    out.push({ ...row, project, trip });
  }
  return out;
}

export async function getTicketsForFielder(
  fielderName: string,
): Promise<Array<TicketRow & { project?: ProjectRow; trip?: TripRow }>> {
  const normalized = fielderName.trim().toUpperCase();
  const rows = await query<TicketRow>(
    `SELECT ${ticketCols} FROM tickets WHERE UPPER(TRIM(fielder_name)) = $1 ORDER BY created_at DESC`,
    [normalized],
  );
  const out: Array<TicketRow & { project?: ProjectRow; trip?: TripRow }> = [];
  for (const row of rows as TicketRow[]) {
    const project = row.projectId ? await getProjectById(row.projectId) : undefined;
    const trip = row.tripId ? (await queryOne<TripRow>(`SELECT ${tripCols} FROM trips WHERE id = $1`, [row.tripId])) as TripRow | undefined : undefined;
    out.push({ ...row, project, trip });
  }
  return out;
}

export async function getTicketById(id: number): Promise<TicketRow | undefined> {
  const row = await queryOne<TicketRow>(`SELECT ${ticketCols} FROM tickets WHERE id = $1`, [id]);
  return row as TicketRow | undefined;
}

export async function updateTicket(
  id: number,
  input: { status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"; resolutionNote: string | null },
): Promise<void> {
  await query(
    `UPDATE tickets SET status = $2, resolution_note = $3, updated_at = NOW() WHERE id = $1`,
    [id, input.status, input.resolutionNote],
  );
}

export async function insertTripExpense(input: {
  tripId: number;
  expenseDate: string;
  category: "CAR" | "ACCOMMODATION" | "GAS" | "TOOLS" | "OTHER";
  amount: number;
  currency: "USD" | "INR";
  paidBy: string | null;
  receiptUrl?: string | null;
  reimbursable?: boolean;
  vendor: string | null;
  notes: string | null;
}): Promise<TripExpenseRow> {
  const row = await queryOneRow<TripExpenseRow>(
    `INSERT INTO trip_expenses (trip_id, expense_date, category, amount, currency, paid_by, receipt_url, reimbursable, vendor, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${tripExpenseCols}`,
    [
      input.tripId,
      input.expenseDate,
      input.category,
      input.amount,
      input.currency,
      input.paidBy,
      input.receiptUrl ?? null,
      input.reimbursable ?? false,
      input.vendor,
      input.notes,
    ],
  );
  if (!row) throw new Error("insertTripExpense failed");
  return row as TripExpenseRow;
}

export async function getPendingTripReimbursementsForFielder(
  fielderName: string,
): Promise<TripExpenseRow[]> {
  const normalized = fielderName.trim().toUpperCase();
  if (!normalized) return [];
  const rows = await query<TripExpenseRow>(
    `SELECT ${tripExpenseCols}
     FROM trip_expenses
     WHERE reimbursable = TRUE
       AND reimbursed_at IS NULL
       AND rejected_at IS NULL
       AND UPPER(TRIM(COALESCE(paid_by, ''))) = $1
     ORDER BY expense_date ASC, id ASC`,
    [normalized],
  );
  return rows as TripExpenseRow[];
}

export async function getApprovedTripReimbursementsForFielder(
  fielderName: string,
): Promise<TripExpenseRow[]> {
  const normalized = fielderName.trim().toUpperCase();
  if (!normalized) return [];
  const rows = await query<TripExpenseRow>(
    `SELECT ${tripExpenseCols}
     FROM trip_expenses
     WHERE reimbursable = TRUE
       AND reimbursed_at IS NULL
       AND rejected_at IS NULL
       AND approved_at IS NOT NULL
       AND UPPER(TRIM(COALESCE(paid_by, ''))) = $1
     ORDER BY expense_date ASC, id ASC`,
    [normalized],
  );
  return rows as TripExpenseRow[];
}

export async function getPendingTripReimbursementsForFielderWithTrip(
  fielderName: string,
): Promise<Array<TripExpenseRow & { trip: TripRow }>> {
  const rows = await getPendingTripReimbursementsForFielder(fielderName);
  const trips = await query<TripRow>(`SELECT ${tripCols} FROM trips`);
  const tripById = new Map((trips as TripRow[]).map((t) => [t.id, t]));
  return rows
    .map((r) => {
      const trip = tripById.get(r.tripId);
      if (!trip) return null;
      return { ...r, trip };
    })
    .filter(Boolean) as Array<TripExpenseRow & { trip: TripRow }>;
}

export async function getTripReimbursementsForFielderWithTrip(
  fielderName: string,
): Promise<Array<TripExpenseRow & { trip: TripRow }>> {
  const normalized = fielderName.trim().toUpperCase();
  if (!normalized) return [];
  const rows = await query<TripExpenseRow>(
    `SELECT ${tripExpenseCols}
     FROM trip_expenses
     WHERE reimbursable = TRUE
       AND UPPER(TRIM(COALESCE(paid_by, ''))) = $1
     ORDER BY expense_date DESC, id DESC`,
    [normalized],
  );
  const trips = await query<TripRow>(`SELECT ${tripCols} FROM trips`);
  const tripById = new Map((trips as TripRow[]).map((t) => [t.id, t]));
  return (rows as TripExpenseRow[])
    .map((r) => {
      const trip = tripById.get(r.tripId);
      if (!trip) return null;
      return { ...r, trip };
    })
    .filter(Boolean) as Array<TripExpenseRow & { trip: TripRow }>;
}

export async function markTripReimbursementsPaid(
  expenseIds: number[],
  paymentId: number | null,
): Promise<void> {
  if (expenseIds.length === 0) return;
  const placeholders = expenseIds.map((_, i) => `$${i + 1}`).join(", ");
  await query(
    `UPDATE trip_expenses
     SET reimbursed_at = NOW(),
         reimbursed_by_payment_id = $${expenseIds.length + 1}
     WHERE id IN (${placeholders})`,
    [...expenseIds, paymentId],
  );
}

export async function getPendingTripReimbursementsForAdminWithTrip(): Promise<
  Array<TripExpenseRow & { trip: TripRow }>
> {
  const rows = await query<TripExpenseRow>(
    `SELECT ${tripExpenseCols}
     FROM trip_expenses
     WHERE reimbursable = TRUE
       AND reimbursed_at IS NULL
       AND rejected_at IS NULL
     ORDER BY created_at DESC, id DESC`,
  );
  const trips = await query<TripRow>(`SELECT ${tripCols} FROM trips`);
  const tripById = new Map((trips as TripRow[]).map((t) => [t.id, t]));
  return (rows as TripExpenseRow[])
    .map((r) => {
      const trip = tripById.get(r.tripId);
      if (!trip) return null;
      return { ...r, trip };
    })
    .filter(Boolean) as Array<TripExpenseRow & { trip: TripRow }>;
}

export async function approveTripReimbursement(id: number, actorName: string): Promise<void> {
  await query(
    `UPDATE trip_expenses
     SET approved_at = NOW(),
         approved_by = $2,
         rejected_at = NULL,
         rejected_by = NULL,
         rejection_note = NULL
     WHERE id = $1
       AND reimbursable = TRUE
       AND reimbursed_at IS NULL`,
    [id, actorName],
  );
}

export async function rejectTripReimbursement(
  id: number,
  actorName: string,
  rejectionNote: string | null,
): Promise<void> {
  await query(
    `UPDATE trip_expenses
     SET rejected_at = NOW(),
         rejected_by = $2,
         rejection_note = $3,
         approved_at = NULL,
         approved_by = NULL
     WHERE id = $1
       AND reimbursable = TRUE
       AND reimbursed_at IS NULL`,
    [id, actorName, rejectionNote],
  );
}

export async function getTripExpensesWithTrip(): Promise<Array<TripExpenseRow & { trip: TripRow }>> {
  const rows = await query<TripExpenseRow>(
    `SELECT ${tripExpenseCols} FROM trip_expenses ORDER BY expense_date DESC, id DESC`,
  );
  const trips = await query<TripRow>(`SELECT ${tripCols} FROM trips`);
  const tripsById = new Map((trips as TripRow[]).map((t) => [t.id, t]));
  const result: Array<TripExpenseRow & { trip: TripRow }> = [];
  for (const row of rows as TripExpenseRow[]) {
    const trip = tripsById.get(row.tripId);
    if (!trip) continue;
    result.push({ ...row, trip });
  }
  return result;
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
  role: string | null;
  region: string | null;
  gdriveRootFolderUrl: string | null;
};

export async function getAllFielderLogins(): Promise<FielderLoginRow[]> {
  const rows = await query<FielderLoginRow>(
    'SELECT id, email, password_hash AS "passwordHash", fielder_name AS "fielderName", role, region, gdrive_root_folder_url AS "gdriveRootFolderUrl" FROM fielder_logins ORDER BY id',
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
    'SELECT id, email, password_hash AS "passwordHash", fielder_name AS "fielderName", role, region, gdrive_root_folder_url AS "gdriveRootFolderUrl" FROM fielder_logins WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))',
    [email],
  );
  return row as FielderLoginRow | null ?? null;
}

export async function getFielderLoginByFielderName(fielderName: string): Promise<FielderLoginRow | null> {
  const normalized = fielderName.trim().toUpperCase();
  const row = await queryOne<FielderLoginRow>(
    'SELECT id, email, password_hash AS "passwordHash", fielder_name AS "fielderName", role, region, gdrive_root_folder_url AS "gdriveRootFolderUrl" FROM fielder_logins WHERE UPPER(TRIM(fielder_name)) = $1',
    [normalized],
  );
  return row as FielderLoginRow | null ?? null;
}

const BCRYPT_ROUNDS = 10;

export async function insertFielderLogin(input: {
  email: string;
  password: string;
  fielderName: string;
  role?: string | null;
  region?: string | null;
  gdriveRootFolderUrl?: string | null;
}): Promise<number> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const row = await queryOneRow<{ id: number }>(
    `INSERT INTO fielder_logins (email, password_hash, fielder_name, role, region, gdrive_root_folder_url)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      input.email.trim().toLowerCase(),
      passwordHash,
      input.fielderName.trim(),
      input.role ? input.role.trim() : null,
      input.region ? input.region.trim() : null,
      input.gdriveRootFolderUrl ? input.gdriveRootFolderUrl.trim() : null,
    ],
  );
  if (!row) throw new Error("insertFielderLogin failed");
  return row.id;
}

export async function updateFielderLoginMeta(
  id: number,
  role: string | null,
  region: string | null,
  gdriveRootFolderUrl: string | null,
): Promise<void> {
  await query(
    "UPDATE fielder_logins SET role = $2, region = $3, gdrive_root_folder_url = $4 WHERE id = $1",
    [id, role, region, gdriveRootFolderUrl],
  );
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

export type FielderNotificationItem = {
  id: string;
  type: "new_assignment" | "project_updated" | "payment" | "issue_resolved";
  message: string;
  projectId: number;
  projectCode: string;
  amount?: number;
  createdAt: string;
};

/** Notifications for the fielder app bell: new assignments, project updates, payments, issue resolved. */
export async function getFielderNotifications(
  fielderName: string,
  limit = 30,
): Promise<FielderNotificationItem[]> {
  const normalized = fielderName.trim().toUpperCase();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffStr = cutoff.toISOString();
  const items: FielderNotificationItem[] = [];

  const assignments = await getAssignmentsForFielderByName(fielderName);
  const projectIds = [...new Set(assignments.map((a) => a.projectId))];
  const assignmentIds = assignments.map((a) => a.id);
  if (projectIds.length === 0) return [];

  const projectIdList = projectIds.join(",");
  const assignmentIdList = assignmentIds.join(",");

  const assignmentRows = await query<{
    id: number;
    projectId: number;
    projectCode: string;
    createdAt: string;
  }>(
    `SELECT a.id, a.project_id AS "projectId", p.project_code AS "projectCode", a.created_at::text AS "createdAt"
     FROM assignments a
     JOIN projects p ON p.id = a.project_id
     WHERE UPPER(TRIM(a.fielder_name)) = $1 AND a.created_at >= $2::timestamptz
     ORDER BY a.created_at DESC LIMIT 15`,
    [normalized, cutoffStr],
  );
  for (const r of assignmentRows) {
    items.push({
      id: `assign-${r.id}`,
      type: "new_assignment",
      message: `You were assigned to ${r.projectCode}`,
      projectId: r.projectId,
      projectCode: r.projectCode,
      createdAt: r.createdAt,
    });
  }

  const auditRows = await query<{
    entityId: string;
    createdAt: string;
    projectCode: string;
  }>(
    `SELECT a.entity_id AS "entityId", a.created_at::text AS "createdAt", p.project_code AS "projectCode"
     FROM audit_log a
     LEFT JOIN projects p ON p.id = (a.entity_id::int)
     WHERE a.actor_type = 'admin' AND a.entity_type = 'project' AND a.action = 'project.update'
       AND (a.entity_id::int) IN (${projectIds.map((_, i) => `$${i + 1}`).join(",")})
       AND a.created_at >= $${projectIds.length + 1}::timestamptz
     ORDER BY a.created_at DESC LIMIT 15`,
    [...projectIds, cutoffStr],
  );
  for (const r of auditRows) {
    const projectId = parseInt(r.entityId, 10) || 0;
    if (!projectId) continue;
    items.push({
      id: `audit-${r.entityId}-${r.createdAt}`,
      type: "project_updated",
      message: `${r.projectCode} was updated`,
      projectId,
      projectCode: r.projectCode ?? `#${r.entityId}`,
      createdAt: r.createdAt,
    });
  }

  if (assignmentIdList) {
    const paymentRows = await query<{
      id: number;
      projectId: number;
      projectCode: string;
      amount: number;
      createdAt: string;
    }>(
      `SELECT py.id, py.project_id AS "projectId", p.project_code AS "projectCode", py.amount, py.created_at::text AS "createdAt"
       FROM payments py
       JOIN projects p ON p.id = py.project_id
       WHERE py.fielder_assignment_id IN (${assignmentIds.map((_, i) => `$${i + 1}`).join(",")})
         AND py.voided_at IS NULL AND py.created_at >= $${assignmentIds.length + 1}::timestamptz
       ORDER BY py.created_at DESC LIMIT 15`,
      [...assignmentIds, cutoffStr],
    );
    for (const r of paymentRows) {
      items.push({
        id: `pay-${r.id}`,
        type: "payment",
        message: `Payment received for ${r.projectCode}`,
        projectId: r.projectId,
        projectCode: r.projectCode,
        amount: Number(r.amount),
        createdAt: r.createdAt,
      });
    }
  }

  const issueRows = await query<{
    id: number;
    projectId: number;
    projectCode: string;
    resolvedAt: string;
  }>(
    `SELECT pi.id, pi.project_id AS "projectId", p.project_code AS "projectCode", pi.resolved_at::text AS "resolvedAt"
     FROM project_issues pi
     JOIN projects p ON p.id = pi.project_id
     WHERE pi.project_id IN (${projectIds.map((_, i) => `$${i + 1}`).join(",")})
       AND pi.resolved_at IS NOT NULL AND pi.resolved_at >= $${projectIds.length + 1}::timestamptz
     ORDER BY pi.resolved_at DESC LIMIT 15`,
    [...projectIds, cutoffStr],
  );
  for (const r of issueRows) {
    items.push({
      id: `issue-${r.id}`,
      type: "issue_resolved",
      message: `Issue resolved on ${r.projectCode}`,
      projectId: r.projectId,
      projectCode: r.projectCode,
      createdAt: r.resolvedAt,
    });
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items.slice(0, limit);
}

export async function getSettings(): Promise<SettingsRow> {
  const row = await queryOne<{
    usdToInrRate: number | null;
    adminPhone: string | null;
    emailIngestEnabled: boolean | null;
    emailIngestWebhookSecret: string | null;
    emailIngestAutoApprove: boolean | null;
    emailIngestAutoApproveMinConfidence: number | null;
  }>(
    `SELECT
      usd_to_inr_rate AS "usdToInrRate",
      admin_phone AS "adminPhone",
      email_ingest_enabled AS "emailIngestEnabled",
      email_ingest_webhook_secret AS "emailIngestWebhookSecret",
      email_ingest_auto_approve AS "emailIngestAutoApprove",
      email_ingest_auto_approve_min_confidence AS "emailIngestAutoApproveMinConfidence"
    FROM settings
    WHERE id = 1`,
  );
  return {
    usdToInrRate: row?.usdToInrRate ?? null,
    adminPhone: row?.adminPhone ?? null,
    emailIngestEnabled: !!row?.emailIngestEnabled,
    emailIngestWebhookSecret: row?.emailIngestWebhookSecret ?? null,
    emailIngestAutoApprove: !!row?.emailIngestAutoApprove,
    emailIngestAutoApproveMinConfidence: Number(
      row?.emailIngestAutoApproveMinConfidence ?? 0.95,
    ),
  };
}

export async function updateSettings(input: {
  usdToInrRate?: number | null;
  adminPhone?: string | null;
  emailIngestEnabled?: boolean;
  emailIngestWebhookSecret?: string | null;
  emailIngestAutoApprove?: boolean;
  emailIngestAutoApproveMinConfidence?: number;
}): Promise<void> {
  const current = await getSettings();
  const usdToInrRate = input.usdToInrRate !== undefined ? input.usdToInrRate : current.usdToInrRate;
  const adminPhone = input.adminPhone !== undefined ? input.adminPhone : current.adminPhone;
  const emailIngestEnabled =
    input.emailIngestEnabled !== undefined
      ? input.emailIngestEnabled
      : current.emailIngestEnabled;
  const emailIngestWebhookSecret =
    input.emailIngestWebhookSecret !== undefined
      ? input.emailIngestWebhookSecret
      : current.emailIngestWebhookSecret;
  const emailIngestAutoApprove =
    input.emailIngestAutoApprove !== undefined
      ? input.emailIngestAutoApprove
      : current.emailIngestAutoApprove;
  const emailIngestAutoApproveMinConfidence =
    input.emailIngestAutoApproveMinConfidence !== undefined
      ? input.emailIngestAutoApproveMinConfidence
      : current.emailIngestAutoApproveMinConfidence;
  await query(
    `UPDATE settings
     SET usd_to_inr_rate = $1,
         admin_phone = $2,
         email_ingest_enabled = $3,
         email_ingest_webhook_secret = $4,
         email_ingest_auto_approve = $5,
         email_ingest_auto_approve_min_confidence = $6
     WHERE id = 1`,
    [
      usdToInrRate,
      adminPhone ?? null,
      emailIngestEnabled,
      emailIngestWebhookSecret ?? null,
      emailIngestAutoApprove,
      emailIngestAutoApproveMinConfidence,
    ],
  );
}

export async function getEmailIngestRecordByFingerprint(
  fingerprint: string,
): Promise<EmailIngestRecordRow | undefined> {
  const row = await queryOne<EmailIngestRecordRow>(
    `SELECT ${emailIngestCols} FROM email_ingest_records WHERE fingerprint = $1`,
    [fingerprint],
  );
  return row as EmailIngestRecordRow | undefined;
}

export async function getEmailIngestRecordById(
  id: number,
): Promise<EmailIngestRecordRow | undefined> {
  const row = await queryOne<EmailIngestRecordRow>(
    `SELECT ${emailIngestCols} FROM email_ingest_records WHERE id = $1`,
    [id],
  );
  return row as EmailIngestRecordRow | undefined;
}

export async function insertEmailIngestRecord(input: {
  source: string;
  externalMessageId: string;
  fingerprint: string;
  senderEmail: string | null;
  senderName: string | null;
  subject: string | null;
  receivedAt: string;
  rawPayload: Record<string, unknown>;
  parsedPayload: CanonicalEmailPayload;
  entityType: CanonicalEntityType;
  confidence: number;
}): Promise<EmailIngestRecordRow> {
  const row = await queryOneRow<EmailIngestRecordRow>(
    `INSERT INTO email_ingest_records (
      source, external_message_id, fingerprint, sender_email, sender_name, subject, received_at,
      raw_payload, parsed_payload, entity_type, confidence, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9, $10, $11, 'PENDING_REVIEW')
    ON CONFLICT (fingerprint) DO UPDATE
      SET updated_at = NOW()
    RETURNING ${emailIngestCols}`,
    [
      input.source,
      input.externalMessageId,
      input.fingerprint,
      input.senderEmail,
      input.senderName,
      input.subject,
      input.receivedAt,
      JSON.stringify(input.rawPayload),
      JSON.stringify(input.parsedPayload),
      input.entityType,
      input.confidence,
    ],
  );
  if (!row) throw new Error("insertEmailIngestRecord failed");
  return row as EmailIngestRecordRow;
}

export async function listEmailIngestRecords(filters?: {
  status?: EmailIngestStatus | "ALL";
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<EmailIngestRecordRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters?.status && filters.status !== "ALL") {
    params.push(filters.status);
    where.push(`status = $${params.length}`);
  }
  if (filters?.q) {
    params.push(`%${filters.q.toLowerCase()}%`);
    where.push(
      `(LOWER(COALESCE(subject, '')) LIKE $${params.length}
        OR LOWER(COALESCE(sender_email, '')) LIKE $${params.length}
        OR LOWER(COALESCE(parsed_payload->>'fielderName', '')) LIKE $${params.length}
        OR LOWER(COALESCE(parsed_payload->>'projectCode', '')) LIKE $${params.length})`,
    );
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(filters?.limit ?? 100);
  params.push(filters?.offset ?? 0);
  const rows = await query<EmailIngestRecordRow>(
    `SELECT ${emailIngestCols}
     FROM email_ingest_records
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1}
     OFFSET $${params.length}`,
    params,
  );
  return rows as EmailIngestRecordRow[];
}

export async function countEmailIngestRecords(filters?: {
  status?: EmailIngestStatus | "ALL";
  q?: string;
}): Promise<number> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters?.status && filters.status !== "ALL") {
    params.push(filters.status);
    where.push(`status = $${params.length}`);
  }
  if (filters?.q) {
    params.push(`%${filters.q.toLowerCase()}%`);
    where.push(
      `(LOWER(COALESCE(subject, '')) LIKE $${params.length}
        OR LOWER(COALESCE(sender_email, '')) LIKE $${params.length}
        OR LOWER(COALESCE(parsed_payload->>'fielderName', '')) LIKE $${params.length}
        OR LOWER(COALESCE(parsed_payload->>'projectCode', '')) LIKE $${params.length})`,
    );
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM email_ingest_records ${whereSql}`,
    params,
  );
  return Number(row?.count ?? 0);
}

export async function markEmailIngestRecordRejected(input: {
  id: number;
  actorName: string;
  reason: string | null;
}): Promise<void> {
  await query(
    `UPDATE email_ingest_records
     SET status = 'REJECTED',
         rejected_at = NOW(),
         rejected_by = $2,
         rejection_reason = $3,
         updated_at = NOW(),
         last_processed_at = NOW()
     WHERE id = $1`,
    [input.id, input.actorName, input.reason],
  );
}

export async function markEmailIngestRecordProcessing(id: number): Promise<void> {
  await query(
    `UPDATE email_ingest_records
     SET status = 'PROCESSING',
         updated_at = NOW(),
         last_error = NULL
     WHERE id = $1`,
    [id],
  );
}

export async function updateEmailIngestParsedPayload(input: {
  id: number;
  parsedPayload: CanonicalEmailPayload;
  entityType: CanonicalEntityType;
  confidence: number;
}): Promise<void> {
  await query(
    `UPDATE email_ingest_records
     SET parsed_payload = $2,
         entity_type = $3,
         confidence = $4,
         updated_at = NOW()
     WHERE id = $1`,
    [input.id, JSON.stringify(input.parsedPayload), input.entityType, input.confidence],
  );
}

export async function markEmailIngestRecordApproved(input: {
  id: number;
  actorName: string;
  createdEntityType: string;
  createdEntityId: string;
  normalizedPayload: Record<string, unknown>;
}): Promise<void> {
  await query(
    `UPDATE email_ingest_records
     SET status = 'APPROVED',
         approved_at = NOW(),
         approved_by = $2,
         created_entity_type = $3,
         created_entity_id = $4,
         normalized_payload = $5,
         updated_at = NOW(),
         last_processed_at = NOW(),
         next_attempt_at = NULL,
         last_error = NULL
     WHERE id = $1`,
    [
      input.id,
      input.actorName,
      input.createdEntityType,
      input.createdEntityId,
      JSON.stringify(input.normalizedPayload),
    ],
  );
}

export async function markEmailIngestRecordRetryableFailure(input: {
  id: number;
  retries: number;
  error: string;
  nextAttemptAt: string;
}): Promise<void> {
  await query(
    `UPDATE email_ingest_records
     SET status = 'FAILED_RETRYABLE',
         retries = $2,
         last_error = $3,
         next_attempt_at = $4::timestamptz,
         updated_at = NOW(),
         last_processed_at = NOW()
     WHERE id = $1`,
    [input.id, input.retries, input.error, input.nextAttemptAt],
  );
}

export async function markEmailIngestRecordFatalFailure(input: {
  id: number;
  error: string;
}): Promise<void> {
  await query(
    `UPDATE email_ingest_records
     SET status = 'FAILED_FATAL',
         last_error = $2,
         next_attempt_at = NULL,
         updated_at = NOW(),
         last_processed_at = NOW()
     WHERE id = $1`,
    [input.id, input.error],
  );
}

export async function getDueRetryableEmailIngestRecords(
  limit = 25,
): Promise<EmailIngestRecordRow[]> {
  const rows = await query<EmailIngestRecordRow>(
    `SELECT ${emailIngestCols}
     FROM email_ingest_records
     WHERE status = 'FAILED_RETRYABLE'
       AND next_attempt_at IS NOT NULL
       AND next_attempt_at <= NOW()
     ORDER BY next_attempt_at ASC
     LIMIT $1`,
    [limit],
  );
  return rows as EmailIngestRecordRow[];
}

export async function getEmailIngestQueueStats(): Promise<{
  pendingReview: number;
  failedRetryable: number;
  failedFatal: number;
  processedLast24h: number;
}> {
  const row = await queryOne<{
    pendingReview: string;
    failedRetryable: string;
    failedFatal: string;
    processedLast24h: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'PENDING_REVIEW')::text AS "pendingReview",
       COUNT(*) FILTER (WHERE status = 'FAILED_RETRYABLE')::text AS "failedRetryable",
       COUNT(*) FILTER (WHERE status = 'FAILED_FATAL')::text AS "failedFatal",
       COUNT(*) FILTER (
         WHERE status = 'APPROVED'
           AND last_processed_at >= NOW() - INTERVAL '24 hours'
       )::text AS "processedLast24h"
     FROM email_ingest_records`,
  );
  return {
    pendingReview: Number(row?.pendingReview ?? 0),
    failedRetryable: Number(row?.failedRetryable ?? 0),
    failedFatal: Number(row?.failedFatal ?? 0),
    processedLast24h: Number(row?.processedLast24h ?? 0),
  };
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

export async function hasRecentIdempotencyKey(input: {
  actorType: "admin" | "fielder";
  actorName: string;
  action: string;
  idempotencyKey: string;
  withinMinutes?: number;
}): Promise<boolean> {
  const minutes = input.withinMinutes ?? 10;
  const row = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1
      FROM audit_log
      WHERE actor_type = $1
        AND actor_name = $2
        AND action = $3
        AND details->>'idempotencyKey' = $4
        AND created_at >= NOW() - ($5::text || ' minutes')::interval
    ) AS "exists"`,
    [input.actorType, input.actorName, input.action, input.idempotencyKey, String(minutes)],
  );
  return !!row?.exists;
}

export async function getRecentAuditByIdempotencyKey(input: {
  actorType: "admin" | "fielder";
  actorName: string;
  action: string;
  idempotencyKey: string;
  withinMinutes?: number;
}): Promise<AuditLogRow | undefined> {
  const minutes = input.withinMinutes ?? 10;
  const row = await queryOne<AuditLogRow>(
    `SELECT id, actor_type AS "actorType", actor_name AS "actorName", action, entity_type AS "entityType",
      entity_id AS "entityId", details, created_at::text AS "createdAt"
     FROM audit_log
     WHERE actor_type = $1
       AND actor_name = $2
       AND action = $3
       AND details->>'idempotencyKey' = $4
       AND created_at >= NOW() - ($5::text || ' minutes')::interval
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.actorType, input.actorName, input.action, input.idempotencyKey, String(minutes)],
  );
  return row as AuditLogRow | undefined;
}

export type NotificationItem = {
  id: string;
  type: "issue" | "status";
  message: string;
  projectCode: string;
  projectId: number;
  actorName: string;
  createdAt: string;
};

/** Fetches recent fielder activity: issues and status updates. Used for notifications bell. */
export async function getRecentNotifications(limit = 30): Promise<NotificationItem[]> {
  const items: NotificationItem[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString();

  const issueRows = await query<{
    id: number;
    projectId: number;
    projectCode: string;
    reportedBy: string;
    description: string;
    createdAt: string;
  }>(
    `SELECT pi.id, pi.project_id AS "projectId", p.project_code AS "projectCode",
            pi.reported_by AS "reportedBy", pi.description,
            pi.created_at::text AS "createdAt"
     FROM project_issues pi
     JOIN projects p ON p.id = pi.project_id
     WHERE pi.resolved_at IS NULL AND pi.created_at >= $1::timestamptz
     ORDER BY pi.created_at DESC LIMIT $2`,
    [cutoffStr, Math.ceil(limit / 2)],
  );

  for (const r of issueRows) {
    items.push({
      id: `issue-${r.id}`,
      type: "issue",
      message: r.description.length > 80 ? r.description.slice(0, 80) + "…" : r.description,
      projectCode: r.projectCode,
      projectId: r.projectId,
      actorName: r.reportedBy,
      createdAt: r.createdAt,
    });
  }

  const auditRows = await query<{
    id: number;
    actorName: string;
    entityId: string;
    details: string | null;
    createdAt: string;
    projectCode: string;
  }>(
    `SELECT a.id, a.actor_name AS "actorName", a.entity_id AS "entityId", a.details,
            a.created_at::text AS "createdAt", p.project_code AS "projectCode"
     FROM audit_log a
     LEFT JOIN projects p ON p.id = (a.entity_id::int)
     WHERE a.actor_type = 'fielder' AND a.entity_type = 'project'
       AND a.action = 'project.update'
       AND a.created_at >= $1::timestamptz
       AND a.details IS NOT NULL
     ORDER BY a.created_at DESC LIMIT $2`,
    [cutoffStr, limit],
  );

  for (const r of auditRows) {
    let details: Record<string, unknown> = {};
    try {
      if (r.details) details = JSON.parse(r.details) as Record<string, unknown>;
    } catch {
      // ignore
    }
    if (details.issue) continue;
    const statusInfo = details.status as { old?: string; new?: string } | undefined;
    const newStatus = statusInfo?.new ?? "";
    if (!newStatus) continue;
    const statusLabel = newStatus.replace(/_/g, " ");
    items.push({
      id: `audit-${r.id}`,
      type: "status",
      message: `marked as ${statusLabel}`,
      projectCode: r.projectCode ?? `#${r.entityId}`,
      projectId: parseInt(r.entityId, 10) || 0,
      actorName: r.actorName,
      createdAt: r.createdAt,
    });
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items.slice(0, limit);
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
  fielderLogins?: Array<{
    id: number;
    email: string;
    passwordHash: string;
    fielderName: string;
    role?: string | null;
    region?: string | null;
    gdriveRootFolderUrl?: string | null;
  }>;
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
      gdriveFolderUrl: row.gdriveFolderUrl != null ? String(row.gdriveFolderUrl) : row.gdrive_folder_url != null ? String(row.gdrive_folder_url) : null,
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
    settings: {
      usdToInrRate: legacy.settings?.usdToInrRate ?? null,
      adminPhone: null,
      emailIngestEnabled: false,
      emailIngestWebhookSecret: null,
      emailIngestAutoApprove: false,
      emailIngestAutoApproveMinConfidence: 0.95,
    },
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
    await client.query("DELETE FROM trip_expenses");
    await client.query("DELETE FROM trips");
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
      `INSERT INTO projects (id, project_code, client_name, location, total_sqft, company_rate_per_sqft, status, ecd, notes, qfield, invoice_number, gdrive_folder_url, created_at, updated_at, archived_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14::timestamptz, $15::timestamptz)`,
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
        p.gdriveFolderUrl ?? null,
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

    await client.query(
      "UPDATE settings SET usd_to_inr_rate = $1, admin_phone = $2 WHERE id = 1",
      [backup.settings.usdToInrRate, backup.settings.adminPhone ?? null],
    );

    const logins = backup.fielderLogins ?? [];
    for (const f of logins) {
      await client.query(
        `INSERT INTO fielder_logins (id, email, password_hash, fielder_name, role, region, gdrive_root_folder_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          f.id,
          f.email,
          f.passwordHash,
          f.fielderName,
          (f as { role?: string | null }).role ?? null,
          (f as { region?: string | null }).region ?? null,
          (f as { gdriveRootFolderUrl?: string | null }).gdriveRootFolderUrl ?? null,
        ],
      );
    }

    const seqQueries = [
      "SELECT setval(pg_get_serial_sequence('projects', 'id'), COALESCE((SELECT MAX(id) FROM projects), 1))",
      "SELECT setval(pg_get_serial_sequence('assignments', 'id'), COALESCE((SELECT MAX(id) FROM assignments), 1))",
      "SELECT setval(pg_get_serial_sequence('payments', 'id'), COALESCE((SELECT MAX(id) FROM payments), 1))",
      "SELECT setval(pg_get_serial_sequence('trips', 'id'), COALESCE((SELECT MAX(id) FROM trips), 1))",
      "SELECT setval(pg_get_serial_sequence('trip_expenses', 'id'), COALESCE((SELECT MAX(id) FROM trip_expenses), 1))",
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
    "SELECT setval(pg_get_serial_sequence('trips', 'id'), COALESCE((SELECT MAX(id) FROM trips), 1))",
    "SELECT setval(pg_get_serial_sequence('trip_expenses', 'id'), COALESCE((SELECT MAX(id) FROM trip_expenses), 1))",
    "SELECT setval(pg_get_serial_sequence('additional_work', 'id'), COALESCE((SELECT MAX(id) FROM additional_work), 1))",
    "SELECT setval(pg_get_serial_sequence('activity_log', 'id'), COALESCE((SELECT MAX(id) FROM activity_log), 1))",
    "SELECT setval(pg_get_serial_sequence('audit_log', 'id'), COALESCE((SELECT MAX(id) FROM audit_log), 1))",
    "SELECT setval(pg_get_serial_sequence('fielder_logins', 'id'), COALESCE((SELECT MAX(id) FROM fielder_logins), 1))",
    "SELECT setval(pg_get_serial_sequence('invoices', 'id'), COALESCE((SELECT MAX(id) FROM invoices), 1))",
    "SELECT setval(pg_get_serial_sequence('invoice_line_items', 'id'), COALESCE((SELECT MAX(id) FROM invoice_line_items), 1))",
  ];
  for (const sql of seqQueries) {
    await pool.query(sql);
  }
}

// --- Invoices (billing records) ---

export type InvoiceRow = {
  id: number;
  invoiceNumber: string;
  clientName: string;
  issueDate: string;
  dueDate: string | null;
  notes: string | null;
  status: string;
  source: string;
  importFilename: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceLineItemRow = {
  id: number;
  invoiceId: number;
  projectCode: string;
  clientName: string | null;
  totalSqft: number;
  ratePerSqft: number;
  projectId: number | null;
  sortOrder: number;
};

const invoiceCols = `
  id, invoice_number AS "invoiceNumber", client_name AS "clientName",
  issue_date AS "issueDate", due_date AS "dueDate", notes, status, source,
  import_filename AS "importFilename",
  created_at::text AS "createdAt", updated_at::text AS "updatedAt"
`;

const invoiceLineCols = `
  id, invoice_id AS "invoiceId", project_code AS "projectCode",
  client_name AS "clientName", total_sqft AS "totalSqft",
  rate_per_sqft AS "ratePerSqft", project_id AS "projectId", sort_order AS "sortOrder"
`;

export function invoiceLineRevenue(line: Pick<InvoiceLineItemRow, "totalSqft" | "ratePerSqft">): number {
  return line.totalSqft * Number(line.ratePerSqft);
}

export async function getAllInvoices(): Promise<InvoiceRow[]> {
  const rows = await query<InvoiceRow>(
    `SELECT ${invoiceCols} FROM invoices ORDER BY created_at DESC`,
  );
  return rows as InvoiceRow[];
}

export type InvoiceSummary = InvoiceRow & {
  lineCount: number;
  totalRevenue: number;
};

export async function getAllInvoiceSummaries(): Promise<InvoiceSummary[]> {
  const rows = await query<InvoiceSummary & { lineCount: string; totalRevenue: string }>(
    `SELECT i.id, i.invoice_number AS "invoiceNumber", i.client_name AS "clientName",
            i.issue_date AS "issueDate", i.due_date AS "dueDate", i.notes, i.status, i.source,
            i.import_filename AS "importFilename",
            i.created_at::text AS "createdAt", i.updated_at::text AS "updatedAt",
            COUNT(l.id)::int AS "lineCount",
            COALESCE(SUM(l.total_sqft * l.rate_per_sqft), 0)::float AS "totalRevenue"
     FROM invoices i
     LEFT JOIN invoice_line_items l ON l.invoice_id = i.id
     GROUP BY i.id
     ORDER BY i.created_at DESC`,
  );
  return rows.map((r) => ({
    ...(r as InvoiceRow),
    lineCount: Number(r.lineCount),
    totalRevenue: Number(r.totalRevenue),
  }));
}

export async function getInvoiceById(id: number): Promise<InvoiceRow | undefined> {
  const row = await queryOne<InvoiceRow>(
    `SELECT ${invoiceCols} FROM invoices WHERE id = $1`,
    [id],
  );
  return row as InvoiceRow | undefined;
}

export async function getInvoiceLineItemsByInvoiceId(invoiceId: number): Promise<InvoiceLineItemRow[]> {
  const rows = await query<InvoiceLineItemRow>(
    `SELECT ${invoiceLineCols} FROM invoice_line_items WHERE invoice_id = $1 ORDER BY sort_order ASC, id ASC`,
    [invoiceId],
  );
  return rows.map((r) => ({
    ...r,
    totalSqft: Number(r.totalSqft),
    ratePerSqft: Number(r.ratePerSqft),
  })) as InvoiceLineItemRow[];
}

export async function getInvoiceWithLines(id: number): Promise<
  | { invoice: InvoiceRow; lines: InvoiceLineItemRow[] }
  | undefined
> {
  const invoice = await getInvoiceById(id);
  if (!invoice) return undefined;
  const lines = await getInvoiceLineItemsByInvoiceId(id);
  return { invoice, lines };
}

export async function suggestNextInvoiceNumber(): Promise<string> {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-`;
  const rows = await query<{ invoiceNumber: string }>(
    `SELECT invoice_number AS "invoiceNumber" FROM invoices WHERE invoice_number LIKE $1 ORDER BY invoice_number DESC LIMIT 1`,
    [`${prefix}%`],
  );
  if (rows.length === 0) return `${prefix}001`;
  const last = rows[0]!.invoiceNumber;
  const suffix = last.slice(prefix.length);
  const num = parseInt(suffix, 10);
  const next = Number.isNaN(num) ? 1 : num + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export async function createInvoiceWithLines(input: {
  invoiceNumber: string;
  clientName: string;
  issueDate: string;
  dueDate?: string | null;
  notes?: string | null;
  status?: string;
  source?: string;
  importFilename?: string | null;
  lines: Array<{
    projectCode: string;
    clientName?: string | null;
    totalSqft: number;
    ratePerSqft: number;
    projectId?: number | null;
  }>;
}): Promise<{ invoice: InvoiceRow; lines: InvoiceLineItemRow[] }> {
  const invoiceRow = await queryOneRow<InvoiceRow>(
    `INSERT INTO invoices (invoice_number, client_name, issue_date, due_date, notes, status, source, import_filename)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${invoiceCols}`,
    [
      input.invoiceNumber.trim(),
      input.clientName.trim(),
      input.issueDate,
      input.dueDate ?? null,
      input.notes ?? null,
      input.status ?? "draft",
      input.source ?? "manual",
      input.importFilename ?? null,
    ],
  );
  if (!invoiceRow) throw new Error("createInvoiceWithLines: insert invoice failed");
  const invoice = invoiceRow as InvoiceRow;
  const lines: InvoiceLineItemRow[] = [];
  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i]!;
    const row = await queryOneRow<InvoiceLineItemRow>(
      `INSERT INTO invoice_line_items (invoice_id, project_code, client_name, total_sqft, rate_per_sqft, project_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${invoiceLineCols}`,
      [
        invoice.id,
        line.projectCode,
        line.clientName ?? null,
        line.totalSqft,
        line.ratePerSqft,
        line.projectId ?? null,
        i,
      ],
    );
    if (!row) throw new Error("createInvoiceWithLines: insert line failed");
    lines.push({
      ...(row as InvoiceLineItemRow),
      totalSqft: Number(row.totalSqft),
      ratePerSqft: Number(row.ratePerSqft),
    });
  }
  await insertActivity({
    type: "invoice_created",
    description: `Created invoice ${invoice.invoiceNumber} (${lines.length} line${lines.length !== 1 ? "s" : ""})`,
    metadata: { invoiceId: invoice.id },
  });
  return { invoice, lines };
}
