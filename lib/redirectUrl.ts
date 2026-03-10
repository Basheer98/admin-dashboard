/**
 * Sanitize redirect path to prevent open redirect (e.g. //evil.com, /\\evil.com).
 * Only allow relative paths that stay on the same origin.
 */
function sanitizeRedirectPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.includes("://")) {
    return "/";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * Build a redirect URL using the request's public host.
 * Behind proxies (Railway, Vercel, etc.) request.url can be internal (e.g. localhost:8080).
 * Use Host / X-Forwarded-Host and X-Forwarded-Proto so redirects go to the real site.
 */
export function getRedirectUrl(request: Request, path: string, searchParams?: Record<string, string>): URL {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? (request.url.startsWith("https") ? "https" : "http");
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;
  const safePath = sanitizeRedirectPath(path);
  const url = new URL(safePath, origin);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
  }
  return url;
}
