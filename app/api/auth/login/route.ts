import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { createSession, sessionCookieName } from "@/lib/auth";
import { getFielderLoginByEmail } from "@/lib/db";
import { getRedirectUrl } from "@/lib/redirectUrl";
import { checkLoginRateLimit } from "@/lib/rateLimit";
import { verifyCsrfWithBodyToken } from "@/lib/csrf";

export async function POST(request: Request) {
  const rate = checkLoginRateLimit(request);
  if (!rate.ok) {
    const isJson = (request.headers.get("content-type") ?? "").toLowerCase().includes("application/json");
    if (isJson) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      );
    }
    return NextResponse.redirect(new URL("/login?error=rate", request.url));
  }

  const contentType = request.headers.get("content-type") ?? "";
  const isJson = contentType.toLowerCase().includes("application/json");

  let email: string;
  let password: string;
  let redirectTo = "/";
  let bodyCsrfToken: string | null = null;

  if (isJson) {
    const body = await request.json().catch(() => ({}));
    email = String(body.email ?? "").trim().toLowerCase();
    password = String(body.password ?? "");
    bodyCsrfToken = body.csrf_token != null ? String(body.csrf_token) : null;
  } else {
    const formData = await request.formData();
    email = String(formData.get("email") ?? "").trim();
    password = String(formData.get("password") ?? "").trim();
    redirectTo = String(formData.get("redirectTo") ?? "/");
    bodyCsrfToken = formData.get("csrf_token") != null ? String(formData.get("csrf_token")) : null;
  }

  // CSRF: required for form POST (web). Fielder app (JSON) uses Bearer after login, so we allow JSON without CSRF.
  if (!isJson && !verifyCsrfWithBodyToken(request, bodyCsrfToken)) {
    return NextResponse.redirect(getRedirectUrl(request, "/login", { error: "invalid" }));
  }

  if (!email || !password) {
    if (isJson) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    return NextResponse.redirect(getRedirectUrl(request, "/login", { error: "invalid", email }));
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";

  if (email === adminEmail && password === adminPassword) {
    if (isJson) {
      return NextResponse.json({ error: "Use the web login for admin access" }, { status: 403 });
    }
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
    if (isJson) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    return NextResponse.redirect(getRedirectUrl(request, "/login", { error: "invalid", email }));
  }

  const token = await createSession({ role: "fielder", fielderName: fielder.fielderName });
  if (isJson) {
    return NextResponse.json({ token, fielderName: fielder.fielderName });
  }
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
