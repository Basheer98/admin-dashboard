import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE_NAME = "admin_session";

export const sessionCookieName = SESSION_COOKIE_NAME;

export type SessionAdmin = { role: "admin" };
export type SessionFielder = { role: "fielder"; fielderName: string };
export type Session = SessionAdmin | SessionFielder;

const SESSION_SECRET =
  process.env.SESSION_SECRET || process.env.AUTH_SECRET || "dev-secret-change-in-production";

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromBase64Url(str: string): Buffer | null {
  try {
    return Buffer.from(str, "base64url");
  } catch {
    return null;
  }
}

function sign(payload: string): string {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

export async function createSession(session: Session): Promise<string> {
  if (session.role === "admin") {
    return "1";
  }
  const payload = JSON.stringify({
    role: "fielder",
    fielderName: session.fielderName,
  });
  const encoded = toBase64Url(Buffer.from(payload, "utf8"));
  const sig = sign(encoded);
  return `${encoded}.${sig}`;
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
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
  const expectedSig = sign(encoded);
  if (!safeCompare(sig, expectedSig)) return null;
  const raw = fromBase64Url(encoded);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
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
