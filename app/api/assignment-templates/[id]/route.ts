import { NextResponse } from "next/server";
import { deleteAssignmentTemplate } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  await deleteAssignmentTemplate(idNum);
  return NextResponse.json({ ok: true });
}
