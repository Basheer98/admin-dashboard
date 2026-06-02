import { z } from "zod";

/** Helper: validate data with a Zod schema. Returns parsed data or the first error message. */
export function validate<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { success: true; data: T } | { success: false; message: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const first = result.error.issues[0];
  const message = first?.message ?? "Invalid data";
  return { success: false, message };
}

// --- Payments ---
export const paymentPostSchema = z.object({
  projectId: z.number().int().positive(),
  fielderAssignmentId: z.number().int().positive(),
  amount: z.number().positive(),
  currency: z.enum(["USD"]),
  method: z.enum(["BANK", "WISE", "CASH", "OTHER"]),
  paymentDate: z.string().min(1),
  notes: z.string().nullable(),
});

/** Log payment for a fielder (allocated across their assignments). */
export const fielderPaymentPostSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(["USD"]),
  method: z.enum(["BANK", "WISE", "CASH", "OTHER"]),
  paymentDate: z.string().min(1),
  notes: z.string().nullable(),
});

// --- Assignments (POST new) ---
export const assignmentPostSchema = z.object({
  projectId: z.number().int().positive(),
  fielderName: z.string().min(1),
  ratePerSqft: z.number().nonnegative(),
  isInternal: z.boolean(),
  commissionPercentage: z.number().min(0).max(1).nullable(),
  managedByFielderId: z.number().int().positive().nullable(),
  managerRatePerSqft: z.number().nonnegative().nullable(),
  managerCommissionShare: z.number().min(0).max(1).nullable(),
  dueDate: z.string().nullable(),
});

// --- Assignments (PATCH by id) ---
export const assignmentPatchSchema = z.object({
  ratePerSqft: z.number().nonnegative(),
  isInternal: z.boolean(),
  commissionPercentage: z.number().min(0).max(1).nullable(),
  managedByFielderId: z.number().int().positive().nullable(),
  managerRatePerSqft: z.number().nonnegative().nullable(),
  managerCommissionShare: z.number().min(0).max(1).nullable(),
  dueDate: z.string().nullable(),
});

// --- Projects (POST new) ---
export const projectPostSchema = z.object({
  projectCode: z.string().min(1),
  clientName: z.string().min(1),
  location: z.string(),
  totalSqft: z.number().int().positive(),
  companyRatePerSqft: z.number().nonnegative(),
  status: z.string(),
  ecd: z.string().nullable(),
  notes: z.string().nullable(),
  qfield: z.enum(["Qfield-1", "Qfield-2"]).nullable(),
  invoiceNumber: z.string().nullable(),
  workType: z.string().nullable(),
  gdriveFolderUrl: z.string().url().nullable().optional(),
});

// --- Projects (PATCH by id) ---
export const projectPatchSchema = z.object({
  projectCode: z.string().min(1),
  clientName: z.string().min(1),
  location: z.string(),
  totalSqft: z.number().int().positive(),
  companyRatePerSqft: z.number().nonnegative(),
  status: z.string(),
  ecd: z.string().nullable(),
  notes: z.string().nullable(),
  qfield: z.enum(["Qfield-1", "Qfield-2"]).nullable(),
  invoiceNumber: z.string().nullable(),
  workType: z.string().nullable(),
  gdriveFolderUrl: z.string().url().nullable().optional(),
});

// --- Settings (partial — only fields present in the form are validated) ---
export const settingsPatchSchema = z.object({
  companyRatePerSqft: z.number().nonnegative().nullable().optional(),
  adminPhone: z.string().max(30).nullable().optional(),
  emailIngestEnabled: z.boolean().optional(),
  emailIngestWebhookSecret: z.string().max(200).nullable().optional(),
  emailIngestAutoApprove: z.boolean().optional(),
  emailIngestAutoApproveMinConfidence: z.number().min(0).max(1).optional(),
});

/** @deprecated Use settingsPatchSchema */
export const settingsPostSchema = settingsPatchSchema;

