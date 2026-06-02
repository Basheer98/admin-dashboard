import { NextResponse } from "next/server";
import { getAllClients, insertClient, insertAuditLog } from "@/lib/db";
import { getAuditActor, getSessionFromRequest } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { clientPostSchema, validate } from "@/lib/validations";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const clients = await getAllClients();
  return NextResponse.json({ clients });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actor = getAuditActor(session);

  const contentType = request.headers.get("content-type") ?? "";
  let payload: unknown;
  if (contentType.includes("application/json")) {
    payload = await request.json();
  } else {
    const formData = await request.formData();
    payload = {
      name: String(formData.get("name") ?? ""),
      address: String(formData.get("address") ?? "").trim() || null,
    };
  }

  const parsed = validate(clientPostSchema, payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const client = await insertClient({
    name: parsed.data.name,
    address: parsed.data.address ?? null,
  });

  await insertAuditLog({
    ...actor,
    action: "client.create",
    entityType: "client",
    entityId: String(client.id),
    details: { name: client.name },
  });

  if (contentType.includes("application/json")) {
    return NextResponse.json({ client });
  }
  return NextResponse.redirect(getRedirectUrl(request, "/clients", { saved: "1" }));
}
