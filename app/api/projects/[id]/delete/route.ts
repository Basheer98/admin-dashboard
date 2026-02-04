import { NextResponse } from "next/server";
import { deleteProject } from "@/lib/db";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  await deleteProject(id);

  const url = new URL("/projects", request.url);
  url.searchParams.set("deleted", "1");
  return NextResponse.redirect(url);
}

