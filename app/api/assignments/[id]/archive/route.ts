import { NextResponse } from "next/server";
import { archiveAssignment, getAssignmentById } from "@/lib/db";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(new URL("/assignments", request.url));
  }
  archiveAssignment(id);
  const assignment = getAssignmentById(id);
  const projectId = assignment?.projectId;
  const url = new URL("/assignments", request.url);
  url.searchParams.set("archived", "1");
  if (projectId) url.searchParams.set("projectId", String(projectId));
  return NextResponse.redirect(url);
}
