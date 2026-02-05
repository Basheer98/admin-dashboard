import { NextResponse } from "next/server";
import { unarchiveProject } from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(getRedirectUrl(request, "/projects"));
  }
  await unarchiveProject(id);
  return NextResponse.redirect(getRedirectUrl(request, "/projects", { unarchived: "1" }));
}
