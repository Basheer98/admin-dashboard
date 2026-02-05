import { NextResponse } from "next/server";
import { deleteProject } from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(getRedirectUrl(request, "/projects"));
  }

  await deleteProject(id);

  return NextResponse.redirect(getRedirectUrl(request, "/projects", { deleted: "1" }));
}

