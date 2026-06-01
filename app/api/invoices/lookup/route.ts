import { NextResponse } from "next/server";
import { getProjectByCode } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim() ?? "";
  if (!code) {
    return NextResponse.json({ project: null });
  }
  const project = await getProjectByCode(code);
  if (!project) {
    return NextResponse.json({ project: null });
  }
  return NextResponse.json({
    project: {
      projectCode: project.projectCode,
      clientName: project.clientName,
      totalSqft: project.totalSqft,
      companyRatePerSqft: Number(project.companyRatePerSqft),
      location: project.location,
      status: project.status,
    },
  });
}
