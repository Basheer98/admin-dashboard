const SESSION_COOKIE_NAME = "admin_session";

export const sessionCookieName = SESSION_COOKIE_NAME;

export type SessionAdmin = { role: "admin" };
export type SessionFielder = { role: "fielder"; fielderName: string };
export type Session = SessionAdmin | SessionFielder;

const DEFAULT_SECRET = "dev-secret-change-in-production";
const SESSION_SECRET =
  process.env.SESSION_SECRET || process.env.AUTH_SECRET || DEFAULT_SECRET;

function ensureProductionSecret(): void {
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "production" && SESSION_SECRET === DEFAULT_SECRET) {
    console.error("SECURITY: SESSION_SECRET or AUTH_SECRET must be set in production. Using default is insecure.");
  }
}

const BASE64URL_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function encodeBase64Url(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
    result += BASE64URL_CHARS[b0 >> 2];
    result += BASE64URL_CHARS[((b0 & 3) << 4) | (b1 ?? 0) >> 4];
    result += b1 !== undefined ? BASE64URL_CHARS[((b1 & 15) << 2) | (b2 ?? 0) >> 6] : "";
    result += b2 !== undefined ? BASE64URL_CHARS[b2 & 63] : "";
  }
  return result;
}

function decodeBase64Url(str: string): Uint8Array | null {
  try {
    const pad = str.length % 4;
    const padded = pad === 0 ? str : str + "=".repeat(4 - pad);
    const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

/** Web Crypto HMAC-SHA256 (works in Edge and Node). */
async function signAsync(payload: string): Promise<string> {
  ensureProductionSecret();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return encodeBase64Url(new Uint8Array(sig));
}

export async function createSession(session: Session): Promise<string> {
  if (session.role === "admin") {
    return "1";
  }
  const payload = JSON.stringify({
    role: "fielder",
    fielderName: session.fielderName,
  });
  const encoded = encodeBase64Url(new TextEncoder().encode(payload));
  const sig = await signAsync(encoded);
  return `${encoded}.${sig}`;
}

export async function verifySession(
  token: string | undefined | null,
): Promise<Session | null> {
  if (!token) return null;
  if (token === "1") return { role: "admin" };
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expectedSig = await signAsync(encoded);
  if (!constantTimeCompare(sig, expectedSig)) return null;
  const raw = decodeBase64Url(encoded);
  if (!raw) return null;
  try {
    const str = new TextDecoder().decode(raw);
    const parsed = JSON.parse(str) as Record<string, unknown>;
    if (parsed && parsed.role === "fielder" && typeof parsed.fielderName === "string") {
      return { role: "fielder", fielderName: parsed.fielderName };
    }
  } catch {
    // ignore
  }
  return null;
}

/** Use in server components to get current session from cookies. */
export async function getSession(): Promise<Session | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const token = store.get(sessionCookieName)?.value;
  return verifySession(token);
}

/** Use in API route handlers to get session from the request cookie. */
export async function getSessionFromRequest(request: Request): Promise<Session | null> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${sessionCookieName}=([^;]+)`));
  const token = match?.[1];
  return verifySession(token ?? null);
}

/** For audit log: who performed the action. */
export function getAuditActor(session: Session): { actorType: "admin" | "fielder"; actorName: string } {
  if (session.role === "admin") {
    return { actorType: "admin", actorName: process.env.ADMIN_EMAIL ?? "Admin" };
  }
  return { actorType: "fielder", actorName: session.fielderName };
}
