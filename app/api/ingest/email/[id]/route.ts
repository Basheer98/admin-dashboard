import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuditActor, getSessionFromRequest } from "@/lib/auth";
import {
  getEmailIngestRecordById,
  insertAuditLog,
  markEmailIngestRecordApproved,
  markEmailIngestRecordProcessing,
  markEmailIngestRecordRejected,
  updateEmailIngestParsedPayload,
} from "@/lib/db";
import { processEmailIngestRecord } from "@/lib/emailIngestProcessor";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { validateCanonicalEmailPayload } from "@/lib/emailIngest";

const postSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().max(500).optional(),
  correctedPayload: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }
  const actor = getAuditActor(session);
  const parsedParams = await params;
  const id = Number(parsedParams.id);
  if (!id) {
    return NextResponse.redirect(
      getRedirectUrl(request, "/email-ingest", { error: "invalid-id" }),
    );
  }
  const formData = await request.formData();
  const parsed = postSchema.safeParse({
    action: String(formData.get("action") ?? ""),
    rejectionReason: String(formData.get("rejectionReason") ?? ""),
    correctedPayload: String(formData.get("correctedPayload") ?? ""),
  });
  if (!parsed.success) {
    return NextResponse.redirect(
      getRedirectUrl(request, "/email-ingest", { error: "invalid-form" }),
    );
  }

  const record = await getEmailIngestRecordById(id);
  if (!record) {
    return NextResponse.redirect(getRedirectUrl(request, "/email-ingest", { error: "not-found" }));
  }

  if (parsed.data.action === "reject") {
    await markEmailIngestRecordRejected({
      id,
      actorName: actor.actorName,
      reason: parsed.data.rejectionReason?.trim() || null,
    });
    await insertAuditLog({
      ...actor,
      action: "email_ingest.reject",
      entityType: "email_ingest",
      entityId: String(id),
      details: { rejectionReason: parsed.data.rejectionReason?.trim() || null },
    });
    return NextResponse.redirect(getRedirectUrl(request, "/email-ingest", { saved: "1" }));
  }

  try {
    if (parsed.data.correctedPayload?.trim()) {
      const corrected = validateCanonicalEmailPayload(
        JSON.parse(parsed.data.correctedPayload.trim()) as unknown,
      );
      await updateEmailIngestParsedPayload({
        id,
        parsedPayload: corrected,
        entityType: corrected.entityType,
        confidence: corrected.confidence,
      });
    }
    const latest = (await getEmailIngestRecordById(id)) ?? record;
    await markEmailIngestRecordProcessing(id);
    const processed = await processEmailIngestRecord(latest);
    await markEmailIngestRecordApproved({
      id,
      actorName: actor.actorName,
      createdEntityType: processed.createdEntityType,
      createdEntityId: processed.createdEntityId,
      normalizedPayload: processed.normalizedPayload,
    });
    await insertAuditLog({
      ...actor,
      action: "email_ingest.approve",
      entityType: "email_ingest",
      entityId: String(id),
      details: {
        createdEntityType: processed.createdEntityType,
        createdEntityId: processed.createdEntityId,
      },
    });
    return NextResponse.redirect(getRedirectUrl(request, "/email-ingest", { saved: "1" }));
  } catch (error) {
    return NextResponse.redirect(
      getRedirectUrl(request, "/email-ingest", {
        error: "approve-failed",
        detail: error instanceof Error ? error.message : "Could not approve",
      }),
    );
  }
}
