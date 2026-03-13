import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { getFielderLoginByEmail, insertAuditLog } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const fielder = await getFielderLoginByEmail(email);
    if (!fielder) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, fielder.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await createSession({ role: "fielder", fielderName: fielder.fielderName });

    await insertAuditLog({
      actorType: "fielder",
      actorName: fielder.fielderName,
      action: "auth.login",
      entityType: "fielder_login",
      entityId: String(fielder.id),
      details: { source: "mobile" },
    });

    return NextResponse.json({ token, fielderName: fielder.fielderName });
  } catch (e) {
    console.error("Mobile login error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
