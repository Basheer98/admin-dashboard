import { NextResponse } from "next/server";
import { queryOne, query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/** Debug route: returns raw project row. Use ?fixqfield=Qfield-1 to update qfield. Requires admin. */
export async function GET(request: Request, { params }: Params) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const fixQfield = url.searchParams.get("fixqfield");
  const validQfield = fixQfield === "Qfield-1" || fixQfield === "Qfield-2";

  if (validQfield) {
    await query(`UPDATE projects SET qfield = $1, updated_at = NOW() WHERE id = $2`, [
      fixQfield,
      id,
    ]);
  }

  const row = await queryOne<Record<string, unknown>>(
    `SELECT id, project_code, client_name, location, qfield, status
     FROM projects WHERE id = $1`,
    [id],
  );
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...row,
    _note: validQfield
      ? `Updated qfield to ${fixQfield}. Pull-to-refresh the project in the fielder app.`
      : "Add ?fixqfield=Qfield-1 or ?fixqfield=Qfield-2 to set qfield for this project.",
  });
}
