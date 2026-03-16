/**
 * In-memory rate limiter for login and sensitive endpoints.
 * Resets on process restart. For multi-instance deployments use Redis/Upstash.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, { count: number; firstAt: number }>();

function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

/** Returns true if the request is within limit, false if rate limited. */
export function checkLoginRateLimit(request: Request): { ok: true } | { ok: false; retryAfter: number } {
  const id = getClientId(request);
  const now = Date.now();
  let entry = attempts.get(id);

  if (!entry) {
    attempts.set(id, { count: 1, firstAt: now });
    return { ok: true };
  }

  if (now - entry.firstAt > WINDOW_MS) {
    entry = { count: 1, firstAt: now };
    attempts.set(id, entry);
    return { ok: true };
  }

  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - entry.firstAt)) / 1000);
    return { ok: false, retryAfter: Math.max(1, retryAfter) };
  }

  return { ok: true };
}
