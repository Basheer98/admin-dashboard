import { NextResponse } from "next/server";
import {
  getSettings,
  getDueRetryableEmailIngestRecords,
  markEmailIngestRecordApproved,
  markEmailIngestRecordFatalFailure,
  markEmailIngestRecordProcessing,
  markEmailIngestRecordRetryableFailure,
} from "@/lib/db";
import { computeRetryDelayMinutes } from "@/lib/emailIngest";
import { processEmailIngestRecord } from "@/lib/emailIngestProcessor";

function isCronAuthorized(request: Request, secret: string | null): boolean {
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
    return NextResponse.json({ ok: true, processed: 0, skipped: "disabled" });
  }
  if (!isCronAuthorized(request, settings.emailIngestWebhookSecret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const due = await getDueRetryableEmailIngestRecords(25);
  let approved = 0;
  let retrying = 0;
  let fatal = 0;

  for (const record of due) {
    try {
      await markEmailIngestRecordProcessing(record.id);
      const processed = await processEmailIngestRecord(record);
      await markEmailIngestRecordApproved({
        id: record.id,
        actorName: "automation:retry",
        createdEntityType: processed.createdEntityType,
        createdEntityId: processed.createdEntityId,
        normalizedPayload: processed.normalizedPayload,
      });
      approved += 1;
    } catch (error) {
      const retries = record.retries + 1;
      if (retries >= 6) {
        await markEmailIngestRecordFatalFailure({
          id: record.id,
          error: error instanceof Error ? error.message : "Unknown processing error",
        });
        fatal += 1;
      } else {
        const retryMinutes = computeRetryDelayMinutes(retries);
        const nextAttemptAt = new Date(Date.now() + retryMinutes * 60_000).toISOString();
        await markEmailIngestRecordRetryableFailure({
          id: record.id,
          retries,
          error: error instanceof Error ? error.message : "Unknown processing error",
          nextAttemptAt,
        });
        retrying += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    processed: due.length,
    approved,
    retrying,
    fatal,
  });
}
