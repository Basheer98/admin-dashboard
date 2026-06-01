import {
  getAllTrips,
  getProjectByCode,
  insertTicket,
  insertTripExpense,
  type EmailIngestRecordRow,
} from "./db";
import type { CanonicalEmailPayload, CanonicalEntityType } from "./emailIngest";

export type ProcessedEntityResult = {
  createdEntityType: string;
  createdEntityId: string;
  normalizedPayload: Record<string, unknown>;
};

function parsePayload(record: EmailIngestRecordRow): CanonicalEmailPayload {
  return record.parsedPayload as CanonicalEmailPayload;
}

async function resolveTripIdByName(tripName: string | null | undefined): Promise<number | null> {
  const q = tripName?.trim().toLowerCase();
  if (!q) return null;
  const trips = await getAllTrips();
  const exact = trips.find((t) => t.name.trim().toLowerCase() === q);
  return exact?.id ?? null;
}

async function resolveProjectIdByCode(projectCode: string | null | undefined): Promise<number | null> {
  const code = projectCode?.trim();
  if (!code) return null;
  const project = await getProjectByCode(code);
  return project?.id ?? null;
}

export async function processEmailIngestRecord(
  record: EmailIngestRecordRow,
): Promise<ProcessedEntityResult> {
  const payload = parsePayload(record);
  const projectId = await resolveProjectIdByCode(payload.projectCode ?? null);
  const tripId = await resolveTripIdByName(payload.tripName ?? null);

  if (payload.entityType === "TICKET") {
    if (!payload.ticket) {
      throw new Error("ticket payload missing");
    }
    const ticket = await insertTicket({
      fielderName: payload.fielderName,
      title: payload.ticket.title,
      category: payload.ticket.category,
      priority: payload.ticket.priority,
      description: payload.ticket.description,
      projectId,
      tripId,
    });
    return {
      createdEntityType: "ticket",
      createdEntityId: String(ticket.id),
      normalizedPayload: {
        ...payload,
        projectId,
        tripId,
      },
    };
  }

  if (payload.entityType === "REIMBURSEMENT") {
    if (!payload.reimbursement) {
      throw new Error("reimbursement payload missing");
    }
    if (!tripId) {
      throw new Error(
        "Trip mapping failed. Provide tripName matching an existing trip before approving.",
      );
    }
    const expense = await insertTripExpense({
      tripId,
      expenseDate: payload.reimbursement.expenseDate,
      category: payload.reimbursement.category,
      amount: payload.reimbursement.amount,
      currency: payload.reimbursement.currency,
      paidBy: payload.fielderName,
      reimbursable: payload.reimbursement.reimbursable,
      vendor: payload.reimbursement.vendor,
      notes: payload.reimbursement.notes,
      receiptUrl: null,
    });
    return {
      createdEntityType: "trip_expense",
      createdEntityId: String(expense.id),
      normalizedPayload: {
        ...payload,
        projectId,
        tripId,
      },
    };
  }

  const unexpected: CanonicalEntityType = payload.entityType;
  throw new Error(`Unsupported entity type: ${String(unexpected)}`);
}
