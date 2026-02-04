import { NextResponse } from "next/server";
import { archiveProject } from "@/lib/db";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(new URL("/projects", request.url));
  }
  archiveProject(id);
  const url = new URL("/projects", request.url);
  url.searchParams.set("archived", "1");
  return NextResponse.redirect(url);
}
