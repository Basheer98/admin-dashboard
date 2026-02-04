import { NextResponse } from "next/server";
import { getProjectByCode, getAssignmentsByProjectId } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim() ?? "";
  if (!code) {
    return NextResponse.json({ project: null, assignments: [] });
  }
  const project = getProjectByCode(code);
  if (!project) {
    return NextResponse.json({ project: null, assignments: [] });
  }
  const assignments = getAssignmentsByProjectId(project.id);
  return NextResponse.json({
    project: {
      id: project.id,
      projectCode: project.projectCode,
      clientName: project.clientName,
      status: project.status,
      ecd: project.ecd,
    },
    assignments: assignments.map((a) => ({
      id: a.id,
      fielderName: a.fielderName,
    })),
  });
}
