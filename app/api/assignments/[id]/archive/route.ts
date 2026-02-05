import { NextResponse } from "next/server";
import { archiveAssignment, getAssignmentById } from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(getRedirectUrl(request, "/assignments"));
  }
  const assignment = await getAssignmentById(id);
  const projectId = assignment?.projectId;
  await archiveAssignment(id);
  const paramsObj: Record<string, string> = { archived: "1" };
  if (projectId) paramsObj.projectId = String(projectId);
  return NextResponse.redirect(getRedirectUrl(request, "/assignments", paramsObj));
}
