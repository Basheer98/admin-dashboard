import { NextResponse } from "next/server";
import { deleteAssignmentTemplate, insertAuditLog } from "@/lib/db";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.redirect(getRedirectUrl(request, "/login"));
  const actor = getAuditActor(session);

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum < 1) {
    return NextResponse.redirect(
      getRedirectUrl(request, "/settings/assignment-templates", {
        error: "invalid",
      }),
    );
  }
  await deleteAssignmentTemplate(idNum);
  await insertAuditLog({
    ...actor,
    action: "assignment_template.delete",
    entityType: "assignment_template",
    entityId: String(idNum),
  });
  return NextResponse.redirect(
    getRedirectUrl(request, "/settings/assignment-templates", {
      deleted: "1",
    }),
  );
}
