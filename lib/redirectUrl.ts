/**
 * Build a redirect URL using the request's public host.
 * Behind proxies (Railway, Vercel, etc.) request.url can be internal (e.g. localhost:8080).
 * Use Host / X-Forwarded-Host and X-Forwarded-Proto so redirects go to the real site.
 */
export function getRedirectUrl(request: Request, path: string, searchParams?: Record<string, string>): URL {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? (request.url.startsWith("https") ? "https" : "http");
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;
  const url = new URL(path.startsWith("/") ? path : `/${path}`, origin);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
  }
  return url;
}
