import { NextResponse } from "next/server";
import { deleteAssignment } from "@/lib/db";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.redirect(new URL("/assignments", request.url));
  }

  await deleteAssignment(id);

  const url = new URL("/assignments", request.url);
  url.searchParams.set("deleted", "1");
  return NextResponse.redirect(url);
}

