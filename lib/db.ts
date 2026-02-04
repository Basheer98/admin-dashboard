import fs from "node:fs";
import path from "node:path";
import { getDataPath } from "./dataPath";
import { normalizeProjectCode } from "./normalize";

// Simple JSON-file persistence. Use DATA_PATH env in production for a mounted volume.

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

type DbShape = {
  projects: ProjectRow[];
  assignments: FielderAssignmentRow[];
  payments: PaymentRow[];
  additionalWork: AdditionalWorkRow[];
  settings: SettingsRow;
  activityLog: ActivityRow[];
  nextProjectId: number;
  nextAssignmentId: number;
  nextPaymentId: number;
  nextAdditionalWorkId: number;
  nextActivityId: number;
};

const defaultSettings: SettingsRow = { usdToInrRate: null };

function loadDb(): DbShape {
  const dataPath = getDataPath();
  if (!fs.existsSync(dataPath)) {
    const empty: DbShape = {
      projects: [],
      assignments: [],
      payments: [],
      additionalWork: [],
      settings: defaultSettings,
      activityLog: [],
      nextProjectId: 1,
      nextAssignmentId: 1,
      nextPaymentId: 1,
      nextAdditionalWorkId: 1,
      nextActivityId: 1,
    };
    fs.writeFileSync(dataPath, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
  const raw = fs.readFileSync(dataPath, "utf8");
  try {
    const parsed = JSON.parse(raw) as DbShape & { settings?: SettingsRow; activityLog?: ActivityRow[]; nextActivityId?: number };
    const settings = parsed.settings ?? defaultSettings;
    const activityLog = (parsed.activityLog ?? []).map((a) => ({
      id: a.id,
      type: a.type,
      description: a.description,
      createdAt: a.createdAt,
      metadata: a.metadata ?? undefined,
    }));
    return {
      projects: (parsed.projects ?? []).map((p) => ({
        ...p,
        ecd: (p as any).ecd ?? null,
        archivedAt: (p as any).archivedAt ?? null,
      })),
      assignments: (parsed.assignments ?? []).map((a) => ({
        ...a,
        isInternal: (a as any).isInternal ?? false,
        dueDate: (a as any).dueDate ?? null,
        archivedAt: (a as any).archivedAt ?? null,
      })),
      payments: (parsed.payments ?? []).map((p) => ({
        ...p,
        voidedAt: (p as any).voidedAt ?? null,
      })),
      additionalWork: (parsed.additionalWork ?? []).map((w: any) => ({
        ...w,
        ourProjectId: w.ourProjectId ?? null,
        assignedFielderAssignmentId: w.assignedFielderAssignmentId ?? null,
        distance: w.distance ?? null,
        rateForEntireJob: w.rateForEntireJob ?? null,
        amount: w.amount ?? null,
        dueDate: w.dueDate ?? null,
        completedAt: w.completedAt ?? null,
        updatedAt: w.updatedAt ?? w.createdAt ?? new Date().toISOString(),
      })),
      settings: {
        usdToInrRate: settings.usdToInrRate ?? null,
      },
      activityLog,
      nextProjectId: parsed.nextProjectId ?? 1,
      nextAssignmentId: parsed.nextAssignmentId ?? 1,
      nextPaymentId: parsed.nextPaymentId ?? 1,
      nextAdditionalWorkId: parsed.nextAdditionalWorkId ?? 1,
      nextActivityId: parsed.nextActivityId ?? 1,
    };
  } catch {
    const empty: DbShape = {
      projects: [],
      assignments: [],
      payments: [],
      additionalWork: [],
      settings: defaultSettings,
      activityLog: [],
      nextProjectId: 1,
      nextAssignmentId: 1,
      nextPaymentId: 1,
      nextAdditionalWorkId: 1,
      nextActivityId: 1,
    };
    fs.writeFileSync(dataPath, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
}

function saveDb(db: DbShape): void {
  fs.writeFileSync(getDataPath(), JSON.stringify(db, null, 2), "utf8");
}

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
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
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

export function getAllProjects(options?: ListProjectsOptions): ProjectRow[] {
  const db = loadDb();
  let list = db.projects;
  if (!options?.includeArchived) {
    list = list.filter((p) => !p.archivedAt);
  }
  return [...list].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}

export function getAllAssignments(options?: ListAssignmentsOptions): FielderAssignmentRow[] {
  const db = loadDb();
  let list = db.assignments;
  if (!options?.includeArchived) {
    list = list.filter((a) => !a.archivedAt);
  }
  return [...list].sort((a, b) => b.id - a.id);
}

export function getAllPayments(options?: ListPaymentsOptions): PaymentRow[] {
  const db = loadDb();
  let list = db.payments;
  if (!options?.includeVoided) {
    list = list.filter((p) => !p.voidedAt);
  }
  return [...list].sort((a, b) =>
    a.paymentDate < b.paymentDate ? 1 : -1,
  );
}

export function insertProject(input: {
  projectCode: string;
  clientName: string;
  location: string;
  totalSqft: number;
  companyRatePerSqft: number;
  status: string;
  ecd?: string | null;
  notes: string | null;
}): ProjectRow {
  const db = loadDb();
  const now = new Date().toISOString();
  const project: ProjectRow = {
    id: db.nextProjectId++,
    projectCode: input.projectCode,
    clientName: input.clientName,
    location: input.location,
    totalSqft: input.totalSqft,
    companyRatePerSqft: input.companyRatePerSqft,
    status: input.status,
    ecd: input.ecd ?? null,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  db.projects.push(project);
  saveDb(db);
  insertActivity({
    type: "project_created",
    description: `Created project ${project.projectCode} (${project.clientName})`,
    metadata: { projectId: project.id },
  });
  return project;
}

export function updateProject(id: number, input: {
  projectCode: string;
  clientName: string;
  location: string;
  totalSqft: number;
  companyRatePerSqft: number;
  status: string;
  ecd?: string | null;
  notes: string | null;
  archivedAt?: string | null;
}): void {
  const db = loadDb();
  const idx = db.projects.findIndex((p) => p.id === id);
  if (idx === -1) return;
  const existing = db.projects[idx];
  db.projects[idx] = {
    ...existing,
    ...input,
    ecd: input.ecd !== undefined ? input.ecd : existing.ecd,
    archivedAt: input.archivedAt !== undefined ? input.archivedAt : existing.archivedAt,
    updatedAt: new Date().toISOString(),
  };
  saveDb(db);
}

export function archiveProject(id: number): void {
  const before = getProjectById(id);
  updateProject(id, {
    ...getProjectById(id)!,
    archivedAt: new Date().toISOString(),
  });
  if (before) {
    insertActivity({
      type: "project_archived",
      description: `Archived project ${before.projectCode} (${before.clientName})`,
      metadata: { projectId: id },
    });
  }
}

export function unarchiveProject(id: number): void {
  const p = getProjectById(id);
  if (!p) return;
  const db = loadDb();
  const idx = db.projects.findIndex((x) => x.id === id);
  if (idx === -1) return;
  db.projects[idx] = { ...db.projects[idx], archivedAt: null, updatedAt: new Date().toISOString() };
  saveDb(db);
  insertActivity({
    type: "project_unarchived",
    description: `Unarchived project ${p.projectCode} (${p.clientName})`,
    metadata: { projectId: id },
  });
}

export function deleteProject(id: number): void {
  const db = loadDb();

  const projectIdx = db.projects.findIndex((p) => p.id === id);
  if (projectIdx === -1) return;

  // Remove project
  db.projects.splice(projectIdx, 1);

  // Remove assignments for this project
  const removedAssignmentIds = new Set(
    db.assignments.filter((a) => a.projectId === id).map((a) => a.id),
  );
  db.assignments = db.assignments.filter((a) => a.projectId !== id);

  // Remove payments for this project OR for removed assignments
  db.payments = db.payments.filter(
    (p) => p.projectId !== id && !removedAssignmentIds.has(p.fielderAssignmentId),
  );

  saveDb(db);
}

export function archiveAssignment(id: number): void {
  const db = loadDb();
  const idx = db.assignments.findIndex((a) => a.id === id);
  if (idx === -1) return;
  const a = db.assignments[idx];
  const project = db.projects.find((p) => p.id === a.projectId);
  db.assignments[idx] = {
    ...db.assignments[idx],
    archivedAt: new Date().toISOString(),
  };
  saveDb(db);
  insertActivity({
    type: "assignment_archived",
    description: `Archived assignment: ${a.fielderName} (${project?.projectCode ?? "project"})`,
    metadata: { assignmentId: id, fielderName: a.fielderName, projectId: a.projectId },
  });
}

export function unarchiveAssignment(id: number): void {
  const db = loadDb();
  const idx = db.assignments.findIndex((a) => a.id === id);
  if (idx === -1) return;
  const a = db.assignments[idx];
  const project = db.projects.find((p) => p.id === a.projectId);
  db.assignments[idx] = {
    ...db.assignments[idx],
    archivedAt: null,
  };
  saveDb(db);
  insertActivity({
    type: "assignment_unarchived",
    description: `Unarchived assignment: ${a.fielderName} (${project?.projectCode ?? "project"})`,
    metadata: { assignmentId: id, fielderName: a.fielderName, projectId: a.projectId },
  });
}

export function deleteAssignment(id: number): void {
  const db = loadDb();

  const idx = db.assignments.findIndex((a) => a.id === id);
  if (idx === -1) return;

  // Remove assignment
  db.assignments.splice(idx, 1);

  // Remove payments linked to this assignment
  db.payments = db.payments.filter((p) => p.fielderAssignmentId !== id);

  saveDb(db);
}

export function getProjectById(id: number): ProjectRow | undefined {
  const db = loadDb();
  return db.projects.find((p) => p.id === id);
}

export function getProjectByCode(projectCode: string): ProjectRow | undefined {
  const db = loadDb();
  const normalized = normalizeProjectCode(projectCode.trim());
  if (!normalized) return undefined;
  return db.projects.find((p) => p.projectCode === normalized);
}

export function getAssignmentsByProjectId(
  projectId: number,
  options?: { includeArchived?: boolean },
): FielderAssignmentRow[] {
  const db = loadDb();
  let list = db.assignments.filter((a) => a.projectId === projectId);
  if (!options?.includeArchived) {
    list = list.filter((a) => !a.archivedAt);
  }
  return list;
}

export function getAllAdditionalWork(): AdditionalWorkRow[] {
  const db = loadDb();
  return [...db.additionalWork].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function getAdditionalWorkById(id: number): (AdditionalWorkRow & { project?: ProjectRow; assignedAssignment?: FielderAssignmentRow }) | undefined {
  const db = loadDb();
  const row = db.additionalWork.find((w) => w.id === id);
  if (!row) return undefined;
  const project = row.ourProjectId ? db.projects.find((p) => p.id === row.ourProjectId) : undefined;
  const assignedAssignment = row.assignedFielderAssignmentId
    ? db.assignments.find((a) => a.id === row.assignedFielderAssignmentId)
    : undefined;
  return { ...row, project, assignedAssignment };
}

export function insertAdditionalWork(input: {
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
}): AdditionalWorkRow {
  const db = loadDb();
  const now = new Date().toISOString();
  const row: AdditionalWorkRow = {
    id: db.nextAdditionalWorkId++,
    type: input.type,
    projectNumber: input.projectNumber,
    ourProjectId: input.ourProjectId,
    assignedFielderAssignmentId: input.assignedFielderAssignmentId,
    distance: input.distance,
    rateForEntireJob: input.rateForEntireJob,
    amount: input.amount,
    dueDate: input.dueDate,
    completedAt: input.completedAt,
    status: input.status,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  db.additionalWork.push(row);
  saveDb(db);
  insertActivity({
    type: "additional_work_created",
    description: `${input.type === "CORRECTION" ? "Correction" : "Additional fielding"} for project ${input.projectNumber}`,
    metadata: { additionalWorkId: row.id, type: input.type },
  });
  return row;
}

export function updateAdditionalWork(id: number, input: {
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
}): void {
  const db = loadDb();
  const idx = db.additionalWork.findIndex((w) => w.id === id);
  if (idx === -1) return;
  const existing = db.additionalWork[idx];
  db.additionalWork[idx] = {
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  saveDb(db);
}

/** Normalize all assignment fielder names to UPPERCASE so "naveen" and "Naveen" become "NAVEEN". */
export function normalizeAllFielderNames(): number {
  const db = loadDb();
  let count = 0;
  for (const a of db.assignments) {
    const normalized = a.fielderName.trim().toUpperCase();
    if (a.fielderName !== normalized) {
      a.fielderName = normalized;
      count++;
    }
  }
  if (count > 0) saveDb(db);
  return count;
}

export function insertAssignment(input: {
  projectId: number;
  fielderName: string;
  ratePerSqft: number;
  commissionPercentage: number | null;
  isInternal?: boolean;
  managedByFielderId?: number | null;
  managerRatePerSqft?: number | null;
  managerCommissionShare?: number | null;
  dueDate?: string | null;
}): number {
  const db = loadDb();
  const id = db.nextAssignmentId++;
  const assignment: FielderAssignmentRow = {
    id,
    projectId: input.projectId,
    fielderName: input.fielderName,
    ratePerSqft: input.ratePerSqft,
    commissionPercentage: input.commissionPercentage,
    isInternal: input.isInternal ?? false,
    managedByFielderId: input.managedByFielderId ?? null,
    managerRatePerSqft: input.managerRatePerSqft ?? null,
    managerCommissionShare: input.managerCommissionShare ?? null,
    dueDate: input.dueDate ?? null,
    archivedAt: null,
  };
  db.assignments.push(assignment);
  saveDb(db);
  return id;
}

export function updateAssignment(id: number, input: {
  ratePerSqft: number;
  commissionPercentage: number | null;
  isInternal?: boolean;
  managedByFielderId?: number | null;
  managerRatePerSqft?: number | null;
  managerCommissionShare?: number | null;
  dueDate?: string | null;
  archivedAt?: string | null;
}): void {
  const db = loadDb();
  const idx = db.assignments.findIndex((a) => a.id === id);
  if (idx === -1) return;
  const existing = db.assignments[idx];
  db.assignments[idx] = {
    ...existing,
    ...input,
    isInternal: input.isInternal ?? existing.isInternal ?? false,
    managedByFielderId: input.managedByFielderId ?? existing.managedByFielderId,
    managerRatePerSqft: input.managerRatePerSqft ?? existing.managerRatePerSqft,
    managerCommissionShare: input.managerCommissionShare ?? existing.managerCommissionShare,
    dueDate: input.dueDate !== undefined ? input.dueDate : existing.dueDate,
    archivedAt: input.archivedAt !== undefined ? input.archivedAt : existing.archivedAt,
  };
  saveDb(db);
}

export function getAssignmentById(id: number): (FielderAssignmentRow & { project: ProjectRow; payments: PaymentRow[] }) | undefined {
  const db = loadDb();
  const assignment = db.assignments.find((a) => a.id === id);
  if (!assignment) return undefined;

  const project = db.projects.find((p) => p.id === assignment.projectId);
  if (!project) return undefined;

  const payments = db.payments
    .filter((p) => p.fielderAssignmentId === id && !p.voidedAt)
    .sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1));

  return { ...assignment, project, payments };
}

export function getAssignmentsWithDetails(options?: ListAssignmentsOptions): Array<
  FielderAssignmentRow & { project: ProjectRow; payments: PaymentRow[] }
> {
  const assignments = getAllAssignments(options);
  return assignments
    .map((a) => getAssignmentById(a.id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
}

export function insertPayment(input: {
  projectId: number;
  fielderAssignmentId: number;
  amount: number;
  currency: string;
  method: string;
  paymentDate: string;
  notes: string | null;
}): number {
  const db = loadDb();
  const payment: PaymentRow = {
    id: db.nextPaymentId++,
    projectId: input.projectId,
    fielderAssignmentId: input.fielderAssignmentId,
    amount: input.amount,
    currency: input.currency,
    method: input.method,
    paymentDate: input.paymentDate,
    notes: input.notes,
    createdAt: new Date().toISOString(),
    voidedAt: null,
  };
  db.payments.push(payment);
  saveDb(db);
  return payment.id;
}

export function getPaymentsWithDetails(options?: ListPaymentsOptions): Array<
  PaymentRow & { project: ProjectRow; assignment: FielderAssignmentRow }
> {
  const db = loadDb();
  let payments = db.payments;
  if (!options?.includeVoided) {
    payments = payments.filter((p) => !p.voidedAt);
  }
  const projects = db.projects;
  const assignments = db.assignments;

  return payments
    .map((p) => {
      const project = projects.find((proj) => proj.id === p.projectId);
      const assignment = assignments.find(
        (a) => a.id === p.fielderAssignmentId,
      );
      if (!project || !assignment) return null;
      return { ...p, project, assignment };
    })
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1));
}

export function voidPayment(id: number): boolean {
  const db = loadDb();
  const idx = db.payments.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  if (db.payments[idx].voidedAt) return false;
  db.payments[idx] = {
    ...db.payments[idx],
    voidedAt: new Date().toISOString(),
  };
  saveDb(db);
  return true;
}

export function getPaymentById(id: number): (PaymentRow & { project: ProjectRow; assignment: FielderAssignmentRow }) | undefined {
  const db = loadDb();
  const payment = db.payments.find((p) => p.id === id);
  if (!payment) return undefined;
  const project = db.projects.find((p) => p.id === payment.projectId);
  const assignment = db.assignments.find((a) => a.id === payment.fielderAssignmentId);
  if (!project || !assignment) return undefined;
  return { ...payment, project, assignment };
}

export function getSettings(): SettingsRow {
  const db = loadDb();
  return { ...db.settings };
}

export function updateSettings(input: { usdToInrRate?: number | null }): void {
  const db = loadDb();
  db.settings = {
    usdToInrRate: input.usdToInrRate !== undefined ? input.usdToInrRate : db.settings.usdToInrRate,
  };
  saveDb(db);
}

export function insertActivity(input: {
  type: string;
  description: string;
  metadata?: Record<string, unknown>;
}): void {
  const db = loadDb();
  const row: ActivityRow = {
    id: db.nextActivityId++,
    type: input.type,
    description: input.description,
    createdAt: new Date().toISOString(),
    metadata: input.metadata,
  };
  db.activityLog.push(row);
  saveDb(db);
}

export function getAllActivity(limit?: number): ActivityRow[] {
  const db = loadDb();
  const list = [...db.activityLog].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return limit ? list.slice(0, limit) : list;
}

