import { NextResponse } from "next/server";
import {
  getSettings,
  getEmailIngestRecordByFingerprint,
  insertEmailIngestRecord,
  insertActivity,
  insertAuditLog,
  markEmailIngestRecordApproved,
  markEmailIngestRecordProcessing,
  markEmailIngestRecordRetryableFailure,
} from "@/lib/db";
import {
  buildCanonicalFingerprint,
  computeRetryDelayMinutes,
  validateCanonicalEmailPayload,
} from "@/lib/emailIngest";
import { processEmailIngestRecord } from "@/lib/emailIngestProcessor";
import { logError, logInfo } from "@/lib/observability";

function isWebhookAuthorized(request: Request, secret: string | null): boolean {
  if (!secret) return false;
  const auth = request.headers.get("authorization")?.trim() ?? "";
  const xSecret = request.headers.get("x-ingest-secret")?.trim() ?? "";
  if (xSecret && xSecret === secret) return true;
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim() === secret;
  }
  return false;
}

export async function POST(request: Request) {
  const settings = await getSettings();
  if (!settings.emailIngestEnabled) {
    return NextResponse.json({ ok: false, error: "Email ingest is disabled." }, { status: 403 });
  }
  if (!isWebhookAuthorized(request, settings.emailIngestWebhookSecret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized ingest request." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  let payload;
  try {
    payload = validateCanonicalEmailPayload(body);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Invalid payload." },
      { status: 400 },
    );
  }

  const fingerprint = buildCanonicalFingerprint(payload);
  const existing = await getEmailIngestRecordByFingerprint(fingerprint);
  if (existing) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      id: existing.id,
      status: existing.status,
    });
  }

  const record = await insertEmailIngestRecord({
    source: payload.source,
    externalMessageId: payload.externalMessageId,
    fingerprint,
    senderEmail: payload.senderEmail,
    senderName: payload.senderName,
    subject: payload.subject,
    receivedAt: payload.receivedAt,
    rawPayload: body as Record<string, unknown>,
    parsedPayload: payload,
    entityType: payload.entityType,
    confidence: payload.confidence,
  });

  const shouldAutoApprove =
    settings.emailIngestAutoApprove &&
    payload.confidence >= settings.emailIngestAutoApproveMinConfidence;

  if (!shouldAutoApprove) {
    await insertActivity({
      type: "email_ingest_received",
      description: `Queued email ingest #${record.id} for review`,
      metadata: { id: record.id, entityType: payload.entityType, confidence: payload.confidence },
    });
    return NextResponse.json({ ok: true, id: record.id, status: "PENDING_REVIEW" });
  }

  try {
    await markEmailIngestRecordProcessing(record.id);
    const processed = await processEmailIngestRecord(record);
    await markEmailIngestRecordApproved({
      id: record.id,
      actorName: "automation:gmail",
      createdEntityType: processed.createdEntityType,
      createdEntityId: processed.createdEntityId,
      normalizedPayload: processed.normalizedPayload,
    });
    await insertActivity({
      type: "email_ingest_auto_approved",
      description: `Auto-approved email ingest #${record.id} -> ${processed.createdEntityType} #${processed.createdEntityId}`,
      metadata: { id: record.id, ...processed },
    });
    await insertAuditLog({
      actorType: "admin",
      actorName: "automation:gmail",
      action: "email_ingest.auto_approve",
      entityType: "email_ingest",
      entityId: String(record.id),
      details: {
        confidence: payload.confidence,
        minConfidence: settings.emailIngestAutoApproveMinConfidence,
        createdEntityType: processed.createdEntityType,
        createdEntityId: processed.createdEntityId,
      },
    });
    return NextResponse.json({ ok: true, id: record.id, status: "APPROVED", autoApproved: true });
  } catch (error) {
    const retries = record.retries + 1;
    const retryMinutes = computeRetryDelayMinutes(retries);
    const nextAttemptAt = new Date(Date.now() + retryMinutes * 60_000).toISOString();
    await markEmailIngestRecordRetryableFailure({
      id: record.id,
      retries,
      error: error instanceof Error ? error.message : "Unknown processing error",
      nextAttemptAt,
    });
    logError({
      message: "email_ingest_auto_approve_failed",
      route: "/api/ingest/email",
      details: { id: record.id, retries, nextAttemptAt },
    });
    return NextResponse.json(
      {
        ok: true,
        id: record.id,
        status: "FAILED_RETRYABLE",
      },
      { status: 202 },
    );
  } finally {
    logInfo({
      message: "email_ingest_received",
      route: "/api/ingest/email",
      details: { id: record.id, autoApprove: shouldAutoApprove },
    });
  }
}
