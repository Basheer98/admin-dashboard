import { NextResponse } from "next/server";
import { deleteClient, getClientById, updateClient, insertAuditLog } from "@/lib/db";
import { getAuditActor, getSessionFromRequest } from "@/lib/auth";
import { clientPatchSchema, validate } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actor = getAuditActor(session);
  const id = Number((await context.params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await request.json();
  const parsed = validate(clientPatchSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.message }, { status: 400 });

  const client = await updateClient(id, parsed.data);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await insertAuditLog({
    ...actor,
    action: "client.update",
    entityType: "client",
    entityId: String(id),
    details: parsed.data,
  });

  return NextResponse.json({ client });
}

export async function DELETE(request: Request, context: Ctx) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actor = getAuditActor(session);
  const id = Number((await context.params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getClientById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteClient(id);
  await insertAuditLog({
    ...actor,
    action: "client.delete",
    entityType: "client",
    entityId: String(id),
    details: { name: existing.name },
  });

  return NextResponse.json({ ok: true });
}
