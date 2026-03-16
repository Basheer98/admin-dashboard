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

/** Use in Server Components / server context to get or set CSRF cookie and return token for the form. */
export async function getOrSetCsrfToken(): Promise<string> {
  const store = await cookies();
  let token = store.get(CSRF_COOKIE)?.value;
  if (!token) {
    token = randomToken();
    store.set(CSRF_COOKIE, token, {
      httpOnly: false, // so client fetch can send X-CSRF-Token header if needed
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CSRF_MAX_AGE,
    });
  }
  return token;
}

/** Read CSRF token from cookie (request headers). */
function getCsrfFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${CSRF_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

/** Verify CSRF: token in cookie must match token in body (form) or X-CSRF-Token header. Returns true if valid. */
export function verifyCsrf(request: Request): boolean {
  const cookieToken = getCsrfFromCookie(request);
  if (!cookieToken) return false;
  const headerToken = request.headers.get("x-csrf-token")?.trim();
  if (headerToken && headerToken === cookieToken) return true;
  // Form POST sends as body; we need to read body - but that consumes the stream. So we only check header for API routes that use JSON. For form POST (login) we need to check the body. So the login route will need to read the body first, then check csrf_token field. So we provide a helper that accepts the body token too.
  return false;
}

/** Use when you have the token from the request body (e.g. form field csrf_token). */
export function verifyCsrfWithBodyToken(request: Request, bodyToken: string | null | undefined): boolean {
  const cookieToken = getCsrfFromCookie(request);
  if (!cookieToken) return false;
  const t = bodyToken?.trim();
  return !!t && t === cookieToken;
}

export const CSRF_COOKIE_NAME = CSRF_COOKIE;
