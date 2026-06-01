import { createHash } from "crypto";
import { z } from "zod";

export const canonicalEntityTypeSchema = z.enum(["TICKET", "REIMBURSEMENT"]);

const canonicalTicketSchema = z.object({
  title: z.string().min(1).max(180),
  description: z.string().min(1),
  category: z.enum(["PROJECT_BLOCKER", "TRAVEL", "TOOLS", "PAYMENT", "OTHER"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

const canonicalReimbursementSchema = z.object({
  expenseDate: z.string().min(8),
  category: z.enum(["CAR", "ACCOMMODATION", "GAS", "TOOLS", "OTHER"]),
  amount: z.number().positive(),
  currency: z.enum(["USD", "INR"]).default("USD"),
  reimbursable: z.boolean().default(true),
  vendor: z.string().max(140).nullable().default(null),
  notes: z.string().max(1000).nullable().default(null),
});

export const canonicalEmailPayloadSchema = z.object({
  source: z.string().min(1).default("GMAIL"),
  externalMessageId: z.string().min(1),
  idempotencyExternalKey: z.string().max(180).optional(),
  senderEmail: z.string().email().nullable().default(null),
  senderName: z.string().max(140).nullable().default(null),
  receivedAt: z.string().min(8),
  subject: z.string().max(500).nullable().default(null),
  bodyText: z.string().nullable().default(null),
  entityType: canonicalEntityTypeSchema,
  confidence: z.number().min(0).max(1).default(1),
  fielderName: z.string().min(1).transform((s) => s.trim().toUpperCase()),
  projectCode: z.string().min(1).nullable().optional(),
  tripName: z.string().min(1).nullable().optional(),
  ticket: canonicalTicketSchema.nullable().optional(),
  reimbursement: canonicalReimbursementSchema.nullable().optional(),
});

export type CanonicalEmailPayload = z.infer<typeof canonicalEmailPayloadSchema>;
export type CanonicalEntityType = z.infer<typeof canonicalEntityTypeSchema>;

export function validateCanonicalEmailPayload(input: unknown): CanonicalEmailPayload {
  const parsed = canonicalEmailPayloadSchema.parse(input);
  if (parsed.entityType === "TICKET" && !parsed.ticket) {
    throw new Error("ticket payload is required when entityType is TICKET");
  }
  if (parsed.entityType === "REIMBURSEMENT" && !parsed.reimbursement) {
    throw new Error("reimbursement payload is required when entityType is REIMBURSEMENT");
  }
  return parsed;
}

export function buildCanonicalFingerprint(payload: CanonicalEmailPayload): string {
  const seed = [
    payload.source.toUpperCase(),
    payload.externalMessageId.trim(),
    payload.idempotencyExternalKey?.trim() ?? "",
    payload.entityType,
    payload.fielderName,
    payload.projectCode?.trim().toUpperCase() ?? "",
    payload.tripName?.trim().toUpperCase() ?? "",
  ].join("|");
  return createHash("sha256").update(seed).digest("hex");
}

export function computeRetryDelayMinutes(retries: number): number {
  if (retries <= 0) return 2;
  if (retries === 1) return 5;
  if (retries === 2) return 10;
  if (retries === 3) return 30;
  return 60;
}
