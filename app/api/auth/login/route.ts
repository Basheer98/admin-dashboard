import { NextResponse } from "next/server";
import { createSession, sessionCookieName } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";

  if (!email || !password || email !== adminEmail || password !== adminPassword) {
    const url = getRedirectUrl(request, "/login", { error: "invalid", email });
    return NextResponse.redirect(url);
  }

  const token = await createSession(email);

  const path = redirectTo.startsWith("http") ? new URL(redirectTo).pathname : (redirectTo.startsWith("/") ? redirectTo : "/");
  const response = NextResponse.redirect(getRedirectUrl(request, path));

  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}

