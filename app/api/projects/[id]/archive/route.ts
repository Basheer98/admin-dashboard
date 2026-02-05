import { NextResponse } from "next/server";
import { archiveProject } from "@/lib/db";
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
  await archiveProject(id);
  return NextResponse.redirect(getRedirectUrl(request, "/projects", { archived: "1" }));
}
