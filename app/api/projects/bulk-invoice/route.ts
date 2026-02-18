import { NextResponse } from "next/server";
import { getProjectById, updateProject, insertAuditLog } from "@/lib/db";
import { getSessionFromRequest, getAuditActor } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.redirect(getRedirectUrl(request, "/login"));
    }
    const actor = getAuditActor(session);

    const formData = await request.formData();
    const projectIdsRaw = formData.getAll("projectIds");
    const projectIds = projectIdsRaw
      .map((id) => Number(id))
      .filter((n) => Number.isInteger(n) && n > 0);
    const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim() || null;

    if (projectIds.length === 0) {
      return NextResponse.redirect(
        getRedirectUrl(request, "/projects", { error: "bulk_invoice_no_selection" }),
      );
    }

    for (const id of projectIds) {
      const project = await getProjectById(id);
      if (project) {
        await updateProject(id, {
          ...project,
          invoiceNumber,
        });
      }
    }

    await insertAuditLog({
      ...actor,
      action: "project.bulk_invoice",
      entityType: "project",
      details: { count: projectIds.length, invoiceNumber, projectIds },
    });

    return NextResponse.redirect(
      getRedirectUrl(request, "/projects", { success: "bulk_invoice", count: String(projectIds.length) }),
    );
  } catch (e) {
    console.error("POST /api/projects/bulk-invoice failed:", e);
    return NextResponse.redirect(
      getRedirectUrl(request, "/projects", { error: "server" }),
    );
  }
}
