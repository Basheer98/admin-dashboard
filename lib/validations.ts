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
  currency: z.enum(["USD", "INR"]),
  method: z.enum(["BANK", "WISE", "CASH", "OTHER"]),
  paymentDate: z.string().min(1),
  notes: z.string().nullable(),
});

/** Log payment for a fielder (allocated across their assignments). */
export const fielderPaymentPostSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(["USD", "INR"]),
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
});

// --- Settings ---
export const settingsPostSchema = z.object({
  usdToInrRate: z.number().positive().nullable(),
});

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
