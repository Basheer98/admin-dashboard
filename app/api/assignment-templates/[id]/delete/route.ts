import { NextResponse } from "next/server";
import { deleteAssignmentTemplate } from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
  return NextResponse.redirect(
    getRedirectUrl(request, "/settings/assignment-templates", {
      deleted: "1",
    }),
  );
}
