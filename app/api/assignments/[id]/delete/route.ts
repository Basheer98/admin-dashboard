import { NextResponse } from "next/server";
import { deleteAssignment } from "@/lib/db";
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
    return NextResponse.redirect(getRedirectUrl(request, "/assignments"));
  }

  await deleteAssignment(id);

  return NextResponse.redirect(getRedirectUrl(request, "/assignments", { deleted: "1" }));
}