// --- Additional work ---
export const additionalWorkPostSchema = z.object({
  type: z.enum(["ADDITIONAL_FIELDING", "CORRECTION"]),
  projectNumber: z.string().min(1),
  assignedFielderAssignmentId: z.number().int().positive().nullable(),
  distance: z.number().nonnegative().nullable(),
  rateForEntireJob: z.number().nonnegative().nullable(),
  amount: z.number().nonnegative().nullable(),
  dueDate: z.string().nullable(),
  completedAt: z.string().nullable(),
  status: z.string(),
  notes: z.string().nullable(),
});

// --- Trips ---
export const tripPostSchema = z.object({
  name: z.string().min(1),
  state: z.string().min(1),
  city: z.string().nullable(),
  teamMembers: z.string().nullable(),
  budgetCar: z.number().nonnegative().nullable(),
  budgetAccommodation: z.number().nonnegative().nullable(),
  budgetGas: z.number().nonnegative().nullable(),
  budgetTools: z.number().nonnegative().nullable(),
  projectId: z.number().int().positive().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().nullable(),
  status: z.enum(["PLANNED", "ACTIVE", "CLOSED"]),
  notes: z.string().nullable(),
});

export const tripPatchSchema = z.object({
  name: z.string().min(1),
  state: z.string().min(1),
  city: z.string().nullable(),
  teamMembers: z.string().nullable(),
  budgetCar: z.number().nonnegative().nullable(),
  budgetAccommodation: z.number().nonnegative().nullable(),
  budgetGas: z.number().nonnegative().nullable(),
  budgetTools: z.number().nonnegative().nullable(),
  projectId: z.number().int().positive().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().nullable(),
  status: z.enum(["PLANNED", "ACTIVE", "CLOSED"]),
  notes: z.string().nullable(),
});

export const tripExpensePostSchema = z.object({
  tripId: z.number().int().positive(),
  expenseDate: z.string().min(1),
  category: z.enum(["CAR", "ACCOMMODATION", "GAS", "TOOLS", "OTHER"]),
  amount: z.number().positive(),
  currency: z.enum(["USD"]),
  paidBy: z.string().nullable(),
  receiptUrl: z.string().url().nullable().optional(),
  reimbursable: z.boolean().optional(),
  vendor: z.string().nullable(),
  notes: z.string().nullable(),
});

export const ticketPostSchema = z.object({
  title: z.string().min(1),
  category: z.enum(["PROJECT_BLOCKER", "TRAVEL", "TOOLS", "PAYMENT", "OTHER"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  description: z.string().min(1),
  projectId: z.number().int().positive().nullable(),
  tripId: z.number().int().positive().nullable(),
});

export const ticketPatchSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
  resolutionNote: z.string().nullable(),
});

// --- Clients ---
export const clientPostSchema = z.object({
  name: z.string().min(1),
  address: z.string().nullable().optional(),
});

export const clientPatchSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
});

// --- Invoices ---
export const invoiceLineSchema = z.object({
  projectCode: z.string().min(1),
  clientName: z.string().nullable().optional(),
  totalSqft: z.number().int().positive(),
  ratePerSqft: z.number().nonnegative(),
});

export const invoicePostSchema = z.object({
  invoiceNumber: z.string().min(1),
  clientId: z.number().int().positive().nullable().optional(),
  clientName: z.string().min(1),
  billToAddress: z.string().nullable().optional(),
  issueDate: z.string().min(1),
  dueDate: z.string().nullable(),
  notes: z.string().nullable(),
  syncProjectInvoiceNumber: z.boolean().optional(),
  lines: z.array(invoiceLineSchema).min(1),
});

export const invoiceImportPreviewSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  mapping: z.record(z.string(), z.string()),
  options: z.object({
    invoiceNumber: z.string().min(1),
    clientId: z.number().int().positive().nullable().optional(),
    defaultClientName: z.string(),
    defaultCompanyRate: z.number().nonnegative(),
    defaultLocation: z.string(),
    defaultStatus: z.string(),
    syncProjectInvoiceNumber: z.boolean(),
    projectConflict: z.enum(["update", "skip_project", "skip"]),
    issueDate: z.string().min(1),
    dueDate: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  }),
});
