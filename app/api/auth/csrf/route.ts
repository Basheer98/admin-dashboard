import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const CSRF_COOKIE = "csrf_token";
const CSRF_MAX_AGE = 60 * 60; // 1 hour

function randomToken(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** GET /api/auth/csrf - Sets CSRF cookie and returns token. Call from login page. */
export async function GET() {
  const store = await cookies();
  let token = store.get(CSRF_COOKIE)?.value;
  if (!token) {
    token = randomToken();
    store.set(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CSRF_MAX_AGE,
    });
  }
  return NextResponse.json({ token });
}
