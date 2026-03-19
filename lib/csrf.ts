const CSRF_COOKIE = "csrf_token";

/** CSRF token is set via GET /api/auth/csrf (Route Handler). Login page fetches it client-side. */

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
