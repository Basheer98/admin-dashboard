import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { createSession, sessionCookieName } from "@/lib/auth";
import { getFielderLoginByEmail } from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  if (!email || !password) {
    return NextResponse.redirect(getRedirectUrl(request, "/login", { error: "invalid", email }));
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";

  if (email === adminEmail && password === adminPassword) {
    const token = await createSession({ role: "admin" });
    let path = "/";
    if (redirectTo.startsWith("/") && !redirectTo.startsWith("//") && !redirectTo.includes("://")) {
      path = redirectTo.startsWith("/fielder") ? "/" : redirectTo;
    } else if (redirectTo.startsWith("http")) {
      try {
        const parsed = new URL(redirectTo);
        if (parsed.origin === new URL(request.url).origin) {
          path = parsed.pathname || "/";
        }
      } catch {
        /* ignore invalid URL */
      }
    }
    const response = NextResponse.redirect(getRedirectUrl(request, path));
    response.cookies.set(sessionCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  }

  const fielder = await getFielderLoginByEmail(email);
  if (!fielder || !(await bcrypt.compare(password, fielder.passwordHash))) {
    return NextResponse.redirect(getRedirectUrl(request, "/login", { error: "invalid", email }));
  }

  const token = await createSession({ role: "fielder", fielderName: fielder.fielderName });
  const response = NextResponse.redirect(getRedirectUrl(request, "/fielder"));
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
